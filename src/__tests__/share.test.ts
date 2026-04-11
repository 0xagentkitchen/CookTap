import { describe, it, expect } from 'vitest';
import { generateCaption } from '../share/caption.js';
import { renderShareCard } from '../share/card-renderer.js';
import type { ShareData } from '../share/types.js';

const sampleData: ShareData = {
  mode: 'drill',
  wpm: 84,
  accuracy: 97.8,
  alphaAccuracy: 98.5,
  symbolAccuracy: 94.2,
  grade: 'A',
  elapsedSeconds: 25,
  errorCount: 2,
  totalChars: 90,
  hostName: 'claude',
  hostDisplayName: 'Claude Code',
  isPersonalBest: true,
  streakCount: 5,
  category: 'code',
  categoryLabel: 'Code',
};

describe('caption', () => {
  it('generates caption with PB for claude host', () => {
    const caption = generateCaption(sampleData);
    expect(caption).toContain('#PB');
    expect(caption).toContain('84 WPM');
    expect(caption).toContain('97.8%');
    expect(caption).toContain('Claude Code');
    expect(caption).toContain('#CookTap');
    expect(caption).toContain('#ClaudeCode');
    expect(caption).toContain('#Streak');
  });

  it('generates caption without PB', () => {
    const caption = generateCaption({ ...sampleData, isPersonalBest: false, streakCount: 1 });
    expect(caption).not.toContain('#PB');
    expect(caption).toContain('84 WPM');
    expect(caption).not.toContain('#Streak');
  });

  it('generates caption for generic host', () => {
    const caption = generateCaption({ ...sampleData, hostName: 'generic', hostDisplayName: 'AI Coding Session' });
    expect(caption).not.toContain('While');
    expect(caption).toContain('#AICoding');
  });
});

describe('card-renderer', () => {
  it('generates a PNG buffer', async () => {
    const buffer = await renderShareCard(sampleData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4E); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  it('generates for generic host without crashing', async () => {
    const buffer = await renderShareCard({
      ...sampleData,
      hostName: 'generic',
      hostDisplayName: 'AI Coding Session',
      isPersonalBest: false,
      streakCount: 0,
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
