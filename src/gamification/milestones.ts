import type { StoredStats, SessionRecord } from '../storage/types.js';

export type MilestoneCategory = 'wpm' | 'accuracy' | 'drills' | 'streak' | 'grade';

export interface Milestone {
  id: string;
  category: MilestoneCategory;
  /** Numeric threshold (WPM, drill count, streak length, etc.) */
  threshold: number;
  title: string;
  description: string;
}

export const MILESTONES: Milestone[] = [
  // WPM milestones (based on bestWpm)
  { id: 'wpm-40', category: 'wpm', threshold: 40, title: '40 WPM', description: 'Reach 40 words per minute.' },
  { id: 'wpm-50', category: 'wpm', threshold: 50, title: '50 WPM', description: 'Reach 50 words per minute.' },
  { id: 'wpm-60', category: 'wpm', threshold: 60, title: '60 WPM', description: 'Reach 60 words per minute.' },
  { id: 'wpm-75', category: 'wpm', threshold: 75, title: '75 WPM', description: 'Reach 75 words per minute.' },
  { id: 'wpm-90', category: 'wpm', threshold: 90, title: '90 WPM', description: 'Reach 90 words per minute.' },
  { id: 'wpm-100', category: 'wpm', threshold: 100, title: '100 WPM Club', description: 'Join the 100 WPM club.' },
  { id: 'wpm-120', category: 'wpm', threshold: 120, title: '120 WPM', description: 'Reach 120 words per minute.' },

  // Accuracy milestones
  {
    id: 'accuracy-first-perfect',
    category: 'accuracy',
    threshold: 100,
    title: 'Flawless',
    description: 'Complete a drill with 100% accuracy.',
  },
  {
    id: 'accuracy-10-s-grade-streak',
    category: 'accuracy',
    threshold: 10,
    title: 'Locked In',
    description: 'Earn 10 S-grades in a row.',
  },

  // Drill count milestones
  { id: 'drills-10', category: 'drills', threshold: 10, title: 'Getting Started', description: 'Complete 10 drills.' },
  { id: 'drills-50', category: 'drills', threshold: 50, title: 'Practicing', description: 'Complete 50 drills.' },
  { id: 'drills-100', category: 'drills', threshold: 100, title: 'Regular', description: 'Complete 100 drills.' },
  { id: 'drills-500', category: 'drills', threshold: 500, title: 'Dedicated', description: 'Complete 500 drills.' },
  { id: 'drills-1000', category: 'drills', threshold: 1000, title: 'Keyboard Demon', description: 'Complete 1000 drills.' },

  // Daily streak milestones
  { id: 'streak-3', category: 'streak', threshold: 3, title: '3 Day Streak', description: 'Practice 3 days in a row.' },
  { id: 'streak-7', category: 'streak', threshold: 7, title: 'Weekly Habit', description: 'Practice 7 days in a row.' },
  { id: 'streak-14', category: 'streak', threshold: 14, title: 'Two Weeks Strong', description: 'Practice 14 days in a row.' },
  { id: 'streak-30', category: 'streak', threshold: 30, title: 'Monthly Grinder', description: 'Practice 30 days in a row.' },
  { id: 'streak-100', category: 'streak', threshold: 100, title: 'Century Streak', description: 'Practice 100 days in a row.' },

  // Grade milestones
  { id: 'grade-first-s', category: 'grade', threshold: 1, title: 'First S-Grade', description: 'Earn your first S-grade.' },
  { id: 'grade-10-s', category: 'grade', threshold: 10, title: 'S-Tier', description: 'Earn 10 total S-grades.' },
];

/** Count total S-grade sessions across history. */
export function countSGrades(sessions: readonly SessionRecord[]): number {
  let n = 0;
  for (const s of sessions) if (s.grade === 'S') n++;
  return n;
}

/** Trailing run of consecutive S-grades at the end of the session history. */
export function trailingSGradeStreak(sessions: readonly SessionRecord[]): number {
  let n = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].grade === 'S') n++;
    else break;
  }
  return n;
}

/** Whether any session in history reached 100% accuracy. */
export function hasPerfectAccuracy(sessions: readonly SessionRecord[]): boolean {
  for (const s of sessions) if (s.accuracy >= 100) return true;
  return false;
}

interface MilestoneSnapshot {
  bestWpm: number;
  drillCount: number;
  dailyStreak: number;
  sGradeCount: number;
  sGradeStreak: number;
  hadPerfect: boolean;
}

function snapshot(stats: StoredStats): MilestoneSnapshot {
  return {
    bestWpm: stats.personalBests.wpm,
    drillCount: stats.sessions.length,
    dailyStreak: stats.streaks.currentDaily,
    sGradeCount: countSGrades(stats.sessions),
    sGradeStreak: trailingSGradeStreak(stats.sessions),
    hadPerfect: hasPerfectAccuracy(stats.sessions),
  };
}

function meetsMilestone(m: Milestone, snap: MilestoneSnapshot): boolean {
  switch (m.category) {
    case 'wpm':
      return snap.bestWpm >= m.threshold;
    case 'drills':
      return snap.drillCount >= m.threshold;
    case 'streak':
      return snap.dailyStreak >= m.threshold;
    case 'accuracy':
      if (m.id === 'accuracy-first-perfect') return snap.hadPerfect;
      if (m.id === 'accuracy-10-s-grade-streak') return snap.sGradeStreak >= m.threshold;
      return false;
    case 'grade':
      return snap.sGradeCount >= m.threshold;
  }
}

/**
 * Returns the milestones that were just crossed going from prevStats to newStats.
 * A milestone is "crossed" when it was NOT met before but IS met now.
 * Pure function — no I/O, no mutation.
 */
export function checkMilestonesCrossed(prevStats: StoredStats, newStats: StoredStats): Milestone[] {
  const prev = snapshot(prevStats);
  const next = snapshot(newStats);

  const crossed: Milestone[] = [];
  for (const m of MILESTONES) {
    if (!meetsMilestone(m, prev) && meetsMilestone(m, next)) {
      crossed.push(m);
    }
  }
  return crossed;
}

/** Returns every milestone currently met by the given stats. */
export function milestonesMet(stats: StoredStats): Milestone[] {
  const snap = snapshot(stats);
  return MILESTONES.filter((m) => meetsMilestone(m, snap));
}
