#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
RUN="$SKILL_DIR/run"

fail() {
  echo "doctor: $1" >&2
  exit 1
}

[[ -f "$RUN/api.pid" && -f "$RUN/web.pid" ]] || fail "this run has no pid files"
kill -0 "$(cat "$RUN/api.pid")" 2>/dev/null || fail "api process is not running"
kill -0 "$(cat "$RUN/web.pid")" 2>/dev/null || fail "web process is not running"

if grep -q '^remote = true' "$ROOT/apps/api/wrangler.toml"; then
  fail "wrangler.toml has remote = true"
fi

curl -sf http://127.0.0.1:8787/api/health | grep -q '"status":"ok"' || fail "api health is not ok"
code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/login || true)"
[[ "$code" == "200" ]] || fail "login page did not return 200"
grep "D1 Database" "$RUN/api.log" | grep -q "local" || fail "D1 binding is not local"
if grep "D1 Database" "$RUN/api.log" | grep -q "remote"; then
  fail "D1 binding is remote"
fi

api_listen="$(lsof -nP -iTCP:8787 -sTCP:LISTEN -t | tr '\n' ' ')"
web_listen="$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t | tr '\n' ' ')"
[[ "$api_listen" == *"$(cat "$RUN/api.listen.pid")"* ]] || fail "8787 is not owned by this run"
[[ "$web_listen" == *"$(cat "$RUN/web.listen.pid")"* ]] || fail "5173 is not owned by this run"

me="$(curl -sS -b "$RUN/cookies.txt" http://127.0.0.1:5173/api/me)"
grep -q '"id":"usr_dev_local"' <<<"$me" || fail "dev session is not valid"

echo "doctor: ok $me"
