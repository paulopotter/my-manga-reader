#!/usr/bin/env bash
# Pulls the app's own diagnostics (metrics + log) and the system's own numbers (meminfo, batterystats)
# from the connected phone into metrics/<timestamp>/ on this machine, then prints the report.
# Usage: scripts/metrics-pull.sh <package> [out-root]
set -euo pipefail

PACKAGE="${1:?package name required}"
ROOT="${2:-metrics}"
ADB="${ADB:-adb}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

command -v "$ADB" >/dev/null 2>&1 || { echo "✗ adb não encontrado (defina ADB=/caminho/do/adb)"; exit 1; }
"$ADB" get-state >/dev/null 2>&1 || { echo "✗ Nenhum dispositivo conectado via adb"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$ROOT/$STAMP"
REMOTE="/sdcard/Android/data/$PACKAGE/files/diagnostics"
mkdir -p "$OUT"

# The app's own files. `pull` of a directory nests it, so pull the files one by one.
for name in app-metrics.jsonl app-metrics.1.jsonl app-diagnostics.log app-diagnostics.1.log; do
  "$ADB" pull "$REMOTE/$name" "$OUT/$name" >/dev/null 2>&1 || true
done
# Older generation first, so the report reads one continuous history.
touch "$OUT/app-metrics.jsonl" "$OUT/app-diagnostics.log"
if [ -f "$OUT/app-metrics.1.jsonl" ]; then
  cat "$OUT/app-metrics.1.jsonl" "$OUT/app-metrics.jsonl" > "$OUT/.merged" 2>/dev/null && mv "$OUT/.merged" "$OUT/app-metrics.jsonl"
fi
if [ -f "$OUT/app-diagnostics.1.log" ]; then
  cat "$OUT/app-diagnostics.1.log" "$OUT/app-diagnostics.log" > "$OUT/.merged" 2>/dev/null && mv "$OUT/.merged" "$OUT/app-diagnostics.log"
fi
rm -f "$OUT/app-metrics.1.jsonl" "$OUT/app-diagnostics.1.log"

# The system's own view: an independent check of what the app measured about itself.
"$ADB" shell dumpsys meminfo "$PACKAGE" > "$OUT/meminfo.txt" 2>/dev/null || true
"$ADB" shell dumpsys batterystats "$PACKAGE" > "$OUT/batterystats.txt" 2>/dev/null || true
{
  echo "model=$("$ADB" shell getprop ro.product.model | tr -d '\r')"
  echo "android=$("$ADB" shell getprop ro.build.version.release | tr -d '\r')"
  echo "pulled=$STAMP"
} > "$OUT/device.txt"

if [ ! -s "$OUT/app-metrics.jsonl" ]; then
  echo "⚠ Sem app-metrics.jsonl: o app instalado ainda não tem o coletor, ou ainda não gravou nada."
fi

echo "✓ Coleta salva em $OUT"
python3 -I "$SCRIPT_DIR/metrics-report.py" report "$OUT"
