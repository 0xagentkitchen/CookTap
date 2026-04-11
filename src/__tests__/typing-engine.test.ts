import { describe, it, expect } from 'vitest';
import { TypingEngine } from '../engine/typing-engine.js';

function typeString(engine: TypingEngine, text: string, startMs: number, intervalMs = 100) {
  let t = startMs;
  for (const char of text) {
    engine.dispatch({ type: 'CHAR_INPUT', char, now: t });
    t += intervalMs;
  }
  return t;
}

describe('TypingEngine', () => {
  describe('lifecycle phases', () => {
    it('starts in idle phase', () => {
      const engine = new TypingEngine();
      expect(engine.getSnapshot(0).phase).toBe('idle');
    });

    it('transitions to ready on LOAD_DRILL', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      expect(engine.getSnapshot(0).phase).toBe('ready');
    });

    it('transitions to running on first CHAR_INPUT', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      expect(engine.getSnapshot(1000).phase).toBe('running');
    });

    it('transitions to finished when all chars typed', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'ab' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'b', now: 1100 });
      expect(engine.getSnapshot(1100).phase).toBe('finished');
    });

    it('transitions to idle on RESET from any phase', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'RESET' });
      expect(engine.getSnapshot(0).phase).toBe('idle');
    });

    it('supports pause and resume', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'PAUSE', now: 1500 });
      expect(engine.getSnapshot(2000).phase).toBe('paused');
      engine.dispatch({ type: 'RESUME', now: 2000 });
      expect(engine.getSnapshot(2000).phase).toBe('running');
    });
  });

  describe('typing correctness', () => {
    it('tracks correct characters', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      const snap = engine.getSnapshot(1000);
      expect(snap.chars[0].correct).toBe(true);
      expect(snap.chars[0].actual).toBe('a');
      expect(snap.cursorPosition).toBe(1);
    });

    it('tracks incorrect characters', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'x', now: 1000 });
      const snap = engine.getSnapshot(1000);
      expect(snap.chars[0].correct).toBe(false);
      expect(snap.errorCount).toBe(1);
    });

    it('supports backspace', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'x', now: 1000 });
      engine.dispatch({ type: 'BACKSPACE', now: 1100 });
      const snap = engine.getSnapshot(1100);
      expect(snap.cursorPosition).toBe(0);
      expect(snap.errorCount).toBe(0);
      expect(snap.chars[0].actual).toBeNull();
    });

    it('backspace does nothing at position 0', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'BACKSPACE', now: 1100 });
      engine.dispatch({ type: 'BACKSPACE', now: 1200 }); // should not go negative
      expect(engine.getSnapshot(1200).cursorPosition).toBe(0);
    });

    it('ignores CHAR_INPUT when finished', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'ab' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'b', now: 1100 });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'c', now: 1200 }); // should be ignored
      expect(engine.getSnapshot(1200).typedCount).toBe(2);
    });
  });

  describe('symbol vs alpha accuracy', () => {
    it('classifies symbol characters', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'a{' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'CHAR_INPUT', char: '{', now: 1100 });
      const snap = engine.getSnapshot(1100);
      expect(snap.alphaAccuracy).toBe(100);
      expect(snap.symbolAccuracy).toBe(100);
    });

    it('tracks symbol errors separately', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'a{b}' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'CHAR_INPUT', char: '[', now: 1100 }); // wrong symbol
      engine.dispatch({ type: 'CHAR_INPUT', char: 'b', now: 1200 });
      engine.dispatch({ type: 'CHAR_INPUT', char: '}', now: 1300 });
      const snap = engine.getSnapshot(1300);
      expect(snap.alphaAccuracy).toBe(100); // a and b correct
      expect(snap.symbolAccuracy).toBe(50); // { wrong, } correct
    });

    it('backspace undoes symbol tracking', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: '{a' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: '[', now: 1000 }); // wrong symbol
      engine.dispatch({ type: 'BACKSPACE', now: 1100 });
      engine.dispatch({ type: 'CHAR_INPUT', char: '{', now: 1200 }); // correct symbol
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1300 }); // finish
      const snap = engine.getSnapshot(1300);
      expect(snap.symbolAccuracy).toBe(100);
      expect(snap.alphaAccuracy).toBe(100);
      expect(snap.errorCount).toBe(0);
    });
  });

  describe('timing', () => {
    it('calculates elapsed correctly', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abcde' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'TICK', now: 11000 });
      const snap = engine.getSnapshot(11000);
      expect(snap.elapsedMs).toBe(10000);
    });

    it('excludes paused time', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abcde' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'PAUSE', now: 1000 });
      engine.dispatch({ type: 'RESUME', now: 6000 }); // paused 5 seconds
      engine.dispatch({ type: 'TICK', now: 11000 });
      const snap = engine.getSnapshot(11000);
      // total wall time: 10s, paused: ~5s, active: ~5s
      expect(snap.elapsedMs).toBe(5000);
    });

    it('calculates WPM in snapshot', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'hello world test thing more' } });
      // 25 chars in 60 seconds = 5 WPM
      const text = 'hello world test thing more';
      let t = 1000;
      const interval = 60000 / text.length;
      for (const ch of text) {
        engine.dispatch({ type: 'CHAR_INPUT', char: ch, now: t });
        t += interval;
      }
      const result = engine.getResult()!;
      expect(result.wpm).toBeGreaterThan(0);
    });
  });

  describe('observer pattern', () => {
    it('notifies subscribers on dispatch', () => {
      const engine = new TypingEngine();
      const snapshots: string[] = [];
      engine.subscribe((snap) => snapshots.push(snap.phase));
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'a' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      expect(snapshots).toEqual(['ready', 'finished']);
    });

    it('unsubscribe stops notifications', () => {
      const engine = new TypingEngine();
      const snapshots: string[] = [];
      const unsub = engine.subscribe((snap) => snapshots.push(snap.phase));
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'ab' } });
      unsub();
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      expect(snapshots).toEqual(['ready']);
    });
  });

  describe('getResult', () => {
    it('returns null when not finished', () => {
      const engine = new TypingEngine();
      expect(engine.getResult()).toBeNull();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      expect(engine.getResult()).toBeNull();
    });

    it('returns full result when finished', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'ab' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'b', now: 2000 });
      const result = engine.getResult()!;
      expect(result).not.toBeNull();
      expect(result.drillId).toBe('test');
      expect(result.accuracy).toBe(100);
      expect(result.errorCount).toBe(0);
      expect(result.totalChars).toBe(2);
      expect(result.typedChars).toBe(2);
      expect(result.grade).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('serialization', () => {
    it('round-trips through serialize/restore', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'hello' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'h', now: 1000 });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'e', now: 1100 });

      const serialized = engine.serialize();
      const json = JSON.stringify(serialized);
      const restored = TypingEngine.restore(JSON.parse(json));

      const origSnap = engine.getSnapshot(1200);
      const restoredSnap = restored.getSnapshot(1200);

      expect(restoredSnap.phase).toBe(origSnap.phase);
      expect(restoredSnap.cursorPosition).toBe(origSnap.cursorPosition);
      expect(restoredSnap.typedCount).toBe(origSnap.typedCount);
      expect(restoredSnap.drillId).toBe(origSnap.drillId);
      expect(restoredSnap.targetText).toBe(origSnap.targetText);
    });

    it('restored engine can continue typing', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'hi' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'h', now: 1000 });

      const restored = TypingEngine.restore(engine.serialize());
      restored.dispatch({ type: 'CHAR_INPUT', char: 'i', now: 2000 });
      expect(restored.getSnapshot(2000).phase).toBe('finished');
    });
  });

  describe('edge cases', () => {
    it('ignores CHAR_INPUT in idle phase', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      expect(engine.getSnapshot(0).phase).toBe('idle');
    });

    it('ignores TICK in non-running phases', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'TICK', now: 1000 });
      expect(engine.getSnapshot(0).phase).toBe('idle');
    });

    it('ignores PAUSE in non-running phases', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'a' } });
      engine.dispatch({ type: 'PAUSE', now: 0 });
      expect(engine.getSnapshot(0).phase).toBe('ready');
    });

    it('ignores RESUME in non-paused phases', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'RESUME', now: 2000 });
      expect(engine.getSnapshot(2000).phase).toBe('running');
    });

    it('LOAD_DRILL from any phase resets to ready', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'a', text: 'abc' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'b', text: 'xyz' } });
      const snap = engine.getSnapshot(0);
      expect(snap.phase).toBe('ready');
      expect(snap.drillId).toBe('b');
      expect(snap.cursorPosition).toBe(0);
    });

    it('nextExpectedChar is null when finished', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'a' } });
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      expect(engine.getSnapshot(1000).nextExpectedChar).toBeNull();
    });

    it('nextExpectedChar points to next char to type', () => {
      const engine = new TypingEngine();
      engine.dispatch({ type: 'LOAD_DRILL', drill: { id: 'test', text: 'abc' } });
      expect(engine.getSnapshot(0).nextExpectedChar).toBe('a');
      engine.dispatch({ type: 'CHAR_INPUT', char: 'a', now: 1000 });
      expect(engine.getSnapshot(1000).nextExpectedChar).toBe('b');
    });
  });
});
