#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$SKILL_DIR/run"

stop_group() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local pid
  pid="$(cat "$file")"
  kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
}

stop_group "$RUN/api.pid"
stop_group "$RUN/web.pid"

if [[ -f "$RUN/api.listen.pid" ]]; then
  kill -TERM "$(cat "$RUN/api.listen.pid")" 2>/dev/null || true
fi
if [[ -f "$RUN/web.listen.pid" ]]; then
  kill -TERM "$(cat "$RUN/web.listen.pid")" 2>/dev/null || true
fi

rm -rf "$RUN"
echo "cleanup: stopped this run; artifacts kept"
