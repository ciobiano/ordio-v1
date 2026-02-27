# Ordio v2 — Task Tracker

## Status Summary

**Phase 1 is functionally complete.** All core features are built and type-check clean with 20 passing tests. The uncommitted work on the v2 branch includes: Whisper punctuation fix, audio-reactive waveforms, spectrogram variant, font loading, caption positioning, and code cleanup.

**Next milestone:** Commit current work, runtime test the full flow, then deploy.

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

## Remaining

### Runtime Testing (blocking deployment)
- [ ] Full flow: record → Whisper transcribe → edit captions → export MP4 → download
- [ ] Full flow: file upload → transcribe → export
- [ ] Verify Whisper punctuation appears in captions
- [ ] Verify font switching works in preview and exported video
- [ ] ffmpeg.wasm fallback: test on Safari or with WebCodecs disabled
- [ ] Cross-browser: Chrome, Edge, Firefox, Safari

### Polish (non-blocking)
- [ ] Persist style preferences in localStorage
- [ ] wavesurfer.js integration for recording/playback UI (nice-to-have)
- [ ] Delete orphaned `LineWaveform.tsx` (replaced by SpectrogramWaveform)
- [ ] Bundle size audit — target <500KB gzipped
- [ ] Audit & remove v1 leftovers (Clerk, Convex deps — keep installed for future paid tier)

### Phase 2: Deploy & Iterate
- [ ] Deploy to Vercel
- [ ] OG image + meta tags
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Performance: Web Worker for encoding, OffscreenCanvas
- [ ] Caption animation styles (karaoke highlight, typewriter)
- [ ] Additional waveform styles

---

## Lessons Learned → `tasks/lessons.md`
