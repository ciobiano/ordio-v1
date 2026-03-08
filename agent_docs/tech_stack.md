# Tech Stack

## Frontend

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Framework** | Next.js (App Router) | 15.3.3 | SSR optional, Vercel deploy, webpack for CopyPlugin |
| **Language** | TypeScript (strict) | 5.x | Type safety, no `any` allowed |
| **UI** | React | 19 | Latest, used with `'use client'` directive |
| **Styling** | Tailwind CSS | 4.x | Utility-first, fast iteration |
| **State** | Zustand | 5.x | ~1KB, selector pattern, no boilerplate |
| **Audio** | Web Audio API | Native | AudioContext, AudioBuffer, AnalyserNode |
| **Graphics** | Canvas API | Native | 1080p rendering, same code for preview + export |
| **Variants** | class-variance-authority | latest | Component variant styling |
| **Fonts** | Google Fonts (dynamic) | CDN | Loaded via FontFace API for canvas rendering |

## Video Export

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Primary encoder** | Mediabunny | WebCodecs → MP4 (H.264 + AAC). Zero-dep, MPL-2.0 |
| **Fallback encoder** | ffmpeg.wasm | For Safari / no-WebCodecs browsers. Single-threaded WASM |
| **Frame renderer** | Custom canvas (`frameRenderer.ts`) | Pure function, renders waveform + captions per frame |

## Transcription

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Live captions** | Web Speech API | Free, runs during recording, ~70% accuracy |
| **Post-recording** | OpenAI Whisper API (`whisper-1`) | Word-level timestamps, punctuation via segment merge |
| **API route** | Next.js Route Handler (`/api/transcribe`) | Server-side Whisper call, returns `Word[]` |

## Browser APIs

| API | Purpose | Support |
|-----|---------|---------|
| **MediaRecorder** | Audio recording | All modern browsers |
| **Web Audio API** | Decode + analyse audio | All modern browsers |
| **Canvas API** | Waveform + caption rendering | All modern browsers |
| **WebCodecs** | Video encoding (Mediabunny) | Chrome 94+, Edge 94+, Firefox 130+ |
| **Web Speech API** | Live transcription | Chrome (best), Edge |
| **FontFace API** | Dynamic font loading for canvas | All modern browsers |

## Development Tools

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager (workspaces) |
| **Turborepo** | Monorepo build orchestration |
| **Vitest** | Unit testing (20 tests) |
| **ESLint** | Linting (`no-explicit-any: error`) |
| **Prettier** | Formatting (single quotes, 100 chars, 2-space) |
| **Husky + lint-staged** | Pre-commit: ESLint + Prettier on staged files |

## Monorepo Structure

```
ordio-v1/
├── apps/
│   ├── web/          # Next.js frontend (the active app)
│   └── renderer/     # Remotion renderer (v1 legacy, unused)
├── packages/
│   ├── shared/       # Zod schemas, waveform sampler, time utils
│   └── convex/       # Backend (v1 legacy, not wired in v2)
├── tasks/            # Project tracking (todo.md, plan.md, lessons.md)
└── agent_docs/       # Architecture specs + project brief
```

## Deployment Target

| Service | Cost | Purpose |
|---------|------|---------|
| **Vercel** | $0 (free tier) | Next.js hosting, API routes |
| **OpenAI API** | ~$0.006/min | Whisper transcription (pay-as-you-go) |
