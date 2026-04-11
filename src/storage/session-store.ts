import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SerializedEngine } from '../engine/typing-engine.js';

const COOKTAP_DIR = process.env.COOKTAP_HOME || path.join(os.homedir(), '.cooktap');
const SESSION_FILE = path.join(COOKTAP_DIR, 'suspended-session.json');

function ensureDir(): void {
  if (!fs.existsSync(COOKTAP_DIR)) {
    fs.mkdirSync(COOKTAP_DIR, { recursive: true });
  }
}

export function saveSuspendedSession(data: SerializedEngine): void {
  ensureDir();
  const wrapped = { ...data, savedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(wrapped, null, 2));
}

export function loadSuspendedSession(): SerializedEngine | null {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed as SerializedEngine;
  } catch {
    return null;
  }
}

export function clearSuspendedSession(): void {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {
    // file doesn't exist, that's fine
  }
}

export function hasSuspendedSession(): boolean {
  return fs.existsSync(SESSION_FILE);
}
