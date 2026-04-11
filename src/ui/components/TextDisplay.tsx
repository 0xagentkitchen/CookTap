import React from 'react';
import { Box, Text } from 'ink';
import type { CharResult } from '../../engine/types.js';

interface Props {
  chars: CharResult[];
  cursorPosition: number;
}

const ACCENT = '#7C5CFC';

// Find word boundaries around the cursor
function getCurrentWordRange(chars: CharResult[], cursor: number): [number, number] {
  let start = cursor;
  while (start > 0 && chars[start - 1]?.expected !== ' ') start--;
  let end = cursor;
  while (end < chars.length && chars[end]?.expected !== ' ') end++;
  return [start, end];
}

export function TextDisplay({ chars, cursorPosition }: Props) {
  // Group chars into lines that fit ~70 chars for readability
  const maxWidth = 70;
  const lines: CharResult[][] = [];
  let current: CharResult[] = [];
  let lineLen = 0;

  for (const char of chars) {
    // Word-wrap on space boundaries
    if (char.expected === ' ' && lineLen >= maxWidth) {
      lines.push(current);
      current = [];
      lineLen = 0;
    }
    current.push(char);
    lineLen++;
  }
  if (current.length > 0) lines.push(current);

  const [wordStart, wordEnd] = getCurrentWordRange(chars, cursorPosition);
  let globalIdx = 0;

  return (
    <Box flexDirection="column" alignItems="center" marginY={1}>
      {lines.map((line, lineIdx) => (
        <Box key={lineIdx}>
          {line.map((char) => {
            const idx = globalIdx++;
            const isCursor = idx === cursorPosition;

            if (char.actual !== null) {
              // Typed characters — fade them out
              if (char.correct) {
                return <Text key={idx} color="#4B5563">{char.expected}</Text>;
              } else {
                return <Text key={idx} backgroundColor="#7F1D1D" color="#FCA5A5">{char.expected}</Text>;
              }
            } else if (isCursor) {
              // Current cursor position — bright highlight
              return <Text key={idx} backgroundColor={ACCENT} color="white" bold>{char.expected}</Text>;
            } else if (idx >= wordStart && idx < wordEnd) {
              // Current word (untyped part) — emphasized
              return <Text key={idx} color="white" bold>{char.expected}</Text>;
            } else {
              // Future text — ghosted
              return <Text key={idx} color="#4B5563">{char.expected}</Text>;
            }
          })}
        </Box>
      ))}
    </Box>
  );
}
