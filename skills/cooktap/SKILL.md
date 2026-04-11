---
name: cooktap
description: Launch a CookTap typing drill in a new terminal tab. Use when the user wants to practice typing, start a typing drill, or play CookTap while waiting for AI work.
metadata:
  author: cooktap
  version: "0.1.0"
allowed-tools: Bash(npx cooktap:*), Bash(cooktap:*), Bash(bash *launch*:*), Bash(bash *cooktap*:*)
---

# CookTap — typing drill

Launch CookTap in a **new terminal tab** so the user can practice typing while waiting.

**IMPORTANT**: CookTap is an interactive terminal UI. It MUST open in a new terminal tab — never run it in the background or inline in this session.

## Launch

Run the launch script located in the `scripts/` folder next to this SKILL.md file:

```bash
bash "<path-to-this-skill-directory>/scripts/launch.sh"
```

This script auto-detects the user's terminal (Ghostty, iTerm2, WezTerm, Terminal.app, tmux) and opens CookTap in a new tab.

If the launch script path cannot be determined, use:

```bash
npx cooktap
```

Note: this fallback will take over the current terminal session.

After launching, tell the user: "I've started CookTap for you. I'll let you know when I'm done."

Do not add any other commentary.
