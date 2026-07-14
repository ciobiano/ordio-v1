# Studio Desk Core (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/studio` desktop workspace's persistent three-pane frame (top bar, left rail, center stage, right inspector, timeline strip) with real recording → transcription → edit wiring, reusing existing hooks and components rather than reinventing them.

**Architecture:** A new `useStudioFlow` hook wraps the same lower-level hooks `/create` already uses (`useAudioRecorder`, `useAudioAnalyser`, `useTranscription`, `useAudioProcessing`) but drives a **local view state machine** (`idle → capture → processing → edit → export`) instead of routing between pages — no navigation, the frame stays mounted and its panes morph. `StudioDesk` composes five pane components that each render different content per `view`. The center stage's Edit body reuses the real `CanvasPreview` renderer and `usePlayback` hook; the inspector's Edit section reuses the real `StyleControls` component. Everything routes through Convex/Clerk providers already supplied by the app's root layout.

**Tech Stack:** Next.js 15 App Router, React, Zustand (existing stores), Convex (existing `sessions` API), Vitest + React Testing Library, Tailwind + CVA (`apps/web/src/lib/studioVariants.ts`), the existing `--acid-*` design tokens in `globals.css`.

## Global Constraints

- Accent color: reuse the existing `acid-text-1` token (`#f4f5ef`, off-white) as the Studio accent via Tailwind utility classes (`bg-acid-text-1`, `text-acid-text-1`, `border-acid-text-1`). **Do not** use `acid-accent` (lime, `#c6ff3d`) or introduce any new hex literal — mobile's lime identity is untouched by this work.
- Destructive/live-recording signals reuse `acid-error` (`#ff5c5c`), matching mobile.
- No inline `style` props — CVA variants in `apps/web/src/lib/studioVariants.ts` for every repeated visual pattern (buttons, pills, rail rows, cards). Tailwind utility classes only, no arbitrary `w-[...]` values.
- `/studio` is auth-gated (no anonymous access, per the app's auth model) but shows no `SplashScreen` and no onboarding — unauthenticated users are redirected, not shown mobile's splash animation.
- The bottom "States" debug switcher from the Claude Design prototype is **not** ported into production code — it was a design-review-only harness (confirmed with user). State transitions are driven exclusively by real events.
- ⌘K, the prompt bar's command execution, and the copilot diff gate are **out of scope for this plan** (Slice 3/4 per the design spec) — the prompt bar renders but does not yet parse or execute input.
- Opening an arbitrary *past* clip from the library sets `view: 'edit'` but only the session just produced by this session's own recording has fully hydrated store state (style/canvas) to render — hydrating an older session's stores is out of scope here (tracked as a known limitation, not silently faked).

---

## File Structure

**Create:**
- `apps/web/src/hooks/studio/useStudioFlow.ts` — view state machine wrapping recording/transcription/processing hooks
- `apps/web/src/app/studio/layout.tsx` — auth-gated shell, no splash/onboarding
- `apps/web/src/app/studio/page.tsx` — mounts `<StudioDesk />`
- `apps/web/src/components/studio/StudioDesk.tsx` — top-level frame composition
- `apps/web/src/components/studio/TopBar.tsx`
- `apps/web/src/components/studio/PromptBar.tsx`
- `apps/web/src/components/studio/LeftRail.tsx`
- `apps/web/src/components/studio/CenterStage.tsx`
- `apps/web/src/components/studio/RightInspector.tsx`
- `apps/web/src/components/studio/TimelineStrip.tsx`
- `apps/web/src/lib/studioVariants.ts` — CVA variants for Studio-only components
- `apps/web/src/__tests__/useStudioFlow.test.ts`
- `apps/web/src/__tests__/StudioDesk.test.tsx`
- `apps/web/src/__tests__/LeftRail.test.tsx`
- `apps/web/src/__tests__/TimelineStrip.test.tsx`

**Modify:** none — this is additive; no existing mobile file changes.

---

### Task 1: `studioVariants.ts` — CVA primitives

**Files:**
- Create: `apps/web/src/lib/studioVariants.ts`
- Test: `apps/web/src/__tests__/studioVariants.test.ts`

**Interfaces:**
- Produces: `studioButton({ variant: 'primary' | 'secondary' })`, `studioPill({ active: boolean })`, `studioCard()`, `studioRailRow({ active: boolean })` — all CVA functions returning className strings, consumed by every later task.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/studioVariants.test.ts
import { describe, it, expect } from 'vitest';
import { studioButton, studioPill, studioCard, studioRailRow } from '@/lib/studioVariants';

describe('studioVariants', () => {
  it('studioButton primary uses the off-white accent, not lime', () => {
    const cls = studioButton({ variant: 'primary' });
    expect(cls).toContain('bg-acid-text-1');
    expect(cls).not.toContain('acid-accent');
  });

  it('studioButton secondary is a neutral surface', () => {
    const cls = studioButton({ variant: 'secondary' });
    expect(cls).toContain('bg-acid-surface-1');
  });

  it('studioPill toggles active styling', () => {
    expect(studioPill({ active: true })).toContain('bg-acid-text-1');
    expect(studioPill({ active: false })).toContain('bg-acid-surface-1');
  });

  it('studioCard returns the shared card shell', () => {
    expect(studioCard()).toContain('bg-acid-surface-1');
    expect(studioCard()).toContain('rounded-acid-md');
  });

  it('studioRailRow highlights the active row', () => {
    expect(studioRailRow({ active: true })).toContain('border-acid-text-1');
    expect(studioRailRow({ active: false })).not.toContain('border-acid-text-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/studioVariants.test.ts`
Expected: FAIL with "Cannot find module '@/lib/studioVariants'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/web/src/lib/studioVariants.ts
import { cva } from 'class-variance-authority';

/**
 * Studio-only CVA variants. Accent is the existing `acid-text-1` off-white
 * token — never `acid-accent` (lime is mobile's signature, not Studio's).
 */
export const studioButton = cva(
  'inline-flex items-center justify-center h-9 px-4 rounded-acid-sm text-sm font-bold transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-acid-text-1 text-acid-bg-base hover:bg-white',
        secondary:
          'bg-acid-surface-1 text-acid-text-1 border border-acid-border-default hover:bg-acid-surface-2',
      },
    },
    defaultVariants: { variant: 'primary' },
  }
);

export const studioPill = cva(
  'px-3 py-1.5 rounded-acid-sm text-xs font-bold cursor-pointer transition-colors',
  {
    variants: {
      active: {
        true: 'bg-acid-text-1 text-acid-bg-base',
        false: 'bg-acid-surface-1 text-acid-text-2 hover:text-acid-text-1',
      },
    },
    defaultVariants: { active: false },
  }
);

export const studioCard = cva(
  'bg-acid-surface-1 border border-acid-border-subtle rounded-acid-md p-3.5 flex flex-col gap-3'
);

export const studioRailRow = cva(
  'relative flex items-center gap-3 px-2.5 py-2.5 rounded-acid-md cursor-pointer overflow-hidden transition-colors',
  {
    variants: {
      active: {
        true: 'bg-acid-text-1/10 border border-acid-text-1/30',
        false: 'border border-transparent hover:bg-acid-surface-1',
      },
    },
    defaultVariants: { active: false },
  }
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/studioVariants.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/studioVariants.ts apps/web/src/__tests__/studioVariants.test.ts
git commit -m "feat(studio): add CVA variants for the desktop workspace"
```

---

### Task 2: `useStudioFlow` — the view state machine

**Files:**
- Create: `apps/web/src/hooks/studio/useStudioFlow.ts`
- Test: `apps/web/src/__tests__/useStudioFlow.test.ts`

**Interfaces:**
- Consumes: `useAudioRecorder()` (`{ isRecording, recordingTime, audioBlob, startRecording(): Promise<MediaStream|null>, stopRecording(): void }`), `useAudioAnalyser()` (`{ connectStream, getAudioLevel, disconnect }`), `useTranscription()` (`{ transcript: Word[], transcribeAudio, clearTranscript }`), `useAudioProcessing(transcription)` (`{ processingProgress, processAudio(blob): Promise<string|undefined>, cancelProcessing }`).
- Produces:
```typescript
export type StudioView = 'idle' | 'capture' | 'processing' | 'edit' | 'export';
export interface UseStudioFlowReturn {
  view: StudioView;
  sessionId: string | null;
  recordingTime: number;
  processingProgress: number;
  transcript: Word[];
  isStarting: boolean;
  micDenied: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  openClip: (sessionId: string) => void;
  goIdle: () => void;
  goExport: () => void;
  getAudioLevel: () => number;
}
export function useStudioFlow(): UseStudioFlowReturn
```
Later tasks (3, 6, 7, 8) consume this return shape exactly.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/useStudioFlow.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStudioFlow } from '@/hooks/studio/useStudioFlow';

const startRecording = vi.fn(async () => ({}) as unknown as MediaStream);
const stopRecording = vi.fn();
const connectStream = vi.fn();
const disconnect = vi.fn();
const transcribeAudio = vi.fn(async () => []);
const clearTranscript = vi.fn();
const processAudio = vi.fn(async () => 'session-123');

vi.mock('@/hooks/audio/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    recordingTime: 0,
    audioBlob: new Blob(['x']),
    error: null,
    startRecording,
    stopRecording,
  }),
}));
vi.mock('@/hooks/audio/useAudioAnalyser', () => ({
  useAudioAnalyser: () => ({ connectStream, getAudioLevel: () => 0.4, disconnect }),
}));
vi.mock('@/hooks/recording/useTranscription', () => ({
  useTranscription: () => ({
    transcript: [],
    isTranscribing: false,
    error: null,
    transcribeAudio,
    clearTranscript,
  }),
}));
vi.mock('@/hooks/audio/useAudioProcessing', () => ({
  useAudioProcessing: () => ({ processingProgress: 0, processAudio, cancelProcessing: vi.fn() }),
}));

describe('useStudioFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in idle', () => {
    const { result } = renderHook(() => useStudioFlow());
    expect(result.current.view).toBe('idle');
  });

  it('moves to capture on startRecording', async () => {
    const { result } = renderHook(() => useStudioFlow());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(startRecording).toHaveBeenCalled();
    expect(result.current.view).toBe('capture');
  });

  it('moves capture -> processing -> edit on stopRecording, setting sessionId', async () => {
    const { result } = renderHook(() => useStudioFlow());
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
    });
    expect(stopRecording).toHaveBeenCalled();
    expect(processAudio).toHaveBeenCalled();
    await waitFor(() => expect(result.current.view).toBe('edit'));
    expect(result.current.sessionId).toBe('session-123');
  });

  it('openClip jumps straight to edit with the given sessionId', () => {
    const { result } = renderHook(() => useStudioFlow());
    act(() => result.current.openClip('older-session'));
    expect(result.current.view).toBe('edit');
    expect(result.current.sessionId).toBe('older-session');
  });

  it('goIdle resets view and sessionId', () => {
    const { result } = renderHook(() => useStudioFlow());
    act(() => result.current.openClip('older-session'));
    act(() => result.current.goIdle());
    expect(result.current.view).toBe('idle');
    expect(result.current.sessionId).toBeNull();
  });

  it('goExport moves to export', () => {
    const { result } = renderHook(() => useStudioFlow());
    act(() => result.current.openClip('s1'));
    act(() => result.current.goExport());
    expect(result.current.view).toBe('export');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/useStudioFlow.test.ts`
Expected: FAIL with "Cannot find module '@/hooks/studio/useStudioFlow'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/web/src/hooks/studio/useStudioFlow.ts
'use client';

import { useCallback, useState } from 'react';
import { useAudioRecorder } from '@/hooks/audio/useAudioRecorder';
import { useAudioAnalyser } from '@/hooks/audio/useAudioAnalyser';
import { useTranscription } from '@/hooks/recording/useTranscription';
import { useAudioProcessing } from '@/hooks/audio/useAudioProcessing';
import type { Word } from '@Ordio/shared/schemas';

export type StudioView = 'idle' | 'capture' | 'processing' | 'edit' | 'export';

export interface UseStudioFlowReturn {
  view: StudioView;
  sessionId: string | null;
  recordingTime: number;
  processingProgress: number;
  transcript: Word[];
  isStarting: boolean;
  micDenied: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  openClip: (sessionId: string) => void;
  goIdle: () => void;
  goExport: () => void;
  getAudioLevel: () => number;
}

export function useStudioFlow(): UseStudioFlowReturn {
  const [view, setView] = useState<StudioView>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  const recorder = useAudioRecorder();
  const analyser = useAudioAnalyser();
  const transcription = useTranscription();
  const { processingProgress, processAudio } = useAudioProcessing(transcription);

  const startRecording = useCallback(async () => {
    setIsStarting(true);
    transcription.clearTranscript();
    try {
      const stream = await recorder.startRecording();
      if (!stream) {
        setMicDenied(true);
        return;
      }
      setMicDenied(false);
      analyser.connectStream(stream);
      setView('capture');
    } finally {
      setIsStarting(false);
    }
  }, [recorder, analyser, transcription]);

  const stopRecording = useCallback(async () => {
    recorder.stopRecording();
    analyser.disconnect();
    setView('processing');
    if (!recorder.audioBlob) return;
    const newSessionId = await processAudio(recorder.audioBlob);
    if (!newSessionId) {
      setView('idle');
      return;
    }
    setSessionId(newSessionId);
    setView('edit');
  }, [recorder, analyser, processAudio]);

  const openClip = useCallback((clipSessionId: string) => {
    setSessionId(clipSessionId);
    setView('edit');
  }, []);

  const goIdle = useCallback(() => {
    setSessionId(null);
    setView('idle');
  }, []);

  const goExport = useCallback(() => setView('export'), []);

  return {
    view,
    sessionId,
    recordingTime: recorder.recordingTime,
    processingProgress,
    transcript: transcription.transcript,
    isStarting,
    micDenied,
    startRecording,
    stopRecording,
    openClip,
    goIdle,
    goExport,
    getAudioLevel: analyser.getAudioLevel,
  };
}
```

`audioLevel` itself stays `0` from this hook — it's a poll-driven value. CenterStage (Task 5) owns the `requestAnimationFrame` loop that calls `flow.getAudioLevel()` while `view === 'capture'`, so no rAF loop runs during hook tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/useStudioFlow.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/studio/useStudioFlow.ts apps/web/src/__tests__/useStudioFlow.test.ts
git commit -m "feat(studio): add useStudioFlow view state machine"
```

---

### Task 3: `TopBar` and `PromptBar`

**Files:**
- Create: `apps/web/src/components/studio/TopBar.tsx`
- Create: `apps/web/src/components/studio/PromptBar.tsx`
- Test: `apps/web/src/__tests__/TopBar.test.tsx`

**Interfaces:**
- Consumes: `studioButton` from Task 1.
- Produces: `<TopBar title={string} onExport={() => void} />`, `<PromptBar visible={boolean} placeholder={string} />` (visual-only in this slice — no `onSubmit`, per Global Constraints).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/TopBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '@/components/studio/TopBar';

describe('TopBar', () => {
  it('renders the clip title and calls onExport when clicked', () => {
    const onExport = vi.fn();
    render(<TopBar title="Why I quit my design job" onExport={onExport} />);
    expect(screen.getByText('Why I quit my design job')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(onExport).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/TopBar.test.tsx`
Expected: FAIL with "Cannot find module '@/components/studio/TopBar'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/studio/TopBar.tsx
'use client';

import { studioButton } from '@/lib/studioVariants';

interface TopBarProps {
  title: string;
  onExport: () => void;
}

export function TopBar({ title, onExport }: TopBarProps) {
  return (
    <div className="h-15 flex-none flex items-center gap-4 px-4.5 bg-acid-bg-subtle border-b border-acid-border-subtle">
      <div className="flex items-center gap-3.5 w-65">
        <div className="w-7.5 h-7.5 rounded-lg bg-acid-text-1 text-acid-bg-base flex items-center justify-center font-acid-display font-bold text-lg flex-none">
          O
        </div>
        <div className="flex flex-col min-w-0">
          <div className="font-acid-display font-semibold text-base text-acid-text-1 truncate">
            {title}
          </div>
          <div className="text-xs text-acid-text-3">ordio / voice clips</div>
        </div>
      </div>
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2.5 h-8.5 px-3 bg-acid-surface-1 border border-acid-border-subtle rounded-acid-sm text-acid-text-3 text-sm min-w-75">
          Search actions, ask copilot…
          <span className="ml-auto flex gap-0.5">
            <kbd className="bg-acid-surface-2 border border-acid-border-subtle rounded px-1.5 text-[11px] font-bold text-acid-text-2">
              ⌘
            </kbd>
            <kbd className="bg-acid-surface-2 border border-acid-border-subtle rounded px-1.5 text-[11px] font-bold text-acid-text-2">
              K
            </kbd>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className={studioButton({ variant: 'primary' })} onClick={onExport}>
          Export ↗
        </button>
        <div className="w-8.5 h-8.5 rounded-full bg-acid-surface-2 border border-acid-border-default flex items-center justify-center text-sm font-bold text-acid-text-1">
          MK
        </div>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/src/components/studio/PromptBar.tsx
'use client';

interface PromptBarProps {
  visible: boolean;
  placeholder: string;
}

export function PromptBar({ visible, placeholder }: PromptBarProps) {
  if (!visible) return null;
  return (
    <div className="absolute left-1/2 bottom-6.5 -translate-x-1/2 w-[min(560px,80%)]">
      <div className="flex items-center gap-3 h-14 pl-4.5 pr-2 bg-acid-surface-1 border border-acid-border-default rounded-acid-lg shadow-2xl">
        <span className="text-acid-text-1 text-lg">✦</span>
        <div className="flex-1 text-[15px] text-acid-text-2">{placeholder}</div>
        <button
          className="w-10 h-10 rounded-acid-sm bg-acid-text-1 text-acid-bg-base font-bold"
          aria-label="Submit prompt"
          disabled
        >
          ↑
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/TopBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/studio/TopBar.tsx apps/web/src/components/studio/PromptBar.tsx apps/web/src/__tests__/TopBar.test.tsx
git commit -m "feat(studio): add TopBar and PromptBar"
```

---

### Task 4: `LeftRail` — Library (real Convex data) and Transcript

**Files:**
- Create: `apps/web/src/components/studio/LeftRail.tsx`
- Test: `apps/web/src/__tests__/LeftRail.test.tsx`

**Interfaces:**
- Consumes: `studioRailRow` (Task 1), `api.sessions.listMySessionsPaginated` (existing Convex query, real shape per `packages/convex/convex/sessions.ts`: `{ id, name, createdAt, updatedAt, expiresAt, durationMs }` — no `status` field; every session in this list is already finalized), `formatDuration` from `@/components/saved-audio/formatters` (existing).
- Produces: `<LeftRail view={StudioView} activeSessionId={string|null} onOpenClip={(id: string) => void} transcript={Word[]} />`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/LeftRail.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftRail } from '@/components/studio/LeftRail';

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({
    results: [
      { id: 's1', name: 'Why I quit my design job', durationMs: 47000, createdAt: Date.now() },
      { id: 's2', name: 'Untitled recording', durationMs: 58000, createdAt: Date.now() },
    ],
  }),
}));
vi.mock('@Ordio/convex', () => ({
  api: { sessions: { listMySessionsPaginated: 'sessions:listMySessionsPaginated' } },
}));

describe('LeftRail', () => {
  it('shows the Library in idle view and opens a clip on click', () => {
    const onOpenClip = vi.fn();
    render(<LeftRail view="idle" activeSessionId={null} onOpenClip={onOpenClip} transcript={[]} />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Why I quit my design job'));
    expect(onOpenClip).toHaveBeenCalledWith('s1');
  });

  it('shows the Transcript in edit view', () => {
    render(
      <LeftRail
        view="edit"
        activeSessionId="s1"
        onOpenClip={vi.fn()}
        transcript={[{ text: 'Hello', start: 0, end: 0.4 }]}
      />
    );
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/LeftRail.test.tsx`
Expected: FAIL with "Cannot find module '@/components/studio/LeftRail'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/studio/LeftRail.tsx
'use client';

import { useConvexAuth, usePaginatedQuery } from 'convex/react';
import { api } from '@Ordio/convex';
import { formatDuration } from '@/components/saved-audio/formatters';
import { studioRailRow } from '@/lib/studioVariants';
import type { StudioView } from '@/hooks/studio/useStudioFlow';
import type { Word } from '@Ordio/shared/schemas';

const PAGE_SIZE = 12;

interface LeftRailProps {
  view: StudioView;
  activeSessionId: string | null;
  onOpenClip: (sessionId: string) => void;
  transcript: Word[];
}

export function LeftRail({ view, activeSessionId, onOpenClip, transcript }: LeftRailProps) {
  const isTranscript = view === 'edit' || view === 'export';

  return (
    <div className="w-70 flex-none bg-acid-bg-subtle border-r border-acid-border-subtle flex flex-col min-h-0 overflow-y-auto">
      {isTranscript ? (
        <TranscriptPane transcript={transcript} />
      ) : (
        <LibraryPane activeSessionId={activeSessionId} onOpenClip={onOpenClip} />
      )}
    </div>
  );
}

function LibraryPane({
  activeSessionId,
  onOpenClip,
}: {
  activeSessionId: string | null;
  onOpenClip: (sessionId: string) => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { results: sessions } = usePaginatedQuery(
    api.sessions.listMySessionsPaginated,
    isAuthenticated ? {} : 'skip',
    { initialNumItems: PAGE_SIZE }
  );

  return (
    <>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="font-acid-display font-semibold text-[15px] text-acid-text-1">Library</div>
        <div className="text-[11px] text-acid-text-3 bg-acid-surface-1 border border-acid-border-subtle px-2 py-0.5 rounded">
          {sessions.length} clips
        </div>
      </div>
      <div className="flex-1 px-2.5 pb-3 flex flex-col gap-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={studioRailRow({ active: session.id === activeSessionId })}
            onClick={() => onOpenClip(session.id)}
          >
            <div className="w-11 h-11 rounded-lg bg-acid-surface-2 border border-acid-border-subtle flex-none" />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold text-acid-text-1 truncate">{session.name}</div>
              <div className="text-[11.5px] text-acid-text-3 mt-0.5">{formatDuration(session.durationMs)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TranscriptPane({ transcript }: { transcript: Word[] }) {
  return (
    <>
      <div className="px-4 pt-3.5 pb-2.5 border-b border-acid-border-subtle">
        <div className="font-acid-display font-semibold text-[15px] text-acid-text-1">Transcript</div>
        <div className="text-[11px] text-acid-text-3 mt-0.5">Click a word to cut it</div>
      </div>
      <div className="flex-1 p-4 leading-loose text-[15px]">
        {transcript.map((word, i) => (
          <span key={`${word.text}-${i}`} className="text-acid-text-2 cursor-pointer rounded px-0.5">
            {word.text}{' '}
          </span>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/LeftRail.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/studio/LeftRail.tsx apps/web/src/__tests__/LeftRail.test.tsx
git commit -m "feat(studio): add LeftRail with real Library query and Transcript view"
```

---

### Task 5: `CenterStage` — Idle, Capture, Processing bodies

**Files:**
- Create: `apps/web/src/components/studio/CenterStage.tsx`
- Test: `apps/web/src/__tests__/CenterStage.test.tsx`

**Interfaces:**
- Consumes: `UseStudioFlowReturn` fields (`view`, `audioLevel`, `recordingTime`, `processingProgress`, `micDenied`, `startRecording`, `stopRecording`), `PromptBar` (Task 3).
- Produces: `<CenterStage flow={UseStudioFlowReturn} sessionData={SessionEditData | null} audioLevel={number} />` — `SessionEditData` (for Edit/Export bodies) is defined and consumed in Task 6; this task only needs to accept and ignore it for now, so the prop is added here and filled in next task. `audioLevel` is a plain number prop, not read from `flow` — `StudioDesk` (Task 9) owns the single `requestAnimationFrame` poll of `flow.getAudioLevel()` and passes the live value down to both `CenterStage` and `RightInspector`, so there is only one poll loop for the whole desk.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/CenterStage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CenterStage } from '@/components/studio/CenterStage';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

function makeFlow(overrides: Partial<UseStudioFlowReturn>): UseStudioFlowReturn {
  return {
    view: 'idle',
    sessionId: null,
    audioLevel: 0,
    recordingTime: 0,
    processingProgress: 0,
    transcript: [],
    isStarting: false,
    micDenied: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    openClip: vi.fn(),
    goIdle: vi.fn(),
    goExport: vi.fn(),
    getAudioLevel: vi.fn(() => 0),
    ...overrides,
  };
}

describe('CenterStage', () => {
  it('idle: shows the record orb and calls startRecording on click', () => {
    const flow = makeFlow({ view: 'idle' });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} />);
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    expect(flow.startRecording).toHaveBeenCalled();
  });

  it('capture: shows recording timer and calls stopRecording on click', () => {
    const flow = makeFlow({ view: 'capture', recordingTime: 12 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} />);
    expect(screen.getByText(/recording/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    expect(flow.stopRecording).toHaveBeenCalled();
  });

  it('processing: shows progress percentage', () => {
    const flow = makeFlow({ view: 'processing', processingProgress: 42 });
    render(<CenterStage flow={flow} sessionData={null} audioLevel={0} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/CenterStage.test.tsx`
Expected: FAIL with "Cannot find module '@/components/studio/CenterStage'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/studio/CenterStage.tsx
'use client';

import { PromptBar } from './PromptBar';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

// Filled in by Task 6 — Edit/Export bodies need playback + canvas data.
export interface SessionEditData {
  sessionId: string;
}

interface CenterStageProps {
  flow: UseStudioFlowReturn;
  sessionData: SessionEditData | null;
  audioLevel: number;
}

function formatTimer(seconds: number): string {
  const t = Math.floor(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function CenterStage({ flow, sessionData, audioLevel }: CenterStageProps) {
  return (
    <div className="flex-1 relative flex flex-col items-center justify-center min-w-0 bg-[radial-gradient(120%_90%_at_50%_0%,var(--acid-bg-subtle)_0%,var(--acid-bg-base)_60%)] p-7">
      {flow.view === 'idle' && (
        <div className="flex flex-col items-center gap-8.5">
          <div className="text-center">
            <div className="font-acid-display font-semibold text-[46px] leading-[1.02] text-acid-text-1 tracking-tight">
              What are we making
              <br />
              today?
            </div>
            <div className="text-[15px] text-acid-text-3 mt-3.5">
              Tap the orb to record, drop a file anywhere, or press ⌘K.
            </div>
          </div>
          <button
            aria-label="Tap to record"
            onClick={() => void flow.startRecording()}
            disabled={flow.isStarting}
            className="w-37.5 h-37.5 rounded-full bg-[radial-gradient(circle_at_34%_28%,#ffffff,var(--acid-text-1)_45%,var(--acid-surface-3)_100%)] flex items-center justify-center cursor-pointer"
          >
            <div className="w-5 h-8.5 rounded-xl bg-acid-bg-base/80" />
          </button>
          {flow.micDenied && (
            <div className="text-xs text-acid-error">Microphone access denied — check browser settings.</div>
          )}
        </div>
      )}

      {flow.view === 'capture' && (
        <div className="w-full max-w-160 flex flex-col items-center gap-7.5">
          <div className="flex items-center gap-2.5 text-acid-text-1 font-bold text-[13px] uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-full bg-acid-error animate-pulse" />
            Recording <span className="text-acid-text-3 tabular-nums normal-case tracking-normal">{formatTimer(flow.recordingTime)}</span>
          </div>
          <div className="w-full h-37.5 flex items-center justify-center gap-0.5" aria-hidden="true">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded bg-acid-text-1/70"
                style={{ height: `${20 + Math.abs(Math.sin(i * 0.7 + audioLevel * 10)) * 70}%` }}
              />
            ))}
          </div>
          <button
            aria-label="Stop recording"
            onClick={() => void flow.stopRecording()}
            className="w-16 h-16 rounded-full border-3 border-acid-border-default flex items-center justify-center"
          >
            <div className="w-5.5 h-5.5 rounded-md bg-acid-error" />
          </button>
        </div>
      )}

      {flow.view === 'processing' && (
        <div className="w-full max-w-165 flex flex-col items-center gap-5.5">
          <div className="flex items-center gap-3.5">
            <div
              className="w-13 h-13 rounded-full"
              style={{ background: `conic-gradient(var(--acid-text-1) ${flow.processingProgress * 3.6}deg, var(--acid-surface-2) 0deg)` }}
            />
            <div>
              <div className="font-acid-display font-semibold text-[19px] text-acid-text-1">
                Transcribing your clip…
              </div>
              <div className="text-xs text-acid-text-3 mt-0.5">
                {Math.round(flow.processingProgress)}% · you can keep recording, this won't block you
              </div>
            </div>
          </div>
        </div>
      )}

      {flow.view === 'edit' && sessionData && (
        <div className="text-acid-text-3 text-sm">Editing {sessionData.sessionId}</div>
      )}

      <PromptBar
        visible={flow.view === 'idle' || flow.view === 'edit'}
        placeholder={flow.view === 'edit' ? 'remove all the ums' : 'record, drop, or ask anything…'}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/CenterStage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/studio/CenterStage.tsx apps/web/src/__tests__/CenterStage.test.tsx
git commit -m "feat(studio): add CenterStage idle/capture/processing bodies"
```

---

### Task 6: `CenterStage` Edit body — real `CanvasPreview` + `usePlayback`

**Files:**
- Modify: `apps/web/src/components/studio/CenterStage.tsx`
- Modify: `apps/web/src/__tests__/CenterStage.test.tsx`

**Interfaces:**
- Consumes: `usePlayback()` (`{ isPlaying, currentTime, duration, play, pause, seek, load }` from `@/hooks/playback/usePlayback`), `CanvasPreview` from `@/components/primitives/video/CanvasPreview` (props: `playback`, `format`, `waveformStyle`, `captionMode`, `canvasLayout?`, `graphicStyle?`, `showWatermark?`), `useUIStore` — `format: FormatVariant`, `captionMode: CaptionMode`, and `waveformStyle` are top-level fields on `UIState` (`apps/web/src/stores/uiStore.ts`), the same fields mobile's `/create/export/[sessionId]/page.tsx` reads before passing them into `ExportState`/`ExportCanvas`. `processAudio` already populates this store, so no new plumbing is needed — just select the same three fields.
- Produces: `SessionEditData` now carries the real fields the Edit body renders; `CenterStage` renders `<CanvasPreview>` when `flow.view === 'edit'`.

- [ ] **Step 1: Extend the failing test**

Add to `apps/web/src/__tests__/CenterStage.test.tsx`:

```typescript
vi.mock('@/hooks/playback/usePlayback', () => ({
  usePlayback: () => ({
    isPlaying: false,
    currentTime: 0,
    duration: 47,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    load: vi.fn(),
  }),
}));
vi.mock('@/components/primitives/video/CanvasPreview', () => ({
  default: () => <div data-testid="canvas-preview" />,
}));

it('edit: renders the canvas preview once a session is loaded', () => {
  const flow = makeFlow({ view: 'edit', sessionId: 's1' });
  render(<CenterStage flow={flow} sessionData={{ sessionId: 's1' }} audioLevel={0} />);
  expect(screen.getByTestId('canvas-preview')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/CenterStage.test.tsx`
Expected: FAIL — no `canvas-preview` testid rendered yet (Edit body is still the placeholder text from Task 5)

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/studio/CenterStage.tsx — replace the Edit body block and imports
'use client';

import { PromptBar } from './PromptBar';
import { usePlayback } from '@/hooks/playback/usePlayback';
import CanvasPreview from '@/components/primitives/video/CanvasPreview';
import { useUIStore } from '@/stores';
import type { UseStudioFlowReturn } from '@/hooks/studio/useStudioFlow';

export interface SessionEditData {
  sessionId: string;
}

// ... (formatTimer, CenterStageProps unchanged from Task 5) ...

export function CenterStage({ flow, sessionData, audioLevel }: CenterStageProps) {
  const playback = usePlayback();
  const format = useUIStore((s) => s.format);
  const waveformStyle = useUIStore((s) => s.waveformStyle);
  const captionMode = useUIStore((s) => s.captionMode);

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center min-w-0 bg-[radial-gradient(120%_90%_at_50%_0%,var(--acid-bg-subtle)_0%,var(--acid-bg-base)_60%)] p-7">
      {/* ...idle / capture / processing bodies unchanged... */}

      {flow.view === 'edit' && sessionData && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-67.5 h-120 rounded-acid-lg overflow-hidden border border-acid-border-default shadow-2xl">
            <CanvasPreview
              playback={playback}
              format={format}
              waveformStyle={waveformStyle}
              captionMode={captionMode}
            />
          </div>
        </div>
      )}

      <PromptBar
        visible={flow.view === 'idle' || flow.view === 'edit'}
        placeholder={flow.view === 'edit' ? 'remove all the ums' : 'record, drop, or ask anything…'}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/CenterStage.test.tsx`
Expected: PASS (all CenterStage tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/studio/CenterStage.tsx apps/web/src/__tests__/CenterStage.test.tsx
git commit -m "feat(studio): wire CenterStage Edit body to real CanvasPreview + usePlayback"
```

---

### Task 7: `RightInspector`

**Files:**
- Create: `apps/web/src/components/studio/RightInspector.tsx`
- Test: `apps/web/src/__tests__/RightInspector.test.tsx`

**Interfaces:**
- Consumes: `StyleControls` (default export, `apps/web/src/components/soul/captions/StyleControls.tsx`, prop `onLocked?`), `studioCard` (Task 1), `StudioView` (Task 2).
- Produces: `<RightInspector view={StudioView} audioLevel={number} onLocked={(feature) => void} />`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/RightInspector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightInspector } from '@/components/studio/RightInspector';

vi.mock('@/components/soul/captions/StyleControls', () => ({
  default: () => <div data-testid="style-controls" />,
}));

describe('RightInspector', () => {
  it('idle: shows input settings', () => {
    render(<RightInspector view="idle" audioLevel={0} onLocked={vi.fn()} />);
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('edit: renders the real StyleControls and a background placeholder', () => {
    render(<RightInspector view="edit" audioLevel={0} onLocked={vi.fn()} />);
    expect(screen.getByTestId('style-controls')).toBeInTheDocument();
    expect(screen.getAllByText(/background/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/RightInspector.test.tsx`
Expected: FAIL with "Cannot find module '@/components/studio/RightInspector'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/studio/RightInspector.tsx
'use client';

import StyleControls from '@/components/soul/captions/StyleControls';
import { studioCard } from '@/lib/studioVariants';
import type { StudioView } from '@/hooks/studio/useStudioFlow';
import type { FeatureKey } from '@/lib/featureGates';

interface RightInspectorProps {
  view: StudioView;
  audioLevel: number;
  onLocked: (feature: FeatureKey) => void;
}

export function RightInspector({ view, audioLevel, onLocked }: RightInspectorProps) {
  return (
    <div className="w-80 flex-none bg-acid-bg-subtle border-l border-acid-border-subtle overflow-y-auto p-4 flex flex-col gap-3.5 min-h-0">
      {view === 'idle' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Input</div>
          <div className={studioCard()}>
            <div>
              <div className="text-[11px] text-acid-text-3 uppercase tracking-wide mb-1.5">Microphone</div>
              <div className="flex items-center justify-between text-[13.5px] text-acid-text-1 font-bold">
                System default <span className="text-acid-text-3">▾</span>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'capture' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Listening</div>
          <div className={studioCard()}>
            <div className="flex items-center gap-2 text-acid-text-1 text-xs font-bold">
              <span className="w-1.75 h-1.75 rounded-full bg-acid-text-1 animate-pulse" />
              Clean signal
            </div>
            <div className="flex gap-1 h-10 items-end" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 flex-none bg-acid-text-1 rounded"
                  style={{ height: `${20 + audioLevel * 60 + i}%` }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'processing' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Transcription</div>
          <div className={studioCard() + ' text-xs text-acid-text-3'}>
            <div className="flex justify-between">
              Model<span className="text-acid-text-1 font-bold">Ordio Whisper-XL</span>
            </div>
          </div>
        </>
      )}

      {view === 'edit' && (
        <>
          <div className="font-acid-display font-semibold text-sm text-acid-text-1">Caption Style</div>
          <StyleControls onLocked={onLocked} />
          <div className="font-acid-display font-semibold text-sm text-acid-text-1 mt-1">Background</div>
          <div className={studioCard() + ' text-xs text-acid-text-3'}>
            Background picker ships once video-backgrounds lands on this branch.
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/RightInspector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/studio/RightInspector.tsx apps/web/src/__tests__/RightInspector.test.tsx
git commit -m "feat(studio): add RightInspector, reusing real StyleControls in Edit"
```

---

### Task 8: `TimelineStrip`

**Files:**
- Create: `apps/web/src/components/studio/TimelineStrip.tsx`
- Test: `apps/web/src/__tests__/TimelineStrip.test.tsx`

**Interfaces:**
- Consumes: `currentTime: number`, `duration: number`, `onSeek: (time: number) => void` (from the `usePlayback` instance owned by `StudioDesk`, passed down).
- Produces: `<TimelineStrip currentTime={number} duration={number} onSeek={(t) => void} />` — click/drag anywhere on the strip seeks.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/TimelineStrip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineStrip } from '@/components/studio/TimelineStrip';

describe('TimelineStrip', () => {
  it('renders formatted start/end time and seeks on click', () => {
    const onSeek = vi.fn();
    render(<TimelineStrip currentTime={10} duration={47} onSeek={onSeek} />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('0:47')).toBeInTheDocument();

    const strip = screen.getByTestId('timeline-strip');
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 400, width: 400, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => {},
    });
    fireEvent.pointerDown(strip, { clientX: 200 });
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(23.5, 1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/TimelineStrip.test.tsx`
Expected: FAIL with "Cannot find module '@/components/studio/TimelineStrip'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/studio/TimelineStrip.tsx
'use client';

import { useRef } from 'react';

interface TimelineStripProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function TimelineStrip({ currentTime, duration, onSeek }: TimelineStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const progress = duration > 0 ? currentTime / duration : 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="h-25 flex-none bg-acid-bg-subtle border-t border-acid-border-subtle px-4.5 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-acid-text-3 font-bold">
        <span className="flex gap-3.5">
          <span className="text-acid-text-1">Timeline</span>
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration)}</span>
        </span>
      </div>
      <div
        ref={stripRef}
        data-testid="timeline-strip"
        onPointerDown={handlePointerDown}
        className="flex-1 relative flex items-center cursor-pointer"
      >
        <div className="w-full h-13 bg-acid-surface-1 rounded-acid-sm" aria-hidden="true" />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-acid-text-1 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/TimelineStrip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/studio/TimelineStrip.tsx apps/web/src/__tests__/TimelineStrip.test.tsx
git commit -m "feat(studio): add TimelineStrip with click-to-seek"
```

---

### Task 9: `StudioDesk` composition + `/studio` route

**Files:**
- Create: `apps/web/src/components/studio/StudioDesk.tsx`
- Create: `apps/web/src/app/studio/layout.tsx`
- Create: `apps/web/src/app/studio/page.tsx`
- Test: `apps/web/src/__tests__/StudioDesk.test.tsx`

**Interfaces:**
- Consumes: `useStudioFlow` (Task 2), `TopBar` (3), `LeftRail` (4), `CenterStage` (5/6), `RightInspector` (7), `TimelineStrip` (8), `usePlayback` (existing).
- Produces: `<StudioDesk />` — the full frame; `apps/web/src/app/studio/page.tsx` renders it with no other chrome.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/__tests__/StudioDesk.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioDesk } from '@/components/studio/StudioDesk';

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  usePaginatedQuery: () => ({ results: [] }),
}));
vi.mock('@Ordio/convex', () => ({
  api: { sessions: { listMySessionsPaginated: 'sessions:listMySessionsPaginated' } },
}));
vi.mock('@/hooks/playback/usePlayback', () => ({
  usePlayback: () => ({
    isPlaying: false, currentTime: 0, duration: 0, play: vi.fn(), pause: vi.fn(), seek: vi.fn(), load: vi.fn(),
  }),
}));

describe('StudioDesk', () => {
  it('renders the frame in idle view', () => {
    render(<StudioDesk />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText(/what are we making/i)).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-strip')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/StudioDesk.test.tsx`
Expected: FAIL with "Cannot find module '@/components/studio/StudioDesk'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/studio/StudioDesk.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudioFlow } from '@/hooks/studio/useStudioFlow';
import { usePlayback } from '@/hooks/playback/usePlayback';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { CenterStage } from './CenterStage';
import { RightInspector } from './RightInspector';
import { TimelineStrip } from './TimelineStrip';

export function StudioDesk() {
  const flow = useStudioFlow();
  const playback = usePlayback();

  // Single audio-level poll for the whole desk — both CenterStage's live
  // waveform and RightInspector's level meter read this one value.
  const [audioLevel, setAudioLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (flow.view !== 'capture') {
      setAudioLevel(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setAudioLevel(flow.getAudioLevel());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flow.view, flow.getAudioLevel]);

  return (
    <div className="w-full h-dvh bg-acid-bg-base text-acid-text-1 flex flex-col overflow-hidden">
      <TopBar title="Untitled recording" onExport={flow.goExport} />
      <div className="flex-1 flex min-h-0 relative">
        <LeftRail
          view={flow.view}
          activeSessionId={flow.sessionId}
          onOpenClip={flow.openClip}
          transcript={flow.transcript}
        />
        <CenterStage
          flow={flow}
          sessionData={flow.sessionId ? { sessionId: flow.sessionId } : null}
          audioLevel={audioLevel}
        />
        <RightInspector view={flow.view} audioLevel={audioLevel} onLocked={() => {}} />
      </div>
      <TimelineStrip currentTime={playback.currentTime} duration={playback.duration} onSeek={playback.seek} />
    </div>
  );
}
```

```tsx
// apps/web/src/app/studio/page.tsx
import { StudioDesk } from '@/components/studio/StudioDesk';

export default function StudioPage() {
  return <StudioDesk />;
}
```

```tsx
// apps/web/src/app/studio/layout.tsx
'use client';

import { useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';

// No dedicated /sign-in route exists in this app — mobile's SplashScreen
// triggers Clerk's imperative modal via useClerk(), not a route redirect.
// Studio mirrors that mechanism, just without the splash animation.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  useEffect(() => {
    if (isLoaded && !isSignedIn) openSignIn();
  }, [isLoaded, isSignedIn, openSignIn]);

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="w-full h-dvh bg-acid-bg-base flex items-center justify-center text-acid-text-3 text-sm">
        Sign in to continue.
      </div>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/StudioDesk.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm --filter web run type-check && pnpm --filter web run lint && pnpm --filter web run test`
Expected: all green, including the pre-existing 58 tests (no mobile files were touched, so none should regress)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/studio/StudioDesk.tsx apps/web/src/app/studio apps/web/src/__tests__/StudioDesk.test.tsx
git commit -m "feat(studio): compose StudioDesk and mount the /studio route"
```

---

## Manual Verification (after Task 9)

1. `pnpm --filter web dev`, visit `http://localhost:3000/studio` while signed in.
2. Confirm: no splash screen, no onboarding — the desk renders immediately.
3. Click the record orb → mic permission prompt → speak → confirm the live waveform bars react and the timer increments.
4. Click stop → confirm the view moves to Processing with a live percentage, then to Edit once transcription completes.
5. Confirm the left rail now shows the real Transcript (not Library), the center stage shows the real video preview via `CanvasPreview`, and the right inspector shows the real `StyleControls` — changing a style option there should visibly update the canvas (shared store).
6. Click a different, older clip in Library (after clicking "‹ Library" — not built in this slice, so instead reload `/studio`, which reopens Idle/Library) → confirm it switches to Edit and does **not** crash (per the documented known limitation, canvas may be blank/stale for a session not just recorded in this tab).
7. Resize the window — confirm the three-pane frame holds at typical desktop widths (1280–1920px) without overflow.

## Known Limitations (explicitly deferred, not silent gaps)

- ⌘K, prompt bar execution, and the copilot diff gate: Slice 3/4 of the design spec.
- Direct-manipulation captions, multi-format export matrix: Slices 5–6.
- Background picker: blocked on `feature/video-backgrounds` merging into this branch.
- Opening a past (not just-recorded) session in Edit does not yet hydrate its style/canvas state — Slice 2 (EDL) is the natural place to add session hydration, since it already needs to load a session's word timestamps for transcript editing.
- `TimelineStrip` only supports click-to-seek, not trim handles or silence heatmap — those require the cut-list (EDL) data model from Slice 2 and would mean inventing that model early. Building it here would front-run the spec's own architecture.
- `packages/engine` extraction (repo-structure design Slice 0) is not part of this plan — Studio imports directly from `apps/web/src/lib` and `apps/web/src/components/primitives`, matching how `/create` already does it. Extracting the engine package is a pure refactor with no UI-visible effect and can land independently at any time.
