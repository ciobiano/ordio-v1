# Tech Stack & Tools

## Frontend (`/app`)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14 (App Router) | SSR optional, excellent DX, Vercel integration |
| **Language** | TypeScript (strict) | Type safety, better IDE support |
| **Styling** | Tailwind CSS | Utility-first, fast iteration |
| **State** | Zustand | Lightweight, no boilerplate, good DevTools |
| **Audio** | Web Audio API | Native, no dependencies |
| **Graphics** | Canvas API | Direct pixel control, captureStream support |
| **Icons** | Lucide React | Consistent, tree-shakeable |

## Browser APIs (Client-Side Core)

| API | Purpose | Browser Support |
|-----|---------|-----------------|
| **MediaRecorder** | Audio recording | All modern browsers |
| **Web Audio API** | Audio decoding + AnalyserNode | All modern browsers |
| **Canvas API** | Waveform + caption rendering | All modern browsers |
| **canvas.captureStream()** | Video capture for export | Chrome, Edge, Firefox |
| **Web Speech API** | Post-recording transcription | Chrome (best), Edge |
| **OffscreenCanvas** | Worker-based rendering (mobile perf) | Chrome, Edge, Firefox |

## Backend (Server Path — P1 Only)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Database** | Convex | Real-time subscriptions, file storage included |
| **Queue** | Trigger.dev | Free tier, webhook-based, no infrastructure |
| **Render** | Docker + FFmpeg | Proven, deterministic output |
| **Hosting** | Railway | Simple Docker deployment, $5/mo starter |

**Note:** Server path is NOT part of MVP. MVP is 100% client-side.

## Development Tools

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager (workspace support) |
| **TypeScript 5.3+** | Strict mode enabled |
| **ESLint** | Linting with typescript-eslint |
| **Prettier** | Code formatting |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **Husky + lint-staged** | Pre-commit hooks |
| **Turborepo** | Monorepo build orchestration (optional) |

## Deployment

| Service | Cost | Purpose |
|---------|------|---------|
| **Vercel** | $0 (free tier) | Hosting Next.js app |
| **Domain** (optional) | $12/year | Custom domain |

---

## Key Patterns

### Zustand Store (No Immer)
```typescript
// stores/useAppStore.ts
import { create } from 'zustand';

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  audioBlob: null,
  audioBuffer: null,
  audioDuration: 0,
  setAudio: (blob, buffer) => set({
    audioBlob: blob,
    audioBuffer: buffer,
    audioDuration: buffer.duration,
  }),
  clearAudio: () => set({
    audioBlob: null,
    audioBuffer: null,
    audioDuration: 0,
    transcript: [],
    currentCaption: '',
  }),

  // ... other slices
}));
```

### Custom Hooks Pattern
```typescript
// hooks/useAudioRecorder.ts
interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

interface AudioRecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export const useAudioRecorder = (): [AudioRecorderState, AudioRecorderActions] => {
  // Implementation using MediaRecorder API
};
```

### Browser Capability Detection
```typescript
// hooks/useCapabilities.ts
export interface Capabilities {
  canRecordAudio: boolean;
  canExportVideo: boolean;
  canTranscribe: boolean;
  recommendedPath: 'client' | 'server';
  warnings: string[];
}
```

## Naming Conventions
- **Files:** kebab-case (`audio-upload.tsx`, `use-waveform.ts`)
- **Components:** PascalCase (`AudioUpload`, `WaveformCanvas`)
- **Functions:** camelCase (`uploadAudio`, `getExportPayload`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_AUDIO_DURATION`, `DEFAULT_FPS`)
- **Types/Interfaces:** PascalCase with descriptive names (`AudioState`, `ExportOptions`)
