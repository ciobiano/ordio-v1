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

### Task 3: Unify the design tokens into one concern-split system ✅ DONE 2026-08-20

Three files (1,128 lines, 57 exports) became one system of seven concern files
(1,045 lines, 51 exports). `lib/variants.ts`, `lib/ordioVariants.ts` and
`lib/desktop/deskVariants.ts` are gone; `@/lib/variants` now resolves to the folder.

| File | Exports | Lines |
|---|---|---|
| `variants/typography.ts` | 8 | 96 |
| `variants/prose.ts` | 5 | 138 |
| `variants/buttons.ts` | 10 | 314 |
| `variants/capture.ts` | 6 | 78 |
| `variants/surfaces.ts` | 6 | 86 |
| `variants/controls.ts` | 11 | 253 |
| `variants/brand.ts` | 5 | 80 |

- [x] Inventory every export by real usage
- [x] Delete 9 exports with zero consumers — `brandBorder`, `acidBody`, `acidStat`,
      `acidSurface`, `acidCta`, `gradientSwatch`, plus the whole superseded pre-acid
      type generation: `heading`, `eyebrow`, `body`
- [x] Group survivors by concern, all files under the 400-line ceiling
- [x] Swap 7 hardcoded px type sizes for their exact tokens
- [x] Repoint 28 importing files, delete the three originals
- [x] `tsc` clean · 485/485 tests · `next build` green

**The first dead-code sweep used bare word matching and was wrong.** Counting `\bbody\b`
across the tree scores `document.body`, request bodies and prose, so `body` looked like it
had 105 consumers. Parsing actual `import { … } from '@/lib/variants'` statements instead
showed `heading`, `eyebrow` and `body` are imported **nowhere**. They are the pre-acid type
scale, superseded by `acidHeading` / `acidEyebrow` and the `--text-acid-*` roles that
DESIGN.md §Type actually specifies. **Survey exports by parsing imports, never by grepping
the symbol name** — the same lesson Task 1 taught about comments.

Deleting them removes the `heading`/`acidHeading` and `eyebrow`/`acidEyebrow` collisions,
which means dropping the `acid` prefix is now a mechanical rename rather than a visual
decision. Worth doing as its own pass.

**The "three palettes" worry was overstated, and the code says so.** `ord-tokens.css`
already aliases every `--ord-*` name onto `--acid-*`, and `globals.css` defines 93
`--acid-*` tokens against zero `--ord-*` ones. The three files were three *CVA files*
over one shared token layer, not three palettes. The `acid*` / `ord*` prefixes record
which design pass a variant arrived in. **Dropping the prefixes is not mechanical** —
`heading` and `acidHeading` both exist and render differently, so choosing a survivor
is a visual decision. Left alone deliberately.

**Verified no visual change by diffing class strings, not by eye.** Every one of the
51 surviving exports was compared against its committed original with comments and
whitespace normalised: 45 byte-identical, 6 differing only by the exact px→token swaps
(`--text-body-lg` 17px, `--text-body` 15px, `--text-caption` 13px, `--text-footnote`
11px — each equal to the literal it replaced). Zero unexplained differences.

**Browser check blocked, not skipped.** The dev server serves a blank page because
`.env.local` holds *production* Clerk keys, which refuse any origin but `ordio.space`.
That is an environment limit, unrelated to this work, and sourcing development
credentials is not something to do on the user's behalf. The class-string diff is
stronger evidence than a screenshot would have been, but a human should still load
`/create` at both widths once before this ships.

**Step 4 was overstated in the original plan.** It called for fixing "the arbitrary
values". There are 223 in the new files: **146 are `var(--token)`-backed** and already
satisfy the rule's intent. Of the 77 literals, most are one-off geometry
(`translate-y-[3px]` for the sticker press, `w-[22px]` for an icon) that would become
noise as tokens. Only the 7 type sizes had exact token equivalents, and only those
were changed.

**Two colour findings left alone, on purpose:**
- `surfaces.ts` has `bg-[#0a0a0a]` while `--acid-bg-base` is `#0a0b0a`. One green-channel
  unit apart — almost certainly drift, but swapping it changes pixels, which this pass
  forbids.
- `controls.ts` and `surfaces.ts` use five white washes (`bg-white/[0.05]`, `[0.07]`,
  `[0.08]`, `[0.10]`, `[0.18]`). They form an implicit elevation scale that has never
  been named. Worth tokenising as a deliberate scale, not as a find-and-replace.

**Bug found: `--text-callout` does not exist.** `ExportFooter.tsx` and
`ExportOverlay.tsx` both size alert text with `text-[length:var(--text-callout)]`. No
such token is defined anywhere, so both alerts silently render at inherited size. The
type scale runs body-lg/body/body-sm/caption/footnote with no callout. Root cause is
the `body` CVA — see Task 5.

---

### Task 5: Give the export-screen alerts a real type role — OPEN

`ExportFooter.tsx` and `ExportOverlay.tsx` size their alert text with
`text-[length:var(--text-callout)]`. **No such token exists in either scale**, so both
alerts silently fall back to inherited size.

`--text-callout` was presumably reaching for the broken `body` CVA's scale, where
`default` and `sm` were both `text-sm` and `caption` and `footnote` were both `text-xs`.
That CVA is now deleted, so the fix is to pick a real ACID role from DESIGN.md §Type:
`body` (15→17px), `label` (13→14px), `caption` (12→13px) or `footnote` (11→12px).

- [ ] Choose the role (`TODO(human)` in `ExportFooter.tsx`)
- [ ] Apply the same choice to `ExportOverlay.tsx:111`
- [ ] Verify: `tsc`, tests, and a look at the export screen

---

### Task 4: Update the documentation ✅ DONE 2026-08-20

- [x] `DESIGN.md` repointed at `lib/variants/` in both places it named the old files
- [x] `docs/superpowers/PATHS-MOVED.md` added — one old→new mapping table
- [x] Dated specs and plans left unedited. They record designs as built; rewriting
      their paths would falsify the record. The mapping table covers them.

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
