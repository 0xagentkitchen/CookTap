#!/usr/bin/env bash
# Launch CookTap in a new terminal tab or popup window
# Usage: launch.sh [--popup] [host]
set -euo pipefail

MODE="tab"
HOST="claude"

for arg in "$@"; do
  case "$arg" in
    --popup) MODE="popup" ;;
    *) HOST="$arg" ;;
  esac
done

# Resolve cooktap binary: prefer local bin/, fallback to npx
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOCAL_BIN="$PLUGIN_ROOT/bin/cooktap"

if [[ -x "$LOCAL_BIN" ]]; then
  COOKTAP_CMD="clear && \"$LOCAL_BIN\" --host $HOST"
elif command -v cooktap &>/dev/null; then
  COOKTAP_CMD="clear && cooktap --host $HOST"
else
  COOKTAP_CMD="clear && npx -y cooktap --host $HOST"
fi

detect_terminal() {
  if [[ -n "${TMUX:-}" ]]; then echo "tmux"
  elif [[ -n "${GHOSTTY_RESOURCES_DIR:-}" ]]; then echo "ghostty"
  elif [[ "${TERM_PROGRAM:-}" == "iTerm.app" ]]; then echo "iterm"
  elif [[ "${TERM_PROGRAM:-}" == "WezTerm" ]]; then echo "wezterm"
  elif [[ "${TERM_PROGRAM:-}" == "Apple_Terminal" ]]; then echo "terminal"
  else echo "unknown"; fi
}

# ── Tab launchers ──

launch_ghostty_tab() {
  osascript -e "
    tell application \"System Events\"
      tell process \"Ghostty\"
        keystroke \"t\" using command down
        delay 0.3
        keystroke \"$COOKTAP_CMD\"
        key code 36
      end tell
    end tell
  " 2>/dev/null
}

launch_iterm_tab() {
  osascript -e "
    tell application \"iTerm2\"
      tell current window
        create tab with default profile
        tell current session of current tab
          write text \"$COOKTAP_CMD\"
        end tell
      end tell
    end tell
  " 2>/dev/null
}

launch_terminal_tab() {
  osascript -e "
    tell application \"Terminal\"
      activate
      do script \"$COOKTAP_CMD\"
    end tell
  " 2>/dev/null
}

launch_wezterm_tab() {
  wezterm cli spawn --new-window -- bash -c "$COOKTAP_CMD" 2>/dev/null
}

launch_tmux_tab() {
  tmux new-window -n "CookTap" "$COOKTAP_CMD" 2>/dev/null
}

# ── Popup launchers ──

launch_popup() {
  # Use Terminal.app for popup — works from any terminal, supports resize
  osascript -e "
    tell application \"Terminal\"
      do script \"$COOKTAP_CMD\"
      set bounds of front window to {100, 50, 850, 750}
      activate
    end tell
  "
}

launch_tmux_popup() {
  tmux popup -w 80 -h 25 -E "$COOKTAP_CMD" 2>/dev/null
}

# ── Main ──

TERMINAL=$(detect_terminal)

if [[ "$MODE" == "popup" ]]; then
  if [[ "$TERMINAL" == "tmux" ]]; then
    echo "Launching CookTap in tmux popup..."
    launch_tmux_popup
  else
    echo "Launching CookTap popup..."
    launch_popup
  fi
  exit 0
fi

case "$TERMINAL" in
  tmux)    echo "Launching CookTap in tmux window..."; launch_tmux_tab ;;
  ghostty) echo "Launching CookTap in Ghostty tab..."; launch_ghostty_tab ;;
  iterm)   echo "Launching CookTap in iTerm tab..."; launch_iterm_tab ;;
  wezterm) echo "Launching CookTap in WezTerm window..."; launch_wezterm_tab ;;
  terminal) echo "Launching CookTap in Terminal.app..."; launch_terminal_tab ;;
  *)       echo "Running CookTap here..."; exec bash -c "$COOKTAP_CMD" ;;
esac
