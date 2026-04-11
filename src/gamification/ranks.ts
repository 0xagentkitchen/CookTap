import type { StoredStats, SessionRecord } from '../storage/types.js';

export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master';

export type Division = 'III' | 'II' | 'I';

export interface RankTier {
  rank: Rank;
  /** Master has no division (undefined) */
  division?: Division;
  /** Human-readable label, e.g. "Gold II" or "Master" */
  label: string;
}

export interface RankStatsInput {
  bestWpm: number;
  bestAccuracy: number;
  totalDrills: number;
  /** 0..1 — how close avgWpm is to bestWpm; higher is more consistent */
  consistency: number;
  avgWpm: number;
}

interface RankThreshold {
  rank: Rank;
  /** Inclusive lower bound on best WPM */
  minWpm: number;
  /** Exclusive upper bound on best WPM (Infinity for Master) */
  maxWpm: number;
  /** Minimum best accuracy (percentage, 0..100) */
  minAccuracy: number;
}

const RANK_THRESHOLDS: RankThreshold[] = [
  { rank: 'Bronze', minWpm: 0, maxWpm: 30, minAccuracy: 0 },
  { rank: 'Silver', minWpm: 30, maxWpm: 45, minAccuracy: 85 },
  { rank: 'Gold', minWpm: 45, maxWpm: 60, minAccuracy: 90 },
  { rank: 'Platinum', minWpm: 60, maxWpm: 80, minAccuracy: 93 },
  { rank: 'Diamond', minWpm: 80, maxWpm: 100, minAccuracy: 95 },
  { rank: 'Master', minWpm: 100, maxWpm: Infinity, minAccuracy: 97 },
];

const RANK_ORDER: Rank[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'];

function formatLabel(rank: Rank, division?: Division): string {
  return division ? `${rank} ${division}` : rank;
}

function makeTier(rank: Rank, division?: Division): RankTier {
  return { rank, division, label: formatLabel(rank, division) };
}

/**
 * Pick the best rank the stats qualify for. Walks from the highest rank down
 * and returns the first whose WPM floor and accuracy floor are both met.
 * Bronze is always a valid fallback.
 */
function selectRank(bestWpm: number, bestAccuracy: number): Rank {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = RANK_THRESHOLDS[i];
    if (bestWpm >= t.minWpm && bestAccuracy >= t.minAccuracy) {
      return t.rank;
    }
  }
  return 'Bronze';
}

/**
 * Determine the division (III, II, I) inside a rank band based on how far
 * the user has progressed through the WPM range and their drill experience.
 * Master has no division.
 */
function selectDivision(rank: Rank, bestWpm: number, totalDrills: number): Division | undefined {
  if (rank === 'Master') return undefined;

  const t = RANK_THRESHOLDS.find((x) => x.rank === rank)!;
  const span = t.maxWpm - t.minWpm;
  const wpmProgress = span > 0 ? Math.min(1, Math.max(0, (bestWpm - t.minWpm) / span)) : 0;

  // Drill experience nudges divisions up once the user has stuck with the rank.
  // At 0 drills this contributes 0; caps at 0.25 once totalDrills reaches 50.
  const drillBonus = Math.min(0.25, totalDrills / 200);

  const combined = Math.min(1, wpmProgress + drillBonus);

  if (combined >= 2 / 3) return 'I';
  if (combined >= 1 / 3) return 'II';
  return 'III';
}

/**
 * Compute a consistency score in [0, 1] by comparing avgWpm to bestWpm.
 * 1 means the user consistently performs at their peak; 0 means they rarely do.
 */
export function computeConsistency(sessions: readonly SessionRecord[]): number {
  if (sessions.length < 2) return 1;
  const wpms = sessions.map((s) => s.wpm);
  const best = Math.max(...wpms);
  if (best <= 0) return 1;
  const avg = wpms.reduce((acc, v) => acc + v, 0) / wpms.length;
  const ratio = avg / best;
  return Math.max(0, Math.min(1, ratio));
}

export function deriveRankStats(stats: StoredStats): RankStatsInput {
  const sessions = stats.sessions;
  const bestWpm = stats.personalBests.wpm;
  const bestAccuracy = stats.personalBests.accuracy;
  const totalDrills = sessions.length;
  const avgWpm = sessions.length === 0
    ? 0
    : sessions.reduce((acc, s) => acc + s.wpm, 0) / sessions.length;
  const consistency = computeConsistency(sessions);

  return { bestWpm, bestAccuracy, totalDrills, avgWpm, consistency };
}

/**
 * Pure function: compute the user's current rank tier from stats.
 * Accepts either a full StoredStats or a pre-derived RankStatsInput.
 */
export function calculateRank(stats: StoredStats | RankStatsInput): RankTier {
  const input: RankStatsInput = 'sessions' in stats ? deriveRankStats(stats) : stats;
  const rank = selectRank(input.bestWpm, input.bestAccuracy);
  const division = selectDivision(rank, input.bestWpm, input.totalDrills);
  return makeTier(rank, division);
}

export interface RankProgress {
  current: RankTier;
  next: RankTier | null;
  /** 0..1 progress toward `next` */
  progress: number;
  /** Human-readable description of what still blocks the next tier */
  gapDescription: string;
}

function nextTierAfter(current: RankTier): RankTier | null {
  if (current.rank === 'Master') return null;
  if (current.division === 'I') {
    const idx = RANK_ORDER.indexOf(current.rank);
    const nextRank = RANK_ORDER[idx + 1];
    if (!nextRank) return null;
    return makeTier(nextRank, nextRank === 'Master' ? undefined : 'III');
  }
  if (current.division === 'II') return makeTier(current.rank, 'I');
  if (current.division === 'III') return makeTier(current.rank, 'II');
  return null;
}

/**
 * Gives the UI a simple "how close am I to the next tier?" struct, including
 * the biggest gap (WPM or accuracy) so the UI can nudge the user toward it.
 */
export function nextRankProgress(stats: StoredStats | RankStatsInput): RankProgress {
  const input: RankStatsInput = 'sessions' in stats ? deriveRankStats(stats) : stats;
  const current = calculateRank(input);
  const next = nextTierAfter(current);

  if (!next) {
    return {
      current,
      next: null,
      progress: 1,
      gapDescription: 'You have reached the top rank.',
    };
  }

  // Determine the WPM target that the next tier needs.
  let targetWpm: number;
  if (next.rank === current.rank) {
    // Same rank, next division — needs a higher WPM slice within the band.
    const t = RANK_THRESHOLDS.find((x) => x.rank === current.rank)!;
    const span = t.maxWpm === Infinity ? 20 : t.maxWpm - t.minWpm;
    const step = span / 3;
    const divisionIndex = next.division === 'I' ? 3 : next.division === 'II' ? 2 : 1;
    targetWpm = t.minWpm + step * divisionIndex;
  } else {
    // Stepping up a rank — the floor of the new rank is the target.
    const nextThreshold = RANK_THRESHOLDS.find((x) => x.rank === next.rank)!;
    targetWpm = nextThreshold.minWpm;
  }

  const nextThreshold = RANK_THRESHOLDS.find((x) => x.rank === next.rank)!;
  const wpmGap = Math.max(0, targetWpm - input.bestWpm);
  const accGap = Math.max(0, nextThreshold.minAccuracy - input.bestAccuracy);

  // Progress is the worst axis (so both must be satisfied to reach 1).
  const wpmProgress = targetWpm > 0 ? Math.min(1, input.bestWpm / targetWpm) : 1;
  const accProgress = nextThreshold.minAccuracy > 0
    ? Math.min(1, input.bestAccuracy / nextThreshold.minAccuracy)
    : 1;
  const progress = Math.min(wpmProgress, accProgress);

  let gapDescription: string;
  if (wpmGap > 0 && accGap > 0) {
    gapDescription = `${wpmGap.toFixed(0)} WPM and ${accGap.toFixed(1)}% accuracy away from ${next.label}`;
  } else if (wpmGap > 0) {
    gapDescription = `${wpmGap.toFixed(0)} WPM away from ${next.label}`;
  } else if (accGap > 0) {
    gapDescription = `${accGap.toFixed(1)}% accuracy away from ${next.label}`;
  } else {
    gapDescription = `Complete another qualifying drill to reach ${next.label}`;
  }

  return { current, next, progress, gapDescription };
}

export const __test__ = {
  RANK_THRESHOLDS,
  RANK_ORDER,
  selectRank,
  selectDivision,
  nextTierAfter,
};
