import type { ContentPack, Drill, ContentFilter, Difficulty } from './types.js';
import { computeTechniqueBonus } from './technique-keys.js';

const BASE_WEIGHT = 1;
const MAX_WEIGHT_MULTIPLIER = 5;
const TECHNIQUE_BONUS_MULTIPLIER = 2;
const RECENT_BUFFER_MAX = 8;
const RECENT_BUFFER_POOL_DIVISOR = 3;

/**
 * Difficulty ramp based on cumulative drills completed. Early sessions
 * favor beginner content; mid users see more intermediate; veterans get
 * flat weighting across all three tiers.
 */
export function difficultyWeightsForCount(count: number): Record<Difficulty, number> {
  if (count < 20) return { beginner: 3, intermediate: 1, advanced: 0 };
  if (count < 60) return { beginner: 1, intermediate: 2, advanced: 1 };
  return { beginner: 1, intermediate: 1, advanced: 1 };
}

export interface DrillSelectionOptions {
  errorHeatmap?: Record<string, number>;
  /** User's cumulative completed-drill count, used to ramp difficulty. */
  drillCount?: number;
}

export class ContentRegistry {
  private packs: Map<string, ContentPack> = new Map();
  private recentIds: string[] = [];

  register(pack: ContentPack): void {
    this.packs.set(pack.id, pack);
  }

  getPack(id: string): ContentPack | undefined {
    return this.packs.get(id);
  }

  getAllDrills(): Drill[] {
    const drills: Drill[] = [];
    for (const pack of this.packs.values()) {
      drills.push(...pack.drills);
    }
    return drills;
  }

  filterDrills(filter: ContentFilter): Drill[] {
    let drills = this.getAllDrills();

    if (filter.category) {
      drills = drills.filter((d) => d.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      drills = drills.filter((d) =>
        filter.tags!.some((tag) => d.tags.includes(tag))
      );
    }

    if (filter.difficulty && filter.difficulty.length > 0) {
      drills = drills.filter((d) =>
        filter.difficulty!.includes(d.difficulty)
      );
    }

    return drills;
  }

  /** Exposed for tests — recent-history exclusion buffer. */
  resetRecent(): void {
    this.recentIds = [];
  }

  private recordRecent(id: string, poolSize: number): void {
    const bufferSize = Math.max(1, Math.min(RECENT_BUFFER_MAX, Math.floor(poolSize / RECENT_BUFFER_POOL_DIVISOR)));
    this.recentIds.push(id);
    while (this.recentIds.length > bufferSize) {
      this.recentIds.shift();
    }
  }

  getRandomDrill(
    filter?: ContentFilter,
    errorHeatmapOrOptions?: Record<string, number> | DrillSelectionOptions,
    drillCount?: number,
  ): Drill {
    // Backwards-compatible signature: previous callers pass (filter, heatmap).
    // New callers can pass (filter, { errorHeatmap, drillCount }) or the third arg.
    let errorHeatmap: Record<string, number> | undefined;
    let count: number | undefined = drillCount;
    if (errorHeatmapOrOptions && typeof errorHeatmapOrOptions === 'object' && !Array.isArray(errorHeatmapOrOptions)) {
      const asOptions = errorHeatmapOrOptions as DrillSelectionOptions;
      if ('errorHeatmap' in asOptions || 'drillCount' in asOptions) {
        errorHeatmap = asOptions.errorHeatmap;
        if (asOptions.drillCount !== undefined) count = asOptions.drillCount;
      } else {
        errorHeatmap = errorHeatmapOrOptions as Record<string, number>;
      }
    }

    const drills = filter ? this.filterDrills(filter) : this.getAllDrills();
    if (drills.length === 0) {
      throw new Error('No drills match the given filter');
    }

    // Anti-repetition: exclude recently-served drills unless the pool is too
    // small for exclusion to leave anything. Buffer size scales with pool so
    // a 5-drill filter doesn't get fully blocked by an 8-slot buffer.
    const bufferSize = Math.max(1, Math.min(RECENT_BUFFER_MAX, Math.floor(drills.length / RECENT_BUFFER_POOL_DIVISOR)));
    const recent = new Set(this.recentIds.slice(-bufferSize));
    const eligible = drills.filter((d) => !recent.has(d.id));
    const pool = eligible.length > 0 ? eligible : drills;

    const difficultyWeights = count !== undefined ? difficultyWeightsForCount(count) : null;
    const hasHeatmap = errorHeatmap && Object.keys(errorHeatmap).length > 0;

    const baseWeights = pool.map((drill) => {
      let score = BASE_WEIGHT;
      if (hasHeatmap) {
        const chars = new Set(drill.text.toLowerCase());
        for (const ch of chars) {
          const err = errorHeatmap![ch];
          if (err) score += Math.sqrt(err);
        }
        if (drill.category === 'technique') {
          score += Math.sqrt(computeTechniqueBonus(drill, errorHeatmap!)) * TECHNIQUE_BONUS_MULTIPLIER;
        }
      }
      return Math.min(score, BASE_WEIGHT * MAX_WEIGHT_MULTIPLIER);
    });

    let finalWeights = baseWeights;
    if (difficultyWeights) {
      const ramped = baseWeights.map((w, i) => w * (difficultyWeights[pool[i].difficulty] ?? 1));
      // If the ramp zeros out the entire eligible pool (e.g. a category has
      // only advanced drills for a new user), drop the ramp for this pick
      // rather than throwing. Manual category picks should always succeed.
      if (ramped.some((w) => w > 0)) {
        finalWeights = ramped;
      }
    }

    let selected: Drill;
    if (hasHeatmap || difficultyWeights) {
      const totalWeight = finalWeights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      selected = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) {
        rand -= finalWeights[i];
        if (rand <= 0) {
          selected = pool[i];
          break;
        }
      }
    } else {
      selected = pool[Math.floor(Math.random() * pool.length)];
    }

    this.recordRecent(selected.id, drills.length);
    return selected;
  }
}
