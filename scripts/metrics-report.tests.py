"""Tests for metrics-report.py. Run: python3 scripts/metrics-report.tests.py"""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("metrics_report", HERE / "metrics-report.py")
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)

MIN = 60_000


def sample(minute, battery=80, foreground=False, screen=False, charging=False, pid=1, cpu=0, pss=100 * 1024, trigger="periodic", service=True):
    return {
        "ts": minute * MIN, "trigger": trigger, "pid": pid, "uptimeMs": minute * MIN, "foreground": foreground,
        "screenOn": screen, "notificationService": service, "batteryPercent": battery, "charging": charging,
        "batteryTempDeci": 300, "powerSave": False, "cpuMs": cpu, "javaUsedBytes": 10 * 1048576,
        "javaMaxBytes": 256 * 1048576, "nativeBytes": 50 * 1048576, "pssKb": pss, "threads": 30,
    }


class LoadTests(unittest.TestCase):
    def test_bad_lines_are_skipped_and_samples_sorted(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "m.jsonl"
            path.write_text(json.dumps(sample(2)) + "\n{cut by a crash\n\n" + json.dumps(sample(1)) + "\n")
            rows = report.load_samples(str(path))
        self.assertEqual([r["ts"] for r in rows], [MIN, 2 * MIN])

    def test_missing_file_is_empty(self):
        self.assertEqual(report.load_samples("/no/such/file"), [])

    def test_events_read_exits_and_crash_traces(self):
        text = (
            "2026-11-10 12:00:00.000 [EXIT] previous process ended: reason=LOW_MEMORY status=0\n"
            '2026-11-10 12:05:00.000 [CRASH] uncaught exception on thread "main"\n'
            "java.lang.OutOfMemoryError: Failed to allocate\n"
            "\tat a.b.C.d(C.kt:1)\n"
            "2026-11-10 12:06:00.000 [Memory] javaHeap=1MB/2MB\n"
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "l.log"
            path.write_text(text)
            events = report.load_events(str(path))
        self.assertEqual(events["exits"][0]["reason"], "LOW_MEMORY")
        self.assertEqual(len(events["crashes"]), 1)
        self.assertTrue(events["crashes"][0]["oom"])
        self.assertEqual(len(events["crashes"][0]["trace"]), 2)


class SummaryTests(unittest.TestCase):
    def test_drain_is_computed_per_state_and_only_while_discharging(self):
        # 60 min in the background with the screen off, losing 6 points; then 60 min charging (ignored).
        rows = [sample(0, battery=80), sample(30, battery=77), sample(60, battery=74),
                sample(90, battery=75, charging=True), sample(120, battery=80, charging=True)]
        summary = report.summarize(rows)
        off = summary["buckets"]["background, screen off"]
        self.assertEqual(off["drain_per_hour"], 6.0)

    def test_drain_is_unknown_with_less_than_half_an_hour(self):
        summary = report.summarize([sample(0, battery=80), sample(10, battery=79)])
        self.assertIsNone(summary["buckets"]["background, screen off"]["drain_per_hour"])

    def test_cpu_share_uses_deltas_inside_one_process_only(self):
        rows = [sample(0, cpu=0), sample(10, cpu=60_000), sample(20, pid=2, cpu=5)]
        # first pair: 60 s of CPU in 10 min = 10 %; the pid change must not count as a negative delta
        self.assertEqual(report.summarize(rows)["buckets"]["background, screen off"]["cpu_percent"], 10.0)

    def test_buckets_split_foreground_and_background(self):
        rows = [sample(0, foreground=True, pss=400 * 1024), sample(5, foreground=False, screen=False, pss=200 * 1024)]
        buckets = report.summarize(rows)["buckets"]
        self.assertEqual(buckets["foreground"]["pss_max_mb"], 400)
        self.assertEqual(buckets["background, screen off"]["pss_max_mb"], 200)

    def test_a_long_gap_is_not_counted_as_one_stretch(self):
        summary = report.summarize([sample(0, battery=90), sample(600, battery=10)])
        self.assertEqual(summary["buckets"]["background, screen off"]["hours"], 0)

    def test_restarts_are_counted_from_distinct_pids(self):
        self.assertEqual(report.summarize([sample(0, pid=1), sample(5, pid=2), sample(6, pid=2)])["processes"], 2)

    def test_empty_input(self):
        summary = report.summarize([])
        self.assertEqual(summary["samples"], 0)
        self.assertIn("Nenhuma amostra", report.render_report({**summary, "events": {"exits": [], "crashes": []}, "system_pss_mb": None, "system_battery": []}))


class SystemNumbersTests(unittest.TestCase):
    def test_meminfo_total_pss(self):
        self.assertEqual(report.parse_meminfo("           TOTAL PSS:   204800   TOTAL RSS: 1"), 200)
        self.assertEqual(report.parse_meminfo("          TOTAL   102400   5   6"), 100)
        self.assertIsNone(report.parse_meminfo("nothing"))

    def test_batterystats_uid_lines(self):
        text = "Estimated power use (mAh):\n    Uid u0a123: 5.20 ( cpu=3 wakelock=1 )\n    Uid 1000: 9.0\n"
        self.assertEqual(report.parse_batterystats(text), ["Uid u0a123: 5.20 ( cpu=3 wakelock=1 )"])


class ReportTests(unittest.TestCase):
    def _pull(self, rows, log=""):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        (Path(tmp.name) / "app-metrics.jsonl").write_text("\n".join(json.dumps(r) for r in rows))
        (Path(tmp.name) / "app-diagnostics.log").write_text(log)
        return report.load_pull(tmp.name)

    def test_observations_flag_background_memory_oom_and_service(self):
        log = '2026-11-10 12:05:00.000 [CRASH] x\njava.lang.OutOfMemoryError\n'
        pull = self._pull([sample(0, pss=500 * 1024), sample(5, pss=500 * 1024, pid=2)], log)
        text = "\n".join(report.observations(pull))
        self.assertIn("segundo plano", text)
        self.assertIn("OutOfMemoryError", text)
        self.assertIn("reiniciado", text)
        self.assertIn("serviço de notificação", text)

    def test_quiet_run_has_no_observations(self):
        self.assertEqual(report.observations(self._pull([sample(0, service=False), sample(5, service=False)])), [])

    def test_report_and_compare_render_every_column(self):
        a = self._pull([sample(0, battery=80), sample(60, battery=70)])
        b = self._pull([sample(0, battery=80), sample(60, battery=76)])
        self.assertIn("bateria do aparelho", report.render_report(a))
        compare = report.render_compare(a, b)
        for header in ["estado do app", "métrica", "antes (A)", "depois (B)", "diferença"]:
            self.assertIn(header, compare)
        self.assertIn("-6", compare)  # drain went from 10 %/h to 4 %/h

    def test_a_crash_without_stack_is_called_out_and_no_samples_is_not_called_normal(self):
        log = "2026-11-10 12:05:43.604 [EXIT] previous process ended: reason=CRASH description=\"crash\" status=0\n"
        pull = self._pull([], log)
        self.assertIn("1 crash/ANR", "\n".join(report.observations(pull)))
        self.assertIn("Nenhuma amostra", report.render_report(pull))
        quiet = self._pull([], "")
        self.assertIn("sem amostras", report.render_report(quiet))
        self.assertNotIn("nada fora do esperado", report.render_report(quiet))

    def test_too_little_data_is_not_called_normal(self):
        short = report.render_report(self._pull([sample(0, service=False), sample(5, service=False)]))
        self.assertIn("use o app por pelo menos", short)
        self.assertNotIn("nada fora do esperado", short)
        long = report.render_report(self._pull([sample(0, service=False), sample(180, service=False)]))
        self.assertIn("nada fora do esperado", long)

    def test_crash_sample_context_is_printed(self):
        pull = self._pull([sample(0, trigger="crash", foreground=True)])
        self.assertIn("estado no crash", report.render_report(pull))

    def test_cli(self):
        self.assertEqual(report.main(["x"]), 2)


if __name__ == "__main__":
    unittest.main()
