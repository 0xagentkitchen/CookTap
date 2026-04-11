import type {
  EnginePhase,
  EngineAction,
  EngineSnapshot,
  EngineSubscriber,
  CharResult,
  SessionResult,
} from './types.js';
import { isSymbolChar } from './types.js';
import { calculateWpm, calculateAccuracy, calculateGrade } from './scoring.js';

interface InternalState {
  phase: EnginePhase;
  drillId: string;
  targetText: string;
  chars: CharResult[];
  cursorPosition: number;
  errorCount: number;
  alphaTyped: number;
  alphaErrors: number;
  symbolTyped: number;
  symbolErrors: number;
  startedAt: number | null;
  pausedAt: number | null;
  pausedDurationMs: number;
  finishedAt: number | null;
  lastTickAt: number | null;
  timeLimitMs: number | null;
}

function createIdleState(): InternalState {
  return {
    phase: 'idle',
    drillId: '',
    targetText: '',
    chars: [],
    cursorPosition: 0,
    errorCount: 0,
    alphaTyped: 0,
    alphaErrors: 0,
    symbolTyped: 0,
    symbolErrors: 0,
    startedAt: null,
    pausedAt: null,
    pausedDurationMs: 0,
    finishedAt: null,
    lastTickAt: null,
    timeLimitMs: null,
  };
}

function createReadyState(drillId: string, text: string, timeLimitMs?: number): InternalState {
  const chars: CharResult[] = [...text].map((ch) => ({
    expected: ch,
    actual: null,
    correct: null,
    isSymbol: isSymbolChar(ch),
    timestampMs: null,
  }));

  return {
    ...createIdleState(),
    phase: 'ready',
    drillId,
    targetText: text,
    chars,
    timeLimitMs: timeLimitMs ?? null,
  };
}

function getElapsedMs(state: InternalState, now: number): number {
  if (!state.startedAt) return 0;
  const end = state.finishedAt ?? (state.pausedAt ?? now);
  return end - state.startedAt - state.pausedDurationMs;
}

function reduce(state: InternalState, action: EngineAction): InternalState {
  switch (action.type) {
    case 'LOAD_DRILL': {
      return createReadyState(action.drill.id, action.drill.text, action.timeLimitMs);
    }

    case 'CHAR_INPUT': {
      if (state.phase !== 'ready' && state.phase !== 'running') return state;

      const next = { ...state };

      if (state.phase === 'ready') {
        next.phase = 'running';
        next.startedAt = action.now;
      }

      if (next.cursorPosition >= next.targetText.length) return state;

      const expected = next.chars[next.cursorPosition].expected;
      const isCorrect = action.char === expected;
      const symbol = next.chars[next.cursorPosition].isSymbol;

      const updatedChars = [...next.chars];
      updatedChars[next.cursorPosition] = {
        ...updatedChars[next.cursorPosition],
        actual: action.char,
        correct: isCorrect,
        timestampMs: action.now,
      };

      next.chars = updatedChars;
      next.cursorPosition = next.cursorPosition + 1;

      if (!isCorrect) {
        next.errorCount = next.errorCount + 1;
        if (symbol) {
          next.symbolErrors = next.symbolErrors + 1;
        } else {
          next.alphaErrors = next.alphaErrors + 1;
        }
      }

      if (symbol) {
        next.symbolTyped = next.symbolTyped + 1;
      } else {
        next.alphaTyped = next.alphaTyped + 1;
      }

      next.lastTickAt = action.now;

      if (next.cursorPosition >= next.targetText.length) {
        next.phase = 'finished';
        next.finishedAt = action.now;
      }

      return next;
    }

    case 'BACKSPACE': {
      if (state.phase !== 'running' || state.cursorPosition === 0) return state;

      const next = { ...state };
      const prevPos = next.cursorPosition - 1;
      const prevChar = next.chars[prevPos];

      // Undo the accuracy tracking for the deleted char
      if (prevChar.actual !== null) {
        const symbol = prevChar.isSymbol;
        if (symbol) {
          next.symbolTyped = next.symbolTyped - 1;
          if (!prevChar.correct) next.symbolErrors = next.symbolErrors - 1;
        } else {
          next.alphaTyped = next.alphaTyped - 1;
          if (!prevChar.correct) next.alphaErrors = next.alphaErrors - 1;
        }
        if (!prevChar.correct) next.errorCount = next.errorCount - 1;
      }

      const updatedChars = [...next.chars];
      updatedChars[prevPos] = {
        ...updatedChars[prevPos],
        actual: null,
        correct: null,
        timestampMs: null,
      };
      next.chars = updatedChars;
      next.cursorPosition = prevPos;
      next.lastTickAt = action.now;

      return next;
    }

    case 'PAUSE': {
      if (state.phase !== 'running') return state;
      return { ...state, phase: 'paused', pausedAt: action.now };
    }

    case 'RESUME': {
      if (state.phase !== 'paused' || !state.pausedAt) return state;
      const pausedDuration = action.now - state.pausedAt;
      return {
        ...state,
        phase: 'running',
        pausedAt: null,
        pausedDurationMs: state.pausedDurationMs + pausedDuration,
        lastTickAt: action.now,
      };
    }

    case 'RESET': {
      return createIdleState();
    }

    case 'TICK': {
      if (state.phase !== 'running') return state;
      // Auto-finish when time limit is reached
      if (state.timeLimitMs && state.startedAt) {
        const elapsed = action.now - state.startedAt - state.pausedDurationMs;
        if (elapsed >= state.timeLimitMs) {
          return { ...state, phase: 'finished', finishedAt: action.now, lastTickAt: action.now };
        }
      }
      return { ...state, lastTickAt: action.now };
    }
  }
}

export class TypingEngine {
  private state: InternalState;
  private subscribers: Set<EngineSubscriber> = new Set();

  constructor() {
    this.state = createIdleState();
  }

  dispatch(action: EngineAction): void {
    this.state = reduce(this.state, action);
    this.notify();
  }

  subscribe(fn: EngineSubscriber): () => void {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  }

  getSnapshot(now?: number): EngineSnapshot {
    return toSnapshot(this.state, now ?? this.state.lastTickAt ?? Date.now());
  }

  getResult(): SessionResult | null {
    if (this.state.phase !== 'finished') return null;
    const s = this.state;
    const elapsed = getElapsedMs(s, s.finishedAt!);
    const elapsedSec = elapsed / 1000;
    const typed = s.cursorPosition;
    const wpm = calculateWpm(typed, elapsed);
    const accuracy = calculateAccuracy(typed, s.errorCount);
    const alphaAccuracy = calculateAccuracy(s.alphaTyped, s.alphaErrors);
    const symbolAccuracy = calculateAccuracy(s.symbolTyped, s.symbolErrors);

    return {
      drillId: s.drillId,
      wpm,
      accuracy,
      alphaAccuracy,
      symbolAccuracy,
      elapsedSeconds: Math.round(elapsedSec * 10) / 10,
      errorCount: s.errorCount,
      totalChars: s.timeLimitMs ? typed : s.targetText.length,
      typedChars: typed,
      grade: calculateGrade(wpm, accuracy),
      completedAt: new Date(s.finishedAt!).toISOString(),
    };
  }

  serialize(): SerializedEngine {
    return { state: { ...this.state, chars: [...this.state.chars] } };
  }

  static restore(data: SerializedEngine): TypingEngine {
    const engine = new TypingEngine();
    engine.state = { ...data.state, chars: [...data.state.chars] };
    return engine;
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const fn of this.subscribers) fn(snap);
  }
}

export interface SerializedEngine {
  state: InternalState;
}

function toSnapshot(state: InternalState, now: number): EngineSnapshot {
  const elapsed = getElapsedMs(state, now);
  const typed = state.cursorPosition;

  return {
    phase: state.phase,
    drillId: state.drillId,
    targetText: state.targetText,
    cursorPosition: state.cursorPosition,
    totalChars: state.targetText.length,
    typedCount: typed,
    errorCount: state.errorCount,
    chars: state.chars,
    wpm: calculateWpm(typed, elapsed),
    accuracy: calculateAccuracy(typed, state.errorCount),
    alphaAccuracy: calculateAccuracy(state.alphaTyped, state.alphaErrors),
    symbolAccuracy: calculateAccuracy(state.symbolTyped, state.symbolErrors),
    elapsedMs: elapsed,
    timeLimitMs: state.timeLimitMs,
    nextExpectedChar: typed < state.targetText.length ? state.targetText[typed] : null,
  };
}
