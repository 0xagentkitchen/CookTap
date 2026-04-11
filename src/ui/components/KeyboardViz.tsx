import React from 'react';
import { Box, Text } from 'ink';
import { KEYBOARD_LAYOUT, SHIFT_TO_BASE, FINGER_COLORS, ACCENT } from '../../constants.js';

interface Props {
  nextChar: string | null;
}

export function KeyboardViz({ nextChar }: Props) {
  const base = nextChar ? (SHIFT_TO_BASE[nextChar] || nextChar) : '';
  const highlight = base ? base.toUpperCase() : '';
  const isSpace = nextChar === ' ';

  return (
    <Box flexDirection="column" alignItems="center">
      {KEYBOARD_LAYOUT.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((key, keyIdx) => {
            const isHighlighted =
              (key === highlight) ||
              (isSpace && key.includes('SPACE'));

            if (isHighlighted) {
              return (
                <Text key={keyIdx} backgroundColor={ACCENT} color="white" bold>
                  {` ${key} `}
                </Text>
              );
            }

            if (key.includes('SPACE')) {
              return <Text key={keyIdx} dimColor>{` ${key} `}</Text>;
            }

            const color = FINGER_COLORS[key];
            return (
              <Text key={keyIdx} color={color} dimColor>
                {` ${key} `}
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
