#!/usr/bin/env python3
"""Reads what `make metrics` pulled from the phone and answers: is the app really heavy, and why does it crash?

    metrics-report.py report  <dir>            one pull, in words and tables
    metrics-report.py compare <dirA> <dirB>    two pulls side by side (A = before, B = after)

A pull directory holds app-metrics.jsonl (one sample per line, see MetricsSample.kt),
app-diagnostics.log (crashes, process exits), and optionally meminfo.txt / batterystats.txt
(the system's own numbers, an independent check of the app's own).

Times are shown in Brasília (UTC-3). Nothing here talks to the network.
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

BRASILIA = timezone(timedelta(hours=-3))
# Two samples further apart than this are not "the same stretch" (the process was dead or frozen).
MAX_GAP_MS = 60 * 60 * 1000
BUCKETS = ["foreground", "background, screen on", "background, screen off"]
# Background memory above this is worth a look (decoded pages held by a process nobody is looking at).
BACKGROUND_PSS_ALERT_MB = 300
# Below this many hours of samples, "nothing wrong" would be a guess, so the report says so instead.
MIN_HOURS_TO_JUDGE = 2


def load_samples(path):
    """Samples sorted by time. A line that is not valid JSON (a write cut by a crash) is skipped."""
    samples = []
    if not os.path.exists(path):
        return samples
    with open(path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if isinstance(row, dict) and "ts" in row:
                samples.append(row)
    return sorted(samples, key=lambda s: s["ts"])


EVENT_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \[(EXIT|CRASH)\] (.*)$")
REASON_RE = re.compile(r"reason=([A-Z_]+(?:\(\d+\))?)")


def load_events(path):
    """Crashes (with the first lines of the stack trace) and process exits from app-diagnostics.log."""
    exits, crashes = [], []
    if not os.path.exists(path):
        return {"exits": exits, "crashes": crashes}
    with open(path, encoding="utf-8", errors="replace") as handle:
        lines = handle.read().splitlines()
    for index, line in enumerate(lines):
        match = EVENT_RE.match(line)
        if not match:
            continue
        stamp, kind, rest = match.groups()
        if kind == "EXIT":
            reason = REASON_RE.search(rest)
            exits.append({"time": stamp, "reason": reason.group(1) if reason else "UNKNOWN", "text": rest})
        else:
            trace = []
            for follow in lines[index + 1 : index + 8]:
                if EVENT_RE.match(follow) or re.match(r"^\d{4}-\d{2}-\d{2} ", follow):
                    break
                trace.append(follow.strip())
            crashes.append({"time": stamp, "text": rest, "trace": trace, "oom": any("OutOfMemoryError" in t for t in trace)})
    return {"exits": exits, "crashes": crashes}


def bucket_of(sample):
    if sample.get("foreground"):
        return BUCKETS[0]
    return BUCKETS[1] if sample.get("screenOn") else BUCKETS[2]


def _empty_bucket():
    return {"hours": 0.0, "drain_pct": 0.0, "drain_hours": 0.0, "cpu_ms": 0.0, "cpu_wall_ms": 0.0, "pss_kb": [], "native_bytes": [], "threads": 0}


def summarize(samples):
    """Numbers per app state. Battery drain is the PHONE's drop while the app was in that state — an upper
    bound for the app, not its own share (the system's batterystats, saved beside, has the share)."""
    buckets = {name: _empty_bucket() for name in BUCKETS}
    pids = []
    for sample in samples:
        if sample.get("pid") not in pids:
            pids.append(sample.get("pid"))
        bucket = buckets[bucket_of(sample)]
        bucket["pss_kb"].append(sample.get("pssKb", 0))
        bucket["native_bytes"].append(sample.get("nativeBytes", 0))
        bucket["threads"] = max(bucket["threads"], sample.get("threads", 0))
    for before, after in zip(samples, samples[1:]):
        gap = after["ts"] - before["ts"]
        if gap <= 0 or gap > MAX_GAP_MS:
            continue
        bucket = buckets[bucket_of(before)]
        bucket["hours"] += gap / 3_600_000
        same_process = before.get("pid") == after.get("pid") and after.get("cpuMs", 0) >= before.get("cpuMs", 0)
        if same_process:
            bucket["cpu_ms"] += after["cpuMs"] - before["cpuMs"]
            bucket["cpu_wall_ms"] += gap
        discharging = before.get("charging") is not True and after.get("charging") is not True
        if discharging and before.get("batteryPercent") is not None and after.get("batteryPercent") is not None:
            bucket["drain_pct"] += before["batteryPercent"] - after["batteryPercent"]
            bucket["drain_hours"] += gap / 3_600_000
    result = {}
    for name, bucket in buckets.items():
        pss = [v / 1024 for v in bucket["pss_kb"]]
        native = [v / (1024 * 1024) for v in bucket["native_bytes"]]
        result[name] = {
            "samples": len(pss),
            "hours": round(bucket["hours"], 2),
            "drain_per_hour": round(bucket["drain_pct"] / bucket["drain_hours"], 2) if bucket["drain_hours"] >= 0.5 else None,
            "cpu_percent": round(100 * bucket["cpu_ms"] / bucket["cpu_wall_ms"], 2) if bucket["cpu_wall_ms"] else None,
            "pss_avg_mb": round(sum(pss) / len(pss)) if pss else None,
            "pss_max_mb": round(max(pss)) if pss else None,
            "native_max_mb": round(max(native)) if native else None,
            "threads_max": bucket["threads"] or None,
        }
    first, last = (samples[0]["ts"], samples[-1]["ts"]) if samples else (None, None)
    return {
        "samples": len(samples),
        "first": first,
        "last": last,
        "span_hours": round((last - first) / 3_600_000, 2) if samples else 0,
        "processes": len(pids),
        "service_share": round(100 * sum(1 for s in samples if s.get("notificationService")) / len(samples)) if samples else None,
        "buckets": result,
        "crash_samples": [s for s in samples if s.get("trigger") == "crash"],
    }


def parse_meminfo(text):
    """The system's own TOTAL PSS for the app (MB), from `dumpsys meminfo <pkg>`."""
    match = re.search(r"TOTAL PSS:\s+(\d+)", text) or re.search(r"^\s*TOTAL\s+(\d+)", text, re.MULTILINE)
    return round(int(match.group(1)) / 1024) if match else None


def parse_batterystats(text):
    """The system's own estimate of the app's battery use: the `Uid ...: N mAh (...)` lines of `dumpsys batterystats`."""
    return [m.group(0).strip() for m in re.finditer(r"Uid\s+u0a\d+:\s+[\d.]+\s*(?:\([^)]*\))?", text)]


def read_text(directory, name):
    path = os.path.join(directory, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8", errors="replace") as handle:
        return handle.read()


def load_pull(directory):
    samples = load_samples(os.path.join(directory, "app-metrics.jsonl"))
    summary = summarize(samples)
    summary["events"] = load_events(os.path.join(directory, "app-diagnostics.log"))
    meminfo = read_text(directory, "meminfo.txt")
    batterystats = read_text(directory, "batterystats.txt")
    summary["system_pss_mb"] = parse_meminfo(meminfo) if meminfo else None
    summary["system_battery"] = parse_batterystats(batterystats) if batterystats else []
    return summary


def _time(ms):
    return datetime.fromtimestamp(ms / 1000, BRASILIA).strftime("%d/%m %H:%M") if ms else "-"


def _val(value, suffix=""):
    return "-" if value is None else f"{value}{suffix}"


def table(headers, rows):
    widths = [max(len(str(x)) for x in col) for col in zip(headers, *rows)]
    line = lambda cells: "  ".join(str(c).ljust(w) for c, w in zip(cells, widths))
    return "\n".join([line(headers), line(["-" * w for w in widths])] + [line(r) for r in rows])


def observations(summary):
    notes = []
    background = [summary["buckets"][b] for b in BUCKETS[1:]]
    worst = max((b["pss_max_mb"] or 0 for b in background), default=0)
    if worst > BACKGROUND_PSS_ALERT_MB:
        notes.append(f"Memória em segundo plano chegou a {worst} MB (alerta acima de {BACKGROUND_PSS_ALERT_MB} MB): o app guarda memória sem ninguém olhando.")
    if summary["processes"] > 1:
        notes.append(f"{summary['processes']} processos distintos no período: o app foi reiniciado {summary['processes'] - 1} vez(es).")
    events = summary["events"]
    if any(c["oom"] for c in events["crashes"]):
        notes.append("Há crash por OutOfMemoryError: é falta de memória, não bug de lógica.")
    reported = sum(1 for e in events["exits"] if e["reason"] in ("CRASH", "CRASH_NATIVE", "ANR"))
    if reported > len(events["crashes"]):
        notes.append(
            f"O Android registrou {reported} crash/ANR, mas o log só tem {len(events['crashes'])} stack trace: "
            "o resto morreu sem passar pelo handler (crash nativo/ANR) ou o log foi limpo/rotacionado antes."
        )
    low = sum(1 for e in events["exits"] if e["reason"] == "LOW_MEMORY")
    if low:
        notes.append(f"O Android matou o app por pouca memória {low} vez(es) (LOW_MEMORY).")
    if summary["service_share"] is not None and summary["service_share"] >= 90:
        notes.append("O serviço de notificação ficou ativo em quase todas as amostras: ele é um suspeito constante de bateria.")
    return notes


def render_report(summary):
    out = []
    out.append(f"Amostras: {summary['samples']}  de {_time(summary['first'])} a {_time(summary['last'])} (Brasília), {summary['span_hours']} h")
    out.append("")
    if not summary["samples"]:
        out.append("Nenhuma amostra de métricas. O app instalado já tem o coletor? (versão com app-metrics.jsonl)")
    rows = []
    for name in BUCKETS:
        b = summary["buckets"][name]
        rows.append([name, b["samples"], b["hours"], _val(b["drain_per_hour"], " %/h"), _val(b["cpu_percent"], " %"), _val(b["pss_avg_mb"], " MB"), _val(b["pss_max_mb"], " MB"), _val(b["native_max_mb"], " MB"), _val(b["threads_max"])])
    out.append(table(["estado do app", "amostras", "horas", "bateria do aparelho", "CPU do app", "PSS médio", "PSS máx", "heap nativo máx", "threads máx"], rows))
    out.append("")
    out.append("Bateria = queda do aparelho inteiro naquele estado, só em trechos sem carregar. É teto, não a parte do app.")
    if summary["system_pss_mb"] is not None:
        out.append(f"Memória medida pelo sistema (dumpsys meminfo): {summary['system_pss_mb']} MB")
    for line in summary["system_battery"]:
        out.append(f"Bateria estimada pelo sistema (batterystats): {line}")
    events = summary["events"]
    out.append("")
    reasons = {}
    for e in events["exits"]:
        reasons[e["reason"]] = reasons.get(e["reason"], 0) + 1
    out.append("Saídas do processo: " + (", ".join(f"{r}={n}" for r, n in sorted(reasons.items())) if reasons else "nenhuma registrada"))
    for crash in events["crashes"]:
        out.append(f"CRASH {crash['time']} (hora do aparelho): {crash['text']}")
        out.extend("    " + t for t in crash["trace"][:4])
    for sample in summary["crash_samples"]:
        out.append(f"  estado no crash {_time(sample['ts'])}: {'em primeiro plano' if sample.get('foreground') else 'em segundo plano'}, PSS {round(sample.get('pssKb', 0) / 1024)} MB, heap Java {round(sample.get('javaUsedBytes', 0) / 1048576)}/{round(sample.get('javaMaxBytes', 0) / 1048576)} MB, bateria {_val(sample.get('batteryPercent'), '%')}")
    notes = observations(summary)
    out.append("")
    if notes:
        out.append("Observações:")
    elif summary["span_hours"] >= MIN_HOURS_TO_JUDGE:
        out.append("Observações: nada fora do esperado nesta coleta.")
    elif summary["samples"]:
        out.append(f"Observações: só {summary['span_hours']} h de dados; use o app por pelo menos {MIN_HOURS_TO_JUDGE} h antes de concluir algo.")
    else:
        out.append("Observações: sem amostras não dá para avaliar memória nem bateria.")
    out.extend("  - " + n for n in notes)
    return "\n".join(out)


def render_compare(a, b):
    def delta(x, y):
        return "-" if x is None or y is None else f"{y - x:+.2f}".rstrip("0").rstrip(".")

    rows = []
    for name in BUCKETS:
        for label, key, suffix in [("bateria %/h", "drain_per_hour", ""), ("CPU %", "cpu_percent", ""), ("PSS médio MB", "pss_avg_mb", ""), ("PSS máx MB", "pss_max_mb", ""), ("heap nativo máx MB", "native_max_mb", "")]:
            x, y = a["buckets"][name][key], b["buckets"][name][key]
            rows.append([name, label, _val(x), _val(y), delta(x, y)])
    for label, x, y in [
        ("crashes", len(a["events"]["crashes"]), len(b["events"]["crashes"])),
        ("saídas LOW_MEMORY", sum(e["reason"] == "LOW_MEMORY" for e in a["events"]["exits"]), sum(e["reason"] == "LOW_MEMORY" for e in b["events"]["exits"])),
        ("horas cobertas", a["span_hours"], b["span_hours"]),
    ]:
        rows.append(["geral", label, x, y, delta(x, y)])
    return table(["estado do app", "métrica", "antes (A)", "depois (B)", "diferença"], rows) + "\n\nDiferença negativa em bateria/CPU/memória = B melhor que A. Compare coletas de duração parecida."


def main(argv):
    if len(argv) == 3 and argv[1] == "report":
        print(render_report(load_pull(argv[2])))
        return 0
    if len(argv) == 4 and argv[1] == "compare":
        print(render_compare(load_pull(argv[2]), load_pull(argv[3])))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
