package com.mymangareader.tools.diagnostics

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Debug
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import java.io.File

/** What the collector cannot know on its own: the app's own state, handed in by the caller. */
data class AppState(
    val foreground: Boolean,
    val notificationService: Boolean,
)

/** Battery as Android's sticky `ACTION_BATTERY_CHANGED` broadcast reports it. */
internal data class BatteryReading(
    val percent: Int?,
    val charging: Boolean?,
    val tempDeci: Int?,
)

/** Pure: turns the broadcast's extras into a reading. A missing intent or `-1` scale gives nulls. */
internal fun readBattery(
    level: Int,
    scale: Int,
    status: Int,
    tempDeci: Int,
): BatteryReading {
    val percent = if (level >= 0 && scale > 0) level * 100 / scale else null
    val charging =
        when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING, BatteryManager.BATTERY_STATUS_FULL -> true
            BatteryManager.BATTERY_STATUS_UNKNOWN, -1 -> null
            else -> false
        }
    return BatteryReading(percent, charging, tempDeci.takeIf { it != Int.MIN_VALUE })
}

/** Pure: the thread count out of `/proc/self/status` text, or 0. */
internal fun parseThreadCount(statusText: String): Int =
    statusText
        .lineSequence()
        .firstOrNull { it.startsWith("Threads:") }
        ?.substringAfter(':')
        ?.trim()
        ?.toIntOrNull() ?: 0

/** Reads the phone's current figures into a [MetricsSample]. Every source is optional: a failing one becomes null/0. */
object MetricsCollector {
    fun collect(
        context: Context,
        trigger: String,
        state: AppState,
        nowMs: Long = System.currentTimeMillis(),
    ): MetricsSample {
        val runtime = Runtime.getRuntime()
        val battery = runCatching { battery(context) }.getOrDefault(BatteryReading(null, null, null))
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        return MetricsSample(
            timestampMs = nowMs,
            trigger = trigger,
            pid = Process.myPid(),
            uptimeMs = SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime(),
            foreground = state.foreground,
            screenOn = runCatching { power?.isInteractive }.getOrNull() ?: false,
            notificationService = state.notificationService,
            batteryPercent = battery.percent,
            charging = battery.charging,
            batteryTempDeci = battery.tempDeci,
            powerSave = runCatching { power?.isPowerSaveMode }.getOrNull() ?: false,
            cpuMs = Process.getElapsedCpuTime(),
            javaUsedBytes = runtime.totalMemory() - runtime.freeMemory(),
            javaMaxBytes = runtime.maxMemory(),
            nativeBytes = Debug.getNativeHeapAllocatedSize(),
            pssKb = Debug.getPss(),
            threads = runCatching { parseThreadCount(File("/proc/self/status").readText()) }.getOrDefault(0),
        )
    }

    private fun battery(context: Context): BatteryReading {
        // A sticky broadcast: registering a null receiver just returns the last one, no listener is left behind.
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return BatteryReading(null, null, null)
        return readBattery(
            level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1),
            scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1),
            status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1),
            tempDeci = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE),
        )
    }
}
