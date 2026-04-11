import React from 'react';
import { Box, Text } from 'ink';

const ACCENT = '#7C5CFC';

interface Props {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({ current, total, label }: Props) {
  const barWidth = 40;
  const pct = total === 0 ? 0 : Math.min(1, current / total);
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const displayLabel = label ?? `${Math.round(pct * 100)}%`;

  return (
    <Box justifyContent="center">
      <Text color={ACCENT}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text dimColor> {displayLabel}</Text>
    </Box>
  );
}
