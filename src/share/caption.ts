import type { ShareData } from './types.js';
import type { Grade } from '../engine/types.js';

const HOST_HASHTAGS: Record<string, string> = {
  claude: '#ClaudeCode',
  codex: '#Codex',
  gemini: '#GeminiCLI',
  generic: '#AICoding',
};

type ToneBucket =
  | 'flawless'
  | 'speedDemon'
  | 'precision'
  | 'sGrade'
  | 'aGrade'
  | 'bGrade'
  | 'cdGrade';

// Drill-mode opener templates, keyed by tone bucket.
// Each template receives {wpm}, {acc}, {grade} placeholders.
const DRILL_OPENERS: Record<ToneBucket, string[]> = {
  flawless: [
    'Flawless. {wpm} WPM, zero misses.',
    'No mistakes. No mercy. {wpm} WPM at 100%.',
    '100% accuracy. {wpm} WPM. Untouchable.',
    'Perfect run. {wpm} WPM, not a single typo.',
    'Clean sheet. {wpm} WPM at 100% accuracy.',
    'Zero errors, {wpm} WPM. That is the standard.',
    'Pristine. {wpm} WPM, 100% acc.',
    'Nailed every key. {wpm} WPM.',
  ],
  speedDemon: [
    'Speed demon mode: {wpm} WPM at {acc}%.',
    'Foot on the gas. {wpm} WPM, {acc}% acc (worth it).',
    '{wpm} WPM. Accuracy can wait.',
    'Full throttle: {wpm} WPM, {acc}%. No regrets.',
    'Typing like it owes me money. {wpm} WPM, {acc}% acc.',
    'Pure velocity. {wpm} WPM at {acc}%.',
    '{wpm} WPM of controlled chaos ({acc}% acc).',
    'Rawdogging {wpm} WPM, accuracy be damned.',
  ],
  precision: [
    'Precision mode: {acc}% acc at {wpm} WPM.',
    'Surgical. {acc}% accuracy, {wpm} WPM.',
    'Slow is smooth. {wpm} WPM at {acc}% acc.',
    'Every key earned. {wpm} WPM, {acc}% acc.',
    'Measured and clean: {acc}% at {wpm} WPM.',
    'Accuracy first: {acc}% ({wpm} WPM).',
    'Dialed in. {acc}% accuracy, {wpm} WPM.',
    'Craftsman pace. {wpm} WPM, {acc}% acc.',
  ],
  sGrade: [
    'Absolutely cooking. {wpm} WPM at {acc}% (Grade S).',
    'S-tier. Do not @ me. {wpm} WPM, {acc}% acc.',
    "Chef's kiss. {wpm} WPM at {acc}% accuracy.",
    'S-grade run: {wpm} WPM, {acc}% acc. Menace behavior.',
    'Locked in. {wpm} WPM, {acc}% acc. S-grade.',
    'That was a cook. {wpm} WPM at {acc}% (S).',
    'Touch grass? No. Touch keys. {wpm} WPM, {acc}%. S.',
    'Grade S. {wpm} WPM, {acc}% accuracy. Elite.',
    'Main character energy: {wpm} WPM, {acc}% acc (S).',
  ],
  aGrade: [
    'Solid run. {wpm} WPM at {acc}% acc (Grade A).',
    'Clean execution: {wpm} WPM, {acc}% acc. A-grade.',
    'A-grade territory. {wpm} WPM at {acc}%.',
    'Nothing flashy. Just an A. {wpm} WPM, {acc}% acc.',
    'Reliable hands. {wpm} WPM, {acc}% accuracy (A).',
    'A-tier output: {wpm} WPM at {acc}% acc.',
    'Business in the front: {wpm} WPM, {acc}% acc, Grade A.',
    'Steady hands, A-grade. {wpm} WPM, {acc}%.',
  ],
  bGrade: [
    'Grinding it out. {wpm} WPM at {acc}% acc (B).',
    'Another one in the books: {wpm} WPM, {acc}% acc.',
    'B-grade reps. {wpm} WPM, {acc}% acc. Progress.',
    'Not every run is a highlight reel. {wpm} WPM, {acc}%.',
    'Middle of the pack: {wpm} WPM, {acc}% acc (B).',
    'Keeping the streak alive. {wpm} WPM, {acc}% acc.',
    'B for "building." {wpm} WPM at {acc}% accuracy.',
    'Showed up. {wpm} WPM, {acc}% acc. Grade B.',
  ],
  cdGrade: [
    'Warming up. {wpm} WPM at {acc}% acc.',
    'Every rep counts. {wpm} WPM, {acc}% acc.',
    'Back to the drawing board. {wpm} WPM, {acc}%.',
    'Rough one. {wpm} WPM at {acc}% acc. Next drill, better.',
    'Log the L, run it back. {wpm} WPM, {acc}% acc.',
    'Reps are reps. {wpm} WPM, {acc}% accuracy.',
    'Humbling. {wpm} WPM, {acc}% acc. Still showed up.',
    'Shaking off the rust: {wpm} WPM, {acc}% acc.',
    'The bad runs build the good ones. {wpm} WPM, {acc}%.',
  ],
};

// Personal-best prefixes — prepended when isPersonalBest is true.
const PB_PREFIXES: string[] = [
  'New PB!',
  'Just broke my record!',
  'Personal best unlocked.',
  'New high score.',
  'PB alert.',
  'Ceiling raised.',
  'New personal best.',
  'Record broken.',
];

// Session-mode openers. {count}, {avgWpm}, {avgAcc}, {wpm}, {grade}
const SESSION_OPENERS: string[] = [
  '{count} drills in one sitting. Avg {avgWpm} WPM at {avgAcc}% acc.',
  'Session log: {count} drills, averaging {avgWpm} WPM ({avgAcc}% acc).',
  '{count} back-to-back. Session avg: {avgWpm} WPM, {avgAcc}% acc.',
  'Cooked through {count} drills. {avgWpm} WPM / {avgAcc}% acc average.',
  '{count}-drill session done. Avg {avgWpm} WPM, {avgAcc}% accuracy.',
  'Stacked {count} drills. Average: {avgWpm} WPM at {avgAcc}% acc.',
  'Session wrap: {count} drills, {avgWpm} WPM avg, {avgAcc}% acc.',
  'Knocked out {count} drills this session ({avgWpm} WPM / {avgAcc}%).',
];

const SESSION_CLOSERS: string[] = [
  'Finished with {wpm} WPM (Grade {grade}).',
  'Capped it at {wpm} WPM, Grade {grade}.',
  'Last drill: {wpm} WPM, Grade {grade}.',
  'Walked off on {wpm} WPM (Grade {grade}).',
  'Ended on {wpm} WPM — Grade {grade}.',
  'Closer: {wpm} WPM at Grade {grade}.',
];

// Global-mode openers. {total}, {bestWpm}, {bestAcc}, {avgWpm}, {time}
const GLOBAL_OPENERS: string[] = [
  '{total} drills completed. Best: {bestWpm} WPM at {bestAcc}% accuracy.',
  'All-time: {total} drills, top speed {bestWpm} WPM ({bestAcc}% acc).',
  '{total} drills deep. Personal ceiling: {bestWpm} WPM, {bestAcc}% acc.',
  'Career stats: {total} drills, best {bestWpm} WPM at {bestAcc}%.',
  'Lifetime count: {total} drills. Record: {bestWpm} WPM / {bestAcc}% acc.',
  '{total} drills in the books. PR: {bestWpm} WPM, {bestAcc}% accuracy.',
  'Running total: {total} drills. Fastest: {bestWpm} WPM ({bestAcc}%).',
];

const GLOBAL_CLOSERS: string[] = [
  'Average: {avgWpm} WPM across {time} of practice.',
  '{time} of keys, averaging {avgWpm} WPM.',
  'Long haul: {time} logged at {avgWpm} WPM average.',
  '{avgWpm} WPM average over {time} of total drill time.',
  '{time} practiced. Mean speed: {avgWpm} WPM.',
];

export function generateCaption(data: ShareData): string {
  const lines: string[] = [];

  if (data.mode === 'global' && data.global) {
    const opener = pick(GLOBAL_OPENERS);
    const closer = pick(GLOBAL_CLOSERS);
    lines.push(
      fill(opener, {
        total: data.global.totalDrills,
        bestWpm: data.global.bestWpm,
        bestAcc: data.global.bestAccuracy,
      }),
    );
    lines.push(
      fill(closer, {
        avgWpm: data.global.avgWpm,
        time: formatTime(data.global.totalTime),
      }),
    );
  } else if (data.mode === 'session' && data.session) {
    const opener = pick(SESSION_OPENERS);
    const closer = pick(SESSION_CLOSERS);
    lines.push(
      fill(opener, {
        count: data.session.drillCount,
        avgWpm: data.session.avgWpm,
        avgAcc: data.session.avgAccuracy,
        wpm: data.wpm,
        grade: data.grade,
      }),
    );
    lines.push(
      fill(closer, {
        wpm: data.wpm,
        grade: data.grade,
      }),
    );
  } else {
    const catSuffix = data.categoryLabel ? ` (${data.categoryLabel})` : '';
    const bucket = selectBucket(data.grade, data.wpm, data.accuracy);
    const opener = fill(pick(DRILL_OPENERS[bucket]), {
      wpm: data.wpm,
      acc: data.accuracy,
      grade: data.grade,
    });
    if (data.isPersonalBest) {
      lines.push(`${pick(PB_PREFIXES)} ${opener}${catSuffix}`);
    } else {
      lines.push(`${opener}${catSuffix}`);
    }
  }

  // Host context
  if (data.hostName !== 'generic') {
    lines.push(`While ${data.hostDisplayName} was working.`);
  }

  // Tagline
  lines.push('Turned wait time into reps with CookTap.');

  // Hashtags
  const hostTag = HOST_HASHTAGS[data.hostName] || '#AICoding';
  const tags = ['#CookTap', '#VibeCoding', hostTag];
  if (data.streakCount >= 3) tags.push('#Streak');
  if (data.mode === 'drill') {
    if (data.grade === 'S') tags.push('#SGrade');
    if (data.accuracy === 100) tags.push('#Flawless');
    if (data.isPersonalBest) tags.push('#PB');
  }
  lines.push(tags.join(' '));

  const caption = lines.join('\n');
  // Twitter/X safety: trim to 280 if we somehow overshoot.
  return caption.length > 280 ? caption.slice(0, 277) + '...' : caption;
}

function selectBucket(grade: Grade, wpm: number, accuracy: number): ToneBucket {
  if (accuracy === 100) return 'flawless';
  if (wpm > 70 && accuracy < 90) return 'speedDemon';
  if (wpm < 40 && accuracy > 97) return 'precision';
  if (grade === 'S') return 'sGrade';
  if (grade === 'A') return 'aGrade';
  if (grade === 'B') return 'bGrade';
  return 'cdGrade';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}
