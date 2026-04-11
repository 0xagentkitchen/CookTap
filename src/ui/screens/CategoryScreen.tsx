import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Category } from '../../content/types.js';
import { CATEGORY_LABELS } from '../../content/types.js';
import type { StoredStats } from '../../storage/types.js';
import { calculateRank } from '../../gamification/ranks.js';
import { topWeakKeys } from '../../content/technique-keys.js';

const ACCENT = '#7C5CFC';
const GOLD = '#FFD700';

const SPARKLINE_CHARS = '▁▂▃▄▅▆▇█';

function sparkline(values: number[], width = 12): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Take the last `width` values
  const recent = values.slice(-width);
  return recent.map((v) => {
    const idx = Math.round(((v - min) / range) * (SPARKLINE_CHARS.length - 1));
    return SPARKLINE_CHARS[idx];
  }).join('');
}

interface Props {
  stats: StoredStats | null;
  onSelect: (category: Category, timeLimitSec?: number) => void;
  onQuit: () => void;
  onResetStats?: () => void;
}

const CATEGORIES: Category[] = ['words', 'code', 'cli', 'technique'];

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  words: 'English text, developer phrases',
  code: 'JS/TS snippets, symbols, patterns',
  cli: 'Shell commands, git, docker, curl',
  technique: 'Finger drills, rows, hand isolation',
};

function getCategoryWpmHistory(stats: StoredStats | null, cat: Category): number[] {
  if (!stats) return [];
  return stats.sessions
    .filter((s) => s.category === cat)
    .map((s) => s.wpm);
}

const TIME_OPTIONS = [0, 30, 60]; // 0 = standard (no limit)
const TIME_LABELS = ['Standard', '30s', '60s'];

export function CategoryScreen({ stats, onSelect, onQuit, onResetStats }: Props) {
  const [selected, setSelected] = useState(0);
  const [timeIdx, setTimeIdx] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  useInput((input, key) => {
    if (confirmReset) {
      if (input === 'y' || input === 'Y') {
        onResetStats?.();
        setConfirmReset(false);
      } else {
        setConfirmReset(false);
      }
      return;
    }

    if (key.upArrow) {
      setSelected((s) => (s - 1 + CATEGORIES.length) % CATEGORIES.length);
    } else if (key.downArrow) {
      setSelected((s) => (s + 1) % CATEGORIES.length);
    } else if (key.tab || key.leftArrow || key.rightArrow) {
      setTimeIdx((t) => (t + 1) % TIME_OPTIONS.length);
    } else if (key.return) {
      const timeLimit = TIME_OPTIONS[timeIdx] || undefined;
      onSelect(CATEGORIES[selected], timeLimit);
    } else if (input === 'q' || input === 'Q' || key.escape) {
      onQuit();
    } else if ((input === 'x' || input === 'X') && onResetStats) {
      setConfirmReset(true);
    } else if (input === '1') {
      onSelect('words', TIME_OPTIONS[timeIdx] || undefined);
    } else if (input === '2') {
      onSelect('code', TIME_OPTIONS[timeIdx] || undefined);
    } else if (input === '3') {
      onSelect('cli', TIME_OPTIONS[timeIdx] || undefined);
    } else if (input === '4') {
      onSelect('technique', TIME_OPTIONS[timeIdx] || undefined);
    }
  });

  const totalSessions = stats?.sessions.length ?? 0;
  const overallPb = stats?.personalBests;
  const rank = stats && totalSessions > 0 ? calculateRank(stats) : null;
  const dailyStreak = stats?.streaks.currentDaily ?? 0;
  const weakKeys = stats?.errorHeatmap ? topWeakKeys(stats.errorHeatmap, 5) : [];

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={ACCENT}>CookTap</Text>
        <Text dimColor> — pick a category</Text>
        {rank && (
          <Text>
            <Text dimColor>  · </Text>
            <Text bold color={GOLD}>{rank.label}</Text>
          </Text>
        )}
      </Box>

      {/* Daily streak banner — prominent when active */}
      {dailyStreak > 0 && (
        <Box marginBottom={1}>
          <Text bold color={GOLD}>{'▲ '}</Text>
          <Text bold color={GOLD}>Day {dailyStreak}</Text>
          <Text dimColor> — {dailyStreak > 1 ? "don't break the chain" : 'streak started'}</Text>
        </Box>
      )}

      {/* Overall stats summary */}
      {totalSessions > 0 && overallPb && overallPb.wpm > 0 && (
        <Box marginBottom={1} gap={2}>
          <Text dimColor>Sessions: <Text>{totalSessions}</Text></Text>
          <Text dimColor>Best: <Text color="#FFD700">{overallPb.wpm} WPM</Text></Text>
          <Text dimColor>Acc: <Text color="#FFD700">{overallPb.accuracy}%</Text></Text>
        </Box>
      )}

      <Box flexDirection="column" gap={0}>
        {CATEGORIES.map((cat, i) => {
          const isSelected = i === selected;
          const label = CATEGORY_LABELS[cat];
          const desc = CATEGORY_DESCRIPTIONS[cat];
          const pb = stats?.categoryBests?.[cat];
          const wpmHistory = getCategoryWpmHistory(stats, cat);
          const spark = sparkline(wpmHistory);
          const catSessions = wpmHistory.length;
          const pbStr = pb && pb.wpm > 0 ? `${pb.wpm} WPM ${pb.accuracy}%` : '';

          return (
            <Box key={cat} flexDirection="column" marginBottom={i < CATEGORIES.length - 1 ? 1 : 0}>
              <Box>
                {isSelected ? (
                  <Text backgroundColor={ACCENT} color="white" bold>{` ${i + 1}. ${label} `}</Text>
                ) : (
                  <Text>   <Text bold>{i + 1}.</Text> <Text>{label}</Text></Text>
                )}
                <Text dimColor>  {desc}</Text>
              </Box>
              {catSessions > 0 && (
                <Box paddingLeft={6}>
                  <Text dimColor>PB </Text>
                  <Text color="#FFD700">{pbStr}</Text>
                  <Text dimColor>  {catSessions} drills  </Text>
                  {spark && <Text color={ACCENT}>{spark}</Text>}
                </Box>
              )}
              {cat === 'technique' && weakKeys.length > 0 && (
                <Box paddingLeft={6}>
                  <Text dimColor>Targeting: </Text>
                  <Text color="#FF4444">{weakKeys.map((k) => (k === ' ' ? '␣' : k)).join(' ')}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Mode selector */}
      <Box marginTop={1} gap={1}>
        <Text dimColor>Mode:</Text>
        {TIME_LABELS.map((label, i) => (
          <Text key={label}>
            {i === timeIdx ? (
              <Text backgroundColor={ACCENT} color="white" bold>{` ${label} `}</Text>
            ) : (
              <Text dimColor> {label} </Text>
            )}
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Up/Down select category, Tab/Left/Right toggle mode, Enter to start</Text>
      </Box>

      {confirmReset ? (
        <Box marginTop={1}>
          <Text color="#FF4444" bold>Reset all stats? This cannot be undone. </Text>
          <Text bold>Y</Text>
          <Text dimColor> / any key to cancel</Text>
        </Box>
      ) : (
        onResetStats && totalSessions > 0 && (
          <Box marginTop={1}>
            <Text dimColor>X reset stats</Text>
          </Box>
        )
      )}
    </Box>
  );
}
