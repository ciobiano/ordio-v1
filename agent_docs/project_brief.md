# Project Brief

## Product Vision

Ordio enables independent creators to generate professional audiogram videos with animated waveforms and captions — entirely in the browser, at zero cost. No SaaS subscriptions. No video editing skills. No account needed.

## Core Value Proposition

**Free, browser-based audiogram generator with what-you-see-is-what-you-get exports.**

Record or upload audio → see a live waveform + caption preview → export MP4 → share on social media. The entire flow happens client-side. $0 hosting cost.

## Current State (v2 branch, 2026-02-27)

The MVP is **functionally complete** but needs runtime testing and polish. The full pipeline works:

1. **Audio input** — record via microphone or upload a file (MP3/WAV/M4A)
2. **Transcription** — hybrid: Web Speech API for live captions during recording, OpenAI Whisper API for accurate word-level timestamps after stop
3. **Live preview** — 1080p canvas preview with audio-reactive waveforms + captions
4. **Caption editing** — click to seek, double-click to edit, keyboard navigation
5. **Video export** — MP4 via Mediabunny (WebCodecs) with ffmpeg.wasm fallback for Safari
6. **Download** — browser download of finished MP4

### What's built and working (type-checks + tests pass):
- Audio recording + file upload with processing pipeline
- Whisper API integration with punctuation merging (word + segment granularities)
- Three waveform variants: bars (pill-shaped), circle (radial), spectrogram (color gradient)
- Audio-reactive waveforms (bounce to current amplitude, not timeline scrubbing)
- Caption rendering with 6-word phrase grouping
- Style controls (colors, fonts, font size, format)
- Font loading via Google Fonts for canvas rendering
- WebCodecs → MP4 encoding (Mediabunny)
- ffmpeg.wasm fallback for browsers without WebCodecs
- Capability detection with user-facing warnings
- 20 passing unit tests

### What needs testing / finishing:
- Runtime test of full record → transcribe → export → download flow
- Runtime test of ffmpeg.wasm fallback path
- Cross-browser testing (Chrome, Edge, Firefox, Safari)
- localStorage persistence for style preferences
- Bundle size audit

## Coding Conventions

### File Naming
- **Components:** PascalCase with `.tsx` (`CanvasPreview.tsx`)
- **Hooks:** camelCase with `use` prefix (`useAudioRecorder.ts`)
- **Utilities:** camelCase with `.ts` (`frameRenderer.ts`, `fontLoader.ts`)
- **Tests:** Co-located in `__tests__/` with `.test.ts` suffix

### Import Order
```typescript
// 1. External dependencies
import { useState, useRef } from 'react';

// 2. Local imports (absolute paths via @/ alias)
import { useStore } from '@/lib/store';
import { renderFrame } from '@/lib/frameRenderer';

// 3. Shared package imports
import type { Word } from '@Ordio/shared/schemas';

// 4. Relative imports
import { PlaybackControls } from './PlaybackControls';
```

### TypeScript Rules
- **Strict mode** enabled everywhere
- **No `any` type** — `@typescript-eslint/no-explicit-any: "error"`
- **Prettier:** single quotes, trailing commas (es5), 100 char width, 2-space indent
- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `test:`

### React Patterns
- **`'use client'`** directive on all interactive components
- **Named exports** for components (default export for page.tsx only)
- **Custom hooks** for all browser API interactions
- **Zustand** for global state — selector pattern to prevent re-renders

## Decision Log

| Decision | Rationale |
|----------|-----------|
| **Client-side first** | $0 hosting, instant feedback, audio never leaves browser |
| **Mediabunny over Remotion** | MPL-2.0 license, zero-dep, uses WebCodecs natively. Remotion has experimental client renderer, CSS limitations, Webpack-only bundler, $25/seat/month |
| **ffmpeg.wasm fallback** | Safari <18 lacks WebCodecs. Single-threaded core (`@ffmpeg/core-st`) avoids COOP/COEP headers |
| **Hybrid transcription** | Web Speech = free live captions. Whisper = accurate word-level timestamps post-recording. Falls back gracefully |
| **Whisper word+segment merge** | Word-level output strips punctuation by design. Segments keep it. Merge gives punctuated words with precise timestamps |
| **Zustand** | ~1KB, no boilerplate, selector pattern, DevTools support |
| **Canvas (not DOM/SVG)** | Direct pixel control, 30fps achievable, same renderer for preview and export |
| **Audio-reactive waveform** | Bounces to current amplitude, not timeline scrubbing. More visually engaging |
| **Next.js 15 (not 16)** | Downgraded for `copy-webpack-plugin` compatibility (webpack, not Turbopack) |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ffmpeg.wasm slow on mobile | Medium | Medium | "Export will be slower" warning, desktop recommended |
| Whisper API cost | Low | Low | ~$0.006/min, free Web Speech fallback always available |
| A/V drift on long recordings | Medium | High | AudioContext.currentTime as truth, frame-index timing |
| Web Speech accent accuracy | Medium | Medium | Manual transcript editing, Whisper as primary |
| WebM not playable on iPhone | High | Medium | Mediabunny outputs MP4 (H.264), universally playable |
