export const ACCENT = '#7C5CFC';

export const KEYBOARD_LAYOUT = [
  ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
  ['                    SPACE                    '],
];

export const SHIFT_TO_BASE: Record<string, string> = {
  '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
  '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
  ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
  '~': '~',
};

export type Hand = 'left' | 'right';
export type FingerIndex = 0 | 1 | 2 | 3 | 4; // thumb, index, middle, ring, pinky

export const FINGER_MAP: Record<string, [Hand, FingerIndex]> = {
  '~': ['left', 4], '`': ['left', 4], '1': ['left', 4], '!': ['left', 4],
  Q: ['left', 4], A: ['left', 4], Z: ['left', 4],
  '2': ['left', 3], '@': ['left', 3], W: ['left', 3], S: ['left', 3], X: ['left', 3],
  '3': ['left', 2], '#': ['left', 2], E: ['left', 2], D: ['left', 2], C: ['left', 2],
  '4': ['left', 1], '$': ['left', 1], R: ['left', 1], F: ['left', 1], V: ['left', 1],
  '5': ['left', 1], '%': ['left', 1], T: ['left', 1], G: ['left', 1], B: ['left', 1],
  ' ': ['left', 0],
  '6': ['right', 1], '^': ['right', 1], Y: ['right', 1], H: ['right', 1], N: ['right', 1],
  '7': ['right', 1], '&': ['right', 1], U: ['right', 1], J: ['right', 1], M: ['right', 1],
  '8': ['right', 2], '*': ['right', 2], I: ['right', 2], K: ['right', 2],
  ',': ['right', 2], '<': ['right', 2],
  '9': ['right', 3], '(': ['right', 3], O: ['right', 3], L: ['right', 3],
  '.': ['right', 3], '>': ['right', 3],
  '0': ['right', 4], ')': ['right', 4], P: ['right', 4],
  ';': ['right', 4], ':': ['right', 4],
  '/': ['right', 4], '?': ['right', 4],
  '-': ['right', 4], '_': ['right', 4],
  '[': ['right', 4], '{': ['right', 4],
  "'": ['right', 4], '"': ['right', 4],
  '=': ['right', 4], '+': ['right', 4],
  ']': ['right', 4], '}': ['right', 4],
  '\\': ['right', 4], '|': ['right', 4],
};

export const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// Colors by finger: index=green, middle=cyan, ring=blue, pinky=magenta
export const FINGER_COLORS: Record<string, string> = {
  // Left pinky
  '~': 'magenta', '`': 'magenta', '1': 'magenta', Q: 'magenta', A: 'magenta', Z: 'magenta',
  // Left ring
  '2': 'blue', W: 'blue', S: 'blue', X: 'blue',
  // Left middle
  '3': 'cyan', E: 'cyan', D: 'cyan', C: 'cyan',
  // Left index
  '4': 'green', R: 'green', F: 'green', V: 'green',
  '5': 'green', T: 'green', G: 'green', B: 'green',
  // Right index
  '6': 'green', Y: 'green', H: 'green', N: 'green',
  '7': 'green', U: 'green', J: 'green', M: 'green',
  // Right middle
  '8': 'cyan', I: 'cyan', K: 'cyan', ',': 'cyan',
  // Right ring
  '9': 'blue', O: 'blue', L: 'blue', '.': 'blue',
  // Right pinky
  '0': 'magenta', P: 'magenta', ';': 'magenta', '/': 'magenta',
  '-': 'magenta', '[': 'magenta', "'": 'magenta',
  '=': 'magenta', ']': 'magenta', '\\': 'magenta',
};

export const LEFT_HAND = [
  '    ╭─╮╭─╮          ',
  '    │ ││ │          ',
  '╭─╮ │ ││ │ ╭─╮      ',
  '│ │ │ ││ │ │ │      ',
  '│ ├─┤ ├┤ ├─┤ │      ',
  '╰─╯ ╰─╯╰─╯ ╰─╯      ',
  '           ╭───╮    ',
  '           ╰───╯    ',
];

export const RIGHT_HAND = [
  '          ╭─╮╭─╮    ',
  '          │ ││ │    ',
  '      ╭─╮ │ ││ │ ╭─╮',
  '      │ │ │ ││ │ │ │',
  '      │ ├─┤ ├┤ ├─┤ │',
  '      ╰─╯ ╰─╯╰─╯ ╰─╯',
  '    ╭───╮            ',
  '    ╰───╯            ',
];

// Finger highlight positions: [lineIndex, startCol, endCol] (inclusive start, exclusive end)
// Using visual character indices from [...str] spread
export const LEFT_FINGER_POS: Record<FingerIndex, Array<[number, number, number]>> = {
  0: [[6, 11, 16], [7, 11, 16]],               // thumb (bottom-right)
  1: [[2, 11, 14], [3, 11, 14]],               // index
  2: [[0, 7, 10], [1, 7, 10], [2, 7, 10]],     // middle
  3: [[0, 4, 7], [1, 4, 7], [2, 4, 7]],         // ring
  4: [[2, 0, 3], [3, 0, 3]],                   // pinky
};

export const RIGHT_FINGER_POS: Record<FingerIndex, Array<[number, number, number]>> = {
  0: [[6, 4, 9], [7, 4, 9]],                   // thumb (bottom-left)
  1: [[2, 6, 9], [3, 6, 9]],                   // index
  2: [[0, 10, 13], [1, 10, 13], [2, 10, 13]],   // middle
  3: [[0, 13, 16], [1, 13, 16], [2, 13, 16]],   // ring
  4: [[2, 17, 20], [3, 17, 20]],               // pinky
};
