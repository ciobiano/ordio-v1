#!/usr/bin/env node

/**
 * Bundles the RNNoise AudioWorkletProcessor + rnnoise-wasm into a single
 * self-contained JS file that can be loaded via audioWorklet.addModule().
 *
 * Output: apps/web/public/rnnoise/rnnoiseProcessor.js
 *
 * Usage: node scripts/build-rnnoise-worklet.mjs
 */

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const outdir = resolve(root, 'apps/web/public/rnnoise');
mkdirSync(outdir, { recursive: true });

try {
  await build({
    entryPoints: [resolve(root, 'apps/web/src/lib/rnnoise/rnnoiseProcessor.ts')],
    bundle: true,
    outfile: resolve(outdir, 'rnnoiseProcessor.js'),
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    minify: true,
    // AudioWorklet scope does not have `window` or `document`
    define: {
      'window': 'globalThis',
      'self': 'globalThis',
    },
    external: [],
    logLevel: 'info',
  });
  console.log('✓ RNNoise worklet built → apps/web/public/rnnoise/rnnoiseProcessor.js');
} catch (err) {
  console.error('Failed to build RNNoise worklet:', err);
  process.exit(1);
}
