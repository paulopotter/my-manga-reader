package com.mymangareader.notifications.plugins.ntfy

import android.util.Log
import com.mymangareader.notifications.plugins.ConnectionState
import com.mymangareader.notifications.plugins.NotificationPlugin
import com.mymangareader.notifications.plugins.NotificationPluginRegistration
import com.mymangareader.notifications.plugins.NotificationUrl
import com.mymangareader.notifications.plugins.RawNotificationEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.ConnectionPool
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import kotlin.math.pow

private val json = Json { ignoreUnknownKeys = true }

private const val INITIAL_BACKOFF_MS = 1_000L
private const val MAX_BACKOFF_MS = 30_000L
private const val TAG = "NtfyPlugin"

/**
 * Real ntfy WebSocket client — the only file (besides [NtfyPayload]) allowed to know ntfy's wire
 * protocol. Connects to `{url}/{topic}/ws` (ntfy's documented WebSocket endpoint) and decodes
 * every frame in two layers: first [NtfyEnvelope] (ntfy's own wrapper — `event`/`message`, where
 * `message` is itself a JSON string, not an embedded object), then, only for `event == "message"`,
 * this app's own payload contract (a JSON array of [NtfyEventDto]) out of that string.
 *
 * A dedicated [OkHttpClient] (own [Dispatcher]/[ConnectionPool]) — never shared with any HTTP
 * client elsewhere in the app, so opening/closing this long-lived socket never starves or
 * interferes with unrelated short-lived requests' connection pool.
 *
 * Reconnection-with-backoff is entirely internal (see [NotificationPlugin.connect]'s own doc):
 * a dropped connection (non-intentional [WebSocketListener.onClosed]/[WebSocketListener.onFailure])
 * schedules a reconnect attempt at an exponentially increasing delay (capped at [MAX_BACKOFF_MS]),
 * reset back to [INITIAL_BACKOFF_MS] on the next successful [WebSocketListener.onOpen]. A caller
 * that wants to stop for good must call [disconnect] — that is the only thing that sets
 * `intentionalClose`, which suppresses any further reconnect attempt.
 */
class NtfyPlugin : NotificationPlugin {
    private val client =
        OkHttpClient
            .Builder()
            .dispatcher(Dispatcher())
            .connectionPool(ConnectionPool())
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()

    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val _events = MutableSharedFlow<RawNotificationEvent>(extraBufferCapacity = 16)
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)

    private var socket: WebSocket? = null
    private var reconnectAttempts = 0
    private var intentionalClose = false
    private var currentUrl: NotificationUrl? = null

    override val events: Flow<RawNotificationEvent> = _events

    override val connectionState: StateFlow<ConnectionState> = _connectionState

    override suspend fun connect(url: NotificationUrl): Result<Unit> {
        Log.d(TAG, "connect() — topic=${url.topic} url=${url.url}")
        intentionalClose = false
        currentUrl = url
        reconnectAttempts = 0
        return runCatching { openSocket(url) }
            .onFailure { Log.e(TAG, "connect() failed to open socket — topic=${url.topic}", it) }
    }

    override suspend fun disconnect() {
        Log.d(TAG, "disconnect() — intentional close, topic=${currentUrl?.topic}")
        intentionalClose = true
        // cancel(), not close() — an intentional stop should tear the connection down right away
        // rather than wait for the server's own close handshake, which the caller (about to stop
        // the whole foreground service, Task 006) has no reason to wait on.
        socket?.cancel()
        socket = null
        currentUrl = null
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    private fun openSocket(url: NotificationUrl) {
        _connectionState.value = ConnectionState.CONNECTING
        val wsUrl = buildWebSocketUrl(url)
        Log.d(TAG, "openSocket() — connecting to $wsUrl")
        val request = Request.Builder().url(wsUrl).build()
        socket = client.newWebSocket(request, Listener())
    }

    private fun scheduleReconnect() {
        if (intentionalClose) return
        val url = currentUrl ?: return
        val delayMs = ntfyReconnectDelayMs(reconnectAttempts)
        reconnectAttempts++
        Log.d(TAG, "scheduleReconnect() — attempt=$reconnectAttempts delayMs=$delayMs topic=${url.topic}")
        scope.launch {
            delay(delayMs)
            if (!intentionalClose) openSocket(url)
        }
    }

    private inner class Listener : WebSocketListener() {
        override fun onOpen(
            webSocket: WebSocket,
            response: Response,
        ) {
            Log.i(TAG, "onOpen() — connected, topic=${currentUrl?.topic}")
            reconnectAttempts = 0
            _connectionState.value = ConnectionState.CONNECTED
        }

        override fun onMessage(
            webSocket: WebSocket,
            text: String,
        ) {
            Log.d(TAG, "onMessage() — frame received (${text.length} chars): $text")
            scope.launch { handleFrame(text) }
        }

        override fun onFailure(
            webSocket: WebSocket,
            t: Throwable,
            response: Response?,
        ) {
            Log.w(TAG, "onFailure() — connection failed, topic=${currentUrl?.topic}", t)
            _connectionState.value = ConnectionState.DISCONNECTED
            scheduleReconnect()
        }

        override fun onClosed(
            webSocket: WebSocket,
            code: Int,
            reason: String,
        ) {
            Log.d(TAG, "onClosed() — code=$code reason=$reason intentional=$intentionalClose")
            _connectionState.value = ConnectionState.DISCONNECTED
            if (!intentionalClose) scheduleReconnect()
        }
    }

    private suspend fun handleFrame(text: String) {
        val envelope = runCatching { json.decodeFromString<NtfyEnvelope>(text) }.getOrNull()
        if (envelope == null) {
            Log.w(TAG, "handleFrame() — could not decode ntfy envelope, discarding frame")
            return
        }
        if (envelope.event != "message" || envelope.message.isBlank()) {
            Log.d(TAG, "handleFrame() — ignoring non-message frame (event=${envelope.event})")
            return
        }

        val decoded = decodeNtfyEvents(json, envelope.message)
        if (decoded.isEmpty()) {
            Log.w(TAG, "handleFrame() — message frame decoded to 0 events, payload may be malformed: ${envelope.message}")
            return
        }
        Log.i(TAG, "handleFrame() — decoded ${decoded.size} event(s) from message frame")
        decoded.forEach {
            Log.d(
                TAG,
                "handleFrame() — event: seriesId=${it.seriesId} slug=${it.slug} seriesName=${it.seriesName} " +
                    "chapterIds=${it.chapterIds} chapterNumbers=${it.chapterNumbers}",
            )
            _events.emit(it.toRawNotificationEvent())
        }
    }

    companion object Info : NotificationPluginRegistration {
        override val id: String = "ntfy"
        override val displayName: String = "ntfy"
        override val version: String = "1.0"
        override val factory: () -> NotificationPlugin = { NtfyPlugin() }
    }
}

// The exponential term stays a Double until AFTER it is compared with the cap: converting it to Long
// first and multiplying by INITIAL_BACKOFF_MS overflowed from attempt 54 on (a negative delay =
// reconnecting with no pause at all — thousands of sockets per hour during a long outage).
internal fun ntfyReconnectDelayMs(attempt: Int): Long {
    val exponentialMs = INITIAL_BACKOFF_MS * 2.0.pow(attempt)
    return if (exponentialMs >= MAX_BACKOFF_MS) MAX_BACKOFF_MS else exponentialMs.toLong()
}

private fun buildWebSocketUrl(url: NotificationUrl): String {
    val base = url.url.trimEnd('/')
    val scheme = if (base.startsWith("https://")) "wss://" else "ws://"
    val hostAndPath = base.substringAfter("://")
    return "$scheme$hostAndPath/${url.topic}/ws"
}
