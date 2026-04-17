import type { ContentPack, Drill, ContentFilter } from './types.js';
import { computeTechniqueBonus } from './technique-keys.js';

const BASE_WEIGHT = 1;
const MAX_WEIGHT_MULTIPLIER = 5;
const TECHNIQUE_BONUS_MULTIPLIER = 2;
const RECENT_BUFFER_MAX = 8;
const RECENT_BUFFER_POOL_DIVISOR = 3;

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

  getRandomDrill(filter?: ContentFilter, errorHeatmap?: Record<string, number>): Drill {
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

    const hasHeatmap = errorHeatmap && Object.keys(errorHeatmap).length > 0;
    let selected: Drill;

    if (hasHeatmap) {
      // Adaptive selection: weight drills by how many weak-spot characters they
      // contain. Square-root dampens runaway favorites; a hard cap at 5× base
      // ensures no single drill dominates even under extreme heatmaps.
      const rawWeights = pool.map((drill) => {
        let score = BASE_WEIGHT;
        const chars = new Set(drill.text.toLowerCase());
        for (const ch of chars) {
          const err = errorHeatmap![ch];
          if (err) score += Math.sqrt(err);
        }
        if (drill.category === 'technique') {
          score += Math.sqrt(computeTechniqueBonus(drill, errorHeatmap!)) * TECHNIQUE_BONUS_MULTIPLIER;
        }
        return score;
      });
      const maxWeight = BASE_WEIGHT * MAX_WEIGHT_MULTIPLIER;
      const weights = rawWeights.map((w) => Math.min(w, maxWeight));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      selected = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) {
        rand -= weights[i];
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
