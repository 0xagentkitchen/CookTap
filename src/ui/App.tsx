import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { TypingEngine } from '../engine/typing-engine.js';
import { ContentRegistry } from '../content/registry.js';
import { generalPack } from '../content/general-pack.js';
import { Ticker } from '../runtime/ticker.js';
import { recordSession, loadStats, getErrorHeatmap, resetStats } from '../storage/storage.js';
import { isEligibleForStats } from '../engine/scoring.js';
import { saveSuspendedSession, loadSuspendedSession, clearSuspendedSession, hasSuspendedSession } from '../storage/session-store.js';
import { onHostReady } from '../ipc/host-signal.js';
import { CategoryScreen } from './screens/CategoryScreen.js';
import { DrillScreen } from './screens/DrillScreen.js';
import { ResultsScreen } from './screens/ResultsScreen.js';
import { generateShare } from '../share/share.js';
import type { ShareData, ShareMode, SessionStats, GlobalStats } from '../share/types.js';
import type { SessionResult } from '../engine/types.js';
import type { Category } from '../content/types.js';
import { CATEGORY_LABELS } from '../content/types.js';
import type { Drill } from '../content/types.js';
import { calculateRank, nextRankProgress } from '../gamification/ranks.js';
import type { Milestone } from '../gamification/milestones.js';

type Screen = 'resume-prompt' | 'category' | 'drill' | 'results';

const ACCENT = '#7C5CFC';

const HOST_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  generic: 'AI Coding Session',
};

interface AppProps {
  hostName?: string;
}

export function App({ hostName = 'generic' }: AppProps) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>(() => hasSuspendedSession() ? 'resume-prompt' : 'category');
  const [activeCategory, setActiveCategory] = useState<Category>('code');
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);
  const [isNewPbWpm, setIsNewPbWpm] = useState(false);
  const [isNewPbAccuracy, setIsNewPbAccuracy] = useState(false);
  const [isCategoryPb, setIsCategoryPb] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [crossedMilestones, setCrossedMilestones] = useState<Milestone[]>([]);
  const [rankLabel, setRankLabel] = useState<string | null>(null);
  const [rankGap, setRankGap] = useState<string | null>(null);
  const [currentDrill, setCurrentDrill] = useState<Drill | null>(null);
  const [hostReadyBanner, setHostReadyBanner] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [missedKeys, setMissedKeys] = useState<Map<string, number>>(new Map());
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    drillCount: 0,
    totalTime: 0,
    avgWpm: 0,
    avgAccuracy: 0,
    totalErrors: 0,
    totalChars: 0,
    missedKeys: {},
  });

  const hostDisplayName = HOST_DISPLAY_NAMES[hostName] || hostName;

  const engineRef = useRef<TypingEngine>(new TypingEngine());
  const tickerRef = useRef<Ticker>(new Ticker());

  const registry = useRef<ContentRegistry | null>(null);
  if (!registry.current) {
    registry.current = new ContentRegistry();
    registry.current.register(generalPack);
  }

  // Listen for SIGUSR1 host-ready signal
  useEffect(() => {
    return onHostReady(() => {
      setHostReadyBanner(true);
      setTimeout(() => setHostReadyBanner(false), 5000);
    });
  }, []);

  const loadNewDrill = useCallback((category?: Category, timeLimitSec?: number) => {
    const cat = category || activeCategory;
    const heatmap = getErrorHeatmap();
    const drillCount = loadStats().sessions.length;
    const selectionOpts = { errorHeatmap: heatmap, drillCount };

    let drillText: string;
    let drillId: string;
    if (timeLimitSec) {
      // For timed mode, concatenate multiple drills to ensure enough text
      const chunks: string[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const d = registry.current!.getRandomDrill({ category: cat }, selectionOpts);
        if (!seen.has(d.id)) {
          chunks.push(d.text);
          seen.add(d.id);
        }
      }
      drillText = chunks.join(' ');
      drillId = `timed-${timeLimitSec}s-${cat}`;
      setCurrentDrill(null); // Clear so downstream code uses activeCategory
    } else {
      const drill = registry.current!.getRandomDrill({ category: cat }, selectionOpts);
      drillText = drill.text;
      drillId = drill.id;
      setCurrentDrill(drill);
    }

    setActiveCategory(cat);
    setTimeLimitSec(timeLimitSec || null);
    engineRef.current = new TypingEngine();
    engineRef.current.dispatch({
      type: 'LOAD_DRILL',
      drill: { id: drillId, text: drillText },
      timeLimitMs: timeLimitSec ? timeLimitSec * 1000 : undefined,
    });
    tickerRef.current.stop();
    tickerRef.current.start(engineRef.current);
    setHostReadyBanner(false);
    setScreen('drill');
  }, [activeCategory]);

  const loadDrillById = useCallback((drillId: string) => {
    const allDrills = registry.current!.getAllDrills();
    const drill = allDrills.find((d) => d.id === drillId);
    if (drill) {
      setCurrentDrill(drill);
      engineRef.current = new TypingEngine();
      engineRef.current.dispatch({ type: 'LOAD_DRILL', drill: { id: drill.id, text: drill.text } });
      tickerRef.current.stop();
      tickerRef.current.start(engineRef.current);
    }
    setScreen('drill');
  }, []);

  const handleFinished = useCallback(() => {
    tickerRef.current.stop();
    const result = engineRef.current.getResult();
    if (!result) return;

    // Extract missed keys from engine char data
    const snap = engineRef.current.getSnapshot();
    const missed = new Map<string, number>();
    for (const ch of snap.chars) {
      if (ch.correct === false) {
        const key = ch.expected.toLowerCase();
        missed.set(key, (missed.get(key) || 0) + 1);
      }
    }
    setMissedKeys(missed);

    clearSuspendedSession();
    setLastResult(result);

    // Accumulate session-level stats
    setSessionStats((prev) => {
      const newCount = prev.drillCount + 1;
      const newTotalTime = prev.totalTime + result.elapsedSeconds;
      const newTotalErrors = prev.totalErrors + result.errorCount;
      const newTotalChars = prev.totalChars + result.totalChars;
      const newAvgWpm = Math.round((prev.avgWpm * prev.drillCount + result.wpm) / newCount);
      const newAvgAccuracy = Math.round(((prev.avgAccuracy * prev.drillCount + result.accuracy) / newCount) * 10) / 10;
      const newMissedKeys = { ...prev.missedKeys };
      for (const [key, count] of missed) {
        newMissedKeys[key] = (newMissedKeys[key] || 0) + count;
      }
      return {
        drillCount: newCount,
        totalTime: Math.round(newTotalTime * 10) / 10,
        avgWpm: newAvgWpm,
        avgAccuracy: newAvgAccuracy,
        totalErrors: newTotalErrors,
        totalChars: newTotalChars,
        missedKeys: newMissedKeys,
      };
    });

    const cat = currentDrill?.category || activeCategory;
    if (isEligibleForStats(result.elapsedSeconds, result.typedChars)) {
      const { isNewPbWpm: pbWpm, isNewPbAccuracy: pbAcc, isCategoryPbWpm, stats, crossedMilestones: crossed } = recordSession(result, cat, missed);
      setIsNewPbWpm(pbWpm);
      setIsNewPbAccuracy(pbAcc);
      setIsCategoryPb(isCategoryPbWpm);
      setStreakCount(stats.streaks.currentSession);
      setCrossedMilestones(crossed);
      const progress = nextRankProgress(stats);
      setRankLabel(progress.current.label);
      setRankGap(progress.next ? progress.gapDescription : null);
    } else {
      setIsNewPbWpm(false);
      setIsNewPbAccuracy(false);
      setIsCategoryPb(false);
      setCrossedMilestones([]);
      setRankLabel(null);
      setRankGap(null);
    }

    // Clear terminal so results don't overlap with the taller drill screen
    process.stdout.write('\x1B[2J\x1B[H');
    setScreen('results');
  }, [currentDrill, activeCategory]);

  const handleQuit = useCallback(() => {
    tickerRef.current.stop();
    const snap = engineRef.current.getSnapshot();
    if (snap.phase === 'running' || snap.phase === 'paused') {
      saveSuspendedSession(engineRef.current.serialize());
    }
    exit();
  }, [exit]);

  const handleRetry = useCallback(() => {
    if (timeLimitSec) {
      loadNewDrill(activeCategory, timeLimitSec);
    } else if (currentDrill) {
      loadDrillById(currentDrill.id);
    } else {
      loadNewDrill();
    }
  }, [currentDrill, loadDrillById, loadNewDrill, timeLimitSec, activeCategory]);

  const buildGlobalStats = useCallback((): GlobalStats => {
    const stats = loadStats();
    const sessions = stats.sessions;
    const totalDrills = sessions.length;
    const totalTime = sessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);
    const totalChars = sessions.reduce((sum, s) => sum + s.typedChars, 0);
    const avgWpm = totalDrills > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.wpm, 0) / totalDrills) : 0;
    const avgAccuracy = totalDrills > 0 ? Math.round((sessions.reduce((sum, s) => sum + s.accuracy, 0) / totalDrills) * 10) / 10 : 0;
    return {
      totalDrills,
      totalTime: Math.round(totalTime),
      totalChars,
      avgWpm,
      avgAccuracy,
      bestWpm: stats.personalBests.wpm,
      bestAccuracy: stats.personalBests.accuracy,
      longestStreak: stats.streaks.longestSession,
      missedKeys: stats.errorHeatmap || {},
    };
  }, []);

  const handleShare = useCallback(async (mode: ShareMode = 'drill') => {
    if (!lastResult) return;
    setShareMessage('Generating share card...');
    try {
      const cat = currentDrill?.category || activeCategory;
      const currentStats = loadStats();
      const currentRank = calculateRank(currentStats);
      const shareData: ShareData = {
        mode,
        wpm: lastResult.wpm,
        accuracy: lastResult.accuracy,
        alphaAccuracy: lastResult.alphaAccuracy,
        symbolAccuracy: lastResult.symbolAccuracy,
        grade: lastResult.grade,
        elapsedSeconds: lastResult.elapsedSeconds,
        errorCount: lastResult.errorCount,
        totalChars: lastResult.totalChars,
        hostName,
        hostDisplayName,
        isPersonalBest: isNewPbWpm,
        streakCount,
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat],
        rankLabel: currentRank.label,
        dailyStreak: currentStats.streaks.currentDaily,
        session: mode === 'session' && sessionStats.drillCount > 1 ? sessionStats : undefined,
        global: mode === 'global' ? buildGlobalStats() : undefined,
      };
      const output = await generateShare(shareData);
      setShareMessage(`Card saved! Caption copied to clipboard.\n${output.imagePath}`);
      setTimeout(() => setShareMessage(null), 5000);
    } catch (err) {
      setShareMessage(`Share failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      setTimeout(() => setShareMessage(null), 3000);
    }
  }, [lastResult, currentDrill, activeCategory, hostName, hostDisplayName, isNewPbWpm, streakCount, sessionStats, buildGlobalStats]);

  // Cleanup ticker on unmount
  useEffect(() => {
    return () => tickerRef.current.stop();
  }, []);

  if (screen === 'resume-prompt') {
    return (
      <ResumePrompt
        onResume={() => {
          const data = loadSuspendedSession();
          if (data) {
            engineRef.current = TypingEngine.restore(data);
            tickerRef.current.stop();
            tickerRef.current.start(engineRef.current);
            clearSuspendedSession();
            const snap = engineRef.current.getSnapshot();
            const allDrills = registry.current!.getAllDrills();
            const drill = allDrills.find((d) => d.id === snap.drillId);
            setCurrentDrill(drill || null);
            if (drill) setActiveCategory(drill.category);
            setScreen('drill');
          } else {
            setScreen('category');
          }
        }}
        onDiscard={() => {
          clearSuspendedSession();
          setScreen('category');
        }}
      />
    );
  }

  if (screen === 'category') {
    const stats = loadStats();
    return (
      <CategoryScreen
        stats={stats}
        onSelect={(cat, timeSec) => loadNewDrill(cat, timeSec)}
        onQuit={() => exit()}
        onResetStats={() => {
          resetStats();
          setSessionStats({
            drillCount: 0, totalTime: 0, avgWpm: 0,
            avgAccuracy: 0, totalErrors: 0, totalChars: 0, missedKeys: {},
          });
          setStreakCount(0);
          setScreen('category');
        }}
      />
    );
  }

  if (screen === 'results' && lastResult) {
    const cat = currentDrill?.category || activeCategory;
    return (
      <Box flexDirection="column">
        <ResultsScreen
          result={lastResult}
          isNewPbWpm={isNewPbWpm}
          isNewPbAccuracy={isNewPbAccuracy}
          isCategoryPb={isCategoryPb}
          streakCount={streakCount}
          hostDisplayName={hostDisplayName}
          categoryLabel={CATEGORY_LABELS[cat]}
          onNextDrill={() => loadNewDrill()}
          onRetry={handleRetry}
          onQuit={() => setScreen('category')}
          onShare={handleShare}
          missedKeys={missedKeys}
          sessionStats={sessionStats}
          rankLabel={rankLabel}
          rankGap={rankGap}
          crossedMilestones={crossedMilestones}
        />
        {shareMessage && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={ACCENT}>{shareMessage}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {hostReadyBanner && (
        <Box flexDirection="column" alignItems="center" paddingY={1}>
          <Text backgroundColor="#FFD700" color="black" bold>
            {'                                        '}
          </Text>
          <Text backgroundColor="#FFD700" color="black" bold>
            {`     ⚡  ${hostDisplayName} is ready!  ⚡     `}
          </Text>
          <Text backgroundColor="#FFD700" color="black" bold>
            {'     Switch back when you\'re done      '}
          </Text>
          <Text backgroundColor="#FFD700" color="black" bold>
            {'                                        '}
          </Text>
        </Box>
      )}
      <DrillScreen
        engine={engineRef.current}
        onFinished={handleFinished}
        onQuit={handleQuit}
        categoryLabel={CATEGORY_LABELS[activeCategory]}
      />
    </Box>
  );
}

function ResumePrompt({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y' || key.return) {
      onResume();
    } else if (input === 'n' || input === 'N' || key.escape) {
      onDiscard();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text bold color={ACCENT}>CookTap</Text>
      <Box marginY={1}>
        <Text>Saved session found. Resume? </Text>
        <Text bold>Y</Text>
        <Text dimColor>/</Text>
        <Text bold>N</Text>
      </Box>
    </Box>
  );
}
