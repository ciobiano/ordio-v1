# Ordio v2 — Task Tracker

## Status Summary

**Phase 1 is functionally complete.** All core features are built and type-check clean with 20 passing tests. Competitive analysis scored Ordio at 62% product-ready, 85% content-flywheel-ready. Core pipeline (92%) is near-competitive with Headliner; gaps are in customization, monetization, and distribution.

**Next milestone:** Phase A — runtime test, commit, deploy to Vercel. Then Phase B — monetization.
**Infrastructure estimate:** $6/mo (beta) → $31/mo (100 users, optimized) → $140/mo (1,000 users)
**See also:** `tasks/monetization.md` for pricing tiers + `tasks/infrastructure.md` for cost analysis

---

## Completed

### VAD + Audio Setup (2026-02-21)
- [x] `useAudioRecorder` — MediaRecorder with start/stop, blob output
- [x] `useTranscription` — Web Speech API for live captions during recording
- [x] Next.js downgraded 16 → 15.3.3 for webpack + CopyPlugin compatibility

### Library Research & Architecture Decision (2026-02-24)
- [x] Evaluated Remotion — rejected (experimental client renderer, Webpack-only, $25/seat/month, CSS limits)
- [x] Chose: **Mediabunny** (WebCodecs → MP4, MPL-2.0) + **ffmpeg.wasm** (Safari fallback)
- [x] Chose: **wavesurfer.js** for UI display (not yet integrated), custom canvas for export

### 1.1 — Mediabunny MP4 Export (2026-02-25)
- [x] `videoEncoder.ts` — `encodeVideo()` using Mediabunny Output, CanvasSource, AudioBufferSource
- [x] `useVideoExporter` hook wired to new encoder
- [x] Export progress tracking + abort/cancel support

### 1.3 — Canvas Export Renderer (2026-02-25)
- [x] `frameRenderer.ts` — pure function rendering waveform + captions per frame
- [x] `CanvasPreview` component — 1080p live preview with rAF render loop
- [x] 8 unit tests for frame rendering

### 1.4 — ffmpeg.wasm Safari Fallback (2026-02-25)
- [x] `ffmpegEncoder.ts` — same interface as Mediabunny encoder
- [x] WAV encoding helper, JPEG frame loop, libx264+aac transcode
- [x] CopyPlugin copies WASM to `public/ffmpeg/`
- [x] `useVideoExporter` auto-branches on WebCodecs detection
- [x] `useCapabilities` shows "compatibility mode" warning

### 1.5 — Caption Editor (2026-02-25)
- [x] Word-level chip editing (click=seek, double-click=edit)
- [x] Keyboard navigation (arrows, Enter, Escape)
- [x] Auto-scroll active word during playback
- [x] Delete word by clearing text

### Capabilities Detection (2026-02-25)
- [x] `useCapabilities` — recording, export, WebCodecs, transcription detection
- [x] User-facing warning banner

### Whisper API Integration (2026-02-26)
- [x] `/api/transcribe` route — Whisper `verbose_json` with word + segment granularities
- [x] `transcribeAudio(blob)` in `useTranscription` hook
- [x] Wired into recording flow (falls back to Web Speech if Whisper fails)
- [x] Wired into file upload flow
- [x] Processing progress UI (decode → transcribe → finalize)
- [x] Transcription source badge in CaptionEditor (green=Whisper, yellow=Web Speech)

### Whisper Punctuation Fix (2026-02-27)
- [x] Discovered: word-level output strips all punctuation by design
- [x] Solution: request both `['word', 'segment']` granularities
- [x] `mergePunctuation()` — aligns segment tokens to words, copies trailing punctuation
- [x] Zero extra API cost (same single Whisper call)

### Waveform Redesign (2026-02-27)
- [x] Replaced timeline-scrubbing waveform with **audio-reactive** (bounces to current amplitude)
- [x] Removed 'line' variant, added 'spectrogram' (color gradient frequency bands)
- [x] Bars: 48 pill-shaped bars with bell curve + sine wave variation
- [x] Circle: 120 radial spokes pulsing outward
- [x] Spectrogram: 48 color-gradient bars (blue→cyan→green→yellow→orange→magenta) + glow
- [x] Updated WaveformStyleSelector, WaveformDisplay, BarsWaveform, SpectrogramWaveform (new)
- [x] Updated frameRenderer tests

### Font Loading & Caption Positioning (2026-02-27)
- [x] `fontLoader.ts` — loads Google Fonts dynamically via FontFace API for canvas
- [x] Font switching now works in canvas preview and export (Inter, Roboto, Outfit)
- [x] Default font size: 72px, weight: 600 (semi-bold)
- [x] Caption positioned above waveform with scaled gap (no overlap on 1:1 or 9:16)

### Style Controls (2026-02-25)
- [x] Color pickers (waveform, background, text)
- [x] Font selector (Inter, Roboto, Outfit) with live preview
- [x] Font size slider (32–96px)
- [x] Format toggle (1:1, 9:16, 16:9) — syncs style dimensions

### Code Cleanup (2026-02-27)
- [x] Extracted `useAudioProcessing` hook — shared decode→transcribe pipeline
- [x] Named constants in frameRenderer (no magic numbers)
- [x] Extracted `computeBarLayout()`, `interpolateColor()`, `drawInnerCircle()`
- [x] Generic `filterTimestamped<T>()` validator in transcribe route
- [x] `fontReadyRef` → `fontLoaded` state (triggers re-render on font load)
- [x] Collapsed dead captionStyle switch to ternary

### 1.1 — Mediabunny MP4 Export (2026-02-25)
- [x] Install `mediabunny` package
- [x] Create `videoEncoder.ts` — `encodeVideo()` using Mediabunny `Output`, `CanvasSource`, `AudioBufferSource`
- [x] Update `useVideoExporter` hook to use `encodeVideo()` (replaced captureStream + MediaRecorder → WebM)
- [x] Support `CanvasSource` → frame-by-frame encoding from export canvas
- [x] Support `AudioBufferSource` → mux decoded audio into MP4
- [x] Add export progress tracking (frame count / total frames)
- [x] Abort/cancel support via `AbortController`
- [ ] Test: 60s clip exports to MP4 in <3 minutes on desktop Chrome *(needs OpenAI key for full flow test)*

**Files:** `apps/web/src/lib/videoEncoder.ts`, `apps/web/src/hooks/useVideoExporter.ts`

### 1.3 — Canvas Export Renderer (2026-02-25)
- [x] Build `frameRenderer.ts` — renders waveform + captions + background per frame
- [x] Uses `packages/shared/waveform.ts` for waveform data (via `waveformSampler`)
- [x] Flowing bezier waveform with playhead, dampened future portion
- [x] Caption rendering with `getCurrentPhrase()` — 6-word discrete phrases
- [x] A/V sync via frame index → time mapping (30fps, `FPS` from `packages/shared/time.ts`)
- [x] `CanvasPreview` component — live preview with rAF render loop
- [x] Unit tests (7 tests in `frameRenderer.test.ts`)

**Files:** `apps/web/src/lib/frameRenderer.ts`, `apps/web/src/components/primitives/CanvasPreview.tsx`, `apps/web/src/__tests__/frameRenderer.test.ts`

### 1.5 — Caption Editor (2026-02-25)
- [x] `CaptionEditor` component with word-level chip editing
- [x] Click word → seek playback to that timestamp (via `onSeek` prop)
- [x] Double-click word → inline edit, Enter to save, Escape to cancel
- [x] Delete word — clear text + Enter removes from transcript
- [x] Keyboard navigation — Arrow Left/Right between chips, Enter to edit
- [x] Auto-scroll active word into view during playback
- [x] Phrase group separators every 6 words (matches `WORDS_PER_PHRASE` in frameRenderer)
- [x] Wired up in `ExportState` — passes `playback.seek`

**Files:** `apps/web/src/components/soul/CaptionEditor.tsx`, `apps/web/src/components/soul/ExportState.tsx`

### Capabilities Detection (2026-02-25)
- [x] `useCapabilities` hook detects: recording, export, WebCodecs, transcription
- [x] WebCodecs detection for Mediabunny support (`VideoEncoder` + `AudioEncoder`)
- [x] User-facing warnings for unsupported features

**Files:** `apps/web/src/hooks/useCapabilities.ts`

---

## Uncommitted (on v2 branch working tree)

All the work from 2026-02-27 sessions needs to be committed:
- Whisper punctuation fix (word+segment merge)
- Audio-reactive waveforms + spectrogram variant
- Font loading for canvas
- Caption positioning + semi-bold weight
- `useAudioProcessing` hook extraction
- frameRenderer clean code refactor
- `UseTranscriptionReturn` export

**Files changed:** 17 modified, 4 new files

---

## Phase A: Ship & Start the Flywheel (Target: 2 weeks)

### Runtime Testing (blocking deployment)
- [ ] Full flow: record → Whisper transcribe → edit captions → export MP4 → download
- [ ] Full flow: file upload → transcribe → export
- [ ] Verify Whisper punctuation appears in captions
- [ ] Verify font switching works in preview and exported video
- [ ] ffmpeg.wasm fallback: test on Safari or with WebCodecs disabled
- [ ] Cross-browser: Chrome, Edge, Firefox, Safari

### Ship It
- [ ] Commit all uncommitted work on v2 branch
- [ ] Deploy to Vercel (get live on a domain)
- [ ] Add 4:5 aspect ratio (Instagram feed)
- [ ] Add 5 more Google Fonts (Poppins, Montserrat, Space Grotesk, DM Sans, Playfair Display)
- [ ] Delete orphaned `LineWaveform.tsx`

### Infrastructure Optimization
- [ ] Migrate audio enhancement from Railway → Modal (GPU serverless, zero idle cost)
- [ ] Evaluate Groq Whisper as cheaper alternative ($0.0011/min vs $0.006/min)

---

## Phase 1: Video Export Pipeline — Remaining

### 1.2 — Integrate wavesurfer.js for waveform UI *(nice-to-have, custom canvas already works)*
- [ ] Install `wavesurfer.js` v7
- [ ] Replace custom `FlowingWaveform` in RecordingState with wavesurfer Record plugin
- [ ] Add wavesurfer playback waveform in ExportState (with Regions plugin for caption segments)
- [ ] Keep custom canvas drawing in `packages/shared/waveform.ts` for video export frames (wavesurfer is for UI only)
- [ ] Ensure waveform style selector (bars/line/mirror) still works
- **Note:** RecordingState already has a working custom canvas waveform. ExportState uses CanvasPreview. This is a polish item, not a blocker.

### 1.4 — ffmpeg.wasm Safari Fallback (2026-02-25) ✅
- [x] Install `@ffmpeg/ffmpeg` + `@ffmpeg/core-st` (single-threaded, no COOP/COEP needed)
- [x] CopyPlugin copies `ffmpeg-core.js` + `ffmpeg-core.wasm` → `public/ffmpeg/` (self-hosted, no CDN)
- [x] `ffmpegEncoder.ts` — `encodeVideoFFmpeg()` with same `EncodeVideoOptions`/`EncodeResult` interface
- [x] WAV encoding helper `audioBufferToWav()` (float32 → int16, RIFF header)
- [x] Frame loop: JPEG @ 0.85 quality → ffmpeg FS → `libx264 + aac` transcode
- [x] `useVideoExporter` branches on `hasWebCodecsSupport()` — no caller changes needed
- [x] `useCapabilities` warning softened to "Using compatibility mode — export will be slower on this browser."
- [x] `pnpm type-check` clean, `pnpm build` passes, `public/ffmpeg/` populated (ffmpeg-core.js 83KB, ffmpeg-core.wasm 23MB)
- [ ] Runtime test: simulate no-WebCodecs → confirm ffmpeg path produces valid MP4 *(deferred — needs browser)*

**Files:** `apps/web/src/lib/ffmpegEncoder.ts` (new), `apps/web/next.config.ts`, `apps/web/src/hooks/useVideoExporter.ts`, `apps/web/src/hooks/useCapabilities.ts`

---

## Phase 1: UI Features — Remaining

### 1.6 — Style controls panel (2026-02-25) ✅ (mostly)
- [x] `StyleControls` — color pickers for waveform, background, text (hex + swatch)
- [x] Font selector (Inter, Roboto, Outfit) with live preview
- [x] Font size slider (32–96px)
- [x] Collapsible panel UI
- [x] `FormatToggle` — aspect ratio toggle (1:1, 9:16, 16:9)
- [x] Preview updates live as styles change (CanvasPreview reads Zustand)
- [ ] Persist style preferences in localStorage

### 1.7 — Cleanup & v1 dependencies (2026-02-25) ✅ audited
- [x] Audit bundle — `@clerk/nextjs`, `convex`, `@Ordio/convex` are installed but NOT bundled (ConvexClientProvider.tsx is orphaned — not imported in layout or page). Zero v1 impact on client bundle.
- [x] `copy-webpack-plugin` actively used in `next.config.ts` for VAD asset copying — must keep.
- [ ] Keep Clerk + Convex installed — will be wired up later for paid tier (auth + storage).
- [ ] Audit bundle size — target <500KB gzipped (do after wavesurfer.js added)

---

## Phase B: Monetization Foundation (Target: Weeks 3-4)

- [ ] Wire Clerk auth back into v2 (gate premium features)
- [ ] Convex: user profiles + usage tracking + subscription tier
- [ ] Define free tier vs. Creator/Pro tier feature gates
- [ ] Stripe integration (USD pricing globally)
- [ ] Paystack integration (Naira pricing locally)
- [ ] Implement watermark on free tier exports
- [ ] Usage limits: 3 exports/day for free tier
- [ ] Subscription webhook handlers (Stripe + Paystack → Convex)

---

## Phase C: Product Polish (Target: Weeks 5-8)

- [ ] 5-8 visual presets/templates
- [ ] Background image support
- [ ] More caption styles (word-highlight box, gradient bg, animated entry)
- [ ] Audio trimming / clip selection from longer recordings
- [ ] Brand kit saving (Convex — Pro feature)
- [ ] Landing page with product demo
- [ ] OG image + meta tags
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Bundle size audit — target <500KB gzipped

---

## Phase D: Growth & Optimization (Ongoing)

- [ ] Performance: Web Worker for encoding, OffscreenCanvas
- [ ] Additional waveform styles
- [ ] AI clip extraction (find best 60s from long recording)
- [ ] Direct social publishing integrations
- [ ] Batch export for Pro/Agency tier
- [ ] Logo/watermark overlay support
- [ ] Video background support
- [ ] RSS auto-generation for podcasters

---

## Lessons Learned → `tasks/lessons.md`
