# Ordio Studio: Desktop Workspace

**Date:** 2026-07-14
**Status:** Approved (brainstorm with user — layout, morph model, copilot architecture, and scope all user-selected)
**Depends on:** `2026-07-14-repo-structure-design.md` (packages/engine extraction, `/studio` route shell)

## Vision

`/studio` is a **production desk**: one clip at a time, deep editing, everything visible at once. A persistent three-pane frame whose *contents* morph per state — no navigation between screens, no splash, no sheets. The video stage is hero. Language is the primary control surface (prompt bar + ⌘K); the mouse does what only a mouse can (on-stage caption manipulation, waveform scrubbing).

Desktop earns its existence through four anchor capabilities mobile cannot offer:

1. **Transcript editing** — edit the audio by editing text (word timestamps already exist from Whisper).
2. **⌘K command layer** — keyboard-first access to every action.
3. **AI copilot prompt bar** — type intent, the app applies engine edits, with a visual diff gate.
4. **Multi-format export matrix** — 9:16 / 1:1 / 16:9 previewed and rendered side by side.

Plus four supporting features: clip library rail, direct-manipulation captions on the stage, an always-visible waveform timeline strip, and a clip finder for long uploads.

## Decisions Made (with user, in order)

| Decision | Chosen | Rejected |
|---|---|---|
| Core job of the studio | Production desk (one clip, deep) | Batch content factory; multi-clip project workspace |
| Layout skeleton | Stage-first with prompt bar under stage (code-agent style) | Text-first Descript-style desk; single morphing column |
| Morph model | Persistent frame, morphing pane contents (rails ghost when inactive) | Progressive reveal (rails slide in/out per state) |
| Copilot execution | Hybrid ladder: deterministic tier 1, LLM tier 2 | Full LLM agent (cost/latency); deterministic-only (not a copilot) |
| Supporting features | All four: library rail, direct-manipulation captions, timeline strip, clip finder | — |

## The Frame

```
┌────────────────────────────────────────────────────────────┐
│ TOP BAR   clip title · ⌘K hint · Export ▸ · account        │
├──────────┬──────────────────────────────────┬──────────────┤
│ LEFT     │            STAGE                 │ INSPECTOR    │
│ RAIL     │      (canvas preview,            │  Style       │
│          │       @ordio/engine)             │  Background  │
│ library  │                                  │  Audio       │
│    ↕     │  ┌────────────────────────────┐  │  (sections   │
│ transcript│ │ ✦ prompt bar               │  │   morph per  │
│ (morphs) │  └────────────────────────────┘  │   state)     │
├──────────┴──────────────────────────────────┴──────────────┤
│ TIMELINE STRIP  waveform · word markers · silence heatmap  │
│                 trim handles · playhead · zoom             │
└────────────────────────────────────────────────────────────┘
```

- **Left rail** morphs between two identities: the **clip library** (idle — recordings list, click to load) and the **transcript editor** (clip loaded — with a compact "‹ Library" header to return). Same pane, two contents.
- **Right inspector** hosts the existing controls (StyleControls, BackgroundVideoPicker, audio enhance) as always-visible sections, not modals. **Trim moves out of a panel** into the timeline strip.
- **Prompt bar** sits under the stage. ⌘K and the prompt bar are the same input, summoned two ways.

## State Choreography

The frame never changes; pane contents morph. Inactive panes ghost (dimmed, non-interactive), never disappear.

| State | Left rail | Stage | Inspector | Timeline |
|---|---|---|---|---|
| Idle | Library | Record orb + prompt bar ("record, drop, or ask…") | Mic/input settings | ghosted |
| Capture | ghosted | Live waveform + live captions + timer | Input meters | ghosted |
| Processing | Transcript **streams in** as Whisper returns | Clip card with progress | locked | ghosted |
| Edit | Transcript | Video preview + prompt bar | Style / Background / Audio | full |
| Export | Transcript (dimmed) | **9:16 · 1:1 · 16:9 matrix** | Render queue | ghosted |

- **Processing is non-blocking**: the clip enters a background queue with a progress badge on its library entry; the user can record again immediately. (Realizes the parallel-processing standard from `docs/improvements.md`.)
- The whole window is a dropzone in every state.
- `Space` = play/pause in edit, push-to-talk in idle. Every async state has an explicit cancel path back to idle.

## Load-Bearing Architecture: the Action Registry

Every edit operation — `setCaptionStyle`, `setBackground`, `removeFillerWords`, `cutRange`, `trimSilence`, `setFormat`, `startExport`, … — is registered once as a typed action:

```ts
{ id: string; label: string; params: ZodSchema; run(store, params): void }
```

Three frontends consume the same registry:

1. **⌘K palette** — fuzzy-matches registry labels, prompts for params.
2. **Prompt bar tier 1 (deterministic)** — parses known phrasings ("make captions karaoke" → `setCaptionStyle({ mode: 'karaoke' })`). Instant, free, offline.
3. **Copilot tier 2 (LLM)** — semantic asks ("cut the tangent about pricing") go to an API route where Claude receives the transcript plus the registry serialized as tool definitions, and returns tool calls the client applies.

**Diff gate:** every AI-initiated edit renders as a reviewable preview before it applies — proposed cuts highlight in the transcript, style changes preview on the stage — with accept/reject. AI never silently mutates state.

The registry inverts the usual "add AI to an app" integration: the UI becomes a tool surface, and the palette, the parser, and the LLM are three routers into one set of verbs. Every action added to the registry is automatically keyboard-accessible, promptable, and AI-executable.

## Transcript Editing: Non-Destructive EDL

New engine concept: a **cut list** layered over the untouched audio and word timestamps:

```ts
edits: Array<{ startMs: number; endMs: number; source: 'manual' | 'filler' | 'silence' | 'copilot' }>
```

- Deleting a sentence in the transcript adds a cut range; filler-word removal batch-adds cuts; undo removes them.
- Preview and export both consume the EDL — audio splicing and caption re-timing happen in `@ordio/engine`.
- Nothing is destructive; every operation is undoable; EDL operations are pure functions (immutable — each edit returns a new list).

**V1 scope:** delete/cut, filler-word removal, click-word-to-seek, select-to-play. **Out of scope:** reordering, insertion, overdub.

## Remaining Components

- **Export matrix:** per-format caption safe-areas and background cover-fit (the background compositor is already format-aware); one sequential render queue through the existing encoder pipeline; per-format progress and download.
- **Direct-manipulation captions:** drag/scale captions on the stage with snap guides; per-format position overrides stored alongside StyleConfig. Builds on `captionTransformGeometry.ts`.
- **Waveform timeline strip:** zoomable waveform, word markers, silence heatmap, trim handles, playhead scrubbing. The desktop promotion of mobile's TrimPanel — always visible instead of buried in a sheet.
- **Clip library rail:** the desktop promotion of mobile's CaptureSidebar. Processing badges, draft clips from the clip finder.
- **Clip finder:** long upload → transcription → LLM scores clippable moments → suggestions appear in the library rail as draft clips, one click loads each into the desk. Continues `feature/clip-finder-wedge`.

## Build Order

Each slice is independently shippable and gets its own spec → plan → implementation cycle. This document is the umbrella vision.

0. **Repo migration** (already designed/approved): `packages/engine` extraction + `/studio` route shell.
1. **Studio desk core** — frame, library rail, stage preview, inspector port of existing controls, desktop capture, basic timeline strip with trim. *Milestone: usable studio at feature parity with mobile.*
2. **EDL + transcript editing** — the desktop-defining feature.
3. **Action registry + ⌘K + prompt bar tier 1.**
4. **Copilot tier 2** — LLM API route, diff preview, feature-tier gating.
5. **Export matrix.**
6. **Direct-manipulation captions.**
7. **Clip finder.**

Slices 5–7 are order-flexible after 4; reorder on product signal.

## Error Handling & Testing

- **Data safety:** the processing queue persists raw audio Blobs to IndexedDB the moment recording stops — a crash or closed tab never loses a recording. Restores on reload.
- **Copilot degradation:** tier 2 failures degrade to a toast plus a tier-1 suggestion where one matches; the app remains fully usable without the LLM.
- **Cost gating:** tier 2 calls are feature-gated per user tier (existing `featureGates.ts` pattern).
- **Testability:** EDL operations are pure and unit-testable. The action registry provides one seam to test all three input frontends against the same action set. Canvas/WebGL components wrap in error boundaries; visual failures never take down capture.
- **State machine:** studio states (idle/capture/processing/edit/export) get explicit transition definitions; every error branch lands in a defined state, never a dead end.
