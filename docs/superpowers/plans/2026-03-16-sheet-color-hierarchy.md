# Sheet Color Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat black sheets with Apple dark glass material — backdrop blur, specular borders, consistent rounding, and a subtle active state — across `RecordingSettingsSheet` and `UpgradeSheet`.

**Architecture:** Three files change. CSS tokens are added to `globals.css` first so they're available before the components are touched. `RecordingSettingsSheet` gets the most changes (glass bg, close button, segmented control, radio, dividers). `UpgradeSheet` gets glass card bg, upgraded border, and inner highlight. No new files, no changes to any other component.

**Tech Stack:** Next.js 15, React 19, Tailwind 4 (arbitrary value syntax), CVA/cn, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-16-sheet-color-hierarchy-design.md`

---

## Chunk 1: CSS Tokens + RecordingSettingsSheet + UpgradeSheet

---

### Task 1: Add glass CSS tokens to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css` (`:root` block, after `--accent-green` on line 20)

- [ ] **Step 1: Add 4 new custom properties to `:root`**

  Open `apps/web/src/app/globals.css`. After the line `--accent-green: #3fb950;`, add:

  ```css
  --surface-glass:      rgba(18, 18, 20, 0.72);
  --surface-glass-card: rgba(18, 18, 20, 0.78);
  --border-glass:       rgba(255, 255, 255, 0.16);
  --shadow-glass-top:   inset 0 1px 0 rgba(255, 255, 255, 0.12);
  --surface-selected:   rgba(255, 255, 255, 0.20);
  ```

  Do NOT add them to the `@theme inline` block — these are consumed only via Tailwind arbitrary value syntax (`bg-[--surface-glass]`) and do not need theme registration.

- [ ] **Step 2: Verify tokens are parseable**

  Run: `pnpm type-check`
  Expected: no new errors (CSS is not type-checked, but this confirms the build pipeline is still healthy)

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/globals.css
  git commit -m "feat: add glass surface CSS tokens for sheet redesign"
  ```

---

### Task 2: Rewrite RecordingSettingsSheet

**Files:**
- Modify: `apps/web/src/components/soul/RecordingSettingsSheet.tsx`

The component has two parts: the `SegmentedControl` sub-component (lines 49–89) and the `RecordingSettingsSheet` export (lines 92–262). Changes span both.

- [ ] **Step 1: Add X icon import**

  At the top of the file, `lucide-react` is not yet imported. Add:

  ```tsx
  import { X } from 'lucide-react'
  ```

  If `lucide-react` is not already a dependency, check `apps/web/package.json`. It is already present as a project dependency — no install needed.

- [ ] **Step 2: Update SegmentedControl wrapper and segment buttons**

  In `SegmentedControl` (around line 61), replace the wrapper `<div>` className and each `<button>` className:

  **Wrapper** — change:
  ```tsx
  <div className="flex rounded-lg border border-[--border] overflow-hidden">
  ```
  to:
  ```tsx
  <div className="flex rounded-xl border border-[--border] overflow-hidden">
  ```

  **Each segment button** — change the `className` cn() call (around line 68–74):
  ```tsx
  className={cn(
    'relative flex-1 py-2 text-[length:var(--text-body-sm)] transition-colors duration-150 min-h-9',
    i < options.length - 1 && 'border-r border-[--border]',
    isActive
      ? 'bg-[--surface-active] text-[--primary] font-medium'
      : 'bg-transparent text-[--secondary] hover:bg-[--surface] hover:text-[--primary]'
  )}
  ```
  to:
  ```tsx
  className={cn(
    'relative flex-1 py-[9px] text-[length:var(--text-body-sm)] transition-colors duration-150 min-h-9',
    i < options.length - 1 && 'border-r border-[--border]',
    isActive
      ? 'bg-[--surface-selected] text-[--primary] font-semibold'
      : 'bg-transparent text-[--secondary] hover:bg-[--surface] hover:text-[--primary]'
  )}
  ```

- [ ] **Step 3: Update the sheet container**

  In `RecordingSettingsSheet` (around line 159), replace the sheet `<div>` className:

  Change:
  ```tsx
  className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-black border-t border-[--border] max-h-[70vh] overflow-y-auto animate-slideUp"
  ```
  to:
  ```tsx
  className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-[--surface-glass] backdrop-blur-[40px] backdrop-saturate-[160%] border-t border-[--border-glass] border-x border-white/[0.06] max-h-[70vh] overflow-y-auto animate-slideUp"
  ```

- [ ] **Step 4: Update the drag handle and add close button**

  Replace the drag handle section (around lines 165–167):

  Change:
  ```tsx
  <div className="flex justify-center pt-3 pb-2">
    <div className="w-10 h-1 rounded-full bg-[--surface-hover]" />
  </div>
  ```
  to:
  ```tsx
  <div className="relative flex justify-center pt-3 pb-2">
    <div className="w-10 h-[5px] rounded-full bg-white/[0.28]" />
    <button
      type="button"
      aria-label="Close settings"
      onClick={onClose}
      className={cn(
        'absolute right-0 top-0',
        'min-w-[44px] min-h-[44px] flex items-center justify-center',
        'group cursor-pointer rounded-full',
        'focus-visible:ring-2 focus-visible:ring-white/60',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-black'
      )}
    >
      <span className={cn(
        'w-7 h-7 rounded-full',
        'bg-white/10 border border-white/10',
        'flex items-center justify-center',
        'group-hover:bg-white/[0.15] transition-colors duration-150'
      )}>
        <X className="w-3 h-3 text-white/55" strokeWidth={2} />
      </span>
    </button>
  </div>
  ```

- [ ] **Step 5: Update section labels**

  There are three `<h3>` section labels in the sheet (Waveform Style, Caption Position, Audio Enhancement). Each currently reads:
  ```tsx
  <h3 className="text-[length:var(--text-footnote)] font-medium text-[--secondary] uppercase tracking-wider mb-3">
  ```
  Change all three to:
  ```tsx
  <h3 className="text-[length:var(--text-footnote)] font-semibold text-white/[0.48] uppercase tracking-[0.13em] mb-3">
  ```

- [ ] **Step 6: Update section dividers**

  There are two `<div className="h-px bg-[--border]" />` dividers. Change both to:
  ```tsx
  <div className="h-px bg-white/[0.08]" />
  ```

- [ ] **Step 7: Update Audio Enhancement radio rows and dot**

  In the Audio Enhancement section (around lines 215–255), update each radio `<button>`:

  **Button className** — change:
  ```tsx
  className={cn(
    'relative w-full flex items-center gap-3 py-3 text-left transition-colors duration-150',
    i < ENHANCE_OPTIONS.length - 1 && 'border-b border-[--border]',
    'hover:bg-[--surface] rounded-lg px-2 -mx-2'
  )}
  ```
  to:
  ```tsx
  className={cn(
    'relative w-full flex items-center gap-3 py-3 text-left transition-colors duration-150',
    i < ENHANCE_OPTIONS.length - 1 && 'border-b border-white/[0.08]',
    'rounded-lg px-2 -mx-2',
    isActive ? 'bg-[--surface-selected]' : 'hover:bg-[--surface]'
  )}
  ```

  **Radio indicator outer ring** — change:
  ```tsx
  className={cn(
    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150',
    isActive ? 'border-[--primary]' : 'border-[--tertiary]'
  )}
  ```
  to:
  ```tsx
  className={cn(
    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150',
    isActive ? 'border-white/70 bg-white/70' : 'border-[--tertiary]'
  )}
  ```

  **Radio indicator inner dot** — change:
  ```tsx
  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[--primary]" />}
  ```
  to:
  ```tsx
  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[rgba(18,18,20)]" />}
  ```

- [ ] **Step 8: Type-check and lint**

  Run:
  ```bash
  pnpm --filter=web type-check
  pnpm lint
  ```
  Expected: no errors. If `X` from lucide-react is not found, verify the import path is `import { X } from 'lucide-react'`.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/web/src/components/soul/RecordingSettingsSheet.tsx
  git commit -m "feat: apply glass material to RecordingSettingsSheet"
  ```

---

### Task 3: Rewrite UpgradeSheet

**Files:**
- Modify: `apps/web/src/components/soul/UpgradeSheet.tsx`

- [ ] **Step 1: Update card container**

  In `UpgradeSheet` (around line 84), replace the inner card `<div>` className:

  Change:
  ```tsx
  className="w-full max-w-sm rounded-3xl bg-black border border-[--border] shadow-2xl px-6 py-6"
  ```
  to:
  ```tsx
  className="w-full max-w-sm rounded-3xl bg-[--surface-glass-card] backdrop-blur-[40px] backdrop-saturate-[160%] border border-[--border-glass] shadow-2xl [box-shadow:var(--shadow-glass-top)] px-6 py-6"
  ```

- [ ] **Step 2: Update drag handle**

  Change:
  ```tsx
  <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mb-5" aria-hidden="true" />
  ```
  to:
  ```tsx
  <div className="w-9 h-[5px] rounded-full bg-white/[0.25] mx-auto mb-5" aria-hidden="true" />
  ```

- [ ] **Step 3: Type-check and lint**

  Run:
  ```bash
  pnpm --filter=web type-check
  pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 4: Run existing tests to confirm no regressions**

  Run:
  ```bash
  pnpm test --filter=web
  ```
  Expected: all tests pass. These are utility unit tests — none test the sheet components directly, but a failure here would indicate an unexpected import side-effect.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/components/soul/UpgradeSheet.tsx
  git commit -m "feat: apply glass material to UpgradeSheet"
  ```

---

### Task 4: Visual verification

- [ ] **Step 1: Start the dev server**

  ```bash
  pnpm dev --filter=web
  ```
  Open `http://localhost:3000/create` in the browser.

- [ ] **Step 2: Verify RecordingSettingsSheet**

  Trigger the sheet (tap the settings gear icon in the RecordingState or IdleState). Confirm:
  - Sheet background is dark glass — the orb gradient bleeds faintly through, not solid black
  - Top corners are visibly more rounded than before (24px)
  - Drag handle is clearly visible (28% white, 5px tall)
  - Close button (X) appears top-right, 44px tap area, 28px visual circle
  - Section labels are slightly brighter/bolder than body text
  - Active segment has a subtle white lift (20% fill) — distinct but not harsh
  - Dividers between sections are faintly visible (8% white)
  - Selected radio row has a subtle bg lift

- [ ] **Step 3: Verify UpgradeSheet**

  Trigger by tapping a locked feature (circle waveform, karaoke, etc.). Confirm:
  - Card has glass treatment — dark but with a subtle top specular edge
  - Drag handle is 5px tall and clearly visible
  - "Maybe later" button still dismisses correctly

- [ ] **Step 4: Verify no other screens changed**

  Navigate to IdleState, RecordingState, ProcessingState, ExportState. Confirm none of these show any visual changes.
