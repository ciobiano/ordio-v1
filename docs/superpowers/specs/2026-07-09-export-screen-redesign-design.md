# Export Screen Redesign — Design Spec

**Date:** 2026-07-09
**Status:** Approved
**Goal:** Bring the export screen into the morphing design language shipped on the capture page (commits `7dd9034` → `3e18169`).

## Context

The capture page was rebuilt around a mobile-first 440px shell with a bottom dock whose
center slot morphs between phases, floating action sheets, and a book-swing sidebar —
all styled through CVA variants in `lib/variants.ts` with the shared ease
`[0.32, 0.72, 0, 1]`. The export screen (`soul/states/ExportState/`) still uses the old
language: full-width page, side-by-side desktop layout, shadcn Drawer + IconToolbar for
mobile controls, and a footer that stacks progress/error/ShareCard in a glass card.

## Decisions (user-approved)

1. **Full shell adoption** — export lives in the same 440px shell as capture; the
   desktop side-by-side layout goes away (440px column centered on desktop, same
   trade-off as capture).
2. **Floating sheets** for editing controls, matching `UploadActionSheet` /
   `RecordingSettingsSheet` patterns.
3. **Full-screen share takeover** for the post-export success moment (bold consumer /
   Spotify Wrapped energy).
4. **New `soul/export/` folder** mirroring the capture migration playbook
   (scaffold → migrate → delete `states/ExportState/`).

## Design

### 1. Shell & layout

`ExportScreen` adopts the capture shell exactly: `max-w-[440px] h-dvh min-h-[720px]
mx-auto`, black background, `select-none`, shared `EASE = [0.32, 0.72, 0, 1]`.

- **ExportHeader** — thin capture-style header: back chevron (opens DiscardDialog),
  phase-dependent title ("Preview" → "Exporting…" → "Ready to share"), theme toggle.
- **ExportStage** — `CanvasPreview` is the hero, centered, with slim
  `PlaybackControls` beneath. The old `StageControlBar` strip is removed from the stage.
- **ExportDock** — bottom morphing dock (section 2).

### 2. Phases & morphing dock

`deriveExportPhase` (mirrors capture's `phase.ts`) yields:
`preview → exporting → done`, with `error` folding back to `preview`.

Dock reuses/extends the capture CVA variants (`captureRoundBtn`, `captureCenterSlot`
in `lib/variants.ts` — no hardcoded class strings):

| Phase | Left | Center slot | Right |
|---|---|---|---|
| `preview` | Style (round, opens StyleSheet) | **"Export video"** white pill | Edit (scissors, opens EditSheet) |
| `exporting` | — | Progress-fill pill (`width: progress%`, same as capture processing) | Cancel (round) → `exporter.cancelExport()` |
| `done` | New recording (reset to capture) | **"Download"** white pill | Back to preview |
| `error` | Same as `preview`; error surfaced via toast/inline message | | |

Every async state has an explicit exit back to a safe state (state-exit rule).

### 3. Floating sheets

Two sheets styled like `UploadActionSheet`/`RecordingSettingsSheet`, replacing the old
`IconToolbar` + `Dock` + shadcn `Drawer` scaffolding:

- **StyleSheet** — absorbs `StageControlBar`'s pickers (Visual / Caption / Stage) as
  sheet rows using the capture sheet styling. Feature gates + `LockBadge` preserved.
- **EditSheet** — tabs: Trim (`TrimPanel` incl. undo/redo/commit) and Captions
  (`CaptionEditor`). Existing panels are reused as-is; only the container changes.

### 4. Share takeover (`done`)

When `exporter.exportedUrl` lands, the stage cross-fades (framer-motion, shared ease)
into a celebration view: `ShareCard` large and centered, variant pills
(acid/sunset/electric, existing `acidPill` variant) below. Dock morphs to Download.
No confetti — the card carries the energy.

### 5. Code structure & migration

```
soul/export/
  ExportScreen.tsx   — shell; replaces states/ExportState/index.tsx rendering
  ExportHeader.tsx
  ExportStage.tsx
  ExportDock.tsx
  ShareTakeover.tsx
  StyleSheet.tsx
  EditSheet.tsx
  DiscardDialog.tsx  — moved from states/ExportState/
  ShareCard.tsx      — moved from states/ExportState/
  phase.ts / types.ts
  useTrimHistory.ts  — undo/redo snapshot history + commit + buildAudioBuffer,
                       lifted verbatim from old index.tsx
```

- All export/trim business logic moves **unchanged** (re-skin, not a logic rewrite):
  `buildAudioBuffer`, `handleExport` (incl. the transcript swap/restore around
  `exporter.startExport`), snapshot history, `useAudioTrimmer` wiring.
- `states/ExportState/` is deleted at the end of migration.
- Props contract of the old `ExportState` component is preserved so the parent
  (`/create` page flow) swaps imports with no behavior change.

## Error handling

- Export errors: message surfaced, dock returns to `preview`; user can retry, edit, or
  discard. No dead-end states.
- `trimIsEmpty` guard: Export pill disabled + inline hint, as today.
- Cancel during export: `cancelExport()` returns to `preview`.

## Testing

- Unit: `deriveExportPhase` phase table; `useTrimHistory` undo/redo/commit bounds
  (MAX_HISTORY = 5, branch clears future).
- Existing export/trim tests must keep passing (logic unchanged).
- Batch test run once at end of implementation, per workflow preference.

## Out of scope

- No changes to `useVideoExporter`, encoders, `frameRenderer`, feature gates, or the
  capture screen itself.
- No shared-shell extraction from capture (revisit if a third screen adopts the shell).
