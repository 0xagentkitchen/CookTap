import type { Grade } from '../engine/types.js';
import type { Category } from '../content/types.js';

export interface SessionRecord {
  id: string;
  drillId: string;
  category: Category;
  wpm: number;
  accuracy: number;
  alphaAccuracy: number;
  symbolAccuracy: number;
  elapsedSeconds: number;
  errorCount: number;
  totalChars: number;
  typedChars: number;
  grade: Grade;
  completedAt: string;
}

export interface PersonalBests {
  wpm: number;
  accuracy: number;
  symbolAccuracy: number;
  updatedAt: string;
}

export type CategoryPersonalBests = Record<Category, PersonalBests>;

export interface StreakData {
  currentDaily: number;
  longestDaily: number;
  lastDailyDate: string; // YYYY-MM-DD
  currentSession: number;
  longestSession: number;
}

export interface StoredStats {
  version: 1;
  sessions: SessionRecord[];
  personalBests: PersonalBests;
  categoryBests: CategoryPersonalBests;
  streaks: StreakData;
  /** Cumulative error counts per character (lowercase) for adaptive drill selection */
  errorHeatmap?: Record<string, number>;
  /** IDs of achievements already unlocked; optional for backwards compatibility with older stats files */
  earnedAchievementIds?: string[];
}

const emptyPB = (): PersonalBests => ({ wpm: 0, accuracy: 0, symbolAccuracy: 0, updatedAt: '' });

export function createEmptyStats(): StoredStats {
  return {
    version: 1,
    sessions: [],
    personalBests: emptyPB(),
    categoryBests: {
      words: emptyPB(),
      code: emptyPB(),
      cli: emptyPB(),
      technique: emptyPB(),
    },
    streaks: {
      currentDaily: 0,
      longestDaily: 0,
      lastDailyDate: '',
      currentSession: 0,
      longestSession: 0,
    },
  };
}
