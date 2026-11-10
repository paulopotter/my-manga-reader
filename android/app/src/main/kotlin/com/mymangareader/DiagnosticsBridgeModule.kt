package com.mymangareader

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.mymangareader.tools.diagnostics.DiagnosticLog
import com.mymangareader.tools.diagnostics.MetricsLog
import java.io.File

// RN→Kotlin bridge for the local diagnostics file (DiagnosticLog): where it is, how big, the adb
// command that reads it, a share sheet to export it, and a way to empty it. Never decides anything
// about what is logged — that is DiagnosticLog's.
class DiagnosticsBridgeModule(
    private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
    override fun getName(): String = "DiagnosticsBridgeModule"

    @ReactMethod
    fun getInfo(promise: Promise) {
        runCatching {
            val directory = diagnosticsDirectory(context)
            Arguments.createMap().apply {
                putString("path", File(directory, DiagnosticLog.FILE_NAME).absolutePath)
                putDouble("sizeBytes", DiagnosticLog.sizeBytes().toDouble())
                putString("adbCommand", adbCommand(context.packageName, directory, diagnosticsAreInternal(context)))
            }
        }.resolveOrReject(promise, "DIAGNOSTICS_INFO_ERROR")
    }

    @ReactMethod
    fun exportLog(promise: Promise) {
        runCatching {
            val directory = diagnosticsDirectory(context)
            // One file with both generations, in the order the lines were written.
            val export = File(directory, EXPORT_FILE_NAME).also { it.writeText(DiagnosticLog.readAll()) }
            val metrics = File(directory, METRICS_EXPORT_FILE_NAME).also { it.writeText(MetricsLog.readAll()) }
            val uris =
                arrayListOf(export, metrics).map { FileProvider.getUriForFile(context, "${context.packageName}.diagnostics", it) }
            val send =
                Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                    type = "text/plain"
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            val chooser = Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
        }.resolveOrReject(promise, "DIAGNOSTICS_EXPORT_ERROR")
    }

    @ReactMethod
    fun clearLog(promise: Promise) {
        runCatching {
            DiagnosticLog.clear()
            MetricsLog.clear()
            File(diagnosticsDirectory(context), EXPORT_FILE_NAME).delete()
            File(diagnosticsDirectory(context), METRICS_EXPORT_FILE_NAME).delete()
            Unit
        }.resolveOrReject(promise, "DIAGNOSTICS_CLEAR_ERROR")
    }

    companion object {
        const val EXPORT_FILE_NAME = "app-diagnostics-export.txt"
        const val METRICS_EXPORT_FILE_NAME = "app-metrics-export.txt"

        // `adb pull` works for the external dir on every build; the private dir needs run-as, which
        // only works on debuggable builds.
        internal fun adbCommand(
            packageName: String,
            directory: File,
            internal: Boolean,
        ): String =
            if (internal) {
                "adb exec-out run-as $packageName cat files/diagnostics/${DiagnosticLog.FILE_NAME}"
            } else {
                "adb pull ${directory.absolutePath.replace("/storage/emulated/0", "/sdcard")}/${DiagnosticLog.FILE_NAME}"
            }
    }
}
