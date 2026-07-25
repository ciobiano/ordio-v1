# Design: Mobile Caption Style Redesign

Status: APPROVED
Branch: TBD (not yet created)
Repo: ciobiano/ordio-v1
Supersedes: none — replaces the `CaptionMode` system (`phrase`/`karaoke`/`stack`/`spotlight`) shipped ~2 months prior. Deliberately scoped as a prerequisite for "Ordio Director" (`tasks/ordio-director-v1-spec.md` §5) — Director is a separate follow-on spec that will consume this spec's presets as its style library, not built here.

## Problem Statement

The current 4 caption modes don't match the validated trending short-form caption grammar (TikTok/Instagram/Submagic/Captions-app-style) that the product's own launch spec calls out as proven caption grammar. Canvas backgrounds are limited to solid color or curated/uploaded video loops (shipped in the video-backgrounds slice) — there's no colorful, playful "Wrapped"-style option, despite that exact visual language already existing and shipping for the post-export `ShareCard` ("Wrapped for your voice"). The settings panel (`StyleControls.tsx`) is a fixed 4-tab layout that can't absorb new per-style properties (stroke, glow, per-word accent) without becoming a sprawling, always-all-visible settings dump.

## Constraints

- Mobile `/create` export screen only. Desktop `/studio` is explicitly out of scope — it already has its own future design cycle per `docs/superpowers/specs/2026-07-14-repo-structure-design.md`.
- `renderFrame()` (packages/engine/src/video/frameRenderer.ts) remains the single source of truth for both preview and export — the AGENTS.md shared-rendering rule requires new caption mechanics to plug into this same pipeline, not a parallel one.
- `CaptionGroup` (packages/engine/src/types.ts) already flows through every existing mode's drawer plus `frameRenderer.ts` and `videoEncoder.ts` — new work extends this structure additively rather than introducing a parallel segment model.
- No server-render infrastructure exists or is being built here — stays 100% client-side canvas, consistent with the video-backgrounds slice's cost-discipline decision.
- Existing tier-gate system (`apps/web/src/lib/featureGates.ts`) already gates cosmetic features by the same pattern; whether the new caption styles or gradient backgrounds are gated is deferred (see Open Questions), not decided here.

## Premises

1. Every validated trending caption style reduces to one of three reveal-timing primitives — word hard-swap, phrase hard-cut, or a static line with a moving highlight — not six bespoke mechanics. Building three reusable mechanic renderers instead of six bespoke ones means a 7th future style is a new preset-table row, not new render code.
2. `CaptionGroup`'s existing independently-owned `start`/`end` timeline-block model already provides the right granularity for phrase-chunking and per-word accent marking. No new segment data structure is needed — only additive optional fields.
3. Real caption apps hard-cut between words/phrases rather than cross-fade; overlapping staggered fades read as unfinished, instant swaps read as intentional. (Established by iterating the animated mockups during this brainstorm — the first pass used staggered fades and read as "basic.")
4. A single settings sheet whose sections morph based on the active caption style scales better than either one mega-sheet with every property always visible, or a separate sheet per style. This follows the existing `Tabs`-in-`Drawer` pattern already in `StyleControls.tsx`.
5. The colorful/playful background direction reuses `ShareCard`'s existing gradient tokens (`sunset`/`electric`/`acid-signal` — see `apps/web/src/lib/variants.ts:238`) rather than inventing a new palette, since that "Wrapped for your voice" visual language is already validated and shipping elsewhere in the product.
6. Exact background art (blob placement, grain intensity, gradient mesh detail) is intentionally left open — this spec locks the schema and integration point, not final visual polish, per an explicit product decision to design that later.

## Approaches Considered

### Rendering architecture

**Approach A (CHOSEN): Three shared mechanic renderers + a preset table.** `wordSwap`, `phraseCut`, and `staticHighlight` live in `packages/engine/src/processing/captions/`, each taking `CaptionGroup[]` plus per-style parameters. A preset table maps `captionStyleId → { mechanic, fontTreatment, stroke?, glow?, chipColor? }`. Effort: M. Reuses the entire existing `CaptionGroup`-driven render pipeline; only the mode-dispatch layer and the four existing mode files change.

**Approach B: Six bespoke renderers, one per style** (continuing today's `phrase.ts`/`karaoke.ts`/`stack.ts`/`spotlight.ts` pattern, just with two more files). Rejected: duplicates timing logic six ways, and every future style addition means writing a new renderer from scratch rather than a new table row.

**Approach C: One mega-parametrized renderer with a single large config object covering every property.** Rejected: recreates the exact "large dataset of settings" problem the settings-sheet redesign is meant to avoid, and is harder to unit test in isolation per mechanic than three small, focused renderers.

### Settings sheet

**Approach A (CHOSEN): One `Drawer`, conditional sections keyed by `captionStyleId`.** Colors/Font/Spacing/Motion stay as universal tabs (unchanged from today); a new section (Stroke, Glow, or chip color) mounts only when the active style's preset declares it needs one.

**Approach B: A separate sheet per style family.** Rejected: duplicates the universal tabs across every style-specific sheet, and directly contradicts the product requirement that this be one destination, not several.

## Recommended Approach

**A** for both: three shared mechanic renderers driven by a preset table, and one morphing `Drawer` sheet. Both minimize new render/UI surface area, reuse everything the existing `CaptionGroup`/`Tabs`/`Drawer` architecture already provides, and scale to future styles as data (a new preset row) rather than new code.

## Data Model

`packages/engine/src/types.ts`:
```typescript
export type CaptionStyleId =
  | 'word-pop'
  | 'bold-outline'
  | 'karaoke-chip'
  | 'minimal-lower-third'
  | 'big-statement'
  | 'script-accent';
// CaptionMode is removed — captionStyleId replaces it everywhere.

export interface CaptionGroup {
  wordIndices: number[];
  text: string;
  start: number;
  end: number;
  /** Indices (into wordIndices) of words rendered with the style's accent
   *  treatment (e.g. script-accent's italic+glow swap). Manually toggled by
   *  tapping a word in the caption editor; empty/absent = no accent words. */
  accentWordIndices?: number[];
}
```

`packages/engine/src/captions/presets.ts` (new):
```typescript
export type CaptionMechanic = 'word-swap' | 'phrase-cut' | 'static-highlight';

interface CaptionStylePreset {
  mechanic: CaptionMechanic;
  fontTreatment: 'plain' | 'accent-swap'; // accent-swap honors accentWordIndices
  stroke?: { defaultWidth: number; defaultColor: string };
  glow?: { defaultIntensity: number; defaultColor: string };
  chipColor?: string;
}

export const CAPTION_STYLE_PRESETS: Record<CaptionStyleId, CaptionStylePreset>;
```

Which presets use `fontTreatment: 'accent-swap'` (and what the swap looks like), per the validated mockups:

| Preset | fontTreatment | Accent visual |
|---|---|---|
| `word-pop` | accent-swap | accented word renders in the accent color (yellow in the mockup) |
| `bold-outline` | plain | no per-word accent |
| `karaoke-chip` | plain | its "active word" highlight is playback-time-driven (which word is being spoken *right now*), a separate mechanism from `accentWordIndices` (which is manually marked and static regardless of playhead position) |
| `minimal-lower-third` | plain | no per-word accent |
| `big-statement` | accent-swap | accented word renders in the accent color (red in the mockup) |
| `script-accent` | accent-swap | accented word swaps to the italic serif font + glow |

`packages/shared/src/schemas.ts`:
```typescript
export const StyleConfigSchema = z.object({
  // ...existing fields unchanged...
  captionStyleId: z.enum([
    'word-pop', 'bold-outline', 'karaoke-chip',
    'minimal-lower-third', 'big-statement', 'script-accent',
  ]),
  strokeWidth: z.number().min(0).max(8).optional(),
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  glowIntensity: z.number().min(0).max(1).optional(),
  glowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // background gains a third union member below
});

export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  z.object({ type: z.literal('video'), source: z.enum(['curated', 'custom']), assetId: z.string().min(1) }),
  z.object({
    type: z.literal('gradient'),
    variant: z.enum(['sunset', 'electric', 'acid-signal']),
    decoration: z.enum(['blob', 'grain', 'none']).optional(),
  }),
]);
```

## Components

| File | Responsibility |
|---|---|
| `packages/engine/src/types.ts` (modify) | `CaptionStyleId` replaces `CaptionMode`; `CaptionGroup.accentWordIndices` |
| `packages/shared/src/schemas.ts` (modify) | `StyleConfig` stroke/glow fields, `captionStyleId`; `BackgroundSchema` gradient variant |
| `packages/engine/src/captions/presets.ts` (create) | `CAPTION_STYLE_PRESETS` table — the single place mapping style → mechanic + defaults |
| `packages/engine/src/processing/captions/wordSwap.ts` (create) | Word hard-swap mechanic renderer |
| `packages/engine/src/processing/captions/phraseCut.ts` (create) | Phrase hard-cut mechanic renderer |
| `packages/engine/src/processing/captions/staticHighlight.ts` (create) | Static line + moving highlight mechanic renderer |
| `packages/engine/src/processing/captions/{phrase,karaoke,stack,spotlight}.ts` (delete) | Replaced by the three mechanic renderers above |
| `packages/engine/src/video/frameRenderer.ts` (modify) | Dispatches to the correct mechanic via preset lookup; composites stroke/glow; renders gradient backgrounds (canvas fill + optional blob/grain, cheaper than video compositing) |
| `packages/engine/src/backgrounds/` (modify) | Gradient variant support alongside curated/custom video, reusing `ShareCard`'s token values |
| `apps/web/src/components/soul/captions/StyleControls.tsx` (modify) | Conditional Stroke/Glow/chip-color sections keyed off `captionStyleId`, alongside unchanged Colors/Font/Spacing/Motion tabs |
| `apps/web/src/components/soul/captions/editor/CaptionEditorRow.tsx` (modify) | Tap a word to toggle it into `accentWordIndices` |
| `apps/web/src/components/soul/captions/GradientBackgroundPicker.tsx` (create) | Mirrors `BackgroundVideoPicker.tsx`'s thumbnail-strip pattern for the 3 gradient variants |
| `apps/web/src/stores/uiStore.ts`, `processingStore.ts` (modify) | `captionStyleId` replaces `captionMode`; one-time legacy-session migration mapping |

## Error Handling

- Legacy sessions carrying an old `CaptionMode` value migrate once on load via a fixed mapping (`phrase`→`minimal-lower-third`, `karaoke`→`karaoke-chip`, `spotlight`→`big-statement`, `stack`→`word-pop`) — no crash, no visual-parity guarantee, consistent with the explicit decision to let the old modes go.
- `accentWordIndices` referencing an index no longer present in `wordIndices` (e.g. after a caption-editor merge/split) is clamped/dropped at render time rather than crashing.
- Styles whose contrast comes from their own mechanism (stroke outline, chip fill) are inherently safe against any background; styles relying on plain text color get a default text-shadow/scrim baked into their preset so they don't need per-background-color tuning.
- Gradient backgrounds render as canvas fills, reusing the exact same client-side compositing path already built for solid/video backgrounds — no new export mechanism, and cheaper than the video-background streaming-decode path.

## Testing

- Unit tests per mechanic renderer: hard-cut boundaries are instantaneous (no overlap window), word-swap never shows two words simultaneously, static-highlight leaves the line's word set constant while only the highlighted index changes.
- Preset-table completeness test: every `CaptionStyleId` has a valid `CAPTION_STYLE_PRESETS` entry.
- `BackgroundSchema` gradient-variant Zod validation.
- `accentWordIndices` bounds-checking against `wordIndices`.
- Legacy `CaptionMode` → `captionStyleId` migration mapping test (deterministic, one fixed table).
- No jsdom coverage for actual canvas pixel output (same accepted limitation as the video-backgrounds slice) — verified via on-device QA: each of the 6 styles × each background type (solid/video/gradient) for legibility, stroke/glow visual correctness, accent-word tap-to-toggle behavior in the editor, and the settings sheet morphing correctly per style.

## Open Questions

- **Feature gating** for the 6 new caption styles and gradient backgrounds was not decided in this brainstorm. A reasonable default — captions stay free (they replace existing free functionality), gradient backgrounds follow the same free-preview/creator-export split already established for video backgrounds — is proposed but not committed; confirm at implementation time.
- Exact background art (specific gradient meshes, blob placement, grain intensity) is an intentional placeholder — product has stated they'll design the final visual treatment separately.
- Whether `accentWordIndices` needs a soft cap (e.g. nudging toward 1-2 accented words per phrase to avoid visual clutter) is unaddressed — no hard limit for v1, tighten later if needed.
- Whether any of the 6 styles need per-format (square/vertical/horizontal/instagram) sizing adjustments beyond what already exists is unaddressed — assume existing per-format scaling continues to apply uniformly unless QA finds otherwise.

## Success Criteria

- All sessions saved under the old `CaptionMode` system still load and render (via the migration mapping) without crashing.
- Each of the 6 new caption styles renders with non-overlapping, hard-cut/hard-swap timing matching the validated visual-companion mockups, not staggered fades.
- Tapping a word in the caption editor toggles it into `accentWordIndices`, and any style with `fontTreatment: 'accent-swap'` reflects that choice identically in preview and export.
- Selecting a gradient (`sunset`/`electric`/`acid-signal`) canvas background renders identically in preview and export, per the shared-rendering rule.
- The settings sheet shows only the section relevant to the active caption style — Stroke, Glow, or chip color never all appear simultaneously with each other.
- Once merged, this spec unblocks Ordio Director (`tasks/ordio-director-v1-spec.md` §5) to reference these 6 `captionStyleId` presets directly as its style library, rather than needing to invent style properties from scratch.

## The Assignment

Once this ships and merges, Spec B — Ordio Director — can be scoped and built on solid ground: its structured-output LLM call picks from real, shipped `captionStyleId` presets (with light per-look overrides, per the earlier Director scoping discussion) instead of needing placeholder style data.
