import React from 'react';
import { render } from 'ink';
import { App } from '../ui/App.js';
import { cleanStalePidFiles, writePidFile, removePidFile, watchForTrigger } from '../ipc/session-identity.js';
import { emitHostReady } from '../ipc/host-signal.js';
import { runSetup } from './setup.js';

// Handle setup/uninstall subcommands before launching the game
const subcommand = process.argv[2];
if (subcommand === 'setup' || subcommand === 'uninstall' || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
  const handled = runSetup(process.argv.slice(2));
  if (handled) process.exit(0);
}

// Parse --host flag
const hostEq = process.argv.find((a) => a.startsWith('--host='));
const hostIdx = process.argv.indexOf('--host');
const hostArg = hostEq ? hostEq.split('=')[1] : (hostIdx >= 0 ? process.argv[hostIdx + 1] : undefined);
const hostName = hostArg || 'generic';

const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Clean up stale PID files from crashed instances
cleanStalePidFiles();

// Register this instance
writePidFile(sessionId);

const { unmount, waitUntilExit } = render(
  React.createElement(App, { hostName }),
  { exitOnCtrlC: false }
);

// Watch for file-based trigger (cross-platform) + SIGUSR1 (Unix fallback)
const stopWatching = watchForTrigger(sessionId, () => {
  process.stdout.write('\x07');
  emitHostReady();
});

function cleanup() {
  stopWatching();
  removePidFile(sessionId);
}

process.on('exit', cleanup);

// SIGUSR1 fallback for Unix systems
if (process.platform !== 'win32') {
  process.on('SIGUSR1', () => {
    process.stdout.write('\x07');
    emitHostReady();
  });
}

// Handle SIGINT (Ctrl+C) — save session and exit gracefully
process.on('SIGINT', () => {
  unmount();
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  unmount();
  cleanup();
  process.exit(0);
});

waitUntilExit().then(() => {
  cleanup();
});
