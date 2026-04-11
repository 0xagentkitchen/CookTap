import type { StoredStats, SessionRecord } from '../storage/types.js';
import type { Category } from '../content/types.js';
import { MILESTONES, milestonesMet, type Milestone } from './milestones.js';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** ISO timestamp when unlocked; undefined if still locked */
  unlockedAt?: string;
  /** Optional icon identifier (string, not emoji) for UI to map */
  icon?: string;
}

interface SpecialAchievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  /** Pure predicate — given stats and history, is this unlocked? */
  isEarned: (stats: StoredStats, sessions: readonly SessionRecord[]) => boolean;
}

function countSGradesInCategory(sessions: readonly SessionRecord[], category: Category): number {
  let n = 0;
  for (const s of sessions) if (s.category === category && s.grade === 'S') n++;
  return n;
}

function countDrillsInCategory(sessions: readonly SessionRecord[], category: Category): number {
  let n = 0;
  for (const s of sessions) if (s.category === category) n++;
  return n;
}

/**
 * Specials are achievements that don't map 1:1 to a milestone and need
 * custom predicates. IDs are stable and live alongside milestone IDs
 * in `stats.earnedAchievementIds`.
 */
const SPECIAL_ACHIEVEMENTS: SpecialAchievement[] = [
  {
    id: 'code-master-10-s',
    title: 'Code Master',
    description: 'Earn 10 S-grades in the code category.',
    icon: 'code-master',
    isEarned: (_stats, sessions) => countSGradesInCategory(sessions, 'code') >= 10,
  },
  {
    id: 'cli-legend-50',
    title: 'CLI Legend',
    description: 'Complete 50 drills in the cli category.',
    icon: 'cli-legend',
    isEarned: (_stats, sessions) => countDrillsInCategory(sessions, 'cli') >= 50,
  },
  {
    id: 'words-wizard-10-s',
    title: 'Words Wizard',
    description: 'Earn 10 S-grades in the words category.',
    icon: 'words-wizard',
    isEarned: (_stats, sessions) => countSGradesInCategory(sessions, 'words') >= 10,
  },
  {
    id: 'symbol-sharpshooter',
    title: 'Symbol Sharpshooter',
    description: 'Reach 95% symbol accuracy.',
    icon: 'symbol-sharpshooter',
    isEarned: (stats) => stats.personalBests.symbolAccuracy >= 95,
  },
];

function milestoneToAchievement(m: Milestone): Omit<Achievement, 'unlockedAt'> {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    icon: `milestone-${m.category}`,
  };
}

/** The full catalog of known achievements (milestones + specials). */
export const ACHIEVEMENTS: ReadonlyArray<Omit<Achievement, 'unlockedAt'>> = [
  ...MILESTONES.map(milestoneToAchievement),
  ...SPECIAL_ACHIEVEMENTS.map((s) => ({ id: s.id, title: s.title, description: s.description, icon: s.icon })),
];

export interface AchievementEvaluation {
  /** Every currently-earned achievement, with unlockedAt preserved for ones already in storage. */
  earned: Achievement[];
  /** Achievements newly unlocked since the last evaluation (not in stats.earnedAchievementIds). */
  newlyEarned: Achievement[];
}

/**
 * Pure function: return the complete current state of achievements for the
 * given stats + session history. `sessionHistory` may be passed explicitly
 * (useful for tests/snapshots) or defaults to `stats.sessions`.
 *
 * Compares against `stats.earnedAchievementIds` (if present) to figure out
 * which achievements are newly earned. The caller is responsible for
 * persisting the resulting IDs back into storage.
 */
export function evaluateAchievements(
  stats: StoredStats,
  sessionHistory?: readonly SessionRecord[],
): AchievementEvaluation {
  const sessions = sessionHistory ?? stats.sessions;
  const previouslyEarnedIds = new Set(stats.earnedAchievementIds ?? []);
  const now = new Date().toISOString();

  // Milestones currently met (by computing on a stats view with the given history).
  const statsForMilestones: StoredStats = sessionHistory
    ? { ...stats, sessions: [...sessionHistory] }
    : stats;
  const metMilestoneIds = new Set(milestonesMet(statsForMilestones).map((m) => m.id));

  // Specials currently met
  const metSpecialIds = new Set(
    SPECIAL_ACHIEVEMENTS.filter((s) => s.isEarned(stats, sessions)).map((s) => s.id),
  );

  const earned: Achievement[] = [];
  const newlyEarned: Achievement[] = [];

  for (const base of ACHIEVEMENTS) {
    const isMet = metMilestoneIds.has(base.id) || metSpecialIds.has(base.id);
    if (!isMet) continue;

    const wasPreviouslyEarned = previouslyEarnedIds.has(base.id);
    const achievement: Achievement = {
      ...base,
      unlockedAt: wasPreviouslyEarned ? undefined : now,
    };
    earned.push(achievement);
    if (!wasPreviouslyEarned) newlyEarned.push(achievement);
  }

  return { earned, newlyEarned };
}
