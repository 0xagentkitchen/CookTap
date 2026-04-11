export type Category = 'words' | 'code' | 'cli' | 'technique';

export const CATEGORY_LABELS: Record<Category, string> = {
  words: 'Words',
  code: 'Code',
  cli: 'CLI',
  technique: 'Technique',
};

export type ContentTag =
  | 'code-js'
  | 'code-general'
  | 'code-symbols'
  | 'cli'
  | 'symbols'
  | 'punctuation'
  | 'common-words'
  | 'speed-builder'
  // Technique tags — finger / row / hand targeting
  | 'home-row'
  | 'top-row'
  | 'bottom-row'
  | 'left-hand'
  | 'right-hand'
  | 'index-fingers'
  | 'middle-fingers'
  | 'ring-fingers'
  | 'pinky-fingers'
  | 'bigrams'
  | 'number-row';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Drill {
  id: string;
  text: string;
  category: Category;
  tags: ContentTag[];
  difficulty: Difficulty;
}

export interface ContentPack {
  id: string;
  name: string;
  description: string;
  drills: Drill[];
}

export interface ContentFilter {
  category?: Category;
  tags?: ContentTag[];
  difficulty?: Difficulty[];
}
