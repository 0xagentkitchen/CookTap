import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const COOKTAP_DIR = process.env.COOKTAP_HOME || path.join(os.homedir(), '.cooktap');
const SESSIONS_DIR = path.join(COOKTAP_DIR, 'sessions');

export interface SessionPidEntry {
  pid: number;
  sessionId: string;
  startedAt: string;
}

function ensureDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function pidFilePath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.pid`);
}

function triggerFilePath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.trigger`);
}

export function writePidFile(sessionId: string): void {
  ensureDir();
  const entry: SessionPidEntry = {
    pid: process.pid,
    sessionId,
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(pidFilePath(sessionId), JSON.stringify(entry));
}

export function removePidFile(sessionId: string): void {
  try {
    fs.unlinkSync(pidFilePath(sessionId));
  } catch {
    // already gone
  }
  try {
    fs.unlinkSync(triggerFilePath(sessionId));
  } catch {
    // already gone
  }
}

/**
 * Poll for a trigger file — cross-platform notification mechanism.
 * notify.sh writes a .trigger file; we detect it via polling and fire the callback.
 * Uses setInterval instead of fs.watch to avoid EMFILE (too many open files) errors.
 * Returns a cleanup function to stop polling.
 */
export function watchForTrigger(sessionId: string, onTrigger: () => void): () => void {
  ensureDir();
  const triggerPath = triggerFilePath(sessionId);

  // Clean up any leftover trigger file
  try { fs.unlinkSync(triggerPath); } catch { /* ok */ }

  // Poll every 500ms for the trigger file
  const interval = setInterval(() => {
    if (fs.existsSync(triggerPath)) {
      try { fs.unlinkSync(triggerPath); } catch { /* ok */ }
      onTrigger();
    }
  }, 500);

  return () => {
    clearInterval(interval);
    try { fs.unlinkSync(triggerPath); } catch { /* ok */ }
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function cleanStalePidFiles(): void {
  ensureDir();
  let files: string[];
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.pid'));
  } catch {
    return;
  }

  for (const file of files) {
    const fullPath = path.join(SESSIONS_DIR, file);
    try {
      const entry = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as SessionPidEntry;
      if (!isProcessAlive(entry.pid)) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // Corrupt file, remove it
      try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
    }
  }
}

export function getActiveSessions(): SessionPidEntry[] {
  ensureDir();
  let files: string[];
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.pid'));
  } catch {
    return [];
  }

  const active: SessionPidEntry[] = [];
  for (const file of files) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8')) as SessionPidEntry;
      if (isProcessAlive(entry.pid)) {
        active.push(entry);
      }
    } catch {
      // skip corrupt
    }
  }
  return active;
}
