# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ordio is a browser-based audiogram generator for social media creators. Users record/upload audio, get live transcription, and export waveform videos — all client-side with zero server cost. The v1 server stack (Convex, Remotion, Clerk) exists as P1 fallback but the **v2 client-side MVP is the current focus**.

## Monorepo Structure

pnpm workspaces + Turborepo with 4 packages:

- **`apps/web`** — Next.js 15 App Router (React 19, Tailwind 4, Zustand)
- **`apps/renderer`** — Express + Remotion server-side renderer (P1 fallback)
- **`packages/shared`** — Shared utilities: waveform sampling, text layout, time utils, Zod schemas, design tokens
- **`packages/convex`** — Convex backend: jobs, auth, webhooks (P1 fallback)

## Commands

```bash
# Development
pnpm dev                        # All dev servers via Turborepo
pnpm dev --filter=web           # Next.js only

# Quality
pnpm test                       # All unit tests (Vitest)
pnpm test --filter=web          # Web tests only
pnpm --filter=web test:watch    # Watch mode
pnpm --filter=web test:e2e      # Playwright E2E tests
pnpm lint                       # ESLint across all packages
pnpm type-check                 # TypeScript strict check
pnpm format                     # Prettier format
pnpm build                      # Build all packages

# Single test file
pnpm --filter=web vitest run src/__tests__/cn.test.ts

# Pre-commit (enforced by Husky + lint-staged)
pnpm lint && pnpm type-check && pnpm test
```

## Architecture

### Web App Data Flow
```
Recording → useAudioRecorder (MediaRecorder + Web Audio decode)
         → useTranscription (Web Speech API live + Whisper fallback)
         → useVideoExporter (Canvas.captureStream + MediaRecorder mux)
         → Zustand store (all UI state)
```

### Key Directories (`apps/web/src/`)
- `app/` — Next.js routes and pages; `page.tsx` orchestrates all UI states (idle→recording→processing→export)
- `app/api/transcribe/` — OpenAI Whisper API route (only server dependency)
- `components/soul/` — State-driven UI components (IdleState, RecordingState, ProcessingState, ExportState, StyleControls, CaptionEditor)
- `components/primitives/` — Reusable visual components (WaveformDisplay, PlaybackControls, VideoPreview)
- `hooks/` — Business logic hooks (useAudioRecorder, useTranscription, useVideoExporter, usePlayback, useVAD, useAnalyzer, useCapabilities)
- `lib/store.ts` — Zustand store for all app state
- `__tests__/` — Vitest unit tests

### Shared Package (`packages/shared/src/`)
Core rendering logic shared between client and server:
- `waveform.ts` — RMS-based audio downsampling for visualization
- `layout.ts` — Deterministic text layout (DOM-independent, injected `measureText`)
- `time.ts` — Frame/time conversion utilities (30fps)
- `schemas.ts` — Zod schemas (Word, Timeline, StyleConfig, JobConfig)
- `tokens.ts` — Design tokens (colors, fonts, resolutions)

### Reference Docs
- `AGENTS.md` — Master plan, current phase, roadmap, success criteria
- `agent_docs/` — Detailed specs: `architecture.md`, `code_patterns.md`, `tech_stack.md`, `testing.md`, `product_requirements.md`

## Critical Constraints

### Client-Server Parity
- ALL rendering math in `packages/shared` — same code runs in browser and server
- Bundled fonts only (WOFF2) — never system fonts (breaks determinism)
- `AudioContext.currentTime` for A/V sync — never `Date.now()`
- `layoutCaption()` for text layout — never CSS word-wrap in rendered output

### Architectural Boundaries
- Next.js routes: request/response handling only
- Business logic: `packages/shared` or React hooks
- No direct DB calls from components
- Zustand for all client UI state

### Type Safety
- No `any` — use `unknown` with type guards
- All exported functions need explicit return types
- Zod for runtime validation of external data
- TypeScript strict mode enforced

### Anti-Patterns
- Don't require Convex/Remotion/Clerk for v2 features
- Don't modify Convex schema without a migration plan
- Don't use `--no-verify` to bypass git hooks
- Don't put business logic in Next.js route handlers

## Workflow Orchestration

### Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Write detailed specs upfront to reduce ambiguity

### Task Management
1. Write plan to `tasks/todo.md` with checkable items
2. Check in before starting implementation
3. Track progress — mark items complete as you go
4. Document results — add review section to `tasks/todo.md`
5. After corrections from user: update `tasks/lessons.md` with rules to prevent the same mistake

### Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask: "Would a staff engineer approve this?"

### Core Principles
- **Simplicity First**: Make every change as simple as possible
- **No Laziness**: Find root causes, no temporary fixes
- **Minimal Impact**: Only touch what's necessary
- **Autonomous Bug Fixing**: Given a bug report, just fix it — zero context switching from the user
