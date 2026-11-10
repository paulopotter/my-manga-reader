package com.mymangareader.tools.diagnostics

import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

/**
 * The structured side of the diagnostics: one [MetricsSample] per line in `app-metrics.jsonl`, next
 * to the human-readable `app-diagnostics.log`. A file, not a Room table, on purpose — a bug in the
 * metrics can never touch the app's database, and `adb pull` reads it on any build.
 *
 * Two generations, each capped at [maxBytes] (a sample is ~300 bytes, so the default keeps roughly
 * two weeks at one sample every 5 minutes). Every call is guarded: metrics must never be the reason
 * the app misbehaves.
 */
object MetricsLog {
    const val FILE_NAME = "app-metrics.jsonl"
    const val PREVIOUS_FILE_NAME = "app-metrics.1.jsonl"
    const val DEFAULT_MAX_BYTES = 512L * 1024

    private val lock = Any()
    private var directory: File? = null
    private var maxBytes: Long = DEFAULT_MAX_BYTES
    private var writer: BufferedWriter? = null
    private var written: Long = 0

    fun init(
        directory: File,
        maxBytes: Long = DEFAULT_MAX_BYTES,
    ) = synchronized(lock) {
        closeWriter()
        directory.mkdirs()
        this.directory = directory
        this.maxBytes = maxBytes
        written = File(directory, FILE_NAME).takeIf { it.exists() }?.length() ?: 0
    }

    /** No-op before [init]; never throws. */
    fun record(sample: MetricsSample) {
        runCatching { append(sample.toJsonLine()) }
    }

    /** Previous generation first, then the current one: the order the lines were written in. */
    fun readAll(): String =
        synchronized(lock) {
            val dir = directory ?: return ""
            writer?.flush()
            listOf(PREVIOUS_FILE_NAME, FILE_NAME)
                .map { File(dir, it) }
                .filter { it.exists() }
                .joinToString("") { it.readText() }
        }

    fun sizeBytes(): Long =
        synchronized(lock) {
            val dir = directory ?: return 0
            writer?.flush()
            listOf(PREVIOUS_FILE_NAME, FILE_NAME).sumOf { File(dir, it).takeIf { f -> f.exists() }?.length() ?: 0 }
        }

    fun clear() =
        synchronized(lock) {
            closeWriter()
            val dir = directory ?: return@synchronized
            listOf(PREVIOUS_FILE_NAME, FILE_NAME).forEach { File(dir, it).delete() }
            written = 0
        }

    private fun append(line: String) {
        synchronized(lock) {
            val dir = directory ?: return
            val text = line.trimEnd('\n') + "\n"
            val bytes = text.toByteArray(Charsets.UTF_8).size
            if (written + bytes > maxBytes) rotate(dir)
            val out = writer ?: BufferedWriter(FileWriter(File(dir, FILE_NAME), true)).also { writer = it }
            out.write(text)
            out.flush()
            written += bytes
        }
    }

    private fun rotate(dir: File) {
        closeWriter()
        val previous = File(dir, PREVIOUS_FILE_NAME)
        previous.delete()
        File(dir, FILE_NAME).renameTo(previous)
        written = 0
    }

    private fun closeWriter() {
        runCatching { writer?.close() }
        writer = null
    }
}
