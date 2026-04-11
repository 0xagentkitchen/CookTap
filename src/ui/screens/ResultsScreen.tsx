import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { SessionResult, Grade } from '../../engine/types.js';
import type { SessionStats } from '../../share/types.js';
import type { Milestone } from '../../gamification/milestones.js';

const ACCENT = '#7C5CFC';
const GOLD = '#FFD700';

interface Props {
  result: SessionResult;
  isNewPbWpm: boolean;
  isNewPbAccuracy: boolean;
  isCategoryPb?: boolean;
  streakCount: number;
  hostDisplayName?: string;
  categoryLabel?: string;
  onNextDrill: () => void;
  onRetry: () => void;
  onQuit: () => void;
  onShare?: (mode: 'drill' | 'session' | 'global') => void;
  missedKeys?: Map<string, number>;
  sessionStats?: SessionStats;
  rankLabel?: string | null;
  rankGap?: string | null;
  crossedMilestones?: Milestone[];
}

const GRADE_COLORS: Record<Grade, string> = {
  S: '#FFD700',
  A: '#7C5CFC',
  B: '#00CC88',
  C: '#FFA500',
  D: '#FF4444',
};

export function ResultsScreen({
  result,
  isNewPbWpm,
  isNewPbAccuracy,
  streakCount,
  hostDisplayName,
  categoryLabel,
  isCategoryPb,
  onNextDrill,
  onRetry,
  onQuit,
  onShare,
  missedKeys,
  sessionStats,
  rankLabel,
  rankGap,
  crossedMilestones,
}: Props) {
  useInput((input, key) => {
    if (key.return) {
      onNextDrill();
      return;
    }
    if (input === 'r' || input === 'R') {
      onRetry();
      return;
    }
    if (onShare) {
      if (input === '1') { onShare('drill'); return; }
      if (input === '2' && sessionStats && sessionStats.drillCount > 1) { onShare('session'); return; }
      if (input === '3') { onShare('global'); return; }
      if (input === 's' || input === 'S') { onShare('drill'); return; }
    }
    if (input === 'q' || input === 'Q' || key.escape) {
      onQuit();
      return;
    }
  });

  const gradeColor = GRADE_COLORS[result.grade];

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={ACCENT}>CookTap</Text>
        <Text dimColor> — results</Text>
        {categoryLabel && <Text dimColor> ({categoryLabel})</Text>}
        {rankLabel && (
          <Text>
            <Text dimColor>  · </Text>
            <Text bold color={GOLD}>{rankLabel}</Text>
          </Text>
        )}
      </Box>

      {/* Milestone celebrations */}
      {crossedMilestones && crossedMilestones.length > 0 && (
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
          {crossedMilestones.map((m) => (
            <Text key={m.id} color={GOLD} bold>
              {'★ UNLOCKED: '}{m.title}
            </Text>
          ))}
        </Box>
      )}

      {/* Grade */}
      <Box marginBottom={1}>
        <Text dimColor>Grade: </Text>
        <Text bold color={gradeColor}>{result.grade}</Text>
        {isNewPbWpm && <Text color="#FFD700" bold> NEW PB!</Text>}
        {!isNewPbWpm && isCategoryPb && categoryLabel && <Text color="#FFD700" bold> {categoryLabel} PB!</Text>}
      </Box>

      {/* Stats */}
      <Box flexDirection="column" alignItems="center" gap={0}>
        <Text>
          <Text dimColor>Speed:    </Text>
          <Text bold>{result.wpm}</Text>
          <Text dimColor> WPM</Text>
          {isNewPbWpm && <Text color="#FFD700"> *</Text>}
        </Text>
        <Text>
          <Text dimColor>Accuracy: </Text>
          <Text bold>{result.accuracy}%</Text>
          {isNewPbAccuracy && <Text color="#FFD700"> *</Text>}
        </Text>
        <Text>
          <Text dimColor>Alpha:    </Text>
          <Text>{result.alphaAccuracy}%</Text>
        </Text>
        <Text>
          <Text dimColor>Symbols:  </Text>
          <Text>{result.symbolAccuracy}%</Text>
        </Text>
        <Text>
          <Text dimColor>Time:     </Text>
          <Text>{result.elapsedSeconds}s</Text>
        </Text>
        <Text>
          <Text dimColor>Errors:   </Text>
          <Text>{result.errorCount}/{result.totalChars}</Text>
        </Text>
        {streakCount > 1 && (
          <Text>
            <Text dimColor>Streak:   </Text>
            <Text color={ACCENT} bold>{streakCount}</Text>
            <Text dimColor> sessions</Text>
          </Text>
        )}
      </Box>

      {/* Session summary (shown after 1+ drills) */}
      {sessionStats && sessionStats.drillCount > 1 && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text dimColor>── session ({sessionStats.drillCount} drills) ──</Text>
          <Box justifyContent="center" gap={2}>
            <Text>
              <Text dimColor>avg </Text>
              <Text bold>{sessionStats.avgWpm}</Text>
              <Text dimColor> wpm</Text>
            </Text>
            <Text>
              <Text dimColor>avg </Text>
              <Text bold>{sessionStats.avgAccuracy}%</Text>
              <Text dimColor> acc</Text>
            </Text>
            <Text>
              <Text dimColor>total </Text>
              <Text bold>{Math.round(sessionStats.totalTime)}s</Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* Error heatmap — cumulative across session when available */}
      {(() => {
        const heatmapSource = sessionStats && sessionStats.drillCount > 1
          ? Object.entries(sessionStats.missedKeys)
          : missedKeys ? [...missedKeys.entries()] : [];
        if (heatmapSource.length === 0) return null;
        const sorted = heatmapSource.sort((a, b) => b[1] - a[1]).slice(0, 6);
        const max = sorted[0]?.[1] ?? 1;
        const barWidth = 16;
        const label = sessionStats && sessionStats.drillCount > 1 ? 'Trouble keys (session):' : 'Trouble keys:';
        return (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text dimColor>{label}</Text>
            <Box flexDirection="column" marginTop={0}>
              {sorted.map(([key, count]) => {
                const filled = Math.max(1, Math.round((count / max) * barWidth));
                const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
                const display = key === ' ' ? '␣' : key;
                return (
                  <Text key={key}>
                    <Text color="#FF4444" bold>{` ${display} `}</Text>
                    <Text color="#FF4444">{bar}</Text>
                    <Text dimColor> {count}</Text>
                  </Text>
                );
              })}
            </Box>
          </Box>
        );
      })()}

      {/* Host label */}
      {hostDisplayName && hostDisplayName !== 'AI Coding Session' && (
        <Box marginTop={1}>
          <Text dimColor>while </Text>
          <Text color={ACCENT}>{hostDisplayName}</Text>
          <Text dimColor> was working</Text>
        </Box>
      )}

      {/* Share options */}
      {onShare && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text dimColor>Share:</Text>
          <Box gap={2}>
            <Text>
              <Text bold>1</Text>
              <Text dimColor> drill</Text>
            </Text>
            {sessionStats && sessionStats.drillCount > 1 && (
              <Text>
                <Text bold>2</Text>
                <Text dimColor> session</Text>
              </Text>
            )}
            <Text>
              <Text bold>3</Text>
              <Text dimColor> global</Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* Rank progress nudge */}
      {rankGap && (
        <Box marginTop={1}>
          <Text dimColor>Next rank: </Text>
          <Text color={ACCENT}>{rankGap}</Text>
        </Box>
      )}

      {/* Actions */}
      <Box marginTop={1} gap={2}>
        <Text>
          <Text bold>Enter</Text>
          <Text dimColor> next</Text>
        </Text>
        <Text>
          <Text bold>R</Text>
          <Text dimColor> retry</Text>
        </Text>
        <Text>
          <Text bold>Q</Text>
          <Text dimColor> quit</Text>
        </Text>
      </Box>
    </Box>
  );
}
