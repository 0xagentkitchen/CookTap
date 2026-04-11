#!/usr/bin/env bash
# CookTap: notify all running instances that the host CLI is done
# Creates .trigger files that CookTap watches via fs.watch (cross-platform)
# Falls back to SIGUSR1 on Unix for backward compatibility

SESSIONS_DIR="$HOME/.cooktap/sessions"
[[ -d "$SESSIONS_DIR" ]] || exit 0

for pidfile in "$SESSIONS_DIR"/*.pid; do
  [[ -f "$pidfile" ]] || continue

  # Extract session ID from filename (e.g., 1234-abc123.pid -> 1234-abc123)
  SESSION_ID="$(basename "$pidfile" .pid)"

  # Extract PID — pure bash/grep, no Python dependency
  PID=$(grep -o '"pid"[[:space:]]*:[[:space:]]*[0-9]*' "$pidfile" 2>/dev/null | grep -o '[0-9]*$' || echo "")

  # Check if process is alive
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    # Primary: write trigger file (cross-platform, works on Windows too)
    touch "$SESSIONS_DIR/${SESSION_ID}.trigger"

    # Fallback: send SIGUSR1 on Unix
    if [[ "$(uname)" != MINGW* && "$(uname)" != MSYS* ]]; then
      kill -USR1 "$PID" 2>/dev/null || true
    fi
  else
    # Stale PID — clean up
    rm -f "$pidfile" 2>/dev/null || true
    rm -f "$SESSIONS_DIR/${SESSION_ID}.trigger" 2>/dev/null || true
  fi
done
