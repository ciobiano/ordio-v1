# System Architecture

## Design Philosophy

Ordio follows **progressive enhancement**:
1. **Client-Side First:** Full functionality in modern browsers (Chrome, Edge, Firefox)
2. **Graceful Degradation:** Detect capability limits, provide clear warnings
3. **Fallback Paths:** ffmpeg.wasm for Safari, Web Speech if Whisper fails

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Record     │    │  Live       │    │  Live       │             │
│  │   Audio      │───▶│  Waveform   │───▶│  Captions   │             │
│  │(MediaRecorder)    │  (Canvas)   │    │(Web Speech) │             │
│  └──────┬──────┘    └─────────────┘    └──────┬──────┘             │
│         │                                      │                    │
│         ▼ (on stop)                            ▼                    │
│  ┌─────────────┐                        ┌─────────────┐            │
│  │  Decode      │                        │  Whisper    │            │
│  │  AudioBuffer │                        │  /api/transcribe        │
│  └──────┬──────┘                        └──────┬──────┘            │
│         │                                      │                    │
│         ▼                                      ▼                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                  Zustand Store                       │           │
│  │  audioBuffer · transcript · style · waveformStyle   │           │
│  │  format · currentTime · phase · transcriptionSource │           │
│  └─────────────────────┬───────────────────────────────┘           │
│                        │                                            │
│         ┌──────────────┼──────────────┐                            │
│         ▼              ▼              ▼                            │
│  ┌─────────────┐ ┌──────────┐ ┌────────────────┐                  │
│  │ Canvas      │ │ Caption  │ │ Export          │                  │
│  │ Preview     │ │ Editor   │ │ Mediabunny/     │                  │
│  │ (1080p)     │ │ (chips)  │ │ ffmpeg.wasm     │                  │
│  └─────────────┘ └──────────┘ └───────┬────────┘                  │
│                                       ▼                            │
│                                ┌─────────────┐                     │
│                                │  Download   │                     │
│                                │  MP4 file   │                     │
│                                └─────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER (Next.js API Route)                     │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/transcribe                                              │
│    → OpenAI Whisper (whisper-1)                                    │
│    → verbose_json with word + segment granularities                │
│    → mergePunctuation() → Word[] with timestamps + punctuation     │
└─────────────────────────────────────────────────────────────────────┘
```

## App Phases

The app has four distinct phases, managed by `currentState` in the Zustand store:

```
idle → recording → processing → export
  ↑                               │
  └───────────── reset ───────────┘
```

| Phase | What happens | Key components |
|-------|-------------|----------------|
| `idle` | Landing screen, record button, file upload | `IdleState` |
| `recording` | Mic recording, live waveform, live captions | `RecordingState` |
| `processing` | Decode audio, Whisper transcription, progress bar | `ProcessingState` |
| `export` | Canvas preview, caption editor, playback, export/download | `ExportState` |

## File Structure (Actual)

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout (Plus Jakarta Sans font)
│   ├── page.tsx                # Main orchestrator — phase routing + handlers
│   ├── globals.css             # Tailwind + custom styles
│   └── api/
│       └── transcribe/
│           └── route.ts        # Whisper API endpoint (word+segment merge)
│
├── components/
│   ├── primitives/             # Reusable UI atoms
│   │   ├── CanvasPreview.tsx   # 1080p canvas with rAF render loop
│   │   ├── CapabilityBanner.tsx# Warning banner for missing features
│   │   ├── LiveCaption.tsx     # Live transcription display
│   │   ├── PlaybackControls.tsx# Play/pause/seek slider
│   │   ├── RecordingTimer.tsx  # MM:SS timer during recording
│   │   └── waveform/
│   │       ├── WaveformDisplay.tsx      # Variant router (bars/circle/spectrogram)
│   │       ├── BarsWaveform.tsx         # Pill-shaped bar visualizer
│   │       ├── CircleWaveform.tsx       # Radial spoke visualizer
│   │       └── SpectrogramWaveform.tsx  # Color gradient frequency bands
│   │
│   └── soul/                   # Feature-level composed components
│       ├── IdleState.tsx       # Landing + record/upload UI
│       ├── RecordingState.tsx  # Recording UI with live waveform
│       ├── ProcessingState.tsx # Progress steps UI
│       ├── ExportState.tsx     # Preview + editor + export controls
│       ├── CaptionEditor.tsx   # Word chips: click=seek, dblclick=edit
│       ├── StyleControls.tsx   # Colors, font, font size panel
│       ├── WaveformStyleSelector.tsx  # Bars/circle/spectrogram toggle
│       ├── CaptionStyleSelector.tsx   # Center/bottom/karaoke toggle
│       └── FormatToggle.tsx    # 1:1 / 9:16 / 16:9 toggle
│
├── hooks/
│   ├── useAudioRecorder.ts    # MediaRecorder wrapper (start/stop/blob)
│   ├── useAudioAnalyser.ts    # AnalyserNode for live audio level
│   ├── useAudioProcessing.ts  # Decode + transcribe pipeline (shared)
│   ├── useTranscription.ts    # Web Speech live + Whisper post-recording
│   ├── useVideoExporter.ts    # WebCodecs/ffmpeg branching + progress
│   ├── usePlayback.ts         # Audio playback (load/play/pause/seek)
│   ├── useCapabilities.ts     # Browser feature detection + warnings
│   └── useAnimationTick.ts    # rAF helper
│
├── lib/
│   ├── store.ts               # Zustand store (AppPhase, styles, transcript)
│   ├── frameRenderer.ts       # Pure function: renders one video frame to canvas
│   ├── videoEncoder.ts        # Mediabunny WebCodecs → MP4 encoder
│   ├── ffmpegEncoder.ts       # ffmpeg.wasm fallback encoder
│   ├── fontLoader.ts          # Google Fonts loader for canvas
│   └── cn.ts                  # clsx + twMerge utility
│
└── __tests__/
    ├── frameRenderer.test.ts  # 8 tests for frame rendering
    ├── fileExtension.test.ts  # 3 tests for MIME → extension
    ├── useCapabilities.test.ts# 4 tests for capability detection
    └── cn.test.ts             # 5 tests for className merging
```

## Data Flows

### Recording Flow
```
User clicks Record
  → useAudioRecorder.startRecording() — MediaRecorder begins
  → useAudioAnalyser connects — provides live audio level
  → useTranscription starts Web Speech API — live word stream
  → RecordingState renders: waveform (audio-reactive) + live captions

User clicks Stop
  → recorder.stopRecording() — produces audioBlob
  → useAudioProcessing.processAudio(blob, liveFallback=true):
      1. Decode: AudioContext.decodeAudioData → AudioBuffer
      2. Transcribe: POST /api/transcribe → Whisper → Word[] with punctuation
      3. Fallback: if Whisper fails, use Web Speech transcript
      4. Finalize: transition to 'export' phase
```

### File Upload Flow
```
User selects file
  → useAudioProcessing.processAudio(file):
      1. Decode: AudioContext.decodeAudioData → AudioBuffer
      2. Transcribe: POST /api/transcribe → Whisper → Word[]
      3. Finalize: transition to 'export' phase
```

### Export Flow
```
User clicks Export
  → Create offscreen canvas (1080x1080 / 1080x1920 / 1920x1080)
  → Detect capabilities:
      WebCodecs available → encodeVideo() via Mediabunny
      No WebCodecs        → encodeVideoFFmpeg() via ffmpeg.wasm
  → Frame loop (30fps):
      For each frame: renderFrame(ctx, frameIndex, totalFrames, options)
        1. Fill background
        2. Draw waveform (audio-reactive bars/circle/spectrogram)
        3. Draw captions (current 6-word phrase)
      → Encode frame + audio → MP4
  → User downloads MP4
```

### Frame Rendering Pipeline
```
renderFrame() — pure function, no React dependency
  ├── Background fill (style.backgroundColor)
  ├── drawWaveform() — dispatches on variant:
  │   ├── 'bars'        → drawPillBars()     — 48 mirrored pill bars
  │   ├── 'circle'      → drawCircleWaveform() — 120 radial spokes
  │   └── 'spectrogram' → drawSpectrogram()  — 48 color-gradient bars
  │   All variants: audio-reactive (getCurrentAmplitude + barAmplitude)
  └── drawCaptions() — 6-word phrase groups, semi-bold, gap above waveform
```

## Zustand Store Schema

```typescript
interface AppState {
  currentState: 'idle' | 'recording' | 'processing' | 'export';
  theme: 'dark' | 'light';

  // Audio
  audioBlob: Blob | null;
  audioBuffer: AudioBuffer | null;
  audioDuration: number;

  // Recording
  isRecording: boolean;
  recordingTime: number;

  // Playback
  isPlaying: boolean;
  currentTime: number;

  // Transcription
  transcript: Word[];          // { text, start, end } in seconds
  isTranscribing: boolean;
  liveWords: string[];         // Web Speech live stream
  transcriptionSource: 'whisper' | 'webspeech' | null;

  // Export
  isExporting: boolean;
  exportProgress: number;
  exportedUrl: string | null;

  // Style
  style: StyleConfig;          // width, height, colors, fontFamily, fontSize
  waveformStyle: 'bars' | 'circle' | 'spectrogram';
  captionStyle: 'center' | 'bottom' | 'karaoke';
  format: 'square' | 'vertical' | 'horizontal';
}
```

## Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `next` | Framework | 15.3.3 |
| `react` | UI | 19 |
| `zustand` | State | 5.x |
| `mediabunny` | WebCodecs → MP4 | latest |
| `@ffmpeg/ffmpeg` | Fallback encoder | 0.12.15 |
| `@ffmpeg/core-st` | WASM (single-threaded) | 0.11.1 |
| `openai` | Whisper API client | latest |
| `class-variance-authority` | Component variants | latest |
| `tailwindcss` | Styling | 4.x |
| `vitest` | Testing | latest |
