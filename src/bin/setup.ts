import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const COOKTAP_DIR = path.join(HOME, '.cooktap');

type Target = 'claude' | 'codex' | 'gemini';

let dryRun = false;

function log(msg: string) {
  console.log(msg);
}

function dryLog(msg: string) {
  console.log(dryRun ? `  [dry-run] ${msg}` : `  ${msg}`);
}

// ── Notify script (cross-platform file-based + SIGUSR1 fallback) ──

const NOTIFY_SCRIPT = `#!/usr/bin/env bash
# CookTap: notify all running instances that the host CLI is done
# Creates .trigger files (cross-platform) + SIGUSR1 fallback (Unix)
SESSIONS_DIR="$HOME/.cooktap/sessions"
[[ -d "$SESSIONS_DIR" ]] || exit 0
for pidfile in "$SESSIONS_DIR"/*.pid; do
  [[ -f "$pidfile" ]] || continue
  SESSION_ID="$(basename "$pidfile" .pid)"
  PID=$(grep -o '"pid"[[:space:]]*:[[:space:]]*[0-9]*' "$pidfile" 2>/dev/null | grep -o '[0-9]*$' || echo "")
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    touch "$SESSIONS_DIR/\${SESSION_ID}.trigger"
    if [[ "$(uname)" != MINGW* && "$(uname)" != MSYS* ]]; then
      kill -USR1 "$PID" 2>/dev/null || true
    fi
  else
    rm -f "$pidfile" 2>/dev/null || true
    rm -f "$SESSIONS_DIR/\${SESSION_ID}.trigger" 2>/dev/null || true
  fi
done
`;

function ensureNotifyScript(): string {
  const scriptDir = path.join(COOKTAP_DIR, 'scripts');
  const scriptPath = path.join(scriptDir, 'notify.sh');
  if (!dryRun) {
    fs.mkdirSync(scriptDir, { recursive: true });
    fs.writeFileSync(scriptPath, NOTIFY_SCRIPT, { mode: 0o755 });
  }
  dryLog(`Notify script → ${scriptPath}`);
  return scriptPath;
}

// ── Launch script (shared) ──

function ensureLaunchScript(): string {
  const scriptDir = path.join(COOKTAP_DIR, 'scripts');
  const scriptPath = path.join(scriptDir, 'launch.sh');
  const cooktapBin = getBinPath();
  const script = `#!/usr/bin/env bash
set -euo pipefail
COOKTAP_CMD="clear && ${cooktapBin} --host \${1:-generic}"

detect_terminal() {
  if [[ -n "\${TMUX:-}" ]]; then echo "tmux"
  elif [[ -n "\${GHOSTTY_RESOURCES_DIR:-}" ]]; then echo "ghostty"
  elif [[ "\${TERM_PROGRAM:-}" == "iTerm.app" ]]; then echo "iterm"
  elif [[ "\${TERM_PROGRAM:-}" == "WezTerm" ]]; then echo "wezterm"
  elif [[ "\${TERM_PROGRAM:-}" == "Apple_Terminal" ]]; then echo "terminal"
  else echo "unknown"; fi
}

TERMINAL=$(detect_terminal)
case "$TERMINAL" in
  tmux) tmux new-window -n "CookTap" "$COOKTAP_CMD" 2>/dev/null ;;
  ghostty) osascript -e "
    tell application \\"System Events\\"
      tell process \\"Ghostty\\"
        keystroke \\"t\\" using command down
        delay 0.3
        keystroke \\"$COOKTAP_CMD\\"
        key code 36
      end tell
    end tell" 2>/dev/null ;;
  iterm) osascript -e "
    tell application \\"iTerm2\\"
      tell current window
        create tab with default profile
        tell current session of current tab
          write text \\"$COOKTAP_CMD\\"
        end tell
      end tell
    end tell" 2>/dev/null ;;
  terminal) osascript -e "
    tell application \\"Terminal\\"
      activate
      do script \\"$COOKTAP_CMD\\"
    end tell" 2>/dev/null ;;
  wezterm) wezterm cli spawn --new-window -- bash -c "$COOKTAP_CMD" 2>/dev/null ;;
  *) exec $COOKTAP_CMD ;;
esac
`;
  if (!dryRun) {
    fs.mkdirSync(scriptDir, { recursive: true });
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
  }
  return scriptPath;
}

function getBinPath(): string {
  // When bundled by tsup, import.meta.url is dist/cli.js — go up one level
  const fromDist = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist', 'cli.js');
  if (fs.existsSync(fromDist)) {
    return `node ${fromDist}`;
  }
  // When running from src/ (dev), go up two levels
  const fromSrc = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'dist', 'cli.js');
  if (fs.existsSync(fromSrc)) {
    return `node ${fromSrc}`;
  }
  return 'npx cooktap';
}

// ── Claude Code ──

function installClaude() {
  const notifyPath = ensureNotifyScript();
  const launchPath = ensureLaunchScript();
  const claudeDir = path.join(HOME, '.claude');

  if (!dryRun) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // 1. Install Stop hook in settings.json
  const settingsPath = path.join(claudeDir, 'settings.json');
  let settings: any = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch { /* new file */ }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  const hookCmd = `bash ${notifyPath}`;
  const hasHook = settings.hooks.Stop.some((entry: any) =>
    entry.hooks?.some((h: any) => h.command?.includes('notify') && h.command?.includes('cooktap'))
  );

  if (!hasHook) {
    let catchAll = settings.hooks.Stop.find((entry: any) => entry.matcher === '' || entry.matcher === undefined);
    if (!catchAll) {
      catchAll = { matcher: '', hooks: [] };
      settings.hooks.Stop.push(catchAll);
    }
    if (!catchAll.hooks) catchAll.hooks = [];
    catchAll.hooks.push({ type: 'command', command: hookCmd });
  }

  if (!dryRun) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
  dryLog('Hook added to ~/.claude/settings.json (Stop event)');

  // 2. Install /cooktap skill
  const skillDir = path.join(claudeDir, 'skills', 'cooktap');
  if (!dryRun) {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: cooktap
description: Launch a CookTap typing drill in a new terminal tab
allowed-tools: Bash(*)
---

Run the following shell command to launch CookTap:

\`\`\`bash
bash "${launchPath}" claude
\`\`\`

Do not add any commentary before or after running the command.
`);
  }
  dryLog('Skill installed: /cooktap');
}

function uninstallClaude() {
  const claudeDir = path.join(HOME, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.hooks?.Stop) {
      for (const entry of settings.hooks.Stop) {
        if (entry.hooks) {
          entry.hooks = entry.hooks.filter((h: any) =>
            !(h.command?.includes('notify') && h.command?.includes('cooktap'))
          );
        }
      }
      settings.hooks.Stop = settings.hooks.Stop.filter((e: any) => e.hooks?.length > 0);
      if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
    }
    if (!dryRun) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    dryLog('Hook removed from ~/.claude/settings.json');
  } catch {
    dryLog('No Claude Code settings found');
  }

  const skillDir = path.join(claudeDir, 'skills', 'cooktap');
  if (!dryRun) {
    try { fs.rmSync(skillDir, { recursive: true }); } catch { /* already gone */ }
  }
  dryLog('Skill /cooktap removed');
}

// ── Codex CLI (coming soon) ──

function installCodex() {
  log('  Codex CLI: launch supported via npx skills');
  log('  Notify hooks: coming soon (pending Codex hook API verification)');
  log('  For now, use: npx skills add cooktap/cooktap');
}

function uninstallCodex() {
  // Clean up any legacy instructions.md entries from older versions
  const configDir = fs.existsSync(path.join(HOME, '.codex'))
    ? path.join(HOME, '.codex')
    : path.join(HOME, '.config', 'codex');
  const instructionsPath = path.join(configDir, 'instructions.md');

  try {
    let instructions = fs.readFileSync(instructionsPath, 'utf8');
    const marker = '<!-- cooktap-hook -->';
    if (instructions.includes(marker)) {
      const regex = new RegExp(`\\n${marker}[\\s\\S]*?${marker}\\n`, 'g');
      instructions = instructions.replace(regex, '');
      if (!dryRun) {
        fs.writeFileSync(instructionsPath, instructions);
      }
      dryLog('Legacy CookTap block removed from instructions.md');
    }
  } catch { /* no config */ }
}

// ── Gemini CLI (coming soon) ──

function installGemini() {
  log('  Gemini CLI: launch supported via npx skills');
  log('  Notify hooks: coming soon (pending Gemini hook event verification)');
  log('  For now, use: npx skills add cooktap/cooktap');
}

function uninstallGemini() {
  // Clean up any legacy hooks from older versions
  const geminiDir = path.join(HOME, '.gemini');
  const settingsPath = path.join(geminiDir, 'settings.json');

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    let changed = false;
    for (const key of Object.keys(settings.hooks || {})) {
      const hooks = settings.hooks[key];
      if (Array.isArray(hooks)) {
        const filtered = hooks.filter((h: any) => !h.command?.includes('cooktap'));
        if (filtered.length !== hooks.length) {
          settings.hooks[key] = filtered;
          changed = true;
          if (filtered.length === 0) delete settings.hooks[key];
        }
      }
    }
    if (changed && !dryRun) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    if (changed) dryLog('Legacy CookTap hooks removed from ~/.gemini/settings.json');
  } catch { /* no config */ }
}

// ── Targets ──

const TARGETS: Record<Target, { name: string; detect: () => boolean; install: () => void; uninstall: () => void; hasNotify: boolean }> = {
  claude: {
    name: 'Claude Code',
    detect: () => fs.existsSync(path.join(HOME, '.claude')),
    install: installClaude,
    uninstall: uninstallClaude,
    hasNotify: true,
  },
  codex: {
    name: 'Codex CLI',
    detect: () => fs.existsSync(path.join(HOME, '.codex')) || fs.existsSync(path.join(HOME, '.config', 'codex')),
    install: installCodex,
    uninstall: uninstallCodex,
    hasNotify: false,
  },
  gemini: {
    name: 'Gemini CLI',
    detect: () => fs.existsSync(path.join(HOME, '.gemini')),
    install: installGemini,
    uninstall: uninstallGemini,
    hasNotify: false,
  },
};

// ── CLI ──

function printUsage() {
  console.log(`
CookTap Setup — install notification hooks into your AI coding CLI

Usage:
  cooktap setup [target]       Install hooks (auto-detect if no target)
  cooktap setup --dry-run      Preview changes without writing files
  cooktap uninstall [target]   Remove all hooks
  cooktap help                 Show this help

Targets: claude, codex (coming soon), gemini (coming soon)

Notify support:
  claude    Full (Stop hook + /cooktap skill)
  codex     Launch only (via npx skills) — notify coming soon
  gemini    Launch only (via npx skills) — notify coming soon
`);
}

export function runSetup(args: string[]) {
  const subcommand = args[0];
  dryRun = args.includes('--dry-run');

  if (subcommand === 'setup') {
    const target = args.find(a => a !== 'setup' && a !== '--dry-run') as Target | undefined;

    if (target && !TARGETS[target]) {
      console.log(`Unknown target: ${target}`);
      console.log(`Available: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }

    const toInstall = target ? [target] : (Object.keys(TARGETS) as Target[]).filter(t => TARGETS[t].detect());

    if (toInstall.length === 0) {
      console.log('No supported AI CLIs detected. Specify a target:');
      console.log('  cooktap setup claude');
      process.exit(1);
    }

    console.log('');
    if (dryRun) console.log('🍳 CookTap Setup (dry run — no files will be modified)');
    else console.log('🍳 CookTap Setup');
    console.log('');

    for (const t of toInstall) {
      console.log(`${TARGETS[t].name}...`);
      TARGETS[t].install();
      console.log('');
    }

    if (!dryRun) {
      console.log('Done! Launch CookTap with:');
      console.log('  cooktap          (standalone)');
      if (toInstall.includes('claude')) {
        console.log('  /cooktap         (inside Claude Code)');
      }
      console.log('');
    }
    return true;
  }

  if (subcommand === 'uninstall') {
    const target = args.find(a => a !== 'uninstall' && a !== '--dry-run') as Target | undefined;
    const toRemove = target ? [target] : (Object.keys(TARGETS) as Target[]);

    console.log('');
    if (dryRun) console.log('Removing CookTap hooks (dry run)...');
    else console.log('Removing CookTap hooks...');
    console.log('');

    for (const t of toRemove) {
      console.log(`${TARGETS[t].name}...`);
      TARGETS[t].uninstall();
      console.log('');
    }

    if (!target && !dryRun) {
      const scriptsDir = path.join(COOKTAP_DIR, 'scripts');
      try { fs.rmSync(scriptsDir, { recursive: true }); } catch { /* ok */ }
      console.log('Shared scripts cleaned up.');
    }

    console.log('Done!');
    console.log('');
    return true;
  }

  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printUsage();
    return true;
  }

  return false;
}
