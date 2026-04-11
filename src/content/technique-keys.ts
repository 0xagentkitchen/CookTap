import type { ContentTag, Drill } from './types.js';

/**
 * Maps each technique tag to the set of keys that tag actually trains.
 * Used for adaptive targeting: if the user's error heatmap is heavy on
 * certain keys, we boost technique drills whose tags cover those keys.
 *
 * Keys are lowercase letters or literal symbols. Finger/row coverage
 * follows a standard QWERTY touch-typing layout.
 */
export const TECHNIQUE_TAG_KEYS: Partial<Record<ContentTag, string[]>> = {
  'home-row': ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  'top-row': ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  'bottom-row': ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
  'left-hand': ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'],
  'right-hand': ['y', 'u', 'i', 'o', 'p', 'h', 'j', 'k', 'l', ';', 'n', 'm', ',', '.', '/'],
  'index-fingers': ['f', 'r', 'v', 't', 'g', 'b', 'j', 'u', 'n', 'y', 'h', 'm'],
  'middle-fingers': ['d', 'e', 'c', 'k', 'i', ','],
  'ring-fingers': ['s', 'w', 'x', 'l', 'o', '.'],
  'pinky-fingers': ['a', 'q', 'z', ';', 'p', '/'],
  'number-row': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  'bigrams': [], // bigrams cover the whole alphabet — no focused boost
};

/** Sum of heatmap errors for every key a given tag covers. */
export function tagErrorScore(tag: ContentTag, heatmap: Record<string, number>): number {
  const keys = TECHNIQUE_TAG_KEYS[tag];
  if (!keys || keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) {
    total += heatmap[k] || 0;
  }
  return total;
}

/**
 * Compute an adaptive bonus weight for a technique drill given the user's
 * error heatmap. Bonus is the sum of tag error scores across the drill's
 * tags — drills whose tags cover the user's weakest keys score highest.
 *
 * Intended to be added on top of the registry's base character-in-text
 * weighting, producing a much stronger signal for technique targeting.
 */
export function computeTechniqueBonus(drill: Drill, heatmap: Record<string, number>): number {
  if (drill.category !== 'technique') return 0;
  let bonus = 0;
  for (const tag of drill.tags) {
    bonus += tagErrorScore(tag, heatmap);
  }
  return bonus;
}

/**
 * For UI transparency: report which of the user's top weak keys any
 * technique drill in the given category could target. Returns up to
 * `topN` keys sorted by error count descending.
 */
export function topWeakKeys(heatmap: Record<string, number>, topN = 5): string[] {
  return Object.entries(heatmap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key]) => key);
}
