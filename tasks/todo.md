# Ordio v2 — Task Tracker

## Completed

### VAD + Whisper API Integration (2026-02-21)
- [x] Create `/api/transcribe` route handler (Whisper API, `verbose_json`, word-level timestamps)
- [x] Add `transcribeAudio()` to `useTranscription` hook
- [x] Wire Whisper into recording + file upload flows in `page.tsx`
- [x] Update `ProcessingState` — 3 real steps instead of 5 fake ones
- [x] VAD integration — `useVAD` hook with `@ricky0123/vad-web`, speaking/listening indicator
- [x] Copy script for VAD assets (`scripts/copy-vad-assets.sh`)
- [x] Next.js downgraded 16 → 15 (15.3.3) for dep compatibility; webpack + CopyPlugin restored
- [x] Build passes, TypeScript clean, 12/12 unit tests pass

**Result:** Hybrid flow — Web Speech for live captions during recording, Whisper API for accurate word-level timestamps after stop. VAD provides visual speech detection feedback.

### Library Research & Architecture Decision (2026-02-24)
- [x] Research open-source audiogram generators, video encoders, waveform libs
- [x] Evaluate Remotion (audiogram template, client-side renderer, licensing)
- [x] Decision: **Custom canvas + Mediabunny** over Remotion (see rationale below)

**Rationale — Why NOT Remotion:**
- `@remotion/web-renderer` is experimental with severe CSS limitations (no z-index, filter, clip-path)
- `@remotion/bundler` uses Webpack — incompatible with Next.js 16 Turbopack
- Licensing: $25/seat/month for teams >3 people
- Server rendering needs headless Chrome + FFmpeg — breaks $0 hosting goal
- Remotion themselves are migrating encoding to Mediabunny (standalone, MPL-2)

**Chosen Stack:**
| Layer | Library | License |
|---|---|---|
| Video encoding | Mediabunny (WebCodecs → MP4) | MPL-2.0 |
| Waveform viz | wavesurfer.js v7 | BSD-3 |
| Caption animation | Custom canvas (packages/shared) | — |
| Encoding fallback | ffmpeg.wasm (Safari <18) | MIT |

---

## Phase 1: Video Export Pipeline

### 1.1 — Integrate Mediabunny for MP4 export
- [ ] Install `mediabunny` package
- [ ] Create `useVideoEncoder` hook (WebCodecs VideoEncoder → Mediabunny mux → MP4 Blob)
- [ ] Replace current `useVideoExporter` (captureStream + MediaRecorder → WebM) with Mediabunny pipeline
- [ ] Support `CanvasSource` → frame-by-frame encoding from export canvas
- [ ] Support `AudioBufferSource` → mux decoded audio into MP4
- [ ] Add export progress tracking (frame count / total frames)
- [ ] Test: 60s clip exports to MP4 in <3 minutes on desktop Chrome

### 1.2 — Integrate wavesurfer.js for waveform
- [ ] Install `wavesurfer.js` v7
- [ ] Replace custom canvas waveform in RecordingState with wavesurfer Record plugin
- [ ] Add wavesurfer playback waveform in ExportState (with Regions plugin for caption segments)
- [ ] Keep custom canvas drawing in `packages/shared/waveform.ts` for video export frames (wavesurfer is for UI only)
- [ ] Ensure waveform style selector (bars/line/mirror) still works

### 1.3 — Canvas export renderer
- [ ] Build frame renderer: draws waveform + captions + background to offscreen canvas per frame
- [ ] Use `packages/shared/waveform.ts` for waveform bar data
- [ ] Use `packages/shared/layout.ts` for caption text layout
- [ ] Support all waveform styles (bars, line, mirror) and caption styles
- [ ] A/V sync via frame index → time mapping (30fps, `packages/shared/time.ts`)

### 1.4 — ffmpeg.wasm fallback
- [ ] Install `@ffmpeg/ffmpeg` + `@ffmpeg/core`
- [ ] Detect WebCodecs support in `useCapabilities`
- [ ] If no WebCodecs: fall back to ffmpeg.wasm single-threaded encoding
- [ ] Handle COOP/COEP headers for multi-threaded variant (if possible on Vercel)

---

## Phase 1: UI Features

### 1.5 — Caption editor
- [ ] Build `CaptionEditor` component (word-level editing in ExportState)
- [ ] Click word → seek playback to that timestamp
- [ ] Edit word text → update transcript in store
- [ ] Re-align timecodes after text edits (reference: slate-transcript-editor approach)
- [ ] Delete/merge words
- [ ] Keyboard navigation (arrow keys between words, Enter to play from word)

### 1.6 — Style controls panel
- [ ] Expand `StyleControls` — color picker (background, waveform, text)
- [ ] Font selector (from bundled WOFF2 fonts in `packages/shared/tokens.ts`)
- [ ] Aspect ratio toggle (vertical 9:16, horizontal 16:9, square 1:1)
- [ ] Preview updates live as styles change
- [ ] Persist style preferences in localStorage

### 1.7 — Cleanup & remove v1 dependencies
- [ ] Remove `@clerk/nextjs` (no auth for MVP)
- [ ] Remove `convex` client dependency
- [ ] Remove `copy-webpack-plugin` (unused, using shell scripts)
- [ ] Remove `@Ordio/convex` workspace dependency
- [ ] Audit bundle size — target <500KB gzipped

---

## Phase 1: Verification

### 1.8 — End-to-end testing
- [ ] Manual test: record → Whisper → caption edit → export MP4 → download
- [ ] Manual test: file upload → Whisper → export
- [ ] VAD speaking indicator reactivity
- [ ] Error handling: Whisper failure shows user-facing message
- [ ] Cross-browser: Chrome 94+, Edge 94+, Firefox 130+
- [ ] ffmpeg.wasm fallback: test on Safari <18

---

## Phase 2: Polish & Deploy (after Phase 1 complete)

- [ ] Performance: Canvas pre-computation, Web Worker offload for encoding
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Deploy to Vercel (zero config)
- [ ] Core Web Vitals: <2s waveform load, <500KB gzipped
- [ ] OG image + meta tags for sharing

---

## Pending / Minor

- [ ] Cache OpenAI client instance (currently creates new per request)
- [ ] Add caption animation styles (karaoke highlight, bounce, typewriter — reference subtitle-burner)
