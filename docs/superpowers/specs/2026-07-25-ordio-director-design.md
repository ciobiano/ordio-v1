# Design: Ordio Director

Status: APPROVED
Branch: TBD (not yet created)
Repo: ciobiano/ordio-v1
Supersedes: none — implements Feature 3 from `tasks/ordio-director-v1-spec.md` §5 ("Ordio Director + Hook Card"). Builds directly on `docs/superpowers/specs/2026-07-25-caption-style-redesign-design.md`, which shipped the 6 caption styles, stroke/glow fields, gradient backgrounds, and `CaptionGroup.accentWordIndices` this spec assumes exist.

## Problem Statement

Every session currently requires manually configuring ~8-10 independent aesthetic decisions (caption style, font, colors, background, spacing) before it's shareable. Director removes that friction: an LLM call generates 3 complete, tailored looks from the transcript, so the manual panel becomes optional polish instead of a mandatory first step. Hook Card additionally renders the opening phrase — the part that decides survival in the first 0.5s of a short-form video — with extra visual weight.

## Constraints

- Mobile `/create` export screen only — desktop `/studio` is out of scope, same boundary as the caption-style redesign.
- No server-render infrastructure exists — the "3 thumbnails rendered client-side via existing `renderFrame`" requirement from the original spec is satisfied for free by the same client-side canvas pipeline every other preview already uses.
- No Convex schema support for session-scoped caching exists yet (`sessions` has no `audioHash`/`styleSnapshot` fields) — this spec does not add any, per the caching decision below.
- Must build on the real primitives shipped in the caption-style redesign: `CAPTION_STYLE_PRESETS` (6 styles), `StyleConfig` (captionStyleId, strokeWidth/Color, glowIntensity/Color, background), and `CaptionGroup.accentWordIndices` — not invent parallel ones.

## Premises

1. A "look" is a full `StyleConfig` bundle (caption style + font + colors + background), not just a caption style ID. Without a curated library of hand-tuned bundles, Director's 3 looks would just be the same 6 raw styles with generic default colors — the differentiated, tailored feel the original spec wanted requires real curated presets.
2. Constraining the LLM to pick a preset ID (plus small bounded overrides) rather than generating a full `StyleConfig` from scratch keeps hallucination risk low (mostly enum selection) while still letting each look feel tailored to what was said.
3. Hook Card is cheaper and more consistent as a scale boost applied on top of whichever caption style is active, rather than a 7th distinct visual treatment — it inherits the user's chosen aesthetic instead of fighting it, and needs only one new field (`CaptionGroup.role`) plus one conditional per mechanic renderer rather than new render code.
4. Session-only client-side caching (Zustand) satisfies "cached per session" without new Convex infrastructure — reasonable since no cache-friendly session fields exist yet, and adding them is out of scope for this spec.
5. On-demand generation (a "Direct it" button) is required because Zero-Wait streaming transcription (spec's P2, not yet built) is the only thing that would make auto-run-on-completion feel instant rather than like an unexpected delay.

## Approaches Considered

### Look generation

**Approach A (CHOSEN): Hybrid — LLM picks a preset ID + light overrides.** `POST /api/direct` returns 3 `{ presetId, overrides?, hookGroupIndex }` objects; the client resolves each into a full `StyleConfig` by merging the preset's base style with the overrides. Effort: M.

**Approach B: Fully generative.** LLM constructs a complete `StyleConfig` from scratch per look. Rejected: larger hallucination surface, no reuse of curated design work, and looks stop feeling "hand-tuned."

**Approach C: Constrained selection only (no overrides).** LLM just returns 3 preset IDs verbatim. Rejected: cheapest but the looks never feel tailored to what was actually said — no personalization signal survives.

### Hook Card

**Approach A (CHOSEN): Scale boost read off `CaptionGroup.role`.** Each mechanic renderer scales its output ~1.4x when the active group's `role === 'hook'`. Reuses 100% of existing render code.

**Approach B: A dedicated 7th caption style/mechanic for hooks.** Rejected: doubles the design and maintenance surface for a treatment that should inherit the user's chosen look, not override it.

## Recommended Approach

**A** for both — hybrid preset+override generation and a scale-boost Hook Card. Both reuse the caption-style redesign's real primitives directly rather than inventing parallel systems, and keep the LLM's job narrow (mostly enum/bounded-range selection) which is what keeps structured-output validation reliable.

## Data Model

`packages/engine/src/captions/lookPresets.ts` (new) — 8 curated look presets, each a `Partial<StyleConfig>` bundling a caption style with a hand-picked font/color/background:

| Preset ID | Caption style | Font | Background |
|---|---|---|---|
| `neon-pop` | word-pop | Space Grotesk | acid-signal gradient |
| `street-bold` | bold-outline | Montserrat | solid black |
| `sunset-karaoke` | karaoke-chip | Poppins | sunset gradient |
| `clean-minimal` | minimal-lower-third | Inter | solid dark |
| `bold-statement` | big-statement | Outfit | electric gradient |
| `editorial-script` | script-accent | Lora (+ Playfair accent, already the preset's default) | solid black |
| `warm-pop` | word-pop | DM Sans | sunset gradient |
| `electric-outline` | bold-outline | Space Grotesk | electric gradient |

```typescript
export const LOOK_PRESETS: Record<string, { label: string; style: Partial<StyleConfig> }>;
```

`packages/engine/src/types.ts` — `CaptionGroup` gains:
```typescript
export interface CaptionGroup {
  // ...existing fields...
  /** Marks this group for the Hook Card scale boost. At most one group per session should carry 'hook'; absent/'body' renders normally. */
  role?: 'hook' | 'body';
}
```

`apps/web/src/lib/director/schemas.ts` (new) — the LLM's structured-output contract, validated with `zodResponseFormat`:
```typescript
export const DirectorLookResponseSchema = z.object({
  presetId: z.enum([/* the 8 LOOK_PRESETS keys */]),
  overrides: z.object({
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }).optional(),
  hookGroupIndex: z.number().int().min(0),
});
export const DirectorResponseSchema = z.object({
  looks: z.array(DirectorLookResponseSchema).length(3),
});
```

`apps/web/src/stores/directorStore.ts` (new) — resolved, session-only state:
```typescript
interface DirectorLook {
  presetId: string;
  style: StyleConfig; // preset base + overrides merged
  hookGroupIndex: number;
}
interface DirectorState {
  looks: DirectorLook[] | null;
  isGenerating: boolean;
  error: string | null;
  generateLooks: () => Promise<void>; // POST /api/direct, resolves into `looks`
  reroll: () => Promise<void>;        // same as generateLooks — always a fresh call, no batch pre-fetch
  applyLook: (index: number) => void; // sets style; clears role on every group, then marks only captionGroups[hookGroupIndex] as 'hook' — guarantees at most one hook group even across reroll+reapply
}
```
Not persisted (no `persist` middleware) — looks live for the current tab session only, matching the "cached per session, no new backend" decision.

## Components

| File | Responsibility |
|---|---|
| `packages/engine/src/captions/lookPresets.ts` (create) | `LOOK_PRESETS` — the 8 curated bundles |
| `packages/engine/src/types.ts` (modify) | `CaptionGroup.role` |
| `packages/engine/src/processing/captions/{wordSwap,phraseCut,staticHighlight}.ts` (modify) | One conditional each: scale ~1.4x when the active group's `role === 'hook'` |
| `apps/web/src/app/api/direct/route.ts` (create) | Mirrors `/api/transcribe/route.ts`'s lazy-init OpenAI client pattern; takes transcript + format, returns `DirectorResponseSchema`-validated JSON via `zodResponseFormat` |
| `apps/web/src/lib/director/schemas.ts` (create) | `DirectorLookResponseSchema` / `DirectorResponseSchema` |
| `apps/web/src/stores/directorStore.ts` (create) | Session-only `looks`/`isGenerating`/`error` state, `generateLooks`/`reroll`/`applyLook` |
| `apps/web/src/components/soul/captions/DirectorSheet.tsx` (create) | `Drawer`-based bottom sheet (reuses the Dock+Modal restructure's `Drawer`), large real live-preview cards first, `LOOK_PRESETS` below in the same scroll |
| `apps/web/src/components/soul/captions/DirectorLookCard.tsx` (create) | One live-preview card — renders the actual canvas via `renderFrame()` with that look's `StyleConfig`, matching the "real content, not thumbnails" direction from the visual-companion pass |
| `apps/web/src/components/soul/states/ExportState/ExportControls.tsx` (modify) | New Dock item ("Direct it") opens `DirectorSheet` — reuses the same Dock the ExportControls restructure (`tasks/todo.md`) already wired for mobile |

## Error Handling

- `/api/direct` network/timeout failure or `DirectorResponseSchema` validation failure → toast error, no partial look ever applied, `directorStore.error` set so the sheet can show a retry state.
- Empty or very short transcript (nothing to analyze) → "Direct it" disabled with a hint, no call made.
- Free tier: only `looks[0]` auto-applies; looks 1-2 and reroll show behind the existing `LockBadge`/`setUpgradeTarget('director_reroll')` pattern already used for every other creator-gated control.
- Applying a look sets `captionGroups[hookGroupIndex].role = 'hook'` directly — if a user later manually splits/merges that group in the caption editor, `role` isn't re-validated or migrated onto the resulting group(s). Accepted edge case, not solved here (see Open Questions).

## Testing

- `LOOK_PRESETS` completeness: exactly 8 entries, each referencing a valid `CaptionStyleId` and valid hex colors.
- `DirectorResponseSchema` validation: accepts a well-formed 3-look response, rejects wrong look count, unknown `presetId`, malformed colors, negative `hookGroupIndex`.
- Hook Card scale boost: unit test per mechanic renderer — a group with `role: 'hook'` renders at the boosted scale, a `role: 'body'`/undefined group does not.
- `directorStore`: `generateLooks` success populates `looks`; a rejected/invalid response sets `error` and leaves `looks` untouched (never a partial apply); `reroll` always issues a fresh call rather than reading a cache; `applyLook` sets both `style` and the correct group's `role`.
- No integration test against the real OpenAI call (mocked) — consistent with how `/api/transcribe` isn't tested against the live Whisper API either.

## Open Questions

- `CaptionGroup.role` surviving manual split/merge edits after a look is applied is unaddressed — acceptable for v1, revisit if it causes visible bugs in practice.
- Whether `director_reroll` should be its own `FeatureKey` or reuse an existing one — not decided, pick at implementation time following the existing `featureGates.ts` conventions.
- Exact OpenAI model for `/api/direct` is deferred to implementation time (a small/cheap chat model with structured-output support, matching the cost-consciousness of the existing `whisper-1` choice for transcription) rather than committed to a specific model string here.

## Success Criteria

- Tapping "Direct it" with a valid transcript produces 3 live-preview cards, each a real canvas render of a distinct `StyleConfig`, not a static thumbnail.
- Free tier: look 1 auto-applies with zero configuration; looks 2-3 and reroll show the existing upgrade prompt.
- Applying any look updates both the style and correctly marks the hook group; that group visibly renders larger in preview and export, in the same visual style as the rest of the video.
- A malformed or failed LLM response never applies a broken/partial look — the user sees a retry state instead.
