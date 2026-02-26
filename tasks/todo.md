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
