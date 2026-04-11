import type { TypingEngine } from '../engine/typing-engine.js';

export class Ticker {
  private interval: ReturnType<typeof setInterval> | null = null;

  start(engine: TypingEngine, intervalMs = 200): void {
    this.stop();
    this.interval = setInterval(() => {
      engine.dispatch({ type: 'TICK', now: Date.now() });
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
