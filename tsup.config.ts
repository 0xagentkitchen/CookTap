import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/cli.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  shims: true,
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
});
