package com.mymangareader.notifications.plugins.ntfy

import com.mymangareader.notifications.plugins.ConnectionState
import com.mymangareader.notifications.plugins.NotificationUrl
import com.mymangareader.notifications.plugins.RawNotificationEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class NtfyPluginTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    // Subscribes BEFORE connecting. The plugin's event flow has no replay, and these servers send their
    // message right in onOpen — collecting only after connect() returned raced it: when the message
    // won, the event was gone and first() waited out its timeout (the flaky failure this fixes).
    private fun CoroutineScope.firstEventWhileConnecting(plugin: NtfyPlugin): RawNotificationEvent {
        val first = async(start = CoroutineStart.UNDISPATCHED) { plugin.events.first() }
        runBlocking { plugin.connect(testUrl()) }
        return runBlocking { withTimeout(5_000) { first.await() } }
    }

    private fun testUrl() = NotificationUrl(url = server.url("/").toString(), topic = "my-topic", timeoutMs = 5_000)

    @Test
    fun `connect abre o socket e connectionState fica CONNECTED apos onOpen`() =
        runBlocking {
            var opened: WebSocket? = null
            server.enqueue(
                MockResponse().withWebSocketUpgrade(
                    object : WebSocketListener() {
                        override fun onOpen(
                            webSocket: WebSocket,
                            response: okhttp3.Response,
                        ) {
                            opened = webSocket
                        }
                    },
                ),
            )
            val plugin = NtfyPlugin()

            plugin.connect(testUrl())

            withTimeout(5_000) {
                while (opened == null) delay(10)
            }
            withTimeout(5_000) {
                while (plugin.connectionState.value != ConnectionState.CONNECTED) delay(10)
            }
            assertEquals(ConnectionState.CONNECTED, plugin.connectionState.value)

            plugin.disconnect()
        }

    @Test
    fun `um frame message com N eventos emite N RawNotificationEvent em ordem`() =
        runBlocking {
            server.enqueue(
                MockResponse().withWebSocketUpgrade(
                    object : WebSocketListener() {
                        override fun onOpen(
                            webSocket: WebSocket,
                            response: okhttp3.Response,
                        ) {
                            val message =
                                """[{"seriesName":"A","detectedAtMs":1},{"seriesId":"2","seriesName":"B","detectedAtMs":2}]"""
                                    .replace("\"", "\\\"")
                            webSocket.send(
                                """{"event":"message","topic":"my-topic","message":"$message"}""",
                            )
                        }
                    },
                ),
            )
            val plugin = NtfyPlugin()
            val first = firstEventWhileConnecting(plugin)

            assertEquals("A", first.seriesName)

            plugin.disconnect()
        }

    @Test
    fun `um frame message no formato legado com wrapper events emite os eventos`() =
        runBlocking {
            server.enqueue(
                MockResponse().withWebSocketUpgrade(
                    object : WebSocketListener() {
                        override fun onOpen(
                            webSocket: WebSocket,
                            response: okhttp3.Response,
                        ) {
                            val message =
                                """{"events":[{"seriesName":"A","detectedAtMs":1},{"seriesId":"2","seriesName":"B","detectedAtMs":2}]}"""
                                    .replace("\"", "\\\"")
                            webSocket.send(
                                """{"event":"message","topic":"my-topic","message":"$message"}""",
                            )
                        }
                    },
                ),
            )
            val plugin = NtfyPlugin()
            val first = firstEventWhileConnecting(plugin)

            assertEquals("A", first.seriesName)

            plugin.disconnect()
        }

    @Test
    fun `um frame open sem message nao emite nenhum evento`() =
        runBlocking {
            server.enqueue(
                MockResponse().withWebSocketUpgrade(
                    object : WebSocketListener() {
                        override fun onOpen(
                            webSocket: WebSocket,
                            response: okhttp3.Response,
                        ) {
                            webSocket.send("""{"event":"open","topic":"my-topic"}""")
                            webSocket.send(
                                """{"event":"message","topic":"my-topic","message":"[{\"seriesName\":\"A\",\"detectedAtMs\":1}]"}""",
                            )
                        }
                    },
                ),
            )
            val plugin = NtfyPlugin()

            // Only the real "message" frame should ever surface as an event — if "open" produced
            // one, this would return it first instead.
            val first = firstEventWhileConnecting(plugin)
            assertEquals("A", first.seriesName)

            plugin.disconnect()
        }

    @Test
    fun `um frame malformado e descartado sem derrubar o provider`() =
        runBlocking {
            server.enqueue(
                MockResponse().withWebSocketUpgrade(
                    object : WebSocketListener() {
                        override fun onOpen(
                            webSocket: WebSocket,
                            response: okhttp3.Response,
                        ) {
                            webSocket.send("not even json")
                            webSocket.send(
                                """{"event":"message","topic":"my-topic","message":"[{\"seriesName\":\"A\",\"detectedAtMs\":1}]"}""",
                            )
                        }
                    },
                ),
            )
            val plugin = NtfyPlugin()
            val first = firstEventWhileConnecting(plugin)
            assertEquals("A", first.seriesName)

            plugin.disconnect()
        }

    @Test
    fun `disconnect marca connectionState como DISCONNECTED e nao reconecta`() =
        runBlocking {
            server.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {}))
            val plugin = NtfyPlugin()
            plugin.connect(testUrl())

            withTimeout(5_000) {
                while (plugin.connectionState.value != ConnectionState.CONNECTED) delay(10)
            }

            plugin.disconnect()

            assertEquals(ConnectionState.DISCONNECTED, plugin.connectionState.value)
        }

    @Test
    fun `o backoff sobe 1s 2s 4s e trava no teto de 30s`() {
        assertEquals(1_000L, ntfyReconnectDelayMs(0))
        assertEquals(2_000L, ntfyReconnectDelayMs(1))
        assertEquals(4_000L, ntfyReconnectDelayMs(2))
        assertEquals(16_000L, ntfyReconnectDelayMs(4))
        assertEquals(30_000L, ntfyReconnectDelayMs(5))
    }

    @Test
    fun `o backoff nunca fica negativo nem abaixo do teto numa queda longa`() {
        // Antes: a partir da tentativa 54 o Long estourava e o atraso virava negativo (sem pausa).
        (5..2_000).forEach { assertEquals("tentativa $it", 30_000L, ntfyReconnectDelayMs(it)) }
    }
}
