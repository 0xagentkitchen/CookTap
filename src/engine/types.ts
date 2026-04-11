export type EnginePhase = 'idle' | 'ready' | 'running' | 'paused' | 'finished';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CharResult {
  expected: string;
  actual: string | null;
  correct: boolean | null;
  isSymbol: boolean;
  timestampMs: number | null;
}

export interface EngineSnapshot {
  phase: EnginePhase;
  drillId: string;
  targetText: string;
  cursorPosition: number;
  totalChars: number;
  typedCount: number;
  errorCount: number;
  chars: CharResult[];
  wpm: number;
  accuracy: number;
  alphaAccuracy: number;
  symbolAccuracy: number;
  elapsedMs: number;
  timeLimitMs: number | null;
  nextExpectedChar: string | null;
}

export interface SessionResult {
  drillId: string;
  wpm: number;
  accuracy: number;
  alphaAccuracy: number;
  symbolAccuracy: number;
  elapsedSeconds: number;
  errorCount: number;
  totalChars: number;
  typedChars: number;
  grade: Grade;
  completedAt: string;
}

export type EngineAction =
  | { type: 'LOAD_DRILL'; drill: { id: string; text: string }; timeLimitMs?: number }
  | { type: 'CHAR_INPUT'; char: string; now: number }
  | { type: 'BACKSPACE'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'RESET' }
  | { type: 'TICK'; now: number };

export type EngineSubscriber = (snapshot: EngineSnapshot) => void;

export function isSymbolChar(char: string): boolean {
  return !/[a-zA-Z0-9\s]/.test(char);
}
