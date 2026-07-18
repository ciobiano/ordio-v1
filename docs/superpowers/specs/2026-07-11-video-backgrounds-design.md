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
2. Free users must be able to *see* curated video backgrounds in preview (desire-driver, matches the original spec's "free previews it, lock on export"); only export is tier-gated.
3. A small, real starter library (2-3 loops) that's easy to expand later beats blocking this slice on sourcing a full 8-12 library up front.
4. Safari/no-WebCodecs users get a visibly-disabled option, not a silent gap or a broken preview/export mismatch.
5. Users can upload their own background video, not just pick from the curated library (per the original v1 spec's "curated library or user upload"). Uploads are transcoded client-side to the exact same size/format spec as curated assets (≤10s, ≤1MB, low-bitrate H.264) — one decode pipeline for export, no matter the source.
6. Custom uploads carry real storage cost the curated library doesn't, so the whole upload feature (not just export) is creator-gated — asymmetric from curated backgrounds, which free users can at least preview.

## Approaches Considered

### Approach A: Client-side stream-composite (CHOSEN)
Preview via CSS `<video>` layer behind the canvas; export via WebCodecs `VideoDecoder` compositing one background frame per output frame inside `renderFrame()`, streamed and discarded (never pre-extracted). Effort: M. Risk: Low-Med (new WebCodecs usage, but the clip-finder wedge already proved this streaming-decode pattern works in this codebase). Reuses: `renderFrame()`, `featureGates.ts`, the `graphicLoader.ts` caching pattern, `renderFrame`'s existing composite order.

### Approach B: Server-render export (deferred)
Matches the *original* v1 spec's "paid/server only" export restriction, using headless canvas + ffmpeg server-side. Rejected for this slice: requires building the server-render spine (`renderJobs`, Modal worker) that the re-scored design doc explicitly deferred — would reopen scope the founder already cut.

### Approach C: Pre-baked GIF/APNG loop overlay instead of video
Simpler compositing (no WebCodecs, just draw an image sequence). Rejected: worse visual quality and larger file sizes than H.264 video for the same duration, and doesn't reuse the frame-streaming pattern already validated in this codebase.

### Approach D: Animated WebP for storage/compositing (considered for user uploads, rejected)
Convert uploaded backgrounds to animated WebP instead of transcoding to H.264. Rejected: WebCodecs `VideoDecoder` (the export compositing mechanism) cannot decode WebP — it's an image format, not a video container. Using it would require a second, entirely separate decode path just for this one asset source, diverging from the curated library's format and adding real complexity for a problem (file size) that client-side H.264 transcoding to the existing size budget already solves.

## Recommended Approach

**A**, because it requires no new infrastructure beyond what the clip-finder wedge already proved works (streaming WebCodecs decode/discard), keeps cost at zero (fully client-side), and satisfies the design's premise that preview and export must match exactly.

## Data Model

`packages/shared/src/schemas.ts`:
```typescript
export const BackgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  z.object({
    type: z.literal('video'),
    source: z.enum(['curated', 'custom']),
    assetId: z.string(), // curated: BACKGROUND_LIBRARY id · custom: backgroundAssets Convex _id
  }),
]);
export type Background = z.infer<typeof BackgroundSchema>;
```
`StyleConfig.background?: BackgroundSchema` — optional and additive. `StyleConfig.backgroundColor` (existing) stays as-is for back-compat; when `background` is absent, rendering code falls back to reading `backgroundColor` as an implicit `{ type: 'solid', color: backgroundColor }`. `source` lets the loader (below) resolve `curated` assets from the static manifest and `custom` assets from Convex storage without guessing based on ID shape.

**Convex (new table):**
```typescript
backgroundAssets: defineTable({
  userId: v.string(),           // Clerk user ID
  storageId: v.id("_storage"),
  label: v.optional(v.string()),
  durationSec: v.number(),
  sizeBytes: v.number(),
  createdAt: v.number(),
}).index("by_user_id", ["userId"])
```
Mutations/queries: `uploadBackground` (create a `backgroundAssets` row after client-side transcode + storage upload, mirrors the existing `createSession` pattern), `listMyBackgrounds` (populates the "My backgrounds" picker section), `deleteBackgroundAsset`.

## Asset Library

**Curated:**
- `apps/web/public/backgrounds/*.mp4` — 2-3 starter loops, real CC0/no-attribution-required-license footage (Pexels/Mixkit/Coverr — whichever source has usable ≤10s abstract/gradient/texture clips), transcoded via `ffmpeg` to ≤10s, ≤1MB, low-bitrate 720p H.264.
- `apps/web/public/backgrounds/*-thumb.jpg` — poster frame per loop, for the picker (avoids loading full video for a thumbnail).
- `apps/web/src/lib/backgrounds/backgroundLibrary.ts` — a `BACKGROUND_LIBRARY: BackgroundAsset[]` manifest (`{ id, label, videoPath, thumbPath }`), the single source of truth the loader and picker both read from. Expanding to 8-12 loops later is purely adding manifest entries + files.

**Custom (user-uploaded):** creator-tier only, gated at the upload action itself (not just export — see Premise 6). Flow: user picks a video file → client-side Mediabunny transcode to the identical ≤10s/≤1MB/low-bitrate H.264 spec used for curated assets (trims duration if the source is longer than 10s) → upload to Convex storage via the existing `generateUploadUrl` pattern → `uploadBackground` mutation creates the `backgroundAssets` row → appears in the picker's "My backgrounds" section, persisted across sessions.

## Components

| File | Responsibility |
|---|---|
| `packages/shared/src/schemas.ts` (modify) | `BackgroundSchema`, `StyleConfig.background` |
| `apps/web/src/lib/backgrounds/backgroundLibrary.ts` (create) | Curated asset manifest |
| `apps/web/src/lib/loaders/backgroundLoader.ts` (create) | Lazy-load + cache `HTMLVideoElement`s by `(source, assetId)`, mirrors `graphicLoader.ts`; resolves curated from the static manifest, custom via a Convex storage URL query |
| `apps/web/src/lib/media/transcodeBackgroundUpload.ts` (create) | Client-side Mediabunny transcode of a user-uploaded video to the ≤10s/≤1MB/low-bitrate H.264 spec |
| `packages/convex/convex/backgrounds.ts` (create) | `uploadBackground`, `listMyBackgrounds`, `deleteBackgroundAsset` |
| `apps/web/src/lib/video/frameRenderer.ts` (modify) | `renderFrame()` composites background before waveform/captions: solid fill (existing) or a pre-supplied decoded video frame (new param) |
| `apps/web/src/lib/video/videoEncoder.ts` (modify) | Export loop: WebCodecs `VideoDecoder` streams background frames in lockstep with the output encode loop, one `VideoFrame` alive at a time, closed immediately after draw; re-loops the decoder at background-loop end to cover full clip duration |
| `apps/web/src/components/soul/captions/StyleControls.tsx` (modify) | New thumbnail-strip row beside the existing "Background" `ColorRow`: curated thumbnails, a "My backgrounds" section for custom uploads, and a trailing "+ Upload" tile (creator-tier only — free users tapping it hit the upgrade prompt, not a file picker). Selecting a thumbnail sets `background: {type:'video', source, assetId}`; selecting a color reverts to solid |
| `apps/web/src/lib/featureGates.ts` (modify) | New `FeatureKey: 'background_video'` gated at `'creator'` |
| `apps/web/src/components/primitives/video/CanvasPreview.tsx` (modify) | CSS `<video>` layer behind the canvas when `background.type === 'video'` |

## Error Handling

- Video asset fails to load (404, decode error) in the picker → that thumbnail shows an unavailable state; if it was already selected, the session falls back to the last solid color (or a default) rather than a broken preview.
- WebCodecs unavailable at export time (Safari) → picker disables video thumbnails with a "not supported on this browser" badge (visible, not hidden); if a `background.type === 'video'` somehow reaches export on this path (e.g. imported from another session), export silently substitutes a solid fallback rather than crashing.
- Free-tier user attempts to export with a video background selected → existing `setUpgradeTarget` upgrade-prompt pattern fires, matching every other gated feature's export-time behavior.
- Free-tier user taps "+ Upload" → upgrade prompt fires immediately, no file picker opens (upload itself is gated, per Premise 6).
- Upload source file fails to transcode (corrupt file, no audio/video track, WebCodecs unavailable) → toast error, no partial/broken `backgroundAssets` row is ever created (transcode happens fully client-side before any storage write).
- Uploaded source is silently longer than 10s → transcode trims to the first 10s rather than rejecting, since a full-length background isn't the point (it loops).

## Testing

- Unit tests: `BackgroundSchema` validation (including the `source` discriminator), `BACKGROUND_LIBRARY` manifest lookup, `tierHasAccess` gate checks for `background_video` (export) and the upload action, transcode-trim logic (source duration > 10s → output is exactly 10s).
- No jsdom coverage for the WebCodecs streaming composite or the client-side transcode itself (same accepted limitation as the clip-finder wedge's `episodeIngest.ts`) — verified via on-device QA before merge: preview/export visual match, Safari fallback, free-tier export upgrade prompt, free-tier upload-gate prompt, asset-load-failure fallback, a real oversized upload transcoding down to spec.

## Open Questions

- Exact CC0/free-license source and specific clips for the 2-3 starter loops — resolved at implementation time (a task in the plan sources and transcodes real files, not placeholders).
- Whether `background_video` export-lock should apply per-export or per-session (i.e., can a free user "unlock" it by paying then re-export the same session) — defer to existing `setUpgradeTarget` conventions, no new decision needed unless those conventions don't already cover it.
- Is there a cap on how many custom backgrounds a creator-tier user can store (storage cost control)? Not addressed here — reasonable default (e.g. 10) can be set at implementation time and tightened later; not a blocker for this slice.

## Success Criteria

- A free user can preview any starter loop live in the editor.
- A free user attempting export with a video background sees the existing upgrade prompt, not a broken export.
- A free user tapping "+ Upload" sees the upgrade prompt, never a file picker.
- A creator-tier user's exported MP4 visually matches their preview exactly (loop timing, no frame drops/artifacts) for a clip longer than one loop duration (proves re-looping works).
- A creator-tier user can upload an oversized (>1MB, >10s) video and get a usable, correctly-sized background out the other end.
- A creator-tier user's uploaded background is available in "My backgrounds" on their next session, without re-uploading.
- Safari users see disabled-not-hidden video options and can still export solid-color sessions normally.

## The Assignment

Once this ships and merges, the founder's 5-podcaster user test (from the clip-finder wedge design's "The Assignment") is unblocked — testers will see video backgrounds, satisfying the design's requirement that they test the feature the founder scored highest, not flat-color-only exports.
