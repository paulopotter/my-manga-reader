package com.mymangareader

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.mymangareader.tools.diagnostics.MetricsLog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AppMetricsTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun `a recorded sample carries the trigger and the app state`() {
        AppMetrics.init(context)
        MetricsLog.clear()
        AppForegroundState.observer.onStart(org.mockito.kotlin.mock())

        AppMetrics.record("periodic")

        val lines = MetricsLog.readAll().trim().lines()
        assertEquals(1, lines.size)
        assertTrue(lines[0].contains("\"trigger\":\"periodic\""))
        assertTrue(lines[0].contains("\"foreground\":true"))
    }

    @Test
    fun `recording never throws, even with the log cleared underneath`() {
        AppMetrics.init(context)
        MetricsLog.clear()

        AppMetrics.record("crash")
        AppMetrics.record("trim")

        assertEquals(2, MetricsLog.readAll().trim().lines().size)
    }
}
