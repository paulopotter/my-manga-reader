package com.mymangareader

import android.content.Context
import com.mymangareader.tools.diagnostics.AppState
import com.mymangareader.tools.diagnostics.MetricsCollector
import com.mymangareader.tools.diagnostics.MetricsLog

/**
 * Takes a [com.mymangareader.tools.diagnostics.MetricsSample] with the app's own state filled in
 * (foreground, notification service) and writes it to [MetricsLog]. The one place that knows both
 * where those states live and the collector, so `MainApplication` and `CrashGuard` just say *when*.
 *
 * Never throws: a metrics failure must not take anything else down, least of all the crash handler.
 */
object AppMetrics {
    @Volatile private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
        MetricsLog.init(diagnosticsDirectory(context))
    }

    fun record(trigger: String) {
        val context = appContext ?: return
        runCatching {
            val state =
                AppState(
                    foreground = AppForegroundState.isForeground.value,
                    notificationService = NotificationConnectionService.status.value != NotificationServiceStatus.STOPPED,
                )
            MetricsLog.record(MetricsCollector.collect(context, trigger, state))
        }
    }
}
