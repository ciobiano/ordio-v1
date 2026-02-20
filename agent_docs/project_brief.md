# Project Brief (Persistent Rules & Conventions)

## Product Vision
ordio enables independent creators to generate professional audiogram videos with animated waveforms and captions—entirely in the browser, at zero cost. No expensive SaaS subscriptions. No video editing skills required.

## Core Value Proposition
**Free, browser-based audiogram generator with what-you-see-is-what-you-get exports.**

The entire record → preview → export flow happens client-side. No server needed. No account needed. $0 cost.

## Coding Conventions

### File Naming
- **Components:** PascalCase with `.tsx` extension (`AudioRecorder.tsx`)
- **Hooks:** camelCase with `use` prefix (`useAudioRecorder.ts`)
- **Utilities:** camelCase with `.ts` extension (`canvas.ts`, `audio.ts`)
- **Types:** PascalCase in `types/index.ts`
- **Tests:** Co-located with `.test.ts` suffix

### Import Order
```typescript
// 1. External dependencies
import { useState, useRef } from 'react';

// 2. Local imports (absolute paths via @/ alias)
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/Button';

// 3. Relative imports
import { AudioPlayer } from './AudioPlayer';

// 4. Types
import type { AudioState } from '@/types';
```

### TypeScript Rules
- **Strict mode enabled** in all `tsconfig.json` files
- **No `any` type** — use `unknown` with type guards
- **Explicit return types** for exported functions
- **Interface over type** for object shapes

### React Patterns
- **Server Components by default** (Next.js 14 App Router)
- **Client Components** only when using hooks, events, or browser APIs
- **Named exports** for components
- **Custom hooks** for all browser API interactions

## Quality Gates

### Pre-Commit Hooks (Enforced)
- ESLint (no warnings allowed)
- Prettier formatting
- TypeScript type check
- Unit tests for changed files

### Testing Requirements
- Unit tests for canvas utilities and hooks
- E2E tests for core user journey (record → preview → export)
- Cross-browser manual testing (Chrome, Edge, Firefox, Safari)

## Key Commands

### Development
```bash
pnpm install           # Install dependencies
pnpm dev               # Start Next.js dev server
```

### Testing
```bash
pnpm test              # Run all tests
pnpm test:unit         # Run unit tests (Vitest)
pnpm test:e2e          # Run E2E tests (Playwright)
pnpm test:coverage     # Generate coverage report
```

### Build & Deploy
```bash
pnpm build             # Build all packages
pnpm lint              # Run ESLint
pnpm type-check        # Run TypeScript compiler
pnpm format            # Run Prettier
```

## Decision Log

### Why Client-Side First instead of Server-Side Export?
- **$0 cost:** No server infrastructure needed for MVP
- **Instant feedback:** Users see results immediately, no waiting for server
- **Privacy:** Audio never leaves the user's browser
- **Simplicity:** No backend to maintain, deploy, or debug
- **Trade-off:** iOS Safari can't export video (addressed in P1 with server fallback)

### Why Web Speech API instead of Whisper?
- **$0 cost:** No API calls needed
- **No server:** Keeps MVP fully client-side
- **Good enough:** ≥70% accuracy for standard English
- **Trade-off:** Lower accuracy for non-standard accents (mitigated by manual editing)
- **P1 plan:** Add Whisper API option for better accuracy

### Why Zustand instead of Redux/Context?
- **Lightweight:** ~1KB, no boilerplate
- **Simple API:** No reducers, actions, or providers needed
- **Selector pattern:** Prevents unnecessary re-renders
- **DevTools support:** Built-in

### Why Canvas instead of DOM/SVG for waveform?
- **Performance:** Direct pixel control, 25-30fps achievable
- **captureStream:** Required for client-side video export
- **Consistency:** Same rendering approach for preview and export

## Update Cadence
- **Daily:** Update `AGENTS.md` "Current State" after each work session
- **Weekly:** Review and update roadmap progress
- **Per Phase:** Update this brief with new conventions or learnings

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| iOS Safari no video export | High | High | "Desktop recommended" message, server path in P1 |
| A/V drift on long recordings | Medium | High | AudioContext.currentTime as truth, 5-min limit |
| Low-end mobile frame drops | Medium | Medium | Throttle to 20fps, reduce bar count, OffscreenCanvas |
| Web Speech API accent accuracy | Medium | Medium | Manual transcript editing, Whisper API in P1 |
| WebM not playable on iPhone | High | Medium | User downloads to desktop, server transcode in P1 |
