package com.mymangareader.tools.diagnostics

/**
 * One reading of how much the app is costing the phone — memory, CPU, battery and the state the app
 * was in while it happened (screen on, foreground, notification service running). The state matters
 * as much as the numbers: 500 MB while reading is expected, the same 500 MB hours after the app was
 * closed is the thing worth chasing.
 *
 * Plain numbers only, so a line can be parsed by anything (the `make metrics` report is Python).
 */
data class MetricsSample(
    val timestampMs: Long,
    /** Why it was taken: `start`, `periodic`, `trim`, `crash`. */
    val trigger: String,
    val pid: Int,
    /** Milliseconds since this process started. A drop between two samples = a restart. */
    val uptimeMs: Long,
    val foreground: Boolean,
    val screenOn: Boolean,
    val notificationService: Boolean,
    /** 0..100, or null when the battery could not be read. */
    val batteryPercent: Int?,
    val charging: Boolean?,
    /** Tenths of a degree Celsius (as Android reports it), or null. */
    val batteryTempDeci: Int?,
    val powerSave: Boolean,
    /** CPU time this process has used since it started, in ms. Deltas give the CPU share. */
    val cpuMs: Long,
    val javaUsedBytes: Long,
    val javaMaxBytes: Long,
    val nativeBytes: Long,
    val pssKb: Long,
    val threads: Int,
)

/** The sample as one JSON object on one line (JSON Lines). Hand-built: nothing here needs escaping. */
fun MetricsSample.toJsonLine(): String =
    buildString {
        append('{')
        append("\"ts\":$timestampMs,")
        append("\"trigger\":\"${trigger.filter { it.isLetterOrDigit() || it == '_' }}\",")
        append("\"pid\":$pid,")
        append("\"uptimeMs\":$uptimeMs,")
        append("\"foreground\":$foreground,")
        append("\"screenOn\":$screenOn,")
        append("\"notificationService\":$notificationService,")
        append("\"batteryPercent\":${batteryPercent ?: "null"},")
        append("\"charging\":${charging ?: "null"},")
        append("\"batteryTempDeci\":${batteryTempDeci ?: "null"},")
        append("\"powerSave\":$powerSave,")
        append("\"cpuMs\":$cpuMs,")
        append("\"javaUsedBytes\":$javaUsedBytes,")
        append("\"javaMaxBytes\":$javaMaxBytes,")
        append("\"nativeBytes\":$nativeBytes,")
        append("\"pssKb\":$pssKb,")
        append("\"threads\":$threads")
        append('}')
    }
