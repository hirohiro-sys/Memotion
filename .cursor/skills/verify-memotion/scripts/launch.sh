#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
RUN="$SKILL_DIR/run"
mkdir -p "$RUN"

if grep -q '^remote = true' "$ROOT/apps/api/wrangler.toml"; then
  echo "wrangler.toml has remote = true; refusing to start" >&2
  exit 1
fi

if [[ ! -f "$ROOT/apps/api/.dev.vars" ]]; then
  echo "missing apps/api/.dev.vars" >&2
  exit 1
fi

app_url="$(grep '^APP_URL=' "$ROOT/apps/api/.dev.vars" | cut -d= -f2- | tr -d '[:space:]')"
secret="$(grep '^SESSION_SECRET=' "$ROOT/apps/api/.dev.vars" | cut -d= -f2- | tr -d '[:space:]')"
if [[ "$app_url" != "http://127.0.0.1:5173" || -z "$secret" ]]; then
  echo "APP_URL must be http://127.0.0.1:5173 and SESSION_SECRET must be set" >&2
  exit 1
fi

if lsof -nP -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1 || lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "5173 or 8787 is already in use; refusing to drive a shared instance" >&2
  exit 1
fi

stop_started() {
  if [[ -f "$RUN/api.pid" ]]; then
    kill -TERM -"$(cat "$RUN/api.pid")" 2>/dev/null || kill -TERM "$(cat "$RUN/api.pid")" 2>/dev/null || true
  fi
  if [[ -f "$RUN/web.pid" ]]; then
    kill -TERM -"$(cat "$RUN/web.pid")" 2>/dev/null || kill -TERM "$(cat "$RUN/web.pid")" 2>/dev/null || true
  fi
}

cd "$ROOT"
pnpm --filter @repo/api db:migrate:local >"$RUN/migrate.log" 2>&1 &
migrate_pid=$!
ready=0
for _ in $(seq 1 90); do
  if grep -q "No migrations to apply\|Successfully applied" "$RUN/migrate.log" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$migrate_pid" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if kill -0 "$migrate_pid" 2>/dev/null; then
  kill "$migrate_pid" 2>/dev/null || true
  wait "$migrate_pid" 2>/dev/null || true
fi
if [[ "$ready" -ne 1 ]] || grep -q "ERROR\|Error" "$RUN/migrate.log"; then
  echo "local migration failed" >&2
  cat "$RUN/migrate.log" >&2
  exit 1
fi

pnpm --filter @repo/api exec node ./scripts/ensure-dev-assets.mjs

set -m
pnpm --filter @repo/api exec wrangler dev --local --ip 127.0.0.1 --port 8787 >"$RUN/api.log" 2>&1 &
echo $! >"$RUN/api.pid"
pnpm --filter @repo/web exec vite --host 127.0.0.1 --port 5173 >"$RUN/web.log" 2>&1 &
echo $! >"$RUN/web.pid"

api_ready=0
web_ready=0
for _ in $(seq 1 90); do
  if curl -sf http://127.0.0.1:8787/api/health | grep -q '"status":"ok"'; then
    api_ready=1
  fi
  code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/login || true)"
  if [[ "$code" == "200" ]]; then
    web_ready=1
  fi
  if [[ "$api_ready" -eq 1 && "$web_ready" -eq 1 ]]; then
    break
  fi
  sleep 1
done

if [[ "$api_ready" -ne 1 || "$web_ready" -ne 1 ]]; then
  echo "stack did not become usable" >&2
  stop_started
  exit 1
fi

if ! grep "D1 Database" "$RUN/api.log" | grep -q "local"; then
  echo "D1 binding is not local" >&2
  stop_started
  exit 1
fi
if grep "D1 Database" "$RUN/api.log" | grep -q "remote"; then
  echo "D1 binding is remote" >&2
  stop_started
  exit 1
fi

curl -sS -c "$RUN/cookies.txt" -D "$RUN/login.headers" -o /dev/null http://127.0.0.1:5173/api/auth/dev
if ! grep -q "302" "$RUN/login.headers" || ! grep -q "usr_dev_local" <<<"$(curl -sS -b "$RUN/cookies.txt" http://127.0.0.1:5173/api/me)"; then
  echo "dev session was not issued" >&2
  stop_started
  exit 1
fi

lsof -nP -iTCP:8787 -sTCP:LISTEN -t >"$RUN/api.listen.pid"
lsof -nP -iTCP:5173 -sTCP:LISTEN -t >"$RUN/web.listen.pid"
echo "ready http://127.0.0.1:5173"
