import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SessionRecord, StoredStats } from './types.js';
import { createEmptyStats } from './types.js';
import type { SessionResult } from '../engine/types.js';
import type { Category } from '../content/types.js';
import { checkMilestonesCrossed, type Milestone } from '../gamification/milestones.js';
import { evaluateAchievements, type Achievement } from '../gamification/achievements.js';

const COOKTAP_DIR = process.env.COOKTAP_HOME || path.join(os.homedir(), '.cooktap');
const STATS_FILE = path.join(COOKTAP_DIR, 'stats.json');

function ensureDir(): void {
  if (!fs.existsSync(COOKTAP_DIR)) {
    fs.mkdirSync(COOKTAP_DIR, { recursive: true });
  }
}

export function loadStats(): StoredStats {
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    const data = JSON.parse(raw) as StoredStats;
    // Ensure categoryBests exists (migration from older stats files)
    if (!data.categoryBests) {
      data.categoryBests = createEmptyStats().categoryBests;
    }
    // Backfill any category keys added since this stats file was written
    const defaults = createEmptyStats().categoryBests;
    for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
      if (!data.categoryBests[key]) {
        data.categoryBests[key] = defaults[key];
      }
    }
    return data;
  } catch {
    return createEmptyStats();
  }
}

export function saveStats(stats: StoredStats): void {
  ensureDir();
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordSession(result: SessionResult, category: Category, missedKeys?: Map<string, number>): {
  record: SessionRecord;
  isNewPbWpm: boolean;
  isNewPbAccuracy: boolean;
  isCategoryPbWpm: boolean;
  stats: StoredStats;
  crossedMilestones: Milestone[];
  newlyEarnedAchievements: Achievement[];
} {
  const stats = loadStats();
  const prevStatsSnapshot: StoredStats = JSON.parse(JSON.stringify(stats));

  const record: SessionRecord = {
    id: generateId(),
    drillId: result.drillId,
    category,
    wpm: result.wpm,
    accuracy: result.accuracy,
    alphaAccuracy: result.alphaAccuracy,
    symbolAccuracy: result.symbolAccuracy,
    elapsedSeconds: result.elapsedSeconds,
    errorCount: result.errorCount,
    totalChars: result.totalChars,
    typedChars: result.typedChars,
    grade: result.grade,
    completedAt: result.completedAt,
  };

  stats.sessions.push(record);

  // Overall personal bests
  let isNewPbWpm = false;
  let isNewPbAccuracy = false;
  if (result.wpm > stats.personalBests.wpm) {
    stats.personalBests.wpm = result.wpm;
    stats.personalBests.updatedAt = result.completedAt;
    isNewPbWpm = true;
  }
  if (result.accuracy > stats.personalBests.accuracy) {
    stats.personalBests.accuracy = result.accuracy;
    stats.personalBests.updatedAt = result.completedAt;
    isNewPbAccuracy = true;
  }
  if (result.symbolAccuracy > stats.personalBests.symbolAccuracy) {
    stats.personalBests.symbolAccuracy = result.symbolAccuracy;
  }

  // Category personal bests
  let isCategoryPbWpm = false;
  const catBest = stats.categoryBests[category];
  if (result.wpm > catBest.wpm) {
    catBest.wpm = result.wpm;
    catBest.updatedAt = result.completedAt;
    isCategoryPbWpm = true;
  }
  if (result.accuracy > catBest.accuracy) {
    catBest.accuracy = result.accuracy;
    catBest.updatedAt = result.completedAt;
  }
  if (result.symbolAccuracy > catBest.symbolAccuracy) {
    catBest.symbolAccuracy = result.symbolAccuracy;
  }

  // Streaks
  const today = todayStr();
  if (stats.streaks.lastDailyDate === today) {
    // Same day
  } else if (stats.streaks.lastDailyDate === yesterday(today)) {
    stats.streaks.currentDaily += 1;
  } else if (stats.streaks.lastDailyDate === '') {
    stats.streaks.currentDaily = 1;
  } else {
    stats.streaks.currentDaily = 1;
  }
  stats.streaks.lastDailyDate = today;
  stats.streaks.longestDaily = Math.max(stats.streaks.longestDaily, stats.streaks.currentDaily);
  stats.streaks.currentSession += 1;
  stats.streaks.longestSession = Math.max(stats.streaks.longestSession, stats.streaks.currentSession);

  // Merge missed keys into error heatmap for adaptive drill selection
  if (missedKeys && missedKeys.size > 0) {
    if (!stats.errorHeatmap) stats.errorHeatmap = {};
    for (const [key, count] of missedKeys) {
      stats.errorHeatmap[key] = (stats.errorHeatmap[key] || 0) + count;
    }
  }

  // Detect milestones crossed and achievements earned on this drill
  const crossedMilestones = checkMilestonesCrossed(prevStatsSnapshot, stats);
  const { newlyEarned: newlyEarnedAchievements } = evaluateAchievements(stats);
  if (newlyEarnedAchievements.length > 0) {
    const existing = new Set(stats.earnedAchievementIds ?? []);
    for (const a of newlyEarnedAchievements) existing.add(a.id);
    stats.earnedAchievementIds = [...existing];
  }

  saveStats(stats);
  return {
    record,
    isNewPbWpm,
    isNewPbAccuracy,
    isCategoryPbWpm,
    stats,
    crossedMilestones,
    newlyEarnedAchievements,
  };
}

function yesterday(todayIso: string): string {
  const d = new Date(todayIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function resetStats(): void {
  saveStats(createEmptyStats());
}

export function getErrorHeatmap(): Record<string, number> {
  const stats = loadStats();
  return stats.errorHeatmap || {};
}


