# Design: Video Backgrounds (Design Slice 4)

Status: APPROVED
Branch: feature/video-backgrounds (to be created)
Repo: ciobiano/ordio-v1
Supersedes: none — implements slice 4 from `~/.gstack/projects/ciobiano-ordio-v1/bg_ralph-main-design-20260710-081415.md`, deferred out of the clip-finder-wedge PR (#11)

## Problem Statement

The approved Ordio re-scored design doc scores video backgrounds 7/10 ("KEEP — top render priority") and states flat-color waveform exports are a declining format — "video backgrounds is survival, not polish" (premise 1). The design's build order also says the founder's 5-podcaster user test should include this feature, not flat-color-only exports. This PR was deliberately deferred out of the clip-finder-wedge implementation (which shipped slices 0-3 only) and is now being built as its own slice before that user test runs.

## Constraints

- Existing render pipeline: `renderFrame()` (apps/web/src/lib/video/frameRenderer.ts) is the single source of truth for both preview (client canvas) and export (client-side WebCodecs/ffmpeg.wasm) — the project's AGENTS.md shared-rendering rule requires preview and export to visually match, enforced by compositing inside this same function.
- No server-render infrastructure exists yet and none is being built here — export stays 100% client-side, consistent with the clip-finder wedge's cost-discipline decision.
- Existing tier-gate system (`apps/web/src/lib/featureGates.ts`) already gates cosmetic features (fonts, waveform styles, layouts) behind `'creator'`; video backgrounds follows the same pattern.
- Existing static-asset-loader pattern (`apps/web/src/lib/loaders/graphicLoader.ts`) already caches lazy-loaded images from `public/`; the video loader mirrors this shape for videos.
- Mobile-first, data-cost-sensitive target users (per the clip-finder wedge's ICP research) — loop assets must stay small (≤10s, ≤1MB, low-bitrate 720p) and load lazily, only when selected.
- Memory-safety discipline established in the clip-finder wedge (never hold more than one decoded frame/window alive at once) carries over to the export compositing loop.

## Premises

1. Preview and export must visually match — no divergence between what the user sees while editing and what they get in the final file.
2. Free users must be able to *see* video backgrounds in preview (desire-driver, matches the original spec's "free previews it, lock on export"); only export is tier-gated.
3. A small, real starter library (2-3 loops) that's easy to expand later beats blocking this slice on sourcing a full 8-12 library up front.
4. Safari/no-WebCodecs users get a visibly-disabled option, not a silent gap or a broken preview/export mismatch.

## Approaches Considered

### Approach A: Client-side stream-composite (CHOSEN)
Preview via CSS `<video>` layer behind the canvas; export via WebCodecs `VideoDecoder` compositing one background frame per output frame inside `renderFrame()`, streamed and discarded (never pre-extracted). Effort: M. Risk: Low-Med (new WebCodecs usage, but the clip-finder wedge already proved this streaming-decode pattern works in this codebase). Reuses: `renderFrame()`, `featureGates.ts`, the `graphicLoader.ts` caching pattern, `renderFrame`'s existing composite order.

### Approach B: Server-render export (deferred)
Matches the *original* v1 spec's "paid/server only" export restriction, using headless canvas + ffmpeg server-side. Rejected for this slice: requires building the server-render spine (`renderJobs`, Modal worker) that the re-scored design doc explicitly deferred — would reopen scope the founder already cut.

### Approach C: Pre-baked GIF/APNG loop overlay instead of video
Simpler compositing (no WebCodecs, just draw an image sequence). Rejected: worse visual quality and larger file sizes than H.264 video for the same duration, and doesn't reuse the frame-streaming pattern already validated in this codebase.

## Recommended Approach

**A**, because it requires no new infrastructure beyond what the clip-finder wedge already proved works (streaming WebCodecs decode/discard), keeps cost at zero (fully client-side), and satisfies the design's premise that preview and export must match exactly.

## Data Model

`packages/shared/src/schemas.ts`:
```typescript
export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  z.object({ type: z.literal('video'), assetId: z.string() }),
]);
export type Background = z.infer<typeof BackgroundSchema>;
```
`StyleConfig.background?: BackgroundSchema` — optional and additive. `StyleConfig.backgroundColor` (existing) stays as-is for back-compat; when `background` is absent, rendering code falls back to reading `backgroundColor` as an implicit `{ type: 'solid', color: backgroundColor }`. No Convex schema changes — this lives inside the existing JSON `styleSnapshot`.

## Asset Library

- `apps/web/public/backgrounds/*.mp4` — 2-3 starter loops, real CC0/no-attribution-required-license footage (Pexels/Mixkit/Coverr — whichever source has usable ≤10s abstract/gradient/texture clips), transcoded via `ffmpeg` to ≤10s, ≤1MB, low-bitrate 720p H.264.
- `apps/web/public/backgrounds/*-thumb.jpg` — poster frame per loop, for the picker (avoids loading full video for a thumbnail).
- `apps/web/src/lib/backgrounds/backgroundLibrary.ts` — a `BACKGROUND_LIBRARY: BackgroundAsset[]` manifest (`{ id, label, videoPath, thumbPath }`), the single source of truth the loader and picker both read from. Expanding to 8-12 loops later is purely adding manifest entries + files.

## Components

| File | Responsibility |
|---|---|
| `packages/shared/src/schemas.ts` (modify) | `BackgroundSchema`, `StyleConfig.background` |
| `apps/web/src/lib/backgrounds/backgroundLibrary.ts` (create) | Asset manifest |
| `apps/web/src/lib/loaders/backgroundLoader.ts` (create) | Lazy-load + cache `HTMLVideoElement`s by assetId, mirrors `graphicLoader.ts` |
| `apps/web/src/lib/video/frameRenderer.ts` (modify) | `renderFrame()` composites background before waveform/captions: solid fill (existing) or a pre-supplied decoded video frame (new param) |
| `apps/web/src/lib/video/videoEncoder.ts` (modify) | Export loop: WebCodecs `VideoDecoder` streams background frames in lockstep with the output encode loop, one `VideoFrame` alive at a time, closed immediately after draw; re-loops the decoder at background-loop end to cover full clip duration |
| `apps/web/src/components/soul/captions/StyleControls.tsx` (modify) | New thumbnail-strip row beside the existing "Background" `ColorRow`; selecting a thumbnail sets `background: {type:'video', assetId}`, selecting a color reverts to solid |
| `apps/web/src/lib/featureGates.ts` (modify) | New `FeatureKey: 'background_video'` gated at `'creator'` |
| `apps/web/src/components/primitives/video/CanvasPreview.tsx` (modify) | CSS `<video>` layer behind the canvas when `background.type === 'video'` |

## Error Handling

- Video asset fails to load (404, decode error) in the picker → that thumbnail shows an unavailable state; if it was already selected, the session falls back to the last solid color (or a default) rather than a broken preview.
- WebCodecs unavailable at export time (Safari) → picker disables video thumbnails with a "not supported on this browser" badge (visible, not hidden); if a `background.type === 'video'` somehow reaches export on this path (e.g. imported from another session), export silently substitutes a solid fallback rather than crashing.
- Free-tier user attempts to export with a video background selected → existing `setUpgradeTarget` upgrade-prompt pattern fires, matching every other gated feature's export-time behavior.

## Testing

- Unit tests: `BackgroundSchema` validation, `BACKGROUND_LIBRARY` manifest lookup, `tierHasAccess` gate check for the new `background_video` key.
- No jsdom coverage for the WebCodecs streaming composite itself (same accepted limitation as the clip-finder wedge's `episodeIngest.ts`) — verified via on-device QA before merge: preview/export visual match, Safari fallback, free-tier export upgrade prompt, asset-load-failure fallback.

## Open Questions

- Exact CC0/free-license source and specific clips for the 2-3 starter loops — resolved at implementation time (a task in the plan sources and transcodes real files, not placeholders).
- Whether `background_video` export-lock should apply per-export or per-session (i.e., can a free user "unlock" it by paying then re-export the same session) — defer to existing `setUpgradeTarget` conventions, no new decision needed unless those conventions don't already cover it.

## Success Criteria

- A free user can preview any starter loop live in the editor.
- A free user attempting export with a video background sees the existing upgrade prompt, not a broken export.
- A creator-tier user's exported MP4 visually matches their preview exactly (loop timing, no frame drops/artifacts) for a clip longer than one loop duration (proves re-looping works).
- Safari users see disabled-not-hidden video options and can still export solid-color sessions normally.

## The Assignment

Once this ships and merges, the founder's 5-podcaster user test (from the clip-finder wedge design's "The Assignment") is unblocked — testers will see video backgrounds, satisfying the design's requirement that they test the feature the founder scored highest, not flat-color-only exports.
