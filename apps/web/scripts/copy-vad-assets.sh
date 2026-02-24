#!/bin/bash
# Copies VAD model/WASM/worklet files to public/vad/ for browser access.
# Run via postinstall/prebuild hooks.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$WEB_DIR/public/vad"

mkdir -p "$OUT_DIR"

# Find vad-web dist
VAD_DIST=$(node -e "
  try {
    const p = require.resolve('@ricky0123/vad-web/package.json');
    console.log(p.replace('/package.json', '/dist'));
  } catch { process.exit(1); }
" 2>/dev/null)

if [ -z "$VAD_DIST" ]; then
  echo "⚠ @ricky0123/vad-web not found, skipping VAD asset copy"
  exit 0
fi

# Find onnxruntime-web dist (may be nested in pnpm store)
ONNX_DIST=$(node -e "
  try {
    const p = require.resolve('onnxruntime-web/package.json');
    console.log(p.replace('/package.json', '/dist'));
  } catch {
    // Fall back to searching from vad-web's node_modules
    try {
      const vadPkg = require.resolve('@ricky0123/vad-web/package.json');
      const vadDir = vadPkg.replace('/package.json', '');
      const path = require('path');
      const fs = require('fs');
      // Walk up to find onnxruntime-web
      let dir = vadDir;
      while (dir !== '/') {
        const candidate = path.join(dir, 'node_modules', 'onnxruntime-web', 'dist');
        if (fs.existsSync(candidate)) { console.log(candidate); process.exit(0); }
        dir = path.dirname(dir);
      }
      // Last resort: find in pnpm store
      const glob = require('child_process').execSync(
        'find ' + path.dirname(path.dirname(path.dirname(vadDir))) + ' -path \"*/onnxruntime-web/dist\" -type d 2>/dev/null | head -1'
      ).toString().trim();
      if (glob) { console.log(glob); process.exit(0); }
      process.exit(1);
    } catch { process.exit(1); }
  }
" 2>/dev/null)

# Copy VAD assets
cp "$VAD_DIST/vad.worklet.bundle.min.js" "$OUT_DIR/" 2>/dev/null || true
cp "$VAD_DIST/"*.onnx "$OUT_DIR/" 2>/dev/null || true

# Copy ONNX runtime assets
if [ -n "$ONNX_DIST" ]; then
  cp "$ONNX_DIST/"*.wasm "$OUT_DIR/" 2>/dev/null || true
  cp "$ONNX_DIST/"*.mjs "$OUT_DIR/" 2>/dev/null || true
fi

echo "✓ VAD assets copied to public/vad/"
