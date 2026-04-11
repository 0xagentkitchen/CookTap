#!/usr/bin/env npx tsx
/**
 * Generate a promotional share card with example global stats.
 * Usage: npx tsx scripts/generate-promo-card.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderShareCard } from '../src/share/card-renderer.js';
import type { ShareData } from '../src/share/types.js';

const promo: ShareData = {
  mode: 'global',
  // Latest drill stats (not shown on global card hero, but required by type)
  wpm: 87,
  accuracy: 98.2,
  alphaAccuracy: 99.1,
  symbolAccuracy: 94.6,
  grade: 'A',
  elapsedSeconds: 42,
  errorCount: 3,
  totalChars: 168,
  hostName: 'claude',
  hostDisplayName: 'Claude',
  isPersonalBest: false,
  streakCount: 5,
  global: {
    totalDrills: 147,
    totalTime: 4620,       // ~77 minutes
    totalChars: 28540,
    avgWpm: 74,
    avgAccuracy: 96.8,
    bestWpm: 103,
    bestAccuracy: 100,
    longestStreak: 12,
    missedKeys: { ';': 38, '{': 29, '=': 22, ']': 17 },
  },
};

(async () => {
  const buf = await renderShareCard(promo);
  const out = path.resolve('promo-global-card.png');
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out}`);
})();
