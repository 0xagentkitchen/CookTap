import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { renderShareCard } from './card-renderer.js';
import { generateCaption } from './caption.js';
import type { ShareData, ShareOutput } from './types.js';

const SHARE_DIR = path.join(os.homedir(), '.cooktap', 'shares');

function ensureDir(): void {
  if (!fs.existsSync(SHARE_DIR)) {
    fs.mkdirSync(SHARE_DIR, { recursive: true });
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export async function generateShare(data: ShareData): Promise<ShareOutput> {
  ensureDir();

  const ts = timestamp();
  const imagePath = path.join(SHARE_DIR, `cooktap-${ts}.png`);
  const jsonPath = path.join(SHARE_DIR, `cooktap-${ts}.json`);
  const captionPath = path.join(SHARE_DIR, `cooktap-${ts}.txt`);

  // Generate card PNG
  const pngBuffer = await renderShareCard(data);
  fs.writeFileSync(imagePath, pngBuffer);

  // Generate caption
  const caption = generateCaption(data);
  fs.writeFileSync(captionPath, caption);

  // Save session JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  // Auto-copy caption to clipboard
  copyToClipboard(caption);

  // Auto-reveal image in file manager
  revealFile(imagePath);

  return { imagePath, caption, sessionJson: jsonPath };
}

function copyToClipboard(text: string): void {
  try {
    if (process.platform === 'darwin') {
      execSync('pbcopy', { input: text });
    } else if (process.platform === 'linux') {
      // Try xclip first, then xsel
      try {
        execSync('xclip -selection clipboard', { input: text });
      } catch {
        execSync('xsel --clipboard --input', { input: text });
      }
    }
    // Windows: skip for now
  } catch {
    // Clipboard copy failed silently — not critical
  }
}

function revealFile(filePath: string): void {
  try {
    if (process.platform === 'darwin') {
      execSync(`open -R "${filePath}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${path.dirname(filePath)}"`);
    }
  } catch {
    // Reveal failed silently — not critical
  }
}
