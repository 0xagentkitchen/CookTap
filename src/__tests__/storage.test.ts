import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Set COOKTAP_HOME to a temp dir BEFORE importing modules (they read it at import time)
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cooktap-test-'));
process.env.COOKTAP_HOME = TEST_DIR;

// Dynamic imports so env var is set before module-level const evaluation
const { loadStats, saveStats, recordSession } = await import('../storage/storage.js');
const { createEmptyStats } = await import('../storage/types.js');
const { saveSuspendedSession, loadSuspendedSession, clearSuspendedSession, hasSuspendedSession } = await import('../storage/session-store.js');
const { writePidFile, removePidFile, cleanStalePidFiles, getActiveSessions } = await import('../ipc/session-identity.js');
import type { SessionResult } from '../engine/types.js';

afterAll(() => {
  // Clean up temp dir
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  delete process.env.COOKTAP_HOME;
});

describe('storage', () => {
  it('loadStats returns empty stats when no file exists', () => {
    const stats = loadStats();
    expect(stats.version).toBe(1);
    expect(Array.isArray(stats.sessions)).toBe(true);
    expect(stats.sessions).toHaveLength(0);
  });

  it('recordSession adds a session and updates PBs', () => {
    const result: SessionResult = {
      drillId: 'test:1',
      wpm: 50,
      accuracy: 95,
      alphaAccuracy: 96,
      symbolAccuracy: 90,
      elapsedSeconds: 10,
      errorCount: 2,
      totalChars: 40,
      typedChars: 40,
      grade: 'A',
      completedAt: new Date().toISOString(),
    };

    const { record, isNewPbWpm, isCategoryPbWpm, stats } = recordSession(result, 'code');
    expect(record.wpm).toBe(50);
    expect(record.category).toBe('code');
    expect(stats.sessions.length).toBeGreaterThan(0);
    expect(stats.personalBests.wpm).toBeGreaterThanOrEqual(50);
    expect(stats.categoryBests.code.wpm).toBeGreaterThanOrEqual(50);
  });
});

describe('session-store', () => {
  afterEach(() => {
    clearSuspendedSession();
  });

  it('round-trips session data', () => {
    const data = {
      state: {
        phase: 'running' as const,
        drillId: 'test',
        targetText: 'hello',
        chars: [],
        cursorPosition: 3,
        errorCount: 0,
        alphaTyped: 3,
        alphaErrors: 0,
        symbolTyped: 0,
        symbolErrors: 0,
        startedAt: 1000,
        pausedAt: null,
        pausedDurationMs: 0,
        finishedAt: null,
        lastTickAt: 2000,
      },
    };

    saveSuspendedSession(data);
    expect(hasSuspendedSession()).toBe(true);

    const loaded = loadSuspendedSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.drillId).toBe('test');
    expect(loaded!.state.cursorPosition).toBe(3);

    clearSuspendedSession();
    expect(hasSuspendedSession()).toBe(false);
  });
});

describe('session-identity', () => {
  const testSessionId = 'test-session-' + Date.now();

  afterEach(() => {
    removePidFile(testSessionId);
  });

  it('writes and removes PID file', () => {
    writePidFile(testSessionId);
    const sessions = getActiveSessions();
    const found = sessions.find((s) => s.sessionId === testSessionId);
    expect(found).toBeDefined();
    expect(found!.pid).toBe(process.pid);

    removePidFile(testSessionId);
    const after = getActiveSessions();
    expect(after.find((s) => s.sessionId === testSessionId)).toBeUndefined();
  });

  it('cleanStalePidFiles removes dead PIDs', () => {
    const fakeId = 'fake-dead-' + Date.now();
    const sessionsDir = path.join(TEST_DIR, 'sessions');
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDir, `${fakeId}.pid`),
      JSON.stringify({ pid: 99999999, sessionId: fakeId, startedAt: new Date().toISOString() })
    );

    cleanStalePidFiles();

    const remaining = getActiveSessions();
    expect(remaining.find((s) => s.sessionId === fakeId)).toBeUndefined();
  });
});
