# Plan: /create Flow Design Review

**Date:** 2026-03-30  
**Branch:** main  
**Scope:** `/create` flow — IdleState, RecordingState, ProcessingState, ExportState  
**Type:** Design review of live implementation (no prior plan document)

## UI Screens

| Screen | Route | Component |
|--------|-------|-----------|
| Idle | `/create` | `IdleState` |
| Recording | `/create` (state) | `RecordingState` |
| Processing | `/create` (state) | `ProcessingState` |
| Export/Edit | `/create/export/[sessionId]` | `ExportState` |

## Design Review Decisions

### Pass 1 — Information Architecture

**Decision 1A — Brand placement:** Keep centered wordmark ("ordio" text-2xl) on IdleState. Does not match splash top-left but user chose intentional separation.

**Decision 1B — Remove mic icon:** Remove the mic SVG between the orb and "Tap to record" label. The orb communicates audio; the icon breaks the orb→label visual unit.

```
BEFORE: orb → mic icon → "Tap to record"
AFTER:  orb → "Tap to record"
```

### Pass 2 — Interaction State Coverage

**Decision 2A — Zero-length guard:** In `RecordingState` stopped phase, if `recordingTime === 0`, disable the Proceed button and show "Recording too short" label. Prevents blank blob submission to Whisper.

**Decision 2B — Mic denied persistent state:** After `getUserMedia` denial, orb shifts to 'resting' state, label changes to "Microphone access denied" (text-white/45), small "How to fix →" link shown. Screen no longer looks identical to pre-tap.

**Decision 2C — AbortController on processing cancel:** Add AbortSignal through `useAudioProcessing`. Cancel button aborts the in-flight Whisper fetch. Eliminates wasted API cost on cancellation.

### Pass 3 — User Journey

**Decision 3A — ProcessingState copy:** Heading changes from "Creating your video" → "Transcribing your audio". Subheading "This won't take long" stays. Accurate to what's actually happening at this step.

**Decision 3B — Completion transition:** When processing completes (progress=100), show brief "Done" state (500ms), then `useOverlayLoading` covers screen and routes to export. Uses existing NavigationTransition infrastructure.

### Pass 5 — Design System Alignment

**Decision 5A — Typography vocabulary migration:** Replace `text-foreground` → `text-white` and `text-muted-foreground` → `text-white/45` in `IdleState.tsx` and `ProcessingState.tsx`. Aligns with DESIGN.md dark canvas vocabulary. Stable explicit opacity values, not theme-variable indirection.

### Pass 6 — Responsive & Accessibility

**Decision 6A — Touch target fix:** Resume · Restart · Cancel row in RecordingState stopped phase: change `h-auto py-0` → `h-11` (44px) on all three buttons. Meets Apple HIG minimum.

**Decision 6B — Idle→Recording transition:** Wrap RecordingState in Framer Motion `motion.div` with `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`, 300ms, matching DESIGN.md page transition spec.

**Decision 6C — 3D Orb + Haptic + Dramatic Transition (MAJOR):**

Three interconnected enhancements to make the orb the definitive attention anchor:

1. **3D Orb — React Three Fiber:**
   - Replace current CSS gradient layers with an R3F `<Canvas>` overlay
   - `SphereGeometry` + custom fragment shader (noise-based morph driven by audioLevel intensity)
   - States: dormant = slow gentle morph (0.5Hz), active = fast reactive morph (driven by audioLevel), resting = still
   - Lazy-load the R3F canvas (`next/dynamic`) to avoid SSR and defer the ~200KB bundle
   - Keep Framer Motion wrapper for 2D scale + position (R3F handles 3D surface)

2. **Haptic on tap:**
   - `navigator.vibrate(10)` on `pointerdown` on the orb button
   - Fallback: CSS `active:scale-95` (already present) for iOS Safari where Vibration API is unsupported
   - No vibrate on hover — only on intentional tap

3. **Idle→Recording dramatic transition:**
   - Framer Motion `layoutId="orb"` on the orb in both IdleState and RecordingState
   - Orb smoothly animates from its idle position to its recording position as RecordingState enters
   - RecordingState `motion.div` entrance: `opacity: 0→1` behind the orb morph
   - Duration: 500ms with spring physics (`stiffness: 200, damping: 30`)

### Pass 7 — Unresolved Decisions

**Decision 7A — R3F bundle strategy:** Lazy-load via `next/dynamic` with `ssr: false`. Preload on idle after 2s (`<link rel="preload">` hint). Cold load cost: ~200KB gzipped added to /create route chunk.

**Decision 7B — ExportState design review:** Deferred. Run as a separate `/plan-design-review` session when export screen polish is prioritized.

## NOT in Scope

- ExportState — deferred to separate review
- AuthGate design — functional, not visual
- UpgradeSheet — already exists, not part of this review
- OnboardingDialog — already exists

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAN | score: 4/10 → 9/10, 11 decisions |

**UNRESOLVED:** 1 (ExportState deferred to separate review)
**VERDICT:** Design review complete. Eng Review required before ship.

## What Already Exists (Reuse)

- `BarsWaveform` in ambient mode — available but user chose orb-only visual anchor
- `useOverlayLoading` / NavigationTransition — use for completion transition (Decision 3B)
- Framer Motion — already in bundle, use for transition spec (Decision 6B, 6C)
- CVA button variants (`roundIconBtn`) — use for touch target fix (Decision 6A)
- `navigator.vibrate()` — no new dependency needed

