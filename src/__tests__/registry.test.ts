import { describe, it, expect } from 'vitest';
import { ContentRegistry } from '../content/registry.js';
import { generalPack } from '../content/general-pack.js';

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
});
