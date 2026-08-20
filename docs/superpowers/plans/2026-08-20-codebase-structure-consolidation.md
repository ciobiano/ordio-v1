# Codebase Structure Consolidation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ordio's directory structure and design-token system tell the truth. Delete the
unreachable `/studio` component tree, rename folders so their names match what they contain,
and collapse three parallel design-token files into one system split by concern — without
changing any rendered output.

**Architecture:** Three independent passes, safest first. Pass 1 deletes dead code (no live
consumer, therefore zero behavioural risk). Pass 2 is pure rename plus import rewriting. Pass 3
merges `variants.ts`, `ordioVariants.ts` and `desk/deskVariants.ts` into `lib/variants/*.ts`
split by concern, keeping every exported class string byte-identical so that no pixel moves.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind, CVA, Zustand, Vitest, Playwright.

## Global Constraints

- **No visual change.** Every CVA output string is preserved exactly. This is a structural
  refactor; if a screenshot differs, the refactor is wrong.
- **Mobile and Desktop remain separate implementations** (ADR 0001). Do not attempt to merge
  duplicated components such as the two `TrimPanel`s. That is explicitly out of scope.
- **The Style system is shared across both.** Design tokens are the one thing that must *not*
  be split by viewport.
- Follow `CONTEXT.md` for naming. `soul`, `desk` and `studio` are retired words.
- Respect the repo's file-size discipline: aim for 100–300 lines, 400 is the ceiling.
- Run the full test suite once at the end of each pass, not per file.

---

### Task 1: Delete the unreachable Studio tree ✅ DONE 2026-08-20

`app/studio/page.tsx` is a 307 redirect to `/create`. Nothing linked to `/studio`.

**Deleted (26 files):**
- All 9 of `apps/web/src/components/studio/` — `CenterStage`, `CommandPalette`, `LeftRail`,
  `PromptBar`, `RightInspector`, `StudioDesk`, `StudioExportBody`, `TimelineStrip`, `TopBar`
- `apps/web/src/lib/studioVariants.ts`
- `apps/web/src/hooks/studio/useStudioFlow.ts`, `useStudioEdits.ts`, `useMicDevices.ts`
- 11 test files

**Kept:** `app/studio/page.tsx` (the redirect), `hooks/studio/useSessionHydration.ts` and its
test — the hook's live consumer is `components/desk/DeskShell.tsx:52`.

- [x] Delete the components, variants file and orphaned hooks
- [x] Delete the 11 test files
- [x] Repair three comments that referenced the deleted hooks
- [x] `tsc --noEmit` clean
- [x] Full suite green — 485/485

**⚠️ Correction made during execution.** This plan originally listed `useMicDevices.ts` as
dead and the three other `hooks/studio/` hooks as live. Both halves were wrong, because the
survey used a filename grep that matched *prose comments* rather than import statements:

- `useMicDevices` was **not** dead — `useStudioFlow` used it to pick the recording input device.
- `useStudioFlow` and `useStudioEdits` were **not** live — their apparent consumers
  (`MobileCaptureFlow.tsx`, `lib/episodeRouting.ts`, `soul/editor/TrimPanel.tsx`) only mentioned
  them in comments. `MobileCaptureFlow` uses `useCreateFlow`.

Once the Studio components went, all three hooks became unreachable together and were removed
as one cascade. **When surveying for dead code in the remaining tasks, grep by module path
(`@/hooks/...`), never by symbol name.**

**Finding left for Task 3.** `soul/editor/TrimPanel.tsx` still declares `onUndo`, `onRedo`,
`canUndo` and `canRedo`. Its only caller (`ExportState/ExportControls.tsx:179`) passes none of
them, and the desktop editor uses its own `desk/inspector/TrimPanel.tsx`. These four props are
now dead.

---

### Task 2: Rename folders to match their contents ✅ DONE 2026-08-20

Pure rename plus import rewriting. No logic changes.

**Renames:**

| From | To | Why |
|---|---|---|
| `components/soul/` | `components/mobile/` | It is the mobile implementation |
| `components/desk/` | `components/desktop/` | It is the desktop implementation |
| `components/primitives/` | `components/media/` | Contains canvas/WebGL/waveform, not primitives |
| `hooks/studio/` | `hooks/session/` | Its three surviving hooks serve both implementations |
| `lib/desk/` | `lib/desktop/` | Follows the component rename |

- [x] Rename `components/primitives/` → `components/media/`
- [x] Rename `hooks/studio/` → `hooks/session/`
- [x] Rename `components/soul/` → `components/mobile/`
- [x] Rename `components/desk/` → `components/desktop/`
- [x] Rename `lib/desk/` → `lib/desktop/`
- [x] Rename `mobile/captions/style/primitives/` → `controls/` — added during execution, because
      the committed glossary retires "primitive" and this nested folder would have contradicted it
- [x] 104 alias specifiers rewritten across 53 files, plus 8 files for the nested rename
- [x] `tsc --noEmit` clean · 485/485 tests · `next build` succeeds, all routes present

**Trap hit during execution.** The alias rewrite (`@/components/...`) missed a *relative* import:
`components/NavigationTransition.tsx` imported `./primitives/overlay/TransitionOverlay`. `tsc`
caught it. Meanwhile 16 `../primitives/` imports under `mobile/captions/style/tabs/` pointed at a
**different, unrenamed** `primitives` folder and correctly needed no change at that moment.
**A folder rename must sweep relative imports as well as aliased ones, and must confirm which
folder a relative path actually resolves to.**

`components/ui/` keeps its name and contents — it holds generic interface atoms and is
correctly named already.

---

### Task 3: Unify the design tokens into one concern-split system

Three token files totalling 1,128 lines currently coexist with three different prefixes
(bare, `acid*`, `ord*`, plus `deskVariants`'s unprefixed exports). Collapse them into one
system, organised by concern rather than by viewport or vintage.

**Files:**
- Read: `lib/variants.ts` (618 lines, 35 exports — two generations: legacy and `acid*`)
- Read: `lib/ordioVariants.ts` (302 lines, 14 exports, `ord*`)
- Read: `lib/desktop/deskVariants.ts` (208 lines, 7 exports)
- Create: `lib/variants/typography.ts`, `buttons.ts`, `surfaces.ts`, `controls.ts`,
  `brand.ts`, `prose.ts`, `index.ts` (exact split to be confirmed against the real exports)
- Delete: the three original files once every import is migrated

- [ ] **Step 1: Inventory every export across the three files** and record which are
      genuinely duplicated, which are viewport-specific, and which legacy exports
      (`primaryBtn`, `heading`, `eyebrow`, `body`, `brandBorder`) still have live consumers
- [ ] **Step 2: Delete legacy exports with no live consumers**
- [ ] **Step 3: Group the survivors by concern** and write the new `lib/variants/*.ts` files,
      preserving each class string byte-for-byte
- [ ] **Step 4: Fix the arbitrary values** that `ordioVariants.ts` currently ships —
      `bg-white/[0.07]`, `text-[13px]`, `bg-[color:var(--acid-bg-base)]` — by promoting them
      to design tokens in `globals.css`. The file that exists to keep arbitrary values out of
      JSX should not itself contain them.
- [ ] **Step 5: Rewrite all imports**, delete the three original files
- [ ] **Step 6: `pnpm type-check && pnpm test && pnpm build`**
- [ ] **Step 7: Visual check** — load `/create` at mobile and desktop widths and compare
      against `main`. Nothing should have moved.

⚠️ **Watch for the CVA variant key order trap.** Later-declared variant keys win under
tailwind-merge. Reordering keys during the merge is not a no-op and can silently change
rendering.

---

### Task 4: Update the documentation

- [ ] **Step 1: Update `CONTEXT.md`** if any term shifted during implementation
- [ ] **Step 2: Update `README.md`** and any `agent_docs/` file-map that names the old folders
- [ ] **Step 3: Grep `docs/superpowers/specs/` for `soul`, `desk`, `studio`** and add a note to
      any spec whose paths are now stale, rather than rewriting history

---

## Out of scope

Recorded so they are not re-litigated:

- **Merging the Mobile and Desktop implementations.** Rejected in ADR 0001.
- **Web Workers for media encoding** and **XState.** The only two unbuilt items from the
  deleted `docs/improvements.md`. Both are justified by concurrency and scale; Ordio is a
  portfolio piece and neither earns its cost.
- **The transcription word-timing fallback** at `app/api/transcribe/route.ts:231`, which emits
  the entire transcript as a single `Word` spanning the whole recording. Real, but a
  correctness bug rather than a structural one — it deserves its own investigation.
