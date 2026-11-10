package com.mymangareader

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.mymangareader.cache.Cache
import com.mymangareader.core.database.ChapterCacheDao
import com.mymangareader.core.database.DbStatusProvider
import com.mymangareader.contentdigest.retention.CacheRetention
import com.mymangareader.core.database.CacheRetentionDao
import com.mymangareader.core.database.FollowedSeriesDao
import com.mymangareader.core.database.ServerConfigDao
import com.mymangareader.externalmetadataserver.ExternalMetadataServer
import com.mymangareader.features.bff.BffFeature
import com.mymangareader.features.kavita.ActiveUrlWatcher
import com.mymangareader.features.kavita.KavitaAuthFeature
import com.mymangareader.features.kavita.KavitaUrlSource
import com.mymangareader.features.kavita.chapter.ChapterDataSource
import com.mymangareader.features.kavita.chapter.KavitaChapterFeature
import com.mymangareader.features.kavita.reader.ui.ReaderDebugFlags
import com.mymangareader.features.kavita.reader.ui.SafeBitmapDecoder
import com.mymangareader.features.kavita.series.KavitaSeriesFeature
import com.mymangareader.notifications.NotificationConnectionGate
import com.mymangareader.notifications.NotificationGroupResolver
import com.mymangareader.notifications.NotificationRetentionPurge
import com.mymangareader.notifications.Notifications
import com.mymangareader.preferences.Preferences
import com.mymangareader.server.Server
import com.mymangareader.tools.bridge.ConfigStore
import com.mymangareader.tools.ota.OtaCheckResult
import com.mymangareader.tools.ota.OtaDecision
import com.mymangareader.tools.ota.OtaManager
import com.mymangareader.tools.ota.OtaStore
import dagger.hilt.android.HiltAndroidApp
import com.mymangareader.tools.diagnostics.DiagnosticLog
import com.mymangareader.tools.diagnostics.LogcatCapture
import com.mymangareader.tools.diagnostics.ProcessExits
import com.mymangareader.tools.diagnostics.describeMemory
import com.mymangareader.tools.network.redactApiKey
import com.mymangareader.tools.network.stableImageCacheKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class MainApplication :
    Application(),
    ReactApplication,
    ImageLoaderFactory {
    @Inject lateinit var configStore: ConfigStore

    @Inject lateinit var dbStatus: DbStatusProvider

    @Inject lateinit var otaStore: OtaStore

    @Inject lateinit var otaManager: OtaManager

    @Inject lateinit var crashGuard: CrashGuard

    @Inject lateinit var kavitaUrlSource: KavitaUrlSource

    @Inject lateinit var kavitaAuthFeature: KavitaAuthFeature

    @Inject lateinit var kavitaSeriesFeature: KavitaSeriesFeature

    @Inject lateinit var kavitaChapterFeature: KavitaChapterFeature

    // Typed as the interface (not KavitaChapterFeature) so ReaderChapterModule's provider stays
    // swappable without touching this wiring — see ChapterDataSource's doc for the rationale.
    @Inject lateinit var chapterDataSource: ChapterDataSource

    @Inject lateinit var bffFeature: BffFeature

    @Inject lateinit var followedSeriesDao: FollowedSeriesDao

    @Inject lateinit var serverConfigDao: ServerConfigDao

    @Inject lateinit var chapterCacheDao: ChapterCacheDao

    @Inject lateinit var activeUrlWatcher: ActiveUrlWatcher

    @Inject lateinit var server: Server

    @Inject lateinit var externalMetadataServer: ExternalMetadataServer

    @Inject lateinit var cache: Cache

    @Inject lateinit var preferences: Preferences

    @Inject lateinit var notificationChannelSync: NotificationChannelSync

    @Inject lateinit var notifications: Notifications

    @Inject lateinit var notificationConnectionGate: NotificationConnectionGate

    @Inject lateinit var notificationGroupResolver: NotificationGroupResolver

    @Inject lateinit var notificationRetentionPurge: NotificationRetentionPurge

    @Inject lateinit var cacheRetentionDao: CacheRetentionDao

    override val reactNativeHost: ReactNativeHost by lazy {
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages +
                    AppReactPackage(
                        configStore = configStore,
                        dbStatus = dbStatus,
                        otaStore = otaStore,
                        kavitaUrlSource = kavitaUrlSource,
                        kavitaAuthFeature = kavitaAuthFeature,
                        kavitaSeriesFeature = kavitaSeriesFeature,
                        kavitaChapterFeature = kavitaChapterFeature,
                        chapterDataSource = chapterDataSource,
                        bffFeature = bffFeature,
                        followedSeriesDao = followedSeriesDao,
                        serverConfigDao = serverConfigDao,
                        chapterCacheDao = chapterCacheDao,
                        activeUrlWatcher = activeUrlWatcher,
                        server = server,
                        externalMetadataServer = externalMetadataServer,
                        cache = cache,
                        preferences = preferences,
                        notifications = notifications,
                        notificationChannelSync = notificationChannelSync,
                        notificationConnectionGate = notificationConnectionGate,
                        notificationGroupResolver = notificationGroupResolver,
                    )

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = false

            override val isNewArchEnabled: Boolean = false
            override val isHermesEnabled: Boolean = true

            override fun getJSBundleFile(): String? = otaStore.bundleFile.takeIf { it.exists() }?.absolutePath
        }
    }

    override val reactHost: ReactHost? = null

    // Lives as long as the process, independent of any Activity: the OTA gate (check + background
    // download) and the "boot stayed up 5s" stable-boot timer run here. There is no SplashActivity
    // anymore — MainActivity is the launcher and just observes `bootGate` below to know when to let
    // the system splash go (and whether to block on `required`).
    val applicationScope: CoroutineScope by lazy {
        CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }

    private val _bootGate = MutableStateFlow<OtaDecision?>(null)

    // null until check() resolves. MainActivity keeps the system splash on screen while this is
    // null, then acts on the decision (block for Blocked, fire the background download for
    // DownloadPending, otherwise just proceed).
    val bootGate: StateFlow<OtaDecision?> = _bootGate.asStateFlow()

    override fun onCreate() {
        super.onCreate()
        startDiagnostics()
        ReaderDebugFlags.d("CoilDiagnostic") { "app version=${BuildConfig.KOTLIN_VERSION_NAME}" }
        otaManager.discardStaleBundleIfNeeded()
        otaManager.applyRollbackIfNeeded()
        otaManager.recordBootStart()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            DefaultNewArchitectureEntryPoint.load()
        }
        crashGuard.install()
        AppForegroundState.register()
        notificationChannelSync.ensureChannelsCreated()

        applicationScope.launch {
            _bootGate.value = otaManager.check()
        }
        applicationScope.launch {
            delay(STABLE_BOOT_DELAY_MS)
            otaManager.recordStableBoot()
        }
        applicationScope.launch {
            notificationRetentionPurge.purge()
        }
        // Re-applies the page-size budget picked in the debug menu (see ReaderFlagsBridgeModule).
        applicationScope.launch {
            runCatching {
                preferences.get(ReaderFlagsBridgeModule.PAGE_BUDGET_PREF_KEY)?.let { stored ->
                    ReaderDebugFlags.parsePageBudgetMb(stored.value)?.let { ReaderDebugFlags.pageBudgetMb = it }
                }
            }
        }
        // Drops digests (and the page images they point to) nobody has read recently: a day for a
        // series that is not followed, three days for a followed one. A short delay keeps the
        // sweep's database work out of the way of the boot itself.
        applicationScope.launch {
            delay(CACHE_SWEEP_DELAY_MS)
            runCatching {
                val imageCache = coil.Coil.imageLoader(this@MainApplication).diskCache
                val result =
                    CacheRetention(cacheRetentionDao, followedSeriesDao) { url ->
                        // The image is cached under the host-free key; an older install may still hold
                        // it under the full URL it was keyed by before.
                        imageCache?.remove(stableImageCacheKey(url))
                        imageCache?.remove(url)
                    }.sweep()
                android.util.Log.i("CacheRetention", "sweep done: $result")
            }.onFailure { android.util.Log.w("CacheRetention", "sweep failed", it) }
        }
        // NotificationsBridgeModule only re-evaluates start/stop as a side effect of an RN-side
        // config write (add/edit/remove group or URL, toggle the channel) — nothing else ever
        // (re)starts the foreground service. Without this, a device that already had a group/URL
        // configured from a previous session never reconnects on a fresh app launch: the service
        // simply never runs until the user touches notification config again.
        applicationScope.launch {
            if (notificationConnectionGate.shouldConnect() && !NotificationConnectionService.tryStart(this@MainApplication)) {
                // Refused because the process is still in the background: connect once it is not.
                AppForegroundState.isForeground.first { it }
                if (notificationConnectionGate.shouldConnect()) NotificationConnectionService.tryStart(this@MainApplication)
            }
        }
    }

    // A local file for troubles that nobody is watching logcat for (a rare crash with the app closed):
    // uncaught exceptions, the app's own warnings/errors, why the previous process ended, and a
    // memory sample every few minutes. Started first so even a crash during boot is recorded.
    private fun startDiagnostics() {
        // Never allowed to get in the way of the app itself: no storage, no log, nothing else changes.
        runCatching { startDiagnosticsUnsafe() }
    }

    private fun startDiagnosticsUnsafe() {
        val directory = diagnosticsDirectory(this)
        DiagnosticLog.init(directory)
        DiagnosticLog.event(
            "App",
            "start version=${BuildConfig.KOTLIN_VERSION_NAME} pid=${android.os.Process.myPid()} " +
                "sdk=${android.os.Build.VERSION.SDK_INT} device=${android.os.Build.MODEL} ${describeMemory()}",
        )
        LogcatCapture.start()
        AppMetrics.init(this)
        AppMetrics.record("start")
        applicationScope.launch { ProcessExits.recordPrevious(this@MainApplication, directory) }
        applicationScope.launch {
            while (true) {
                delay(MEMORY_SAMPLE_INTERVAL_MS)
                DiagnosticLog.event("Memory", describeMemory())
                AppMetrics.record("periodic")
            }
        }
    }

    // The notification foreground service keeps this process alive after the user closes the app, so
    // the decoded reader pages Coil holds in memory (full-resolution ARGB_8888, tens of MB each)
    // would otherwise stay resident with no screen to show them. Drop them as soon as the UI is
    // hidden — the disk cache still serves them without a re-download.
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        DiagnosticLog.event("Memory", "onTrimMemory level=$level ${describeMemory()}")
        AppMetrics.record("trim")
        if (level >= TRIM_MEMORY_UI_HIDDEN) {
            coil.Coil.imageLoader(this).memoryCache?.clear()
        }
    }

    // Runs the OTA bundle download for a resolved DownloadPending, mirroring progress to the RN
    // side through OtaEventBridge. Fire-and-forget on applicationScope — the boot never waits on it.
    fun startOtaDownload(decision: OtaDecision.DownloadPending) {
        OtaEventBridge.markDownloadStarted()
        applicationScope.launch {
            val progressJob =
                launch {
                    otaManager.downloadProgress.collect {
                        OtaEventBridge.notifyDownloadProgress("downloading", it)
                    }
                }
            val result =
                try {
                    otaManager.download(decision.manifest)
                } finally {
                    progressJob.cancel()
                }
            when (result) {
                is OtaCheckResult.Updated -> {
                    OtaEventBridge.notifyDownloadProgress("ready", 1f)
                    OtaEventBridge.notifyBundleReady()
                }
                else -> OtaEventBridge.notifyDownloadProgress("failed", -1f)
            }
        }
    }

    // Registers SafeBitmapDecoder globally so every Coil request (reader pages included) decodes
    // very tall images in tiles via BitmapRegionDecoder instead of asking BitmapFactory to decode
    // the raw resolution in one shot — see SafeBitmapDecoder for why that matters on-device.
    override fun newImageLoader(): ImageLoader =
        ImageLoader
            .Builder(this)
            .components { add(SafeBitmapDecoder.Factory()) }
            // Coil's default in-memory cache has no size floor tied to this app's content: reader
            // pages are decoded at their original resolution (SafeBitmapDecoder never downsamples —
            // see its own doc on why: downsampling breaks AVIF decode on some devices), so a manga/
            // webtoon page can be tens of MB as a raw ARGB_8888 bitmap. Left at Coil's own default
            // (~25% of available app memory, sized with no awareness of that), a few pages held by
            // the preloader's window are enough to push the process's total RAM well past what a
            // reader app should need. An explicit, smaller ceiling caps how much of that decoded
            // pixel data stays memory-resident — pages beyond it fall back to a disk-cache hit
            // (cheap: no re-download) instead of a second full decode.
            .memoryCache {
                MemoryCache
                    .Builder(this)
                    .maxSizeBytes(READER_MEMORY_CACHE_BYTES)
                    .build()
            }
            // Coil's default disk cache is 2% of free disk space, which on a nearly-full device
            // can be too small to hold more than a couple of chapters — pages get evicted and
            // re-downloaded on every reopen even though nothing on the server changed. A manga
            // reader's pages are exactly the kind of content worth a generous, explicit floor.
            .diskCache {
                DiskCache
                    .Builder()
                    .directory(cacheDir.resolve("coil_page_cache"))
                    .maxSizeBytes(READER_DISK_CACHE_MAX_BYTES)
                    .build()
            }
            // Temporary diagnostic: confirms whether a failing request ever reached
            // SafeBitmapDecoder.Factory.create() at all. Remove once the tiled decode is confirmed
            // working.
            .eventListener(
                object : coil.EventListener {
                    override fun onError(
                        request: coil.request.ImageRequest,
                        result: coil.request.ErrorResult,
                    ) {
                        android.util.Log.e(
                            "CoilDiagnostic",
                            "onError url=${redactApiKey(request.data.toString())} throwable=${redactApiKey(result.throwable.toString())}",
                            result.throwable,
                        )
                    }
                },
            ).build()

    companion object {
        private const val READER_DISK_CACHE_MAX_BYTES = 500L * 1024 * 1024
        // An absolute size, not a percentage: 15% of this app's ~256MB memory class was ~38MB, SMALLER
        // than one decoded webtoon page (up to 48MB, see SafeBitmapDecoder.MAX_OUTPUT_BYTES) — and
        // Coil never stores an entry larger than the whole cache. So no page stayed in memory at all:
        // scrolling back re-decoded it (2-5s of black placeholder), seen as the same page decoded 2-3x
        // in on-device logs. Room for three such pages; cleared in onTrimMemory once the UI is hidden.
        private const val READER_MEMORY_CACHE_BYTES = 160 * 1024 * 1024
        private const val STABLE_BOOT_DELAY_MS = 5_000L
        private const val CACHE_SWEEP_DELAY_MS = 8_000L
        private const val MEMORY_SAMPLE_INTERVAL_MS = 5 * 60 * 1000L
    }
}
