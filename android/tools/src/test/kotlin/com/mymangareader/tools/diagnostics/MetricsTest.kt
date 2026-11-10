package com.mymangareader.tools.diagnostics

import android.content.Context
import android.os.BatteryManager
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class MetricsTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun sample(
        ts: Long = 1,
        battery: Int? = 80,
        charging: Boolean? = false,
        trigger: String = "periodic",
    ) = MetricsSample(
        timestampMs = ts,
        trigger = trigger,
        pid = 42,
        uptimeMs = 1_000,
        foreground = true,
        screenOn = true,
        notificationService = true,
        batteryPercent = battery,
        charging = charging,
        batteryTempDeci = 310,
        powerSave = false,
        cpuMs = 500,
        javaUsedBytes = 10,
        javaMaxBytes = 20,
        nativeBytes = 30,
        pssKb = 40,
        threads = 7,
    )

    @Test
    fun `a sample is one JSON line with every figure`() {
        val line = sample().toJsonLine()

        assertFalse(line.contains('\n'))
        assertTrue(line.startsWith("{") && line.endsWith("}"))
        assertTrue(line.contains("\"batteryPercent\":80"))
        assertTrue(line.contains("\"charging\":false"))
        assertTrue(line.contains("\"pssKb\":40"))
        assertTrue(line.contains("\"foreground\":true"))
    }

    @Test
    fun `an unreadable battery is written as null, not as a made-up number`() {
        val line = sample(battery = null, charging = null).toJsonLine()

        assertTrue(line.contains("\"batteryPercent\":null"))
        assertTrue(line.contains("\"charging\":null"))
    }

    @Test
    fun `the trigger cannot break the JSON`() {
        assertTrue(sample(trigger = "a\"b\n").toJsonLine().contains("\"trigger\":\"ab\""))
    }

    @Test
    fun `battery reading handles charging, discharging and unknown`() {
        assertEquals(50, readBattery(50, 100, BatteryManager.BATTERY_STATUS_DISCHARGING, 300).percent)
        assertEquals(true, readBattery(50, 100, BatteryManager.BATTERY_STATUS_CHARGING, 300).charging)
        assertEquals(true, readBattery(100, 100, BatteryManager.BATTERY_STATUS_FULL, 300).charging)
        assertEquals(false, readBattery(50, 100, BatteryManager.BATTERY_STATUS_NOT_CHARGING, 300).charging)
        assertNull(readBattery(50, 100, BatteryManager.BATTERY_STATUS_UNKNOWN, 300).charging)
        assertNull(readBattery(-1, 100, -1, Int.MIN_VALUE).percent)
        assertNull(readBattery(50, 0, -1, Int.MIN_VALUE).percent)
        assertNull(readBattery(50, 100, -1, Int.MIN_VALUE).tempDeci)
    }

    @Test
    fun `thread count is read from the status text`() {
        assertEquals(31, parseThreadCount("Name:\tapp\nThreads:\t31\nVmRSS:\t100 kB\n"))
        assertEquals(0, parseThreadCount("Name:\tapp\n"))
    }

    @Test
    fun `the collector reads the live figures and carries the app state through`() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        val result = MetricsCollector.collect(context, "start", AppState(foreground = true, notificationService = false), nowMs = 123)

        assertEquals(123, result.timestampMs)
        assertEquals("start", result.trigger)
        assertTrue(result.foreground)
        assertFalse(result.notificationService)
        assertTrue(result.javaMaxBytes > 0)
        assertNotNull(result.pid)
    }

    @Test
    fun `the log appends lines and reads them back in order`() {
        MetricsLog.init(tmp.root)
        MetricsLog.record(sample(ts = 1))
        MetricsLog.record(sample(ts = 2))

        val lines = MetricsLog.readAll().trim().lines()
        assertEquals(2, lines.size)
        assertTrue(lines[0].contains("\"ts\":1,"))
        assertTrue(lines[1].contains("\"ts\":2,"))
        assertTrue(MetricsLog.sizeBytes() > 0)
    }

    @Test
    fun `the log rotates at the cap and keeps one previous generation`() {
        MetricsLog.init(tmp.root, maxBytes = 700)
        repeat(8) { MetricsLog.record(sample(ts = it.toLong())) }

        assertTrue(File(tmp.root, MetricsLog.PREVIOUS_FILE_NAME).exists())
        assertTrue(File(tmp.root, MetricsLog.FILE_NAME).length() <= 700)
        // Oldest generation first, newest last, nothing duplicated.
        val stamps = MetricsLog.readAll().trim().lines().map { Regex("\"ts\":(\\d+)").find(it)!!.groupValues[1].toInt() }
        assertEquals(stamps.sorted(), stamps)
        assertEquals(7, stamps.last())
    }

    @Test
    fun `clear empties both generations`() {
        MetricsLog.init(tmp.root, maxBytes = 700)
        repeat(8) { MetricsLog.record(sample(ts = it.toLong())) }

        MetricsLog.clear()

        assertEquals("", MetricsLog.readAll())
        assertEquals(0, MetricsLog.sizeBytes())
    }

    @Test
    fun `a write that fails is swallowed, never thrown into the app`() {
        MetricsLog.init(tmp.root)
        // The directory vanishing under the log makes the real write fail; record() must absorb it.
        tmp.root.deleteRecursively()
        MetricsLog.record(sample())
    }
}
