import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import type { ShareData } from './types.js';
import type { Grade } from '../engine/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the background image regardless of how CookTap is launched.
 * When bundled by tsup, __dirname is `<root>/dist` → go up 1.
 * When run via tsx (dev), __dirname is `<root>/src/share` → go up 2.
 * Pick the first candidate that exists on disk.
 */
function resolveBgPath(): string {
  const candidates = [
    path.resolve(__dirname, '..', 'assets', 'CookTap-CardBG.png'),
    path.resolve(__dirname, '..', '..', 'assets', 'CookTap-CardBG.png'),
    path.resolve(__dirname, '..', '..', '..', 'assets', 'CookTap-CardBG.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const BG_PATH = resolveBgPath();

const SCALE = 2;
const WIDTH = 1200;
const HEIGHT = 675;
const CX = WIDTH / 2;

const COLORS = {
  bg: '#0D1117',
  bgSecondary: '#161B22',
  accent: '#7C5CFC',
  text: '#E6EDF3',
  textDim: '#7D8590',
  gold: '#FFD700',
  green: '#3FB950',
  red: '#F85149',
  border: '#30363D',
};

const GRADE_COLORS: Record<Grade, string> = {
  S: '#FFD700',
  A: '#7C5CFC',
  B: '#3FB950',
  C: '#FFA500',
  D: '#F85149',
};

export async function renderShareCard(data: ShareData): Promise<Buffer> {
  const canvas = createCanvas(WIDTH * SCALE, HEIGHT * SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  await drawBackground(ctx);
  drawHeader(ctx, data);

  if (data.mode === 'global' && data.global) {
    drawGlobalHero(ctx, data);
    drawGlobalPanel(ctx, data);
  } else if (data.mode === 'session' && data.session) {
    drawSessionHero(ctx, data);
    drawSessionPanel(ctx, data);
  } else {
    drawDrillHero(ctx, data);
    drawDrillPanel(ctx, data);
  }

  drawTagline(ctx);

  return Buffer.from(await canvas.encode('png'));
}

async function drawBackground(ctx: SKRSContext2D) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  try {
    const img = await loadImage(BG_PATH);
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (WIDTH - w) / 2;
    const y = (HEIGHT - h) / 2;
    // @napi-rs/canvas Image type conflicts with DOM CanvasImageSource
    (ctx as any).drawImage(img, x, y, w, h);
  } catch {
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(124, 92, 252, 0.08)');
    grad.addColorStop(1, 'rgba(124, 92, 252, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, 200);
  }

  // Dark overlay
  ctx.fillStyle = 'rgba(13, 17, 23, 0.55)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Accent line at top
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, WIDTH, 3);
}

function drawHeader(ctx: SKRSContext2D, data: ShareData) {
  // Centered title
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 42px monospace';
  ctx.fillText('CookTap', CX, 55);

  // Mode / category subtitle
  const modeLabels: Record<string, string> = {
    drill: data.categoryLabel ? `${data.categoryLabel}` : 'Drill',
    session: 'Session',
    global: 'All-Time Stats',
  };
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '22px monospace';
  ctx.fillText(modeLabels[data.mode], CX, 85);

  // Rank label under the subtitle — flex
  if (data.rankLabel) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(data.rankLabel, CX, 108);
  }

  ctx.textAlign = 'left';
}

// ── Drill mode ──

function drawDrillHero(ctx: SKRSContext2D, data: ShareData) {
  ctx.textAlign = 'center';

  // Grade — centered
  const gradeColor = GRADE_COLORS[data.grade];
  ctx.fillStyle = gradeColor;
  ctx.font = 'bold 130px monospace';
  ctx.fillText(data.grade, CX, 220);

  // PB badge under grade
  if (data.isPersonalBest) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('NEW PERSONAL BEST', CX, 250);
  }

  // WPM + accuracy on same line, centered below grade
  const wpmStr = `${data.wpm}`;
  const accStr = `${data.accuracy}%`;
  ctx.font = 'bold 56px monospace';
  const wpmW = ctx.measureText(wpmStr).width;
  ctx.font = '24px monospace';
  const wpmLabelW = ctx.measureText(' WPM').width;
  ctx.font = 'bold 56px monospace';
  const accW = ctx.measureText(accStr).width;
  ctx.font = '24px monospace';
  const accLabelW = ctx.measureText(' ACC').width;
  const gap = 50;
  const totalW = wpmW + wpmLabelW + gap + accW + accLabelW;
  let x = CX - totalW / 2;
  const y = 310;

  ctx.textAlign = 'left';

  // WPM
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 56px monospace';
  ctx.fillText(wpmStr, x, y);
  x += wpmW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '24px monospace';
  ctx.fillText(' WPM', x, y);
  x += wpmLabelW + gap;

  // Accuracy
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 56px monospace';
  ctx.fillText(accStr, x, y);
  x += accW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '24px monospace';
  ctx.fillText(' ACC', x, y);
}

function drawDrillPanel(ctx: SKRSContext2D, data: ShareData) {
  const { statY, col1, col2, col3, col4, rowGap } = drawPanel(ctx);
  const words = Math.round(data.totalChars / 5);

  drawStat(ctx, col1, statY, 'Alpha', `${data.alphaAccuracy}%`, COLORS.green);
  drawStat(ctx, col2, statY, 'Symbols', `${data.symbolAccuracy}%`, COLORS.accent);
  drawStat(ctx, col3, statY, 'Time', `${data.elapsedSeconds}s`, COLORS.text);
  drawStat(ctx, col4, statY, 'Errors', `${data.errorCount}/${data.totalChars}`, data.errorCount === 0 ? COLORS.green : COLORS.text);

  drawStat(ctx, col1, statY + rowGap, 'Words', `${words}`, COLORS.text);
  drawStat(ctx, col2, statY + rowGap, 'Characters', `${data.totalChars}`, COLORS.text);
  if (data.streakCount > 1) {
    drawStat(ctx, col3, statY + rowGap, 'Streak', `${data.streakCount} sessions`, COLORS.gold);
  }
}

// ── Session mode ──

function drawSessionHero(ctx: SKRSContext2D, data: ShareData) {
  const session = data.session!;
  ctx.textAlign = 'center';

  // Drill count — big centered number
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 110px monospace';
  ctx.fillText(`${session.drillCount}`, CX, 210);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '24px monospace';
  ctx.fillText('drills this session', CX, 240);

  // Avg WPM + Avg Accuracy centered below
  const avgWpmStr = `${session.avgWpm}`;
  const avgAccStr = `${session.avgAccuracy}%`;
  ctx.font = 'bold 48px monospace';
  const wpmW = ctx.measureText(avgWpmStr).width;
  ctx.font = '20px monospace';
  const wpmLabelW = ctx.measureText(' avg WPM').width;
  ctx.font = 'bold 48px monospace';
  const accW = ctx.measureText(avgAccStr).width;
  ctx.font = '20px monospace';
  const accLabelW = ctx.measureText(' avg ACC').width;
  const gap = 50;
  const totalW = wpmW + wpmLabelW + gap + accW + accLabelW;
  let x = CX - totalW / 2;
  const y = 305;

  ctx.textAlign = 'left';

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px monospace';
  ctx.fillText(avgWpmStr, x, y);
  x += wpmW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '20px monospace';
  ctx.fillText(' avg WPM', x, y);
  x += wpmLabelW + gap;

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px monospace';
  ctx.fillText(avgAccStr, x, y);
  x += accW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '20px monospace';
  ctx.fillText(' avg ACC', x, y);
}

function drawSessionPanel(ctx: SKRSContext2D, data: ShareData) {
  const session = data.session!;
  const { statY, col1, col2, col3, col4, rowGap } = drawPanel(ctx);

  // Row 1: session totals
  const sessionWords = Math.round(session.totalChars / 5);
  drawStat(ctx, col1, statY, 'Words', `${formatNumber(sessionWords)}`, COLORS.text);
  drawStat(ctx, col2, statY, 'Characters', `${formatNumber(session.totalChars)}`, COLORS.text);
  drawStat(ctx, col3, statY, 'Total Time', `${Math.round(session.totalTime)}s`, COLORS.text);
  drawStat(ctx, col4, statY, 'Errors', `${session.totalErrors}`, session.totalErrors === 0 ? COLORS.green : COLORS.text);

  // Row 2: latest drill stats (all purple)
  drawStat(ctx, col1, statY + rowGap, 'Last WPM', `${data.wpm}`, COLORS.accent);
  drawStat(ctx, col2, statY + rowGap, 'Last Acc', `${data.accuracy}%`, COLORS.accent);
  drawStat(ctx, col3, statY + rowGap, 'Last Grade', data.grade, COLORS.accent);
  if (data.isPersonalBest) {
    drawStat(ctx, col4, statY + rowGap, 'PB', 'NEW!', COLORS.gold);
  }
}

// ── Global mode ──

function drawGlobalHero(ctx: SKRSContext2D, data: ShareData) {
  const global = data.global!;
  ctx.textAlign = 'center';

  // Total drills — big centered number
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 100px monospace';
  ctx.fillText(`${global.totalDrills}`, CX, 195);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '22px monospace';
  ctx.fillText('drills all-time', CX, 222);

  // Best WPM + Best Accuracy
  const bestWpmStr = `${global.bestWpm}`;
  const bestAccStr = `${global.bestAccuracy}%`;
  ctx.font = 'bold 44px monospace';
  const bWpmW = ctx.measureText(bestWpmStr).width;
  ctx.font = '18px monospace';
  const bWpmLabelW = ctx.measureText(' best WPM').width;
  ctx.font = 'bold 44px monospace';
  const bAccW = ctx.measureText(bestAccStr).width;
  ctx.font = '18px monospace';
  const bAccLabelW = ctx.measureText(' best ACC').width;
  const gap = 50;
  const bestTotalW = bWpmW + bWpmLabelW + gap + bAccW + bAccLabelW;
  let bx = CX - bestTotalW / 2;
  const bestY = 278;

  ctx.textAlign = 'left';

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 44px monospace';
  ctx.fillText(bestWpmStr, bx, bestY);
  bx += bWpmW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '18px monospace';
  ctx.fillText(' best WPM', bx, bestY);
  bx += bWpmLabelW + gap;

  ctx.fillStyle = COLORS.green;
  ctx.font = 'bold 44px monospace';
  ctx.fillText(bestAccStr, bx, bestY);
  bx += bAccW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '18px monospace';
  ctx.fillText(' best ACC', bx, bestY);

  // Avg WPM + Avg Accuracy
  const avgWpmStr = `${global.avgWpm}`;
  const avgAccStr = `${global.avgAccuracy}%`;
  ctx.font = 'bold 36px monospace';
  const aWpmW = ctx.measureText(avgWpmStr).width;
  ctx.font = '16px monospace';
  const aWpmLabelW = ctx.measureText(' avg WPM').width;
  ctx.font = 'bold 36px monospace';
  const aAccW = ctx.measureText(avgAccStr).width;
  ctx.font = '16px monospace';
  const aAccLabelW = ctx.measureText(' avg ACC').width;
  const avgTotalW = aWpmW + aWpmLabelW + gap + aAccW + aAccLabelW;
  let ax = CX - avgTotalW / 2;
  const avgY = 330;

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 36px monospace';
  ctx.fillText(avgWpmStr, ax, avgY);
  ax += aWpmW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '16px monospace';
  ctx.fillText(' avg WPM', ax, avgY);
  ax += aWpmLabelW + gap;

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 36px monospace';
  ctx.fillText(avgAccStr, ax, avgY);
  ax += aAccW;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '16px monospace';
  ctx.fillText(' avg ACC', ax, avgY);
}

function drawGlobalPanel(ctx: SKRSContext2D, data: ShareData) {
  const global = data.global!;
  const { statY, col1, col2, col3, col4, rowGap } = drawPanel(ctx);

  const globalWords = Math.round(global.totalChars / 5);
  drawStat(ctx, col1, statY, 'Words', `${formatNumber(globalWords)}`, COLORS.text);
  drawStat(ctx, col2, statY, 'Characters', `${formatNumber(global.totalChars)}`, COLORS.text);
  drawStat(ctx, col3, statY, 'Total Time', formatTime(global.totalTime), COLORS.text);
  drawStat(ctx, col4, statY, 'Best Streak', `${global.longestStreak} sessions`, COLORS.gold);

  // Top trouble keys
  const sorted = Object.entries(global.missedKeys).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (sorted.length > 0) {
    const cols = [col1, col2, col3, col4];
    for (let i = 0; i < sorted.length; i++) {
      const [key, count] = sorted[i];
      const display = key === ' ' ? '␣' : key.toUpperCase();
      drawStat(ctx, cols[i], statY + rowGap, `Weak: ${display}`, `${count} errors`, COLORS.red);
    }
  }
}

// ── Shared helpers ──

function drawPanel(ctx: SKRSContext2D) {
  const panelY = 350;
  const panelHeight = 210;

  ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
  roundRect(ctx, 40, panelY, WIDTH - 80, panelHeight, 12);
  ctx.fill();

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  roundRect(ctx, 40, panelY, WIDTH - 80, panelHeight, 12);
  ctx.stroke();

  return {
    panelY,
    statY: panelY + 50,
    col1: 80,
    col2: 380,
    col3: 680,
    col4: 950,
    rowGap: 70,
  };
}

function drawTagline(ctx: SKRSContext2D) {
  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText('While the AI cooks, you level up your typing speed.', CX, HEIGHT - 60);

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('#CookTap', CX, HEIGHT - 35);

  ctx.textAlign = 'left';
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function drawStat(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  valueColor: string,
) {
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '18px monospace';
  ctx.fillText(label, x, y - 8);

  ctx.fillStyle = valueColor;
  ctx.font = 'bold 32px monospace';
  ctx.fillText(value, x, y + 28);
}

function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
