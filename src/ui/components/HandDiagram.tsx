import React from 'react';
import { Box, Text } from 'ink';
import {
  FINGER_MAP,
  FINGER_NAMES,
  LEFT_HAND,
  RIGHT_HAND,
  LEFT_FINGER_POS,
  RIGHT_FINGER_POS,
  ACCENT,
} from '../../constants.js';
import type { Hand, FingerIndex } from '../../constants.js';

interface Props {
  nextChar: string | null;
}

function renderHandLine(
  template: string,
  lineIdx: number,
  fingerPositions: Record<FingerIndex, Array<[number, number, number]>>,
  activeFinger: FingerIndex | null,
): React.ReactNode {
  const chars = [...template];
  const elements: React.ReactNode[] = [];

  // Batch consecutive characters with the same highlight state into single
  // <Text> elements to avoid cumulative layout drift from many inline elements.
  let batchStart = 0;
  let batchHighlighted = false;

  function isHighlighted(c: number): boolean {
    if (activeFinger === null) return false;
    const positions = fingerPositions[activeFinger];
    if (!positions) return false;
    for (const [pLine, pStart, pEnd] of positions) {
      if (lineIdx === pLine && c >= pStart && c < pEnd) return true;
    }
    return false;
  }

  function flushBatch(end: number) {
    if (end <= batchStart) return;
    const text = chars.slice(batchStart, end).join('');
    elements.push(
      batchHighlighted
        ? <Text key={batchStart} backgroundColor={ACCENT} color="white">{text}</Text>
        : <Text key={batchStart} dimColor>{text}</Text>
    );
  }

  batchHighlighted = isHighlighted(0);
  for (let c = 1; c < chars.length; c++) {
    const h = isHighlighted(c);
    if (h !== batchHighlighted) {
      flushBatch(c);
      batchStart = c;
      batchHighlighted = h;
    }
  }
  flushBatch(chars.length);

  return elements;
}

export function HandDiagram({ nextChar }: Props) {
  let activeHand: Hand | null = null;
  let activeFinger: FingerIndex | null = null;
  let fingerLabel = '';

  if (nextChar) {
    const key = nextChar.toUpperCase();
    const mapping = FINGER_MAP[key] || FINGER_MAP[nextChar];
    if (mapping) {
      [activeHand, activeFinger] = mapping;
      const handLabel = activeHand === 'left' ? 'Left' : 'Right';
      fingerLabel = `${handLabel} ${FINGER_NAMES[activeFinger]}`;
    }
  }

  return (
    <Box flexDirection="column" alignItems="center">
      {LEFT_HAND.map((_, lineIdx) => (
        <Box key={lineIdx}>
          <Text>
            {renderHandLine(
              LEFT_HAND[lineIdx],
              lineIdx,
              LEFT_FINGER_POS,
              activeHand === 'left' ? activeFinger : null,
            )}
          </Text>
          <Text>{'      '}</Text>
          <Text>
            {renderHandLine(
              RIGHT_HAND[lineIdx],
              lineIdx,
              RIGHT_FINGER_POS,
              activeHand === 'right' ? activeFinger : null,
            )}
          </Text>
        </Box>
      ))}
      <Box gap={6}>
        <Text dimColor>Left Hand</Text>
        <Text dimColor>Right Hand</Text>
      </Box>
      {fingerLabel && (
        <Text>
          <Text dimColor>Use: </Text>
          <Text color={ACCENT} bold>{fingerLabel}</Text>
        </Text>
      )}
    </Box>
  );
}
