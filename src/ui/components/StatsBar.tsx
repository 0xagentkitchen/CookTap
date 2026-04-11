import React from 'react';
import { Box, Text } from 'ink';

const ACCENT = '#7C5CFC';

interface Props {
  wpm: number;
  accuracy: number;
  elapsedMs: number;
  streak?: number;
}

export function StatsBar({ wpm, accuracy, elapsedMs, streak = 0 }: Props) {
  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <Box justifyContent="center" gap={2}>
      <Text>
        <Text color={ACCENT} bold>{wpm}</Text>
        <Text dimColor> WPM</Text>
      </Text>
      <Text dimColor>|</Text>
      <Text>
        <Text color={ACCENT} bold>{accuracy}%</Text>
        <Text dimColor> ACC</Text>
      </Text>
      <Text dimColor>|</Text>
      <Text>
        <Text color={ACCENT} bold>{seconds}s</Text>
        <Text dimColor> TIME</Text>
      </Text>
      {streak >= 5 && (
        <>
          <Text dimColor>|</Text>
          <Text>
            <Text color="#FFD700" bold>{streak}</Text>
            <Text color="#FF6B35"> 🔥</Text>
          </Text>
        </>
      )}
    </Box>
  );
}
