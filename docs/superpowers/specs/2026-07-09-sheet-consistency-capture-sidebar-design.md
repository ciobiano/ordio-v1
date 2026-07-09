# Sheet Design Consistency + CaptureSidebar Overhaul

**Date:** 2026-07-09
**Branch:** main
**Supersedes:** `2026-03-16-sheet-color-hierarchy-design.md` (glass-material direction abandoned; see Phase 1)

---

## Problem

Auditing every sheet/drawer in the app surfaced two related issues:

1. **Visual inconsistency across sheets.** `RecordingSettingsSheet` and `CaptureSidebar` use a solid dark background (`#0d0d10`), while `UpgradeSheet` and the `ExportControls` mobile drawer use `bg-[color:var(--glass-bg)]` + `backdrop-blur-xl`. `--glass-bg` is referenced in 7 places (`Dock.tsx`, `UpgradeSheet.tsx`, `ExportControls.tsx`, `ExportFooter.tsx`, `StageControlBar.tsx` ×2) but **never defined** anywhere in `globals.css` — the declaration is invalid and silently dropped, so those elements render with no background at all, just blur. Separately, corner radius/shadow treatment differs sheet-to-sheet with no shared source.

2. **Dead design-system debris.** A March 2026 spec (`2026-03-16-sheet-color-hierarchy-design.md`) introduced a frosted-glass material system (`--surface-glass`, `--surface-glass-card`, `--shadow-glass-top`, `--surface-selected`). That direction was superseded by a later flat-dark redesign, but the tokens were never removed — they're defined in `globals.css` and consumed by zero components today.

3. **CaptureSidebar gaps.** The sidebar that's actually wired into the app (`CaptureSidebar.tsx`, revealed via the hamburger icon in `CaptureScreen`) has a stray `bg-[#3a7bf0]` blue "New recording" button that doesn't match anything else in the app, no swipe gesture to open/close (only tap-to-toggle via a `framer-motion` `x` transform), and no way to delete a recording from the list at all.

   A separate component, `SavedAudioPanel.tsx`, already has search/sort/delete-with-confirmation and a real `vaul` `Drawer` (`direction="left"`, native swipe-to-close) — but it is **not imported or rendered anywhere in the app**. It's dead code from an earlier iteration, confirmed via repo-wide search (only self-references and one unused comment mention in `FileConfirmDialog.tsx`).

**Decision:** Upgrade the live `CaptureSidebar` in place rather than swapping in the unused `SavedAudioPanel`, and delete `SavedAudioPanel.tsx` + `SavedAudioDialogs.tsx` as dead code (keep `saved-audio/formatters.ts`, still imported by `CaptureSidebar`).

---

## Phase 1 — Design tokens & sheet consistency

### Token changes (`globals.css`)

Remove (dead, unconsumed):
```
--surface-glass
--surface-glass-card
--border-glass
--shadow-glass-top
--surface-selected
```

Add:
```css
--sheet-bg: #0d0d10; /* single source of truth for all sheet/drawer/sidebar dark surfaces */
```

`--glass-bg` is removed (never defined, so removing it changes nothing at runtime) and every consumer is repointed at `--sheet-bg` with the blur/glass framing dropped, since we're committing to a solid dark look, not glass:

| File | Before | After |
|---|---|---|
| `Dock.tsx` | `bg-[color:var(--glass-bg)] backdrop-blur-xl` | `bg-[color:var(--sheet-bg)]` |
| `UpgradeSheet.tsx` | `bg-[color:var(--glass-bg)] backdrop-blur-xl` | `bg-[color:var(--sheet-bg)]` |
| `ExportControls.tsx` (mobile drawer) | `bg-[color:var(--glass-bg)] backdrop-blur-xl` | `bg-[color:var(--sheet-bg)]` |
| `ExportFooter.tsx` | `bg-[color:var(--glass-bg)] backdrop-blur-xl` | `bg-[color:var(--sheet-bg)]` |
| `StageControlBar.tsx` (×2, `SelectContent`) | `bg-[color:var(--glass-bg)] backdrop-blur-xl` | `bg-[color:var(--sheet-bg)]` |

`RecordingSettingsSheet.tsx` and `CaptureSidebar`'s wrapper (`bg-[#0d0d10]` in `CaptureScreen.tsx`) are repointed from their hardcoded hex to `bg-[color:var(--sheet-bg)]` too, so there is exactly one place that defines "sheet dark."

### Shared shape (`variants.ts`)

Add one constant so all bottom sheets share a silhouette instead of repeating the string:

```ts
export const captureSheetSurface =
  'bg-[color:var(--sheet-bg)] rounded-4xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)] ' +
  'data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-2.5 ' +
  'data-[vaul-drawer-direction=bottom]:right-2.5 data-[vaul-drawer-direction=bottom]:bottom-3.5';
```

Applied to `RecordingSettingsSheet` (already has this shape — just switches to the shared constant), `UpgradeSheet`, and the `ExportControls` mobile drawer (both currently flush-to-edge with no radius — they adopt the floating-inset + rounded + shadow look).

### Leftover one-off hex values

`RecordingSettingsSheet`'s `bg-[rgba(18,18,20)]` (inner radio-dot fill, matched to sheet bg for contrast) becomes `bg-[color:var(--sheet-bg)]` too, since it's the same color by a different name. Plain `white/N` or `black/N` opacity utilities elsewhere are left as-is — those are intentional alpha values, not stand-ins for a missing token.

---

## Phase 2 — CaptureSidebar overhaul

### Remove the blue button
Delete the `bg-[#3a7bf0]` "New recording" button (`CaptureSidebar.tsx:107-114`) entirely. It only calls `onClose()` today — closing the sidebar already returns to the idle capture screen where the orb starts a new recording, so no behavior is lost. The footer row (`CaptureSidebar.tsx:106-124`) keeps just the Settings button, right-aligned (`justify-end`).

### Edge-swipe to open/close
In `CaptureScreen.tsx`, the sidebar-reveal `motion.div` (currently animating `x` off the `filesOpen` boolean, toggled only by tapping the hamburger icon in `CaptureHeader`) gains:
- `drag="x"` with `dragConstraints` limiting drag-start to a ~24px zone from the left edge when closed
- `onDragEnd` with a distance/velocity threshold (reusing the existing `EASE` curve) to snap open or closed
- When open, dragging anywhere on the revealed page closes it (the existing tap-to-close overlay button stays as a fallback for non-drag taps)

### Swipe-to-delete per row
Each row in the `Recents` list (`CaptureSidebar.tsx:91-103`) gets `drag="x"` with `dragConstraints` limited to revealing a red Delete action behind it (iOS Mail-style reveal, not instant delete). Tapping Delete opens an `AlertDialog` confirmation styled like the existing `FileConfirmDialog` pattern; on confirm, calls `api.sessions.deleteSession` — the same Convex mutation `SavedAudioPanel` already used, so no backend changes are needed. `usePaginatedQuery`'s result list updates reactively once the mutation resolves.

### Cleanup
Delete `SavedAudioPanel.tsx` and `SavedAudioDialogs.tsx` (confirmed dead — zero imports anywhere in the app, only a stale comment reference in `FileConfirmDialog.tsx`). Keep `saved-audio/formatters.ts` (`CaptureSidebar` imports `formatDuration` from it).

---

## What Does Not Change

- `SavedAudioPanel`'s underlying `deleteSession`/`renameSession`/pagination logic pattern is reused conceptually in `CaptureSidebar`, but no shared component is extracted — scope stays contained to `CaptureSidebar.tsx`.
- No changes to `CaptureStage.tsx`, `CaptureDock.tsx` beyond what was already fixed in the prior session (upload pill darkening).
- No changes to desktop (`md:` and up) sheet/panel layouts — `panelCard` and the desktop inline panel in `ExportControls.tsx` are untouched; this spec is about the bottom-sheet/drawer pattern specifically.
- Landing page components, onboarding, and non-capture routes are untouched.

---

## File Changelist

| File | Change |
|---|---|
| `apps/web/src/app/globals.css` | Remove 5 dead glass tokens, remove undefined `--glass-bg` references, add `--sheet-bg` |
| `apps/web/src/lib/variants.ts` | Add `captureSheetSurface` constant |
| `apps/web/src/components/ui/Dock.tsx` | Repoint bg to `--sheet-bg`, drop blur |
| `apps/web/src/components/soul/modals/UpgradeSheet.tsx` | Repoint bg to `--sheet-bg`, adopt `captureSheetSurface` |
| `apps/web/src/components/soul/states/ExportState/ExportControls.tsx` | Repoint mobile drawer bg to `--sheet-bg`, adopt `captureSheetSurface` |
| `apps/web/src/components/soul/states/ExportState/ExportFooter.tsx` | Repoint bg to `--sheet-bg`, drop blur |
| `apps/web/src/components/soul/states/ExportState/StageControlBar.tsx` | Repoint both `SelectContent` bg to `--sheet-bg`, drop blur |
| `apps/web/src/components/soul/recording/RecordingSettingsSheet.tsx` | Adopt `captureSheetSurface`, repoint radio-dot fill to token |
| `apps/web/src/components/soul/capture/CaptureScreen.tsx` | Repoint sidebar wrapper bg to `--sheet-bg`, add `drag="x"` edge-swipe to sidebar reveal |
| `apps/web/src/components/soul/capture/CaptureSidebar.tsx` | Remove blue button, add swipe-to-delete per row + `AlertDialog` confirm + `deleteSession` mutation |
| `apps/web/src/components/saved-audio/SavedAudioPanel.tsx` | Delete (dead code) |
| `apps/web/src/components/saved-audio/SavedAudioDialogs.tsx` | Delete (dead code) |

---

## Success Criteria

- All bottom sheets (`RecordingSettingsSheet`, `UpgradeSheet`, `ExportControls` mobile drawer) share one background token and one silhouette (radius, floating inset, shadow)
- No component references an undefined CSS custom property
- No unconsumed CSS custom properties remain from the abandoned glass-material direction
- `CaptureSidebar` footer has no blue button
- Sidebar opens via edge-swipe (~24px zone) and closes via swipe-anywhere-when-open, in addition to the existing tap affordances
- Each recording row supports swipe-to-reveal-delete, with confirmation before the mutation runs
- `SavedAudioPanel.tsx` and `SavedAudioDialogs.tsx` no longer exist in the repo
- `tsc --noEmit` clean, no regressions in other components
