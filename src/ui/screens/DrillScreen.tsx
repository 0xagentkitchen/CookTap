import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { TypingEngine } from '../../engine/typing-engine.js';
import type { EngineSnapshot } from '../../engine/types.js';
import { TextDisplay } from '../components/TextDisplay.js';
import { StatsBar } from '../components/StatsBar.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { KeyboardViz } from '../components/KeyboardViz.js';
import { HandDiagram } from '../components/HandDiagram.js';

const ACCENT = '#7C5CFC';

interface Props {
  engine: TypingEngine;
  onFinished: () => void;
  onQuit: () => void;
  categoryLabel?: string;
}

export function DrillScreen({ engine, onFinished, onQuit, categoryLabel }: Props) {
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(engine.getSnapshot());
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    const unsub = engine.subscribe((snap) => {
      setSnapshot(snap);
      if (snap.phase === 'finished') {
        onFinished();
      }
    });
    return unsub;
  }, [engine, onFinished]);

  // Track streak (consecutive correct chars without error)
  const streak = countCurrentStreak(snapshot);

  useInput((input, key) => {
    if (key.escape) {
      onQuit();
      return;
    }

    // Toggle focus mode with F key only when not yet started or in ready phase
    if ((input === 'f' || input === 'F') && snapshot.phase === 'ready') {
      setFocusMode((prev) => !prev);
      return;
    }

    if (key.backspace || key.delete) {
      engine.dispatch({ type: 'BACKSPACE', now: Date.now() });
      return;
    }

    if (key.tab) {
      engine.dispatch({ type: 'CHAR_INPUT', char: ' ', now: Date.now() });
      engine.dispatch({ type: 'CHAR_INPUT', char: ' ', now: Date.now() });
      return;
    }

    // Ignore control sequences (arrows, etc.) but allow regular chars
    if (input && !key.ctrl && !key.meta) {
      for (const c of input) {
        const before = engine.getSnapshot().errorCount;
        engine.dispatch({ type: 'CHAR_INPUT', char: c, now: Date.now() });
        if (engine.getSnapshot().errorCount > before) {
          process.stderr.write('\x07'); // terminal bell on error
        }
      }
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={ACCENT}>CookTap</Text>
        {categoryLabel && <Text dimColor> — {categoryLabel}</Text>}
        {focusMode && <Text color="#FFD700"> [focus]</Text>}
      </Box>

      {!focusMode && (
        <StatsBar wpm={snapshot.wpm} accuracy={snapshot.accuracy} elapsedMs={snapshot.elapsedMs} streak={streak} />
      )}

      {focusMode && snapshot.phase === 'running' && (
        <Box justifyContent="center" gap={2}>
          <Text color={ACCENT} bold>{snapshot.wpm}</Text>
          <Text dimColor>wpm</Text>
          {streak >= 5 && (
            <>
              <Text color="#FFD700" bold>{streak}</Text>
              <Text color="#FF6B35">🔥</Text>
            </>
          )}
        </Box>
      )}

      <Box marginY={1}>
        {snapshot.timeLimitMs ? (
          <ProgressBar
            current={Math.min(snapshot.elapsedMs, snapshot.timeLimitMs)}
            total={snapshot.timeLimitMs}
            label={`${Math.max(0, Math.ceil((snapshot.timeLimitMs - snapshot.elapsedMs) / 1000))}s`}
          />
        ) : (
          <ProgressBar current={snapshot.typedCount} total={snapshot.totalChars} />
        )}
      </Box>

      <TextDisplay chars={snapshot.chars} cursorPosition={snapshot.cursorPosition} />

      {!focusMode && (
        <Box marginTop={1}>
          <KeyboardViz nextChar={snapshot.nextExpectedChar} />
        </Box>
      )}

      {!focusMode && (
        <Box marginTop={1}>
          <HandDiagram nextChar={snapshot.nextExpectedChar} />
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>ESC to quit</Text>
        {snapshot.phase === 'ready' && <Text dimColor>  F toggle focus</Text>}
      </Box>
    </Box>
  );
}

function countCurrentStreak(snapshot: EngineSnapshot): number {
  let streak = 0;
  for (let i = snapshot.cursorPosition - 1; i >= 0; i--) {
    if (snapshot.chars[i]?.correct) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
