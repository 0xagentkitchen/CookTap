import type { Grade } from './types.js';

export function calculateWpm(charsTyped: number, elapsedMs: number): number {
  if (charsTyped === 0 || elapsedMs < 600) return 0;
  const minutes = elapsedMs / 1000 / 60;
  return Math.round((charsTyped / 5) / minutes);
}

export function calculateAccuracy(typed: number, errors: number): number {
  if (typed === 0) return 100;
  return Math.round(((typed - errors) / typed) * 1000) / 10;
}

export function calculateGrade(wpm: number, accuracy: number): Grade {
  if (accuracy >= 98 && wpm >= 60) return 'S';
  if (accuracy >= 95 && wpm >= 45) return 'A';
  if (accuracy >= 90 && wpm >= 35) return 'B';
  if (accuracy >= 80) return 'C';
  return 'D';
}

export const ELIGIBLE_MIN_SECONDS = 5;
export const ELIGIBLE_MIN_CHARS = 10;

export function isEligibleForStats(elapsedSeconds: number, typedChars: number): boolean {
  return elapsedSeconds >= ELIGIBLE_MIN_SECONDS && typedChars >= ELIGIBLE_MIN_CHARS;
}
