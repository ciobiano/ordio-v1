# Export Screen Redesign — Gap Analysis

Source: `Ordio Export Screen.dc.html` (Claude Design project `20530c20…`), read 2026-08-02.
Compared against the current implementation inventoried in `export-screen-inventory.md`.

Verdict: **~55% of the design is already built and needs rewiring. ~45% does not exist at any
layer** — not in the schema, not in the engine, not in the UI.

---

## 1. Structural moves (things that exist but relocate)

| # | Change | Now | Design |
|---|---|---|---|
| 1 | **Director** | Dock item 1 | Rose pill in the **transport bar**, between the timecode and undo/redo |
| 2 | **Reframe** | Dock item 5 → 26vh panel, instant apply | Dock item 4 → **full sheet**, pending selection + **Apply/Cancel** commit |
| 3 | **Undo/redo** | Two separate pairs (captions 50-step in panel header, trim 5-step in TrimPanel) | **One pair in the transport bar**, above whichever panel is open |
| 4 | **Add** | — | New **circular FAB** at dock-left opening a 210px panel |
| 5 | **Dock** | 5 items (Direct it, Captions, Edit Style, Trim, Reframe) | **FAB + 4 items** (Captions, Style, Trim, Reframe) |
| 6 | **Style tabs** | 5 (Animation, Colors, Font, Spacing, Visual) | **7** (Motion, Colors, Font, Breaks, Templates, Layout, Visual) |
| 7 | **Backdrop picker** | Nested inside Colors tab | Promoted to its own **Templates** tab |
| 8 | **Bottom surface** | `position: fixed` layer | **Sticky in-flow block** — deliberate, so the mobile URL bar can't cover it |
| 9 | **Header** | Fixed bar, inline styles | Two variants shipped: **floating pills** (default) or **solid bar** — needs a pick |
| 10 | **Panel heights** | `46vh` / `26vh` | Fixed px: `332px` / `372px` (style) / `210px` (add) |

---

## 2. NOT BUILT — no schema field, no engine support, no UI

### 2.1 Caption text editing ⚠️ largest single gap
Design: double-tap any word in a selected caption row → inline `<input>` → edit the transcript text.
Current: `CaptionEditorRow` can toggle a split cursor and an accent, but **the word text is immutable**.
There is no `editWord`/`updateWord` action anywhere in `processingStore`.

Needs: new store action, undo integration, and a decision on whether edits rewrite `transcript`
(shared with the exporter) or a display-only overlay.

### 2.2 The entire **Breaks** tab
Nothing here exists as a user control.

| Control | Values | Status |
|---|---|---|
| Frequency | Punctuation or pause · Single word · Time · Random | ✗ |
| Quantity | One…Eight · Random (9 chips) | ✗ — `chunkWords` exists in `StyleConfig` (2–12) but is preset-authored, not user-set |
| Hold each caption | 1–6s slider, only when Frequency = Time | ✗ |
| Apply to all phrases | toggle; off = this caption only | ✗ — no per-caption override model exists at all |

`packages/engine/src/captions/segmentation.ts` does content-aware sentence segmentation with no
mode switch. This tab is a genuine engine feature, not a UI veneer.

### 2.3 New **Colors** controls
`StyleConfig` has `textColor`, `waveColor`, `backgroundColor`, `strokeColor`, `glowColor`, `accentColor`.
Missing:

| Control | Status |
|---|---|
| **Active word** colour | ✗ — the highlight colour is currently hardcoded per preset (`chipColor`/`chipTextColor`) |
| **Active word background** + on/off toggle | ✗ — same, preset-owned, not user-editable |
| **Caption background** + on/off toggle | ✗ — no caption-box fill exists |
| **Shadow** colour + intensity | ~ partial — `glowColor`/`glowIntensity` exist but are gated behind `preset.glow` (only `script-accent`). Design exposes it **always**, renamed Shadow. |
| **Stroke** colour + width | ~ partial — same story, gated behind `preset.stroke` (only `bold-outline`). Design exposes it **always**. |
| **Emphasis** colour | ✓ maps to existing `accentColor` |

The design's Colors tab is **flat and always-visible**, grouped Words / Caption box / Canvas.
The current one **morphs per preset**. That's a deliberate reversal.

### 2.4 New **Font** controls
| Control | Values | Status |
|---|---|---|
| Capitalization | As spoken · AA · aa · Aa | ✗ no `textTransform` anywhere |
| Auto fit | toggle; dims the size slider when on | ✗ — and it contradicts the standing "never scale caption text to fit" rule (see §5) |
| Hide auto punctuation | toggle | ✗ — the transcribe route *adds* punctuation (`route.ts:50`), nothing strips it |
| Alignment | moved here from Spacing | ✓ exists, relocates |

### 2.5 **Reframe** — content fit
| Control | Values | Status |
|---|---|---|
| Aspect ratio | 1:1 · 9:16 · 16:9 · 4:5 | ✓ exists |
| **Content fit** | **Fill · Fit · Auto** | ✗ — no `objectFit` concept in the renderer at all |
| Pending + Apply commit | | ✗ — currently instant |
| Locked ratios guard the whole button | | ✗ — **current code only guards the badge; the button body applies a locked format** (existing bug, design fixes it) |

### 2.6 **Add** panel
All three rows are new:
- **Record more** — "Tack another clip onto this one" → multi-clip append. No such flow exists.
- **Upload a backdrop** → gated, routes to `background_upload`
- **Pick artwork** → jumps to Style ▸ Templates ▸ Artwork

### 2.7 Trim additions
| Control | Status |
|---|---|
| **Trim in +1s** / **Trim out +1s** buttons | ✗ — only drag handles today |
| **Reset** | ~ partial — `clearDeletions()` clears silence chips but **not** the handles |
| Playhead line on the timeline | ✗ |

---

## 3. BUILT — wire straight through

| Feature | Where it lives now |
|---|---|
| 4 animations (Reveal/Pop/Cut/Karaoke) | `lib/captionAnimations.ts` — ids match the design exactly |
| 11 fonts + 5 Creator gates | `StyleControls` FONTS + `fontFeatureKey` |
| 20 artwork presets | `packages/engine/src/backgrounds/canvasPresets.ts` (design strip shows 8 — codebase has more, keep all 20) |
| 3 curated video loops + custom upload | `BackgroundVideoPicker` |
| Image upload (jpg/png/webp, 4 MB) | `BackgroundImagePicker` |
| 6 visuals + Frames 1/2 | `waveformStyle` + `graphicStyle` |
| Text / wave / background colour | `StyleConfig` |
| Line spacing, character spacing, font size, align, vertical position | `StyleConfig` |
| Trim timeline, silence detection, Apply cuts | `TrimPanel` + `useAudioTrimmer` |
| 4 formats + 3 gates | `FormatToggle` + `setFormat` |
| Director: 3 looks, first free, reroll gated | `DirectorSheet` + `directorStore` + 12 `LOOK_PRESETS` |
| Export progress / error / success | `ExportOverlay` |
| Upgrade sheet | `UpgradeSheet` — needs the design's new per-key copy |
| All 9 feature-gate keys | `lib/featureGates.ts` |

**Design tokens**: the whole `_ds/ordio-design-system-…/tokens/*` set (palette 50+ hues, semantic,
motion, shape, space, typography) is new to this repo. Currently `globals.css` has its own scale.
These need importing as the source of truth — notably `--ord-acid`, `--ord-rose`, `--ord-paper`,
`--ord-ink`, `--shadow-sticker-sm`, `--ease-snap`, `--ease-overshoot`.

---

## 4. Conflicts to resolve before coding

1. **`ownsStage` semantics.** Design drives it off the *animation* (`anim === 'karaoke'` hides the
   Visual tab). Code drives it off the *preset* — `karaoke-chip` is `ownsStage: true` but
   `cream-block` runs the same `static-highlight` mechanic with `ownsStage: false`. Adopting the
   design's rule silently changes `cream-block`.

2. **Auto fit vs. the fixed-size rule.** `feedback_caption_fixed_size_wrapping` says never scale
   caption text to fit width — that was a deliberate fix (commits `fe98e98`, `a0daffa`). The design
   reintroduces it as an opt-in toggle, defaulted **on**. Recommend: ship it opt-in, defaulted **off**.

3. **Stroke/shadow always-on.** Exposing these for every preset means `bold-outline` and
   `script-accent` lose their identity as "the stroke one" / "the glow one". Acceptable, but it makes
   the 8 engine presets much less distinct.

4. **One undo stack.** Merging caption undo (50 steps, store-based) with trim undo (5 steps,
   component-based, snapshots whole AudioBuffers) into one pair means one unified command history.
   That's a real refactor, not a UI move — AudioBuffer snapshots are memory-heavy.

5. **Lock copy granularity.** Design has one `font` lock message; code has 5 separate font gate keys.
   Collapse the copy, keep the keys.

---

## 5. File-size problem (the "spaghetti" concern)

Current offenders, and what the redesign does to them:

| File | Now | After, if unsplit |
|---|---|---|
| `StyleControls.tsx` | **667** | ~1000+ (5 tabs → 7, Colors triples) |
| `CanvasPreview.tsx` | 320 | ~360 |
| `TrimPanel.tsx` | 273 | ~330 |
| `StageControlBar.tsx` | 231 | deleted (desktop bar folds into tabs) |
| `ExportControls.tsx` | 204 | ~260 |
| `BackgroundVideoPicker.tsx` | 210 | ~210 |

`StyleControls.tsx` must be split — one file per tab, plus shared primitives. Target ≤200 lines each.

Proposed shape:

```
components/soul/captions/style/
  StyleControls.tsx          ~90   tab shell + AnimatePresence only
  tabs/MotionTab.tsx         ~70
  tabs/ColorsTab.tsx        ~150   3 groups
  tabs/FontTab.tsx          ~140
  tabs/BreaksTab.tsx        ~130   NEW
  tabs/TemplatesTab.tsx      ~60   wraps the 3 existing pickers
  tabs/LayoutTab.tsx         ~90
  tabs/VisualTab.tsx        ~110
  primitives/ColorRow.tsx    ~40
  primitives/SliderRow.tsx   ~40
  primitives/SegmentedRow.tsx ~45  NEW — 6 places use this pattern
  primitives/ToggleRow.tsx   ~45   NEW — 5 places use this pattern
  primitives/OptionCard.tsx  ~55   NEW — Motion/Visual/Font share one card
```

Four repeated patterns in the design (segmented control, labelled toggle, option card with
checkmark, slider with min/max captions) currently get hand-rolled at each call site. Extracting
them is most of the line-count win — and they belong in `lib/variants.ts` as CVA, per project rules.

---

## 6. Suggested landing order

| Phase | Contents | Risk |
|---|---|---|
| **0** | Import design tokens; add the 4 CVA primitives; split `StyleControls` into the shell + 7 tab files with **current** functionality only | Low — pure refactor, no behaviour change, tests stay green |
| **1** | Structural moves: Director → transport, one undo pair, Add FAB + panel, Reframe → sheet with Apply, dock to 4 items, header variant | Medium |
| **2** | Schema additions: active-word colour/bg, caption bg, always-on stroke/shadow, capitalization, content fit. Renderer + exporter updates | Medium — touches `frameRenderer` and both encoders |
| **3** | Breaks engine: segmentation modes, quantity, hold-time, per-caption override | High — real algorithm work |
| **4** | Caption word editing + transcript mutation + undo | High |
| **5** | Auto fit, hide punctuation, trim ±1s, playhead | Low |

Phase 0 is worth doing on its own regardless of the rest — it's the fix for the file-size problem
and it makes every later phase cheaper.
