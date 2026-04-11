#!/usr/bin/env bash
# CookTap installer for AI coding CLIs
# Usage: bash install.sh [claude|all]
# For full setup, prefer: cooktap setup [target]
set -euo pipefail

TARGET="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "CookTap Installer"
echo ""

install_claude() {
  echo "Installing for Claude Code..."
  echo "  Recommended: use the native plugin system:"
  echo "    /plugin install cooktap"
  echo "  Or run: cooktap setup claude"
  echo "  Or run: npx cooktap setup claude"
  echo ""
}

case "$TARGET" in
  claude) install_claude ;;
  codex)
    echo "Codex CLI: notify hooks coming soon."
    echo "  For launch support: npx skills add cooktap/cooktap"
    echo ""
    ;;
  gemini)
    echo "Gemini CLI: notify hooks coming soon."
    echo "  For launch support: npx skills add cooktap/cooktap"
    echo ""
    ;;
  all)
    [[ -d "$HOME/.claude" ]] && install_claude
    [[ -d "$HOME/.codex" || -d "$HOME/.config/codex" ]] && echo "Codex CLI detected — notify hooks coming soon. Use: npx skills add cooktap/cooktap"
    [[ -d "$HOME/.gemini" ]] && echo "Gemini CLI detected — notify hooks coming soon. Use: npx skills add cooktap/cooktap"
    ;;
  *)
    echo "Usage: bash install.sh [claude|codex|gemini|all]"
    exit 1
    ;;
esac

echo ""
echo "Run 'cooktap' or 'npx cooktap' to play."
echo "Run 'cooktap setup claude' for full Claude Code integration."
echo ""
