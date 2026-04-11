import type { ContentPack, Drill, ContentFilter } from './types.js';
import { computeTechniqueBonus } from './technique-keys.js';

export class ContentRegistry {
  private packs: Map<string, ContentPack> = new Map();

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

  getRandomDrill(filter?: ContentFilter, errorHeatmap?: Record<string, number>): Drill {
    const drills = filter ? this.filterDrills(filter) : this.getAllDrills();
    if (drills.length === 0) {
      throw new Error('No drills match the given filter');
    }

    // Adaptive selection: weight drills by how many weak-spot characters they contain.
    // Technique drills get an additional tag-based bonus so they target the
    // user's weakest fingers/rows/hands even when the exact chars don't
    // appear in the drill text.
    if (errorHeatmap && Object.keys(errorHeatmap).length > 0) {
      const weights = drills.map((drill) => {
        let score = 1; // base weight
        const chars = new Set(drill.text.toLowerCase());
        for (const ch of chars) {
          if (errorHeatmap[ch]) {
            score += errorHeatmap[ch];
          }
        }
        // Tag-level bonus for technique drills — amplified so it dominates
        // base character weighting when the user has a clear finger/row weakness.
        if (drill.category === 'technique') {
          score += computeTechniqueBonus(drill, errorHeatmap) * 3;
        }
        return score;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < drills.length; i++) {
        rand -= weights[i];
        if (rand <= 0) return drills[i];
      }
    }

    return drills[Math.floor(Math.random() * drills.length)];
  }
}
