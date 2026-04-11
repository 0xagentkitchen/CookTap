import type { Grade } from '../engine/types.js';

export interface SessionStats {
  drillCount: number;
  totalTime: number; // seconds
  avgWpm: number;
  avgAccuracy: number;
  totalErrors: number;
  totalChars: number;
  missedKeys: Record<string, number>; // cumulative across session
}

export type ShareMode = 'drill' | 'session' | 'global';

export interface GlobalStats {
  totalDrills: number;
  totalTime: number; // seconds
  totalChars: number;
  avgWpm: number;
  avgAccuracy: number;
  bestWpm: number;
  bestAccuracy: number;
  longestStreak: number;
  missedKeys: Record<string, number>;
}

export interface ShareData {
  mode: ShareMode;
  wpm: number;
  accuracy: number;
  alphaAccuracy: number;
  symbolAccuracy: number;
  grade: Grade;
  elapsedSeconds: number;
  errorCount: number;
  totalChars: number;
  hostName: string;
  hostDisplayName: string;
  isPersonalBest: boolean;
  streakCount: number;
  category?: string;
  categoryLabel?: string;
  session?: SessionStats;
  global?: GlobalStats;
  /** Current rank tier label, e.g. "Gold II" or "Master" */
  rankLabel?: string;
  /** Daily streak for flex */
  dailyStreak?: number;
}

export interface ShareOutput {
  imagePath: string;
  caption: string;
  sessionJson: string;
}
