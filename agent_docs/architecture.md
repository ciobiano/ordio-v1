# System Architecture & Data Flow

## High-Level Architecture

### Design Philosophy
ordio follows a **progressive enhancement** approach:
1. **Client-Side First:** Full functionality in modern browsers (Chrome, Edge, Firefox)
2. **Graceful Degradation:** Detect capability limits, provide clear messaging
3. **Server Fallback:** Optional render path for iOS Safari and low-end devices (P1)

### Client-Side Architecture (MVP)
```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Record    │    │  Visualize  │    │  Transcribe │             │
│  │   Audio     │───▶│  Waveform   │───▶│   (Post)    │             │
│  │(MediaRecorder)   │  (Canvas)   │    │(Web Speech) │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                  │                  │                     │
│         ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                  Zustand Store                       │           │
│  │  • audioBuffer    • waveformData    • transcript     │           │
│  │  • playbackTime   • isRecording     • captionText    │           │
│  └─────────────────────────────────────────────────────┘           │
│                            │                                        │
│         ┌──────────────────┼──────────────────┐                    │
│         ▼                  ▼                  ▼                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Preview   │    │   Export    │    │  Download   │             │
│  │   Canvas    │    │ (captureStream)  │   WebM/MP4  │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Server Fallback Architecture (P1 — Post-MVP)
```
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVER FALLBACK (Optional)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Client ──▶ Upload Audio ──▶ Convex Storage                        │
│             POST config  ──▶ Convex Mutation (createJob)           │
│                                     │                               │
│                                     ▼                               │
│                              Trigger.dev Job                        │
│                                     │                               │
│                                     ▼                               │
│                          Docker Worker (Railway)                    │
│                          FFmpeg / Remotion Render                   │
│                                     │                               │
│                                     ▼                               │
│  Client ◀── Download URL ◀── Convex Storage                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Record/Upload → Preview → Export

### 1. Audio Input (Client)
```
User Action          Browser Processing              Output
─────────────────────────────────────────────────────────────
Record/Upload   →    Web Audio API (decode)    →    AudioBuffer
                            ↓
                     AnalyserNode (frequency)   →    Waveform data
                            ↓
                     Canvas (render bars)       →    Visual preview
```

### 2. Transcription (Client — Post-Recording)
```
Stop Recording  →    Web Speech API            →    Transcript + timestamps
                            ↓
                     Editable transcript UI     →    User corrections
```

### 3. Preview (Client)
```
Play/Scrub      →    Audio sync + Canvas       →    Live preview
                     • Waveform bars animate from AnalyserNode
                     • Captions highlight word-by-word
                     • AudioContext.currentTime drives sync
```

### 4. Export (Client)
```
Export          →    captureStream + MediaRecorder  →  WebM/MP4 blob
                            ↓
                     Download                   →    Video file
```

---

## Component Architecture

### Frontend File Structure
```
ordio/
├── app/
│   ├── layout.tsx          # Root layout with theme provider
│   ├── page.tsx            # Main app page
│   ├── globals.css         # Tailwind imports + custom styles
│   └── api/                # (P1: Server routes if needed)
│
├── components/
│   ├── ui/                 # Reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Slider.tsx
│   │   └── Toggle.tsx
│   ├── AudioRecorder.tsx   # Record button + timer
│   ├── AudioUploader.tsx   # Drag-and-drop file upload
│   ├── WaveformCanvas.tsx  # Bar visualization
│   ├── CaptionEditor.tsx   # Editable transcript
│   ├── PlaybackControls.tsx # Play/pause/scrub
│   ├── ExportButton.tsx    # Export with progress
│   └── ThemeToggle.tsx     # Dark/light switch
│
├── hooks/
│   ├── useAudioRecorder.ts
│   ├── useAudioAnalyser.ts
│   ├── useTranscription.ts
│   ├── useVideoExporter.ts
│   └── useCapabilities.ts  # Browser feature detection
│
├── stores/
│   └── useAppStore.ts      # Zustand store
│
├── lib/
│   ├── canvas.ts           # Waveform + caption drawing utilities
│   ├── audio.ts            # Audio processing utilities
│   ├── transcription.ts    # Web Speech API wrapper
│   └── export.ts           # MediaRecorder utilities
│
├── types/
│   └── index.ts            # Shared TypeScript types
│
├── public/
│   └── fonts/              # Inter font files (WOFF2)
│
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── package.json
```

---

## State Management (Zustand Store)

```typescript
// stores/useAppStore.ts
interface AppState {
  // Theme
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
  playbackTime: number;

  // Transcription
  transcript: TranscriptWord[];
  isTranscribing: boolean;

  // Caption Display
  currentCaption: string;

  // Export
  isExporting: boolean;
  exportProgress: number;
}

interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}
```

---

## Critical Paths

1. **Audio Recording:** MediaRecorder → Blob → AudioBuffer
2. **Waveform Rendering:** AnalyserNode → getByteFrequencyData → Canvas bars
3. **Transcription:** Web Speech API → word timestamps → editable UI
4. **Caption Sync:** AudioContext.currentTime → find active word → Canvas render
5. **Video Export:** captureStream + MediaRecorder → WebM blob → download
6. **A/V Sync:** AudioContext.currentTime as single source of truth (no Date.now())
