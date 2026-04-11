---
name: cooktap
description: Launch a CookTap typing drill in a new terminal tab. Use when the user wants to practice typing, start a typing drill, or play CookTap while waiting for AI work.
metadata:
  author: cooktap
  version: "0.1.0"
allowed-tools: Bash(npx cooktap:*), Bash(cooktap:*)
---

# CookTap — typing drill

Launch CookTap in a new terminal tab so the user can practice typing while waiting.

Requires: `npm i -g cooktap` or use via `npx`.

## Launch

```bash
npx cooktap
```

After launching, tell the user: "I've started CookTap for you. I'll let you know when I'm done."

Do not add any other commentary before or after running the command.
