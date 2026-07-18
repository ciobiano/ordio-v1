# Repo Structure: Engine Package, Studio Route, Audio-Enhance Extraction

**Date:** 2026-07-14
**Status:** Approved (design review with user)

## Problem

Three structural pressures on the codebase:

1. A desktop UI is coming — a single-surface, morphing workspace (code-agent-style), with no splash screens, onboarding, or redirect-based navigation. It must not inherit the mobile flow's chrome or layout.
2. The rendering/export engine (canvas frame rendering, waveforms, captions, backgrounds, media, export encoders) lives inside `apps/web/src/lib`, giving it no enforced boundary from UI code.
3. `services/audio-enhance` (Python, Modal GPU) has a fully independent release cycle from the web app but shares its repo.

## Decision

Stay a single monorepo for all TypeScript code. Split by **package boundaries**, not repo boundaries. Extract only audio-enhance to its own repo, because it alone has an independent release cycle (separate language, separate deploy target, HTTP-only coupling).

Rejected alternatives:

- **Engine in a separate repo (published npm package):** every engine fix becomes a two-repo publish-and-bump dance. Engine and UI change together on most features (new waveform → new picker UI). No external consumers exist. Revisit only if external consumers materialize — the package boundary created here makes that extraction cheap later.
- **Desktop UI in a separate repo:** the desktop UI is React routes in the same Next.js deployment; a second repo would require publishing packages or submodules for zero isolation benefit beyond what a route group provides.

Key principle: repo boundaries are for independent release cycles; package boundaries are for code that ships together but must not entangle. In-monorepo breaking changes fail typecheck in the same PR; cross-repo breaks surface weeks later at version bump.

## Target Structure

```
ordio-v1/  (this repo — the product)
├── apps/web
│   └── src/app/
│       ├── (marketing)/          → landing (unchanged)
│       ├── create/               → mobile flow (unchanged)
│       └── studio/               → desktop workspace, own root layout
├── packages/
│   ├── engine/                   → NEW: rendering + export core
│   ├── shared/                   → schemas, tokens (unchanged)
│   └── convex/                   → backend (unchanged)

ordio-audio-enhance/  (NEW separate repo)
└── contents of services/audio-enhance
```

## `packages/engine`

**Moves in** (from `apps/web/src/lib`): `video/`, `waveforms/`, `captions/`, `backgrounds/`, `media/`, `processing/`, `core/`, `loaders/`, plus loose engine files `graphic.ts`, `transitions.ts`, `webgl-detect.ts`.

**Stays in web:** `variants.ts`, `featureGates.ts`, `fileValidation.ts`, `formatFileSize.ts`, `utils.ts`, `audioEnhanceApi.ts`, the Zustand store, and all hooks/components — anything React, UI, or business-policy.

**Extraction risk is low:** as of this design, none of the 38 files in the moving directories import React, Zustand, or carry `"use client"`. The engine is already headless in practice; this move makes it headless by construction.

**Public API:** the package exports a deliberate surface via `src/index.ts` (frame rendering, export pipeline, waveform renderers, caption layout, media utilities). `apps/web` imports `@ordio/engine` only — no deep imports. Engine code must never import from `apps/web`; the package boundary turns that into a build error.

**Dependency direction:** `engine` may depend on `shared` (schemas/types). `web` depends on `engine`, `shared`, `convex`. Turborepo task graph builds `engine` before `web`.

## `/studio` Route Group

- Own `layout.tsx`: no splash, no onboarding, no mobile chrome. Single-page morphing workspace — state morphs in place rather than navigating between routes.
- Consumes the same `@ordio/engine` and Convex backend as `/create`.
- Next.js code-splits per route: mobile users never download studio code and vice versa.
- Ships as an empty shell in this migration. The actual workspace UI is a separate future project with its own design cycle. Device-based nudging from `/create` to `/studio` is a later product decision, out of scope here.

## Audio-Enhance Extraction

- `services/audio-enhance` moves to a new repo: `ordio-audio-enhance`.
- History: preserve via `git subtree split` if desired; a plain copy is acceptable.
- The only coupling is the HTTP contract consumed by `apps/web/src/lib/audioEnhanceApi.ts` — document the request/response shapes in the new repo's README as the interface contract.
- Modal deploy config moves with it. The `services/` directory in this repo is removed once verified.

## Migration Order (each step independently shippable)

1. **Extract `packages/engine`.** Create the package, move the directories/files listed above, fix imports, export the public API from `index.ts`. Pure refactor — no behavior change. Verify: `pnpm run type-check`, `pnpm run lint`, full test suite (58 tests) pass.
2. **Move audio-enhance out.** Create `ordio-audio-enhance` repo, migrate contents, redeploy on Modal, verify the enhance flow end-to-end from the web app (including the graceful-degradation toast path), then delete `services/` here.
3. **Scaffold `/studio`.** Route group with its own layout, empty shell. Verify: route renders, mobile `/create` flow untouched, bundle for `/create` does not grow.

## Error Handling & Testing Notes

- Step 1 relies on TypeScript as the safety net: every broken import fails typecheck. Existing engine tests move with their code into `packages/engine` and must pass there.
- Step 2's risk is deployment config drift (env vars, Modal secrets). Verification is a live end-to-end enhance call, not just a deploy success.
- The web app's existing graceful degradation for enhance failures (toast + continue without enhancement) already covers the service being unavailable mid-migration.
