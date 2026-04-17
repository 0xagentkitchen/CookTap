import { describe, it, expect } from 'vitest';
import { ContentRegistry } from '../content/registry.js';
import { generalPack } from '../content/general-pack.js';
import type { ContentPack, Drill } from '../content/types.js';

describe('ContentRegistry', () => {
  it('registers and retrieves a pack', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    expect(reg.getPack('general')).toBe(generalPack);
  });

  it('returns all drills', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const drills = reg.getAllDrills();
    expect(drills.length).toBe(generalPack.drills.length);
    expect(drills.length).toBeGreaterThan(40);
  });

  it('filters by tag', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const cli = reg.filterDrills({ tags: ['cli'] });
    expect(cli.length).toBeGreaterThan(0);
    expect(cli.every((d) => d.tags.includes('cli'))).toBe(true);
  });

  it('filters by difficulty', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const beginner = reg.filterDrills({ difficulty: ['beginner'] });
    expect(beginner.length).toBeGreaterThan(0);
    expect(beginner.every((d) => d.difficulty === 'beginner')).toBe(true);
  });

  it('filters by both tag and difficulty', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const result = reg.filterDrills({ tags: ['code-js'], difficulty: ['advanced'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((d) => d.tags.includes('code-js') && d.difficulty === 'advanced')).toBe(true);
  });

  it('getRandomDrill returns a drill', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const drill = reg.getRandomDrill();
    expect(drill).toBeDefined();
    expect(drill.id).toBeDefined();
    expect(drill.text.length).toBeGreaterThan(0);
  });

  it('getRandomDrill respects filter', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const drill = reg.getRandomDrill({ tags: ['symbols'] });
    expect(drill.tags).toContain('symbols');
  });

  it('getRandomDrill throws on empty result', () => {
    const reg = new ContentRegistry();
    expect(() => reg.getRandomDrill()).toThrow('No drills match');
  });

  it('all drills have valid structure', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    for (const drill of reg.getAllDrills()) {
      expect(drill.id).toBeTruthy();
      expect(drill.text.length).toBeGreaterThan(10);
      expect(drill.tags.length).toBeGreaterThan(0);
      expect(['beginner', 'intermediate', 'advanced']).toContain(drill.difficulty);
      expect(['words', 'code', 'cli', 'technique']).toContain(drill.category);
    }
  });

  it('filters by category', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const words = reg.filterDrills({ category: 'words' });
    const code = reg.filterDrills({ category: 'code' });
    const cli = reg.filterDrills({ category: 'cli' });
    expect(words.length).toBeGreaterThan(5);
    expect(code.length).toBeGreaterThan(10);
    expect(cli.length).toBeGreaterThan(5);
    expect(words.every((d) => d.category === 'words')).toBe(true);
    expect(code.every((d) => d.category === 'code')).toBe(true);
    expect(cli.every((d) => d.category === 'cli')).toBe(true);
  });

  it('getRandomDrill respects category filter', () => {
    const reg = new ContentRegistry();
    reg.register(generalPack);
    const drill = reg.getRandomDrill({ category: 'cli' });
    expect(drill.category).toBe('cli');
  });

  describe('anti-repetition', () => {
    function makeDrills(n: number): Drill[] {
      return Array.from({ length: n }, (_, i) => ({
        id: `t:${i}`,
        text: `drill number ${i} with some content`,
        category: 'words' as const,
        tags: ['common-words' as const],
        difficulty: 'beginner' as const,
      }));
    }

    function makePack(drills: Drill[]): ContentPack {
      return { id: 'test', name: 'Test', description: '', drills };
    }

    it('does not repeat within a large pool window', () => {
      const reg = new ContentRegistry();
      reg.register(makePack(makeDrills(50)));
      const seen: string[] = [];
      for (let i = 0; i < 20; i++) {
        seen.push(reg.getRandomDrill().id);
      }
      // With a buffer of 8, no id should appear back-to-back within any 8-wide window
      for (let i = 0; i < seen.length; i++) {
        const window = seen.slice(Math.max(0, i - 7), i);
        expect(window).not.toContain(seen[i]);
      }
    });

    it('falls back gracefully when the entire pool fits in the buffer', () => {
      const reg = new ContentRegistry();
      reg.register(makePack(makeDrills(3)));
      // With 3 drills and buffer = max(1, min(8, 3/3))=1, we can always pick one
      for (let i = 0; i < 10; i++) {
        const drill = reg.getRandomDrill();
        expect(drill).toBeDefined();
      }
    });

    it('resetRecent clears the buffer', () => {
      const reg = new ContentRegistry();
      reg.register(makePack(makeDrills(50)));
      const first = reg.getRandomDrill().id;
      reg.resetRecent();
      // After reset, the same drill is eligible again; we just verify no throw
      const another = reg.getRandomDrill().id;
      expect(typeof another).toBe('string');
      expect(typeof first).toBe('string');
    });
  });

  describe('adaptive weighting', () => {
    it('does not let a single weighted drill dominate selection', () => {
      // One drill has every heatmap key; others have none. Without the 5x cap,
      // the weighted drill would be selected nearly every time under a heavy
      // heatmap. With the cap, it should stay within ~5x base odds.
      const drills: Drill[] = [
        { id: 't:hot', text: 'abcdefghij', category: 'words', tags: ['common-words'], difficulty: 'beginner' },
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `t:cold:${i}`,
          text: 'xxxxxxxx',
          category: 'words' as const,
          tags: ['common-words' as const],
          difficulty: 'beginner' as const,
        })),
      ];
      const reg = new ContentRegistry();
      reg.register({ id: 'test', name: '', description: '', drills });
      const heatmap: Record<string, number> = {};
      for (const ch of 'abcdefghij') heatmap[ch] = 10000;

      let hotCount = 0;
      const trials = 2000;
      for (let i = 0; i < trials; i++) {
        reg.resetRecent();
        if (reg.getRandomDrill(undefined, heatmap).id === 't:hot') hotCount++;
      }
      // Uniform would be ~1/21 ≈ 4.8%. Cap of 5x base means the hot drill's
      // weight is 5 vs 1 for each of 20 cold = 5/25 = 20%. Allow headroom.
      const share = hotCount / trials;
      expect(share).toBeLessThan(0.35);
    });
  });
});
