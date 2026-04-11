import { describe, it, expect } from 'vitest';
import {
  TECHNIQUE_TAG_KEYS,
  tagErrorScore,
  computeTechniqueBonus,
  topWeakKeys,
} from '../content/technique-keys.js';
import type { Drill } from '../content/types.js';

describe('technique targeting', () => {
  describe('tagErrorScore', () => {
    it('sums heatmap errors for all keys a tag covers', () => {
      const heatmap = { f: 10, v: 5, r: 3, j: 2, a: 100 };
      // index-fingers covers f,r,v,t,g,b,j,u,n,y,h,m → f(10)+v(5)+r(3)+j(2) = 20
      expect(tagErrorScore('index-fingers', heatmap)).toBe(20);
    });

    it('returns 0 for bigrams tag (intentionally unfocused)', () => {
      const heatmap = { a: 50, b: 50, c: 50 };
      expect(tagErrorScore('bigrams', heatmap)).toBe(0);
    });

    it('returns 0 for non-technique tags', () => {
      const heatmap = { a: 50 };
      expect(tagErrorScore('code-js', heatmap)).toBe(0);
    });

    it('home-row picks up home row key errors', () => {
      const heatmap = { s: 7, l: 3, q: 999 };
      expect(tagErrorScore('home-row', heatmap)).toBe(10);
    });
  });

  describe('computeTechniqueBonus', () => {
    const indexDrill: Drill = {
      id: 'test:1',
      text: 'fff vvv rrr',
      category: 'technique',
      tags: ['index-fingers', 'left-hand'],
      difficulty: 'beginner',
    };

    const codeDrill: Drill = {
      id: 'test:2',
      text: 'const x = 5;',
      category: 'code',
      tags: ['code-js'],
      difficulty: 'beginner',
    };

    it('returns 0 for non-technique drills', () => {
      const heatmap = { f: 50 };
      expect(computeTechniqueBonus(codeDrill, heatmap)).toBe(0);
    });

    it('sums bonuses across all tags on a technique drill', () => {
      const heatmap = { f: 10, v: 5, a: 2 };
      // index-fingers: f(10)+v(5) = 15
      // left-hand: a(2)+f(10)+v(5) = 17
      // total: 32
      expect(computeTechniqueBonus(indexDrill, heatmap)).toBe(32);
    });

    it('returns 0 when heatmap has no matching keys', () => {
      const heatmap = { p: 100, o: 100 };
      expect(computeTechniqueBonus(indexDrill, heatmap)).toBe(0);
    });
  });

  describe('topWeakKeys', () => {
    it('returns top N keys sorted by error count descending', () => {
      const heatmap = { a: 3, b: 10, c: 1, d: 7, e: 5 };
      expect(topWeakKeys(heatmap, 3)).toEqual(['b', 'd', 'e']);
    });

    it('returns all keys if fewer than N', () => {
      expect(topWeakKeys({ a: 5, b: 2 }, 10)).toEqual(['a', 'b']);
    });

    it('returns empty array for empty heatmap', () => {
      expect(topWeakKeys({}, 5)).toEqual([]);
    });
  });

  describe('TECHNIQUE_TAG_KEYS coverage', () => {
    it('has a mapping for each finger/row/hand tag', () => {
      const required = [
        'home-row',
        'top-row',
        'bottom-row',
        'left-hand',
        'right-hand',
        'index-fingers',
        'middle-fingers',
        'ring-fingers',
        'pinky-fingers',
        'number-row',
      ] as const;
      for (const tag of required) {
        expect(TECHNIQUE_TAG_KEYS[tag]).toBeDefined();
        expect((TECHNIQUE_TAG_KEYS[tag] ?? []).length).toBeGreaterThan(0);
      }
    });

    it('left-hand and right-hand together cover all letters', () => {
      const left = new Set(TECHNIQUE_TAG_KEYS['left-hand'] ?? []);
      const right = new Set(TECHNIQUE_TAG_KEYS['right-hand'] ?? []);
      for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
        expect(left.has(letter) || right.has(letter)).toBe(true);
      }
    });
  });
});
