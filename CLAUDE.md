# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ordio is a browser-based audiogram generator that lets creators produce captioned waveform videos for social media. The architecture is shifting from server-side rendering (v1) to client-side first (v2, $0 hosting). See `agent_docs/` for detailed specs.

## Commands

```bash
# Development (Turborepo orchestrates all workspaces)
pnpm dev                          # Start all dev servers (Next.js + Convex + renderer)
pnpm dev --filter=web             # Start only the Next.js frontend
pnpm dev --filter=@ordio/shared   # Watch shared package only

# Build & Verify
pnpm build                        # Build all packages
pnpm lint                         # ESLint across all packages
pnpm type-check                   # TypeScript strict check across all packages
pnpm format                       # Prettier format all files

# Testing
pnpm test                         # Run all tests via Turborepo

# Convex (from packages/convex/)
npx convex dev                    # Start Convex dev server with hot reload
npx convex deploy                 # Deploy Convex backend to production
```

## Architecture

**Monorepo** using pnpm workspaces + Turborepo with 4 packages:

### `apps/web/` — Next.js frontend
- Next.js with App Router, React 19, Tailwind CSS 4
- Clerk for auth, Convex React hooks for data
- Zustand store in `src/lib/store.ts` (audioBuffer, playback, timeline, style)
- Components: `Waveform.tsx` (Canvas-based bar visualization), `AudioPlayer.tsx` (upload + playback + export trigger)
- `src/app/ConvexClientProvider.tsx` wraps Clerk + Convex providers

### `apps/renderer/` — Remotion video renderer
- Express server with POST `/render` endpoint in `src/server.ts`
- Remotion composition in `src/Composition.tsx` (1080x1920 portrait, 30fps)
- Uses `packages/shared` for waveform sampling (same algorithm as client preview)
- Dockerized for Railway deployment

### `packages/shared/` — Shared rendering logic
The critical parity layer — same code runs on client and server:
- `schemas.ts` — Zod schemas: `WordSchema`, `TimelineSchema`, `StyleConfigSchema`, `JobConfigSchema`
- `waveform.ts` — `waveformSampler()` using RMS loudness, normalizes to 0-1
- `layout.ts` — `layoutCaption()` deterministic text layout with injected `measureText`
- `time.ts` — `timeToFrame()`, `frameToTime()`, `formatTime()` at 30fps
- `tokens.ts` — Design tokens (colors, fonts, resolutions)

### `packages/convex/` — Backend
- Schema: `jobs` table (status: uploading→pending→processing→completed→failed), `users` table (usage tracking)
- `jobs.ts`: `generateUploadUrl`, `createJob` (with rate limiting: 20/day), `listJobs`, `updateStatus`
- `actions.ts`: `scheduleRender` calls renderer service via HTTP
- `http.ts`: POST `/updateStatus` webhook for renderer callbacks
- Auth via Clerk JWT (`auth.config.ts`)

## Data Flow

1. User uploads audio → Convex signed URL → `storageId`
2. Web Audio API decodes → `AudioBuffer` → waveform preview via Canvas
3. User clicks Export → `createJob` mutation → Convex scheduler → `scheduleRender` action
4. Action POSTs to renderer → Remotion renders MP4 → uploads result → webhook updates status
5. Client receives update via Convex WebSocket subscription

## Key Conventions

- **TypeScript strict mode** everywhere. `@typescript-eslint/no-explicit-any: "error"` in ESLint.
- **Path alias:** `@Ordio/shared/*` maps to `packages/shared/src/*`
- **Prettier:** single quotes, trailing commas (es5), 100 char width, 2-space tabs
- **Pre-commit:** Husky + lint-staged runs ESLint fix + Prettier on staged `.ts`/`.tsx` files
- **Timing:** Always use `AudioContext.currentTime`, never `Date.now()` for A/V sync
- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `test:`

## Architecture Direction (v2)

The `agent_docs/` folder has been updated to reflect a v2 client-side-first architecture. Key shift: MVP should work with $0 hosting (no Convex, no server rendering needed). The existing code still has v1 patterns (Clerk, Convex, Remotion server). The v2 approach uses:
- MediaRecorder + `canvas.captureStream()` for client-side video export
- Web Speech API for transcription (instead of Whisper)
- No authentication required for MVP

Read `agent_docs/product_requirements.md` and `agent_docs/architecture.md` for the target v2 design.
