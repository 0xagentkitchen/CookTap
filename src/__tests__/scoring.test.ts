import { describe, it, expect } from 'vitest';
import { calculateWpm, calculateAccuracy, calculateGrade, isEligibleForStats } from '../engine/scoring.js';

describe('calculateWpm', () => {
  it('returns 0 for no chars typed', () => {
    expect(calculateWpm(0, 10000)).toBe(0);
  });

  it('returns 0 for elapsed under 600ms', () => {
    expect(calculateWpm(25, 500)).toBe(0);
  });

  it('calculates correctly for standard case', () => {
    // 25 chars in 60 seconds = 5 words / 1 min = 5 WPM
    expect(calculateWpm(25, 60000)).toBe(5);
  });

  it('calculates correctly for fast typing', () => {
    // 100 chars in 30 seconds = 20 words / 0.5 min = 40 WPM
    expect(calculateWpm(100, 30000)).toBe(40);
  });

  it('calculates correctly for 1 minute', () => {
    // 300 chars in 60s = 60 words / 1 min = 60 WPM
    expect(calculateWpm(300, 60000)).toBe(60);
  });
});

describe('calculateAccuracy', () => {
  it('returns 100 for no chars typed', () => {
    expect(calculateAccuracy(0, 0)).toBe(100);
  });

  it('returns 100 for no errors', () => {
    expect(calculateAccuracy(50, 0)).toBe(100);
  });

  it('calculates correctly with errors', () => {
    // 50 typed, 5 errors = 90%
    expect(calculateAccuracy(50, 5)).toBe(90);
  });

  it('rounds to one decimal', () => {
    // 30 typed, 1 error = 96.666...% -> 96.7
    expect(calculateAccuracy(30, 1)).toBe(96.7);
  });
});

describe('calculateGrade', () => {
  it('S for >=98% acc and >=60 WPM', () => {
    expect(calculateGrade(60, 98)).toBe('S');
    expect(calculateGrade(100, 100)).toBe('S');
  });

  it('A for >=95% acc and >=45 WPM', () => {
    expect(calculateGrade(45, 95)).toBe('A');
    expect(calculateGrade(59, 97)).toBe('A');
  });

  it('B for >=90% acc and >=35 WPM', () => {
    expect(calculateGrade(35, 90)).toBe('B');
  });

  it('C for >=80% acc', () => {
    expect(calculateGrade(10, 80)).toBe('C');
  });

  it('D for <80% acc', () => {
    expect(calculateGrade(100, 79)).toBe('D');
  });

  it('high WPM but low accuracy still grades low', () => {
    expect(calculateGrade(120, 70)).toBe('D');
  });
});

describe('isEligibleForStats', () => {
  it('rejects short sessions', () => {
    expect(isEligibleForStats(4, 20)).toBe(false);
  });

  it('rejects few chars', () => {
    expect(isEligibleForStats(10, 9)).toBe(false);
  });

  it('accepts eligible sessions', () => {
    expect(isEligibleForStats(5, 10)).toBe(true);
    expect(isEligibleForStats(30, 100)).toBe(true);
  });
});
