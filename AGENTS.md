# AGENTS.md — Ordio Master Plan

## Project Overview

**App:** Ordio — Browser-based audiogram generator for social media creators
**Goal:** Free, client-side-first video export. No server required for MVP.
**Stack:** Next.js (App Router), React 19, Tailwind CSS 4, Zustand, Web Audio API, Canvas, MediaRecorder
**Current Phase:** v2 — Client-Side MVP
**Budget Constraint:** $0 hosting for MVP (Vercel free tier)
**Architecture:** Shifting from v1 (Convex + Remotion server) → v2 (pure client-side export)

## How I Should Think

1. **Understand Intent First**: Before answering, identify what the user actually needs
2. **Ask If Unsure**: If critical information is missing, ask before proceeding
3. **Plan Before Coding**: Propose a plan, ask for approval, then implement
4. **Verify After Changes**: Run tests/linters or manual checks after each change
5. **Explain Trade-offs**: When recommending something, mention alternatives and architectural implications

## Plan → Execute → Verify (MANDATORY)

1. **Plan:** Outline a brief approach with architectural considerations. Wait for approval.
2. **Execute:** Implement one feature at a time. Follow existing patterns.
3. **Verify:** Run `pnpm lint && pnpm type-check && pnpm test` after each feature. Fix before moving on.

## Context & Memory

- Treat `AGENTS.md` and `agent_docs/` as living documentation
- Use `CLAUDE.md` (Claude Code), `.cursorrules` (Cursor) for editor-specific rules
- Update these files as the project evolves
- Reference specific `agent_docs/` files for deep-dive context

## Context Files (Load on Demand)

- `agent_docs/tech_stack.md`: Detailed tech stack and library decisions
- `agent_docs/code_patterns.md`: Architecture patterns, anti-patterns, code examples
- `agent_docs/project_brief.md`: Persistent project rules, conventions, decision log
- `agent_docs/product_requirements.md`: Full PRD with user stories and success metrics
- `agent_docs/testing.md`: Testing strategy and verification commands
- `agent_docs/architecture.md`: System architecture and data flow diagrams

## Current State (UPDATE THIS REGULARLY!)

**Last Updated:** 2026-02-19
**Architecture:** v1 monorepo is built (Convex, Remotion, Clerk); pivoting to v2 client-side
**v1 Status:** Complete — monorepo scaffold, packages/shared, packages/convex, apps/renderer, apps/web shell
**Working On:** v2 client-side export pipeline (MediaRecorder + captureStream)
**Blocked By:** None

## What's Built (v1 — Substantially Complete)

- ✅ Monorepo structure (Turborepo + pnpm workspaces, 4 packages)
- ✅ `packages/shared` — waveform sampler, text layout, time utils, Zod schemas, design tokens
- ✅ `packages/convex` — Convex schema (jobs + users), auth (Clerk JWT), rate limiting, webhooks
- ✅ `apps/renderer` — Express server, Remotion composition (1080×1920, 30fps), Docker-ready
- ✅ `apps/web` — Next.js App Router, Zustand store, Waveform canvas, AudioPlayer, Clerk auth
- ✅ Pre-commit hooks (Husky + lint-staged: ESLint, Prettier, TypeScript)
- ✅ Unit tests for `packages/shared` (waveform, layout, time)

## Actual File Structure

```
ordio-v1/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx              # Main page (Clerk auth + component wiring)
│   │       │   ├── layout.tsx            # Root layout with theme
│   │       │   └── ConvexClientProvider.tsx
│   │       ├── components/
│   │       │   ├── AudioPlayer.tsx       # Upload, playback, export trigger
│   │       │   └── Waveform.tsx          # Canvas-based bar visualization
│   │       └── lib/
│   │           └── store.ts             # Zustand store (audio, playback, timeline, style)
│   └── renderer/
│       └── src/
│           ├── server.ts                # Express POST /render endpoint
│           ├── Composition.tsx          # Remotion composition (1080×1920, 30fps)
│           ├── Root.tsx                 # Remotion root
│           └── index.ts
├── packages/
│   ├── shared/src/
│   │   ├── schemas.ts                   # Zod: Word, Timeline, StyleConfig, JobConfig
│   │   ├── waveform.ts                  # waveformSampler() — RMS normalization
│   │   ├── layout.ts                    # layoutCaption() — deterministic text layout
│   │   ├── time.ts                      # timeToFrame, frameToTime, formatTime (30fps)
│   │   ├── tokens.ts                    # COLORS, FONTS, RESOLUTIONS
│   │   └── index.ts
│   └── convex/convex/
│       ├── schema.ts                    # jobs + users tables
│       ├── jobs.ts                      # generateUploadUrl, createJob, listJobs
│       ├── actions.ts                   # scheduleRender (HTTP to renderer)
│       ├── http.ts                      # POST /updateStatus webhook
│       └── auth.ts                      # Clerk JWT helpers
├── agent_docs/                          # Detailed architecture and spec docs
├── AGENTS.md                            # This file — master plan
├── CLAUDE.md                            # Claude Code instructions
├── .cursorrules                         # Cursor IDE rules
├── turbo.json
└── pnpm-workspace.yaml
```

## v2 Target Architecture (Client-Side MVP)

The goal is a $0-hosting version that works entirely in the browser. The v1 server stack (Convex, Remotion, Clerk) becomes a **P1 server fallback** for iOS Safari and low-end devices.

```
User Flow (v2):
  Upload/Record → Waveform Preview → Transcribe (Web Speech) → Edit Captions → Export

Export Pipeline:
  Canvas (waveform + captions) ─┐
                                 ├─ captureStream() → MediaRecorder → WebM/MP4
  AudioContext (decoded audio) ──┘
```

**v2 Key APIs:**
- `MediaRecorder` — audio recording
- `Web Audio API` — decoding, analysis, playback timing
- `OffscreenCanvas` / `Canvas` — waveform and caption rendering
- `canvas.captureStream()` — video track from canvas
- `MediaRecorder` — muxing canvas + audio into WebM
- `Web Speech API` — transcription (post-recording)

## Roadmap

### Phase 1: v2 Client Export (Current)
- [ ] Replace Clerk auth with anonymous session (or remove entirely for MVP)
- [ ] Implement `useAudioRecorder` hook (MediaRecorder + Web Audio decode)
- [ ] Implement `useVideoExporter` hook (captureStream + MediaRecorder mux)
- [ ] Implement `useTranscription` hook (Web Speech API)
- [ ] Add `useCapabilities` hook (detect browser feature support)
- [ ] Build caption editor UI (word-level editing, timing adjustment)
- [ ] Implement style controls panel (colors, fonts, aspect ratio)
- [ ] Client-side export with progress indicator

### Phase 2: Polish & Deploy
- [ ] Performance: Canvas pre-computation, worker offload if needed
- [ ] Cross-browser testing (Chrome, Edge, Firefox, Safari partial)
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Deploy to Vercel (zero config)
- [ ] Core Web Vitals: <2s waveform load, <500KB gzipped

### Phase 3: Server Fallback (P1 — Post-MVP)
- [ ] Re-enable Convex backend for job queueing
- [ ] Wire renderer (Remotion/FFmpeg) for iOS Safari fallback
- [ ] Clerk auth for usage tracking and rate limiting
- [ ] Infrastructure cost target: <$15/month

## Engineering Constraints (STRICTLY ENFORCE)

### Type Safety (No Compromises)
- `any` is **FORBIDDEN** — use `unknown` with type guards
- All exported functions must have explicit return types
- Zod for runtime validation of external data
- TypeScript strict mode in all packages

### Architectural Boundaries
- Next.js routes: request/response handling ONLY
- Business logic: `packages/shared` or React hooks
- No direct DB calls from React components
- Zustand store for all client UI state

### Client-Side Parity
- ALL rendering math lives in `packages/shared` (same code, browser + server)
- Use bundled fonts (WOFF2), NEVER system fonts — breaks determinism
- Use `AudioContext.currentTime` for A/V sync timing (not `Date.now()`)
- No CSS word-wrap for caption layout — use manual calculation via `layoutCaption()`

### Library Governance
- Check existing `package.json` before suggesting new dependencies
- Prefer native Web APIs over libraries
- No deprecated patterns (e.g., useEffect for data fetching)

## What NOT To Do (CRITICAL)

- ❌ Delete files without explicit confirmation
- ❌ Modify Convex schema without migration plan
- ❌ Add features not in current phase
- ❌ Skip tests for "simple" changes
- ❌ Bypass failing pre-commit hooks (`--no-verify`)
- ❌ Use system fonts (breaks rendering determinism)
- ❌ Use `Date.now()` for A/V sync (use `AudioContext.currentTime`)
- ❌ Use `any` type anywhere

## Success Criteria (v2 MVP)

- [ ] Upload audio → waveform preview within 2s
- [ ] Client-side export completes for 60s clips in <3 minutes
- [ ] ≥25fps desktop preview, ≥20fps mobile preview
- [ ] Works on Chrome 90+, Edge 90+, Firefox 90+
- [ ] Bundle size <500KB gzipped
- [ ] WCAG 2.1 AA compliant
- [ ] Zero server cost for MVP

---

**Next Steps:**
1. Review `agent_docs/` for v2 implementation details
2. Start with Phase 1: `useAudioRecorder` and `useVideoExporter` hooks
3. Update Current State section after each feature
