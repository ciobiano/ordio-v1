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
