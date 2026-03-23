# Production Readiness — Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven confirmed production bugs in Ordio: Whisper filename mislabeling on uploads, 29 dead landing page surfaces, missing cancel from processing state, auth loading flash, no cancel from recording state, mobile canvas animation freeze (RAF loop instability), and export visual polish.

**Architecture:** All fixes are contained in the web app (`apps/web/src/`). No new files needed — each fix is a targeted edit to an existing component, hook, or API route. The RAF fix is the highest-risk change and must be tested on a real mobile device (iOS Safari / Brave).

**Tech Stack:** Next.js 15, React 19, Zustand, TypeScript, Tailwind CSS, CVA

---

## File Map

| File | Change |
|------|--------|
| `apps/web/src/app/api/transcribe/route.ts` | Fix hardcoded `'audio.webm'` filename — derive extension from `file.type` |
| `apps/web/src/components/landing/LandingNav.tsx` | Fix `<span>` nav items (Product/Pricing/Blog) with no role or handler |
| `apps/web/src/components/landing/LandingFooter.tsx` | Fix all 20+ `href="#"` dead links |
| `apps/web/src/components/soul/ProcessingState.tsx` | Add `onCancel` prop + cancel button |
| `apps/web/src/app/create/page.tsx` | Wire cancel from processing; add `handleCancel` to RecordingState; fix auth loading render |
| `apps/web/src/components/soul/RecordingState.tsx` | Add `onCancel` prop + cancel button (active recording phase) + cancel button (post-stop phase) |
| `apps/web/src/components/primitives/CanvasPreview.tsx` | Sync `currentTime` to ref; remove from `drawCurrentFrame` useCallback deps |

---

## Task 0: Fix Whisper File Naming for Uploads

**Problem:** `apps/web/src/app/api/transcribe/route.ts:113` — `new File([buffer], 'audio.webm', { type: file.type || 'audio/webm' })` hardcodes the filename as `audio.webm` regardless of the actual upload format. Whisper uses the filename extension to determine the audio codec. MP3/WAV/M4A uploads are mislabeled as WebM and fail to transcribe.

**Files:**
- Modify: `apps/web/src/app/api/transcribe/route.ts`

- [ ] **Step 1: Write the failing test**

  In `apps/web/src/app/api/transcribe/__tests__/filename.test.ts`:

  ```ts
  // Test that the file sent to Whisper has the correct extension for each MIME type
  // Use a spy on OpenAI audio.transcriptions.create to capture the file argument
  it('sends audio.mp3 filename for audio/mpeg uploads', async () => { ... });
  it('sends audio.wav filename for audio/wav uploads', async () => { ... });
  it('sends audio.webm filename for audio/webm uploads (default)', async () => { ... });
  ```

- [ ] **Step 2: Run test to confirm FAIL**

  ```bash
  cd apps/web && pnpm test filename
  ```

- [ ] **Step 3: Fix `transcribe/route.ts`**

  Replace the hardcoded `'audio.webm'` filename:

  ```ts
  // Before:
  const audioFile = new File([buffer], 'audio.webm', { type: file.type || 'audio/webm' });

  // After:
  const ext = file.type.split('/')[1]?.replace('mpeg', 'mp3') ?? 'webm';
  const audioFile = new File([buffer], `audio.${ext}`, { type: file.type || 'audio/webm' });
  ```

- [ ] **Step 4: Run test to confirm PASS**

  ```bash
  cd apps/web && pnpm test filename
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/app/api/transcribe/route.ts
  git commit -m "fix: derive Whisper filename extension from upload MIME type"
  ```

---

## Task 0b: Fix Dead Landing Page Surfaces

**Problem:** The landing page has 29 dead surfaces:
- `LandingNav.tsx` — Product, Pricing, Blog rendered as `<span className="cursor-pointer">` with no `href`, no `onClick`, no semantic role. Also in mobile dropdown.
- `LandingFooter.tsx` — ALL 20+ footer links (across 5 columns + social links) use `href="#"`.

**Approach:** For footer links that have no real route yet, replace `href="#"` with a `href="#not-yet"` placeholder with `aria-disabled="true"` to communicate clearly that the link is a placeholder. For nav items, convert to `<Link href="#not-yet">` with `aria-disabled="true"` styling. This is honest UX — better than fake interactivity.

**Files:**
- Modify: `apps/web/src/components/landing/LandingNav.tsx`
- Modify: `apps/web/src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Fix `LandingNav.tsx`**

  Convert `<span>` nav items to `<Link href="#not-yet">` with `aria-disabled="true"`. Apply `pointer-events-none opacity-50` or equivalent so the visual styling communicates unavailability.

- [ ] **Step 2: Fix `LandingFooter.tsx`**

  For all `href="#"` links: replace with `href="#not-yet"` and add `aria-disabled="true"`. For the Get Started / sign-in CTAs (if any), verify they point to `/create`.

- [ ] **Step 3: Visual check**

  Read both files after editing to confirm no `href="#"` remains (except intentional same-page anchors).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/components/landing/LandingNav.tsx apps/web/src/components/landing/LandingFooter.tsx
  git commit -m "fix: replace dead href='#' surfaces with aria-disabled placeholders"
  ```

---

## Task 0c: Add Cancel Path from Processing → Idle

**Problem:** `ProcessingState` has no cancel button. Once transcription/processing starts, the user is trapped until it completes. Violates State Exit Law.

**Files:**
- Modify: `apps/web/src/components/soul/ProcessingState.tsx`
- Modify: `apps/web/src/app/create/page.tsx`

- [ ] **Step 1: Write the failing test**

  In `apps/web/src/components/soul/__tests__/ProcessingState.test.tsx`:

  ```tsx
  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn();
    render(<ProcessingState progress={45} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  ```

- [ ] **Step 2: Run test to confirm FAIL**

  ```bash
  cd apps/web && pnpm test ProcessingState
  ```

- [ ] **Step 3: Add `onCancel` prop to `ProcessingState`**

  1. Add `onCancel?: () => void` to `ProcessingStateProps`.
  2. Add a small "Cancel" text button below the progress ring:

  ```tsx
  {onCancel && (
    <button
      type="button"
      onClick={onCancel}
      aria-label="Cancel processing"
      className="text-[--tertiary] hover:text-[--secondary] text-[length:var(--text-caption)] transition-colors"
    >
      Cancel
    </button>
  )}
  ```

- [ ] **Step 4: Wire `handleReset` as cancel in `create/page.tsx`**

  ```tsx
  {currentState === 'processing' && (
    <ProcessingState progress={processingProgress} onCancel={handleReset} />
  )}
  ```

- [ ] **Step 5: Run test to confirm PASS**

  ```bash
  cd apps/web && pnpm test ProcessingState
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/components/soul/ProcessingState.tsx apps/web/src/app/create/page.tsx
  git commit -m "fix: add cancel path from processing state back to idle"
  ```

---

## Task 1: Fix Auth Loading Flash

**Problem:** `create/page.tsx:175` — `if (!isSignedIn && !isLoading)` — `isLoading` here comes from `useCurrentUser()` (which wraps `useConvexAuth` + the `me` Convex query, line 65). During Convex auth initialization (`authLoading=true`) or while the `me` query is in-flight (`me === undefined`), `isLoading` is true. The guard falls through to neither `AuthGate` nor the app — the full idle UI renders transiently.

**Files:**
- Modify: `apps/web/src/app/create/page.tsx`

- [ ] **Step 1: Write the failing test**

  In `apps/web/src/app/create/__tests__/auth-loading.test.tsx`:

  ```tsx
  import { render, screen } from '@testing-library/react';
  import CreateContent from '../page'; // export CreateContent for testing

  // Mock useCurrentUser to simulate loading state (Convex auth + me query in-flight)
  jest.mock('@/hooks/useCurrentUser', () => ({
    useCurrentUser: () => ({ tier: 'free', usageCount: 0, isAuthenticated: false, isLoading: true }),
  }));

  // Mock Clerk — not signed in
  jest.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ isSignedIn: false }),
    UserButton: () => null,
  }));

  // Mock remaining hooks to return safe defaults
  jest.mock('@/lib/store', () => ({ useStore: () => ({ currentState: 'idle', reset: jest.fn() }) }));
  // ... (mock remaining hooks as needed)

  it('renders a loading spinner while auth is resolving, not the idle UI', () => {
    render(<CreateContent />);
    // The idle state "Start recording" button should NOT be visible during loading
    expect(screen.queryByRole('button', { name: /start recording/i })).not.toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd apps/web && pnpm test auth-loading
  ```
  Expected: FAIL — "Start recording" button is found when it shouldn't be.

- [ ] **Step 3: Add early return for loading state in `create/page.tsx`**

  In `apps/web/src/app/create/page.tsx`, find the auth guard block and add the loading check:

  ```tsx
  // Before:
  if (!isSignedIn && !isLoading) {
    return <AuthGate />;
  }

  // After:
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-black flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }
  if (!isSignedIn) {
    return <AuthGate />;
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd apps/web && pnpm test auth-loading
  ```
  Expected: PASS

- [ ] **Step 5: Manual verification**

  Open `/create` in a fresh browser tab (no session). Confirm:
  - No flash of idle state before auth gate appears
  - Spinner shows briefly, then auth gate appears

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/app/create/page.tsx
  git commit -m "fix: prevent idle state flash during Clerk auth loading"
  ```

---

## Task 2: Add Cancel Path from Recording → Idle

**Problem:** Once `setCurrentState('recording')` fires, there is no way back to `idle` except by proceeding through the full pipeline. This violates the State Exit Law — every state must have a forward path AND a back path.

**Missing exits:**
- Active recording phase: Pause · Stop · Settings — no Cancel
- Post-stop phase: Proceed · Resume · Restart — no Cancel

**Files:**
- Modify: `apps/web/src/components/soul/RecordingState.tsx`
- Modify: `apps/web/src/app/create/page.tsx`

- [ ] **Step 1: Write the failing test**

  In `apps/web/src/components/soul/__tests__/RecordingState.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from '@testing-library/react';
  import { RecordingState } from '../RecordingState';

  // Build fresh mocks per test to avoid cross-test count contamination
  function makeProps(overrides = {}) {
    return {
      audioLevel: 0,
      isPaused: false,
      recordingTime: 5,
      onPauseRecording: jest.fn(),
      onResumeRecording: jest.fn(),
      onStopRecording: jest.fn(),
      onRestart: jest.fn(),
      onProceed: jest.fn(),
      onCancel: jest.fn(),    // new prop
      onLocked: jest.fn(),
      ...overrides,
    };
  }

  it('calls onCancel when cancel button clicked during active recording', () => {
    const props = makeProps();
    render(<RecordingState {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked in post-stop phase', () => {
    const props = makeProps();
    render(<RecordingState {...props} />);
    // Transition to post-stop phase
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd apps/web && pnpm test RecordingState
  ```
  Expected: FAIL — no `onCancel` prop, no cancel button found.

- [ ] **Step 3: Add `onCancel` prop + cancel button to `RecordingState.tsx`**

  1. Add `onCancel: () => void` to the `RecordingStateProps` interface.
  2. Destructure `onCancel` in the component.
  3. In the **active recording phase** bottom bar, add a small back/cancel button to the top-left corner (absolute positioned, like the ExportState back button):

  ```tsx
  // Top-left back button — always visible in recording state
  <button
    type="button"
    onClick={onCancel}
    aria-label="Cancel recording"
    className={roundIconBtn({ intent: 'nav' })}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
         stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
    </svg>
  </button>
  ```

  4. In the **post-stop phase**, add a "Cancel" text button next to Resume · Restart:

  ```tsx
  <span className="text-[--tertiary]">&middot;</span>

  <button
    type="button"
    className="text-[--tertiary] hover:text-[--secondary] transition-colors"
    onClick={onCancel}
    aria-label="Cancel and return to start"
  >
    Cancel
  </button>
  ```

- [ ] **Step 4: Wire `handleCancel` in `create/page.tsx`**

  `handleReset` already exists and cleans up everything. Wire it as the cancel handler:

  ```tsx
  // In create/page.tsx, pass onCancel to RecordingState:
  {currentState === 'recording' && (
    <RecordingState
      ...
      onCancel={handleReset}   // add this
    />
  )}
  ```

- [ ] **Step 5: Run test to verify it passes**

  ```bash
  cd apps/web && pnpm test RecordingState
  ```
  Expected: PASS

- [ ] **Step 6: Manual verification**

  1. Click "Start Recording" → confirm cancel button appears top-left
  2. Click cancel → confirm returns to idle state, mic is released, timer resets
  3. Start recording again → stop → confirm "Cancel" link appears in post-stop row
  4. Click "Cancel" → confirm returns to idle

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/components/soul/RecordingState.tsx apps/web/src/app/create/page.tsx
  git commit -m "fix: add cancel path from recording state back to idle"
  ```

---

## Task 3: Fix RAF Loop Instability (Mobile Canvas Freeze)

**Problem:** `CanvasPreview.tsx:120` — `drawCurrentFrame` useCallback lists `playback.currentTime` as a dependency. Since `currentTime` is React state (updated by `setCurrentTime` in `usePlayback`), this creates a loop:

```
RAF tick → setCurrentTime (state update) → new drawCurrentFrame ref
→ useEffect cleanup (dep changed) → cancelAnimationFrame
→ useEffect runs again → new requestAnimationFrame
```

On desktop, the teardown+restart overhead is invisible. On mobile Safari/Brave, the per-frame React reconciliation and effect cleanup is slow enough to cause visible stutter or complete freeze.

**Fix:** Sync `currentTime` to a mutable ref. Read from the ref inside `drawCurrentFrame`. Remove `currentTime` from useCallback deps. The RAF loop never gets cancelled mid-playback.

**Files:**
- Modify: `apps/web/src/components/primitives/CanvasPreview.tsx`

- [ ] **Step 1: Write the failing test**

  In `apps/web/src/components/primitives/__tests__/CanvasPreview.test.tsx`:

  ```tsx
  import { render } from '@testing-library/react';
  import CanvasPreview from '../CanvasPreview';

  // Mock dependencies
  jest.mock('@/lib/frameRenderer', () => ({ renderFrame: jest.fn() }));
  jest.mock('@/lib/fontLoader', () => ({ loadFont: () => Promise.resolve() }));
  jest.mock('@/lib/store', () => ({
    useStore: () => ({ transcript: [], style: {}, audioBuffer: null }),
    getCanvasDimensions: () => ({ width: 1080, height: 1080 }),
  }));

  const { renderFrame } = require('@/lib/frameRenderer');

  it('does not cancel/restart RAF on each currentTime tick during playback', () => {
    const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame');

    const playback = {
      isPlaying: true,
      currentTime: 0,
      duration: 10,
      play: jest.fn(),
      pause: jest.fn(),
      seek: jest.fn(),
      load: jest.fn(),
      stop: jest.fn(),
    };

    const { rerender } = render(
      <CanvasPreview playback={playback} format="square"
        waveformStyle="bars" captionStyle="center" />
    );

    // Simulate currentTime advancing (what usePlayback does every RAF tick)
    rerender(
      <CanvasPreview playback={{ ...playback, currentTime: 0.016 }}
        format="square" waveformStyle="bars" captionStyle="center" />
    );
    rerender(
      <CanvasPreview playback={{ ...playback, currentTime: 0.033 }}
        format="square" waveformStyle="bars" captionStyle="center" />
    );

    // cancelAnimationFrame should NOT be called on each currentTime update
    // (it should only be called when isPlaying changes or component unmounts)
    expect(cancelSpy).not.toHaveBeenCalled();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd apps/web && pnpm test CanvasPreview
  ```
  Expected: FAIL — `cancelAnimationFrame` is called on each currentTime rerender.

- [ ] **Step 3: Fix `CanvasPreview.tsx`**

  Add a `currentTimeRef` that stays in sync with the prop, then read from the ref inside `drawCurrentFrame`:

  ```tsx
  // 1. Add ref for currentTime (below existing rafRef and waveformDataRef)
  const currentTimeRef = useRef(0);

  // 2. Keep ref in sync with prop — no effect cleanup needed, runs synchronously on render
  currentTimeRef.current = playback.currentTime;

  // 3. Update drawCurrentFrame to read from ref, not prop:
  const drawCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = playback.duration || 1;            // duration is stable — ok as dep
    const totalFrames = Math.ceil(duration * FPS);
    const frameIndex = Math.min(
      Math.floor(currentTimeRef.current * FPS),         // ← ref, not state
      totalFrames - 1
    );

    const frameOptions: FrameOptions = {
      waveformData: waveformDataRef.current,
      transcript,
      style: { ...style, width: canvasWidth, height: canvasHeight },
      waveformStyle,
      captionStyle,
      showWatermark,
      graphicStyle,
    };

    renderFrame(ctx, Math.max(0, frameIndex), totalFrames, frameOptions);
  }, [
    playback.duration,    // removed: playback.currentTime
    transcript, style, canvasWidth, canvasHeight,
    waveformStyle, captionStyle, showWatermark, graphicStyle, fontLoaded
  ]);
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd apps/web && pnpm test CanvasPreview
  ```
  Expected: PASS

- [ ] **Step 5: Manual verification — desktop**

  Open `/create`, record 10s of audio, proceed to export, hit Play. Confirm canvas animates smoothly. Scrub the timeline. Confirm single-frame renders on seek.

- [ ] **Step 6: Manual verification — mobile** ⚠️ critical

  On an iOS device (Safari) or Android (Chrome/Brave):
  - Open `/create` → record → proceed to export → Play
  - Confirm canvas animates without freeze or stutter
  - This is the primary regression this fix targets

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/components/primitives/CanvasPreview.tsx
  git commit -m "fix: stabilize RAF loop by reading currentTime from ref to prevent mobile canvas freeze"
  ```

---

## Task 4: Export Visual Polish

**Problem:** The export panel has visual issues identified in the journey audit. Audit the header and button styling for consistency.

**Files:**
- Read: `apps/web/src/components/soul/ExportState.tsx`
- Read: `apps/web/src/lib/variants.ts`

- [ ] **Step 1: Audit `ExportState.tsx` against design rules**

  Verify the following (do not change anything yet — just check):

  1. **Export/Download header button (lines ~160-164):** Uses raw `cn()` with compact inline sizing. This is intentional — `primaryBtn` in `variants.ts` is a plain string constant (not a CVA function) sized for full-width CTAs. The compact header button is a justified exception; no change needed.

  2. **Progress bar fill (~line 273):** Uses `style={{ width: \`${progressPct}%\` }}`. This is an acceptable dynamic value — there is no CVA alternative for runtime-computed widths. No change needed.

  3. **"Edit" header label (line 151):** Uses `text-[length:var(--text-body-sm)] font-medium tracking-tight`. Confirm this matches the spacing and weight used in the RecordingState and other full-screen header labels for visual consistency.

  4. **Typography in panels:** Scan `CaptionEditor`, `StyleControls`, `FormatToggle` for any hardcoded `text-sm`, `text-xs`, `font-bold` that bypass the `--text-*` CSS custom properties. Flag any found.

- [ ] **Step 2: Fix any flagged typography inconsistencies**

  Only change items flagged in Step 1. If nothing is flagged, this step is a no-op — commit with "no changes needed".

- [ ] **Step 3: Manual verification**

  - Open `/create` → record → proceed to export panel
  - Confirm header "Edit" label weight/size matches visual hierarchy
  - Confirm Export/Download button is visually consistent with its nav bar context
  - Confirm progress bar fill animates smoothly

- [ ] **Step 4: Commit (or skip if no changes)**

  ```bash
  git add apps/web/src/components/soul/ExportState.tsx
  git commit -m "fix: align export panel typography with design token system"
  ```

---

## Notes — Out of Scope (Requires Architecture Decision)

### Route Architecture

All four phases (idle → recording → processing → export) live on `/create`. The journey audit flagged this as a potential issue because:
- Recording and export are different jobs with different mental models
- Deep-linking to the export editor is not possible
- Browser Back during export discards work without warning

**Recommended discussion before implementing:** Should `/create` be the recording flow only, with `/create/edit` (or `/edit`) as the export/editing route? This would also allow export settings to be bookmarkable and shareable.

This is not a bug fix — it's an architectural refactor. Flagged here for future planning.
