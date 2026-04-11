import { describe, it, expect } from 'vitest';
import type { StoredStats, SessionRecord } from '../storage/types.js';
import { createEmptyStats } from '../storage/types.js';
import type { Category } from '../content/types.js';
import type { Grade } from '../engine/types.js';
import {
  calculateRank,
  nextRankProgress,
  computeConsistency,
  checkMilestonesCrossed,
  milestonesMet,
  evaluateAchievements,
  MILESTONES,
  ACHIEVEMENTS,
} from '../gamification/index.js';

function makeSession(opts: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: opts.id ?? Math.random().toString(36).slice(2),
    drillId: opts.drillId ?? 'drill:1',
    category: (opts.category ?? 'code') as Category,
    wpm: opts.wpm ?? 50,
    accuracy: opts.accuracy ?? 95,
    alphaAccuracy: opts.alphaAccuracy ?? 96,
    symbolAccuracy: opts.symbolAccuracy ?? 90,
    elapsedSeconds: opts.elapsedSeconds ?? 10,
    errorCount: opts.errorCount ?? 2,
    totalChars: opts.totalChars ?? 40,
    typedChars: opts.typedChars ?? 40,
    grade: (opts.grade ?? 'A') as Grade,
    completedAt: opts.completedAt ?? new Date().toISOString(),
  };
}

function makeStats(overrides: Partial<StoredStats> = {}): StoredStats {
  const base = createEmptyStats();
  return {
    ...base,
    ...overrides,
    personalBests: { ...base.personalBests, ...(overrides.personalBests ?? {}) },
    streaks: { ...base.streaks, ...(overrides.streaks ?? {}) },
  };
}

describe('ranks', () => {
  it('returns Bronze III for a brand-new user', () => {
    const stats = makeStats();
    const tier = calculateRank(stats);
    expect(tier.rank).toBe('Bronze');
    expect(tier.division).toBe('III');
    expect(tier.label).toBe('Bronze III');
  });

  it('returns Silver for WPM in Silver range with sufficient accuracy', () => {
    const stats = makeStats({
      personalBests: { wpm: 38, accuracy: 88, symbolAccuracy: 85, updatedAt: '' },
    });
    const tier = calculateRank(stats);
    expect(tier.rank).toBe('Silver');
  });

  it('does not promote past Bronze if accuracy is too low', () => {
    const stats = makeStats({
      personalBests: { wpm: 55, accuracy: 70, symbolAccuracy: 60, updatedAt: '' },
    });
    const tier = calculateRank(stats);
    // 70% accuracy fails Silver/Gold/etc. thresholds, so falls back to Bronze.
    expect(tier.rank).toBe('Bronze');
  });

  it('returns Master (no division) at 100+ WPM and 97+ accuracy', () => {
    const stats = makeStats({
      personalBests: { wpm: 110, accuracy: 98, symbolAccuracy: 97, updatedAt: '' },
    });
    const tier = calculateRank(stats);
    expect(tier.rank).toBe('Master');
    expect(tier.division).toBeUndefined();
    expect(tier.label).toBe('Master');
  });

  it('picks higher divisions for users deeper into the WPM band', () => {
    const low = calculateRank(makeStats({
      personalBests: { wpm: 46, accuracy: 92, symbolAccuracy: 90, updatedAt: '' },
    }));
    const high = calculateRank(makeStats({
      personalBests: { wpm: 59, accuracy: 92, symbolAccuracy: 90, updatedAt: '' },
    }));
    expect(low.rank).toBe('Gold');
    expect(high.rank).toBe('Gold');
    // Higher WPM within the Gold band should yield a better (lower-numeral) division.
    const order = ['III', 'II', 'I'] as const;
    expect(order.indexOf(high.division!)).toBeGreaterThan(order.indexOf(low.division!));
  });

  it('nextRankProgress reports a non-null next tier for non-Master', () => {
    const stats = makeStats({
      personalBests: { wpm: 32, accuracy: 87, symbolAccuracy: 85, updatedAt: '' },
    });
    const progress = nextRankProgress(stats);
    expect(progress.current.rank).toBe('Silver');
    expect(progress.next).not.toBeNull();
    expect(progress.progress).toBeGreaterThan(0);
    expect(progress.progress).toBeLessThanOrEqual(1);
    expect(progress.gapDescription.length).toBeGreaterThan(0);
  });

  it('nextRankProgress returns null next at Master', () => {
    const stats = makeStats({
      personalBests: { wpm: 130, accuracy: 99, symbolAccuracy: 98, updatedAt: '' },
    });
    const progress = nextRankProgress(stats);
    expect(progress.current.rank).toBe('Master');
    expect(progress.next).toBeNull();
    expect(progress.progress).toBe(1);
  });

  it('computeConsistency is 1 when avg equals best', () => {
    const sessions = [makeSession({ wpm: 50 }), makeSession({ wpm: 50 })];
    expect(computeConsistency(sessions)).toBeCloseTo(1);
  });

  it('computeConsistency drops when variance is high', () => {
    const sessions = [makeSession({ wpm: 100 }), makeSession({ wpm: 20 })];
    const c = computeConsistency(sessions);
    expect(c).toBeLessThan(1);
    expect(c).toBeGreaterThanOrEqual(0);
  });
});

describe('milestones', () => {
  it('exports all required milestone categories', () => {
    const categories = new Set(MILESTONES.map((m) => m.category));
    expect(categories.has('wpm')).toBe(true);
    expect(categories.has('accuracy')).toBe(true);
    expect(categories.has('drills')).toBe(true);
    expect(categories.has('streak')).toBe(true);
    expect(categories.has('grade')).toBe(true);
  });

  it('detects a freshly-crossed WPM milestone', () => {
    const prev = makeStats({
      personalBests: { wpm: 38, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
    });
    const next = makeStats({
      personalBests: { wpm: 41, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
    });
    const crossed = checkMilestonesCrossed(prev, next);
    const ids = crossed.map((m) => m.id);
    expect(ids).toContain('wpm-40');
    expect(ids).not.toContain('wpm-50');
  });

  it('does not re-report a milestone that was already crossed', () => {
    const prev = makeStats({
      personalBests: { wpm: 45, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
    });
    const next = makeStats({
      personalBests: { wpm: 47, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
    });
    const crossed = checkMilestonesCrossed(prev, next);
    expect(crossed.map((m) => m.id)).not.toContain('wpm-40');
  });

  it('detects a crossed drill count milestone', () => {
    const mk = (n: number) => {
      const s = makeStats();
      s.sessions = Array.from({ length: n }, (_, i) => makeSession({ id: `s-${i}` }));
      return s;
    };
    const crossed = checkMilestonesCrossed(mk(9), mk(10));
    expect(crossed.map((m) => m.id)).toContain('drills-10');
  });

  it('detects a daily streak milestone crossing', () => {
    const prev = makeStats({ streaks: { currentDaily: 2, longestDaily: 2, lastDailyDate: '', currentSession: 0, longestSession: 0 } });
    const next = makeStats({ streaks: { currentDaily: 3, longestDaily: 3, lastDailyDate: '', currentSession: 0, longestSession: 0 } });
    const crossed = checkMilestonesCrossed(prev, next);
    expect(crossed.map((m) => m.id)).toContain('streak-3');
  });

  it('detects a first S-grade crossing via the grade category', () => {
    const prev = makeStats();
    prev.sessions = [makeSession({ grade: 'A' })];
    const next = makeStats();
    next.sessions = [makeSession({ grade: 'A' }), makeSession({ grade: 'S' })];
    const crossed = checkMilestonesCrossed(prev, next);
    expect(crossed.map((m) => m.id)).toContain('grade-first-s');
  });

  it('detects a 100% accuracy first-perfect crossing', () => {
    const prev = makeStats();
    prev.sessions = [makeSession({ accuracy: 98 })];
    const next = makeStats();
    next.sessions = [makeSession({ accuracy: 98 }), makeSession({ accuracy: 100 })];
    const crossed = checkMilestonesCrossed(prev, next);
    expect(crossed.map((m) => m.id)).toContain('accuracy-first-perfect');
  });

  it('milestonesMet is consistent with checkMilestonesCrossed', () => {
    const stats = makeStats({
      personalBests: { wpm: 60, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
    });
    const met = milestonesMet(stats).map((m) => m.id);
    expect(met).toContain('wpm-40');
    expect(met).toContain('wpm-50');
    expect(met).toContain('wpm-60');
    expect(met).not.toContain('wpm-75');
  });
});

describe('achievements', () => {
  it('ACHIEVEMENTS catalog includes all milestones plus specials', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(MILESTONES.length);
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const m of MILESTONES) expect(ids.has(m.id)).toBe(true);
    expect(ids.has('code-master-10-s')).toBe(true);
  });

  it('returns empty earned for a fresh user', () => {
    const stats = makeStats();
    const evalResult = evaluateAchievements(stats);
    expect(evalResult.earned).toHaveLength(0);
    expect(evalResult.newlyEarned).toHaveLength(0);
  });

  it('reports a new milestone achievement as newlyEarned on first evaluation', () => {
    const stats = makeStats({
      personalBests: { wpm: 42, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
    });
    const result = evaluateAchievements(stats);
    const ids = result.earned.map((a) => a.id);
    expect(ids).toContain('wpm-40');
    expect(result.newlyEarned.map((a) => a.id)).toContain('wpm-40');
  });

  it('does not re-report achievements already in earnedAchievementIds', () => {
    const stats = makeStats({
      personalBests: { wpm: 42, accuracy: 95, symbolAccuracy: 90, updatedAt: '' },
      earnedAchievementIds: ['wpm-40'],
    });
    const result = evaluateAchievements(stats);
    expect(result.newlyEarned.map((a) => a.id)).not.toContain('wpm-40');
    // But it's still reported as earned.
    expect(result.earned.map((a) => a.id)).toContain('wpm-40');
  });

  it('unlocks Code Master after 10 S-grades in the code category', () => {
    const stats = makeStats();
    stats.sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ id: `c-${i}`, category: 'code', grade: 'S' }),
    );
    const result = evaluateAchievements(stats);
    expect(result.earned.map((a) => a.id)).toContain('code-master-10-s');
    expect(result.newlyEarned.map((a) => a.id)).toContain('code-master-10-s');
  });

  it('does not unlock Code Master with only 9 code S-grades', () => {
    const stats = makeStats();
    stats.sessions = Array.from({ length: 9 }, (_, i) =>
      makeSession({ id: `c-${i}`, category: 'code', grade: 'S' }),
    );
    const result = evaluateAchievements(stats);
    expect(result.earned.map((a) => a.id)).not.toContain('code-master-10-s');
  });

  it('is backwards compatible when earnedAchievementIds is undefined', () => {
    const stats = makeStats({
      personalBests: { wpm: 100, accuracy: 98, symbolAccuracy: 97, updatedAt: '' },
    });
    // Simulate old stats file — no earnedAchievementIds field.
    delete (stats as Partial<StoredStats>).earnedAchievementIds;
    const result = evaluateAchievements(stats);
    expect(result.earned.length).toBeGreaterThan(0);
    // Everything earned should be newlyEarned since there's no prior record.
    expect(result.newlyEarned.length).toBe(result.earned.length);
  });
});
