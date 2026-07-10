# Clip-Finder Wedge Implementation Plan (Slices 0–3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload a full podcast episode (≤90 min) → chunked transcription → AI finds up to 3 hook moments (30–60s) → user picks one → it becomes a normal Ordio session trimmed to that window.

**Architecture:** Long episodes get a new ingestion path that never fully decodes audio in memory (streaming decode via Mediabunny → mono 16kHz → Opus/WebM chunks → per-chunk `/api/transcribe` calls → client-side merge). A new `/api/find-clips` route runs one GPT-4o-mini structured-output call over the merged transcript. The picked clip window is seek-decoded from the original local file at full quality and fed into the **existing** `createSession` → `/create/export/[sessionId]` flow, so the editor/export path is untouched. Video backgrounds (design slice 4) are a separate follow-up plan.

**Tech Stack:** Next.js 15, Mediabunny 1.34 (demux/decode/encode), WebCodecs, OpenAI (`whisper-1` + `gpt-4o-mini`), Convex, Zod, Vitest.

## Global Constraints

- Spec: `~/.gstack/projects/ciobiano-ordio-v1/bg_ralph-main-design-20260710-081415.md` (Status: APPROVED).
- Episodes: hard reject > 90 min (5400s) or > 250 MB, before any upload spend.
- Never fully decode an episode: no `decodeAudioData` on files routed to the episode path.
- Chunk target: ~10 min (600s) on the Opus path; ~5 min (300s) on WAV fallback. Whisper limit is 25MB per request (already enforced by `/api/transcribe`).
- Per-chunk transcription retries once; on second failure offer "use partial transcript" or abort. Resume state is in-memory only.
- Clip candidates: 30–60s windows, within episode bounds, non-overlapping; 1–2 candidates is success (never force 3 by retrying).
- Sparse transcript (< 30 words/min) → tell the user plainly, don't return garbage candidates.
- Every async state has an explicit cancel/exit back to idle (project design rule).
- No inline style props; CVA/`cn` for variants (project rule). Lazy-init SDK clients (never module level).
- Workflow: implement all tasks, run `pnpm --filter web run test` + `typecheck` + `lint` ONCE at the end, then commit in logical groups (user preference — overrides per-task TDD ceremony). Test code is still written per task, alongside the implementation.
- Commit messages: conventional commits, no Co-Authored-By.

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/schemas.ts` (modify) | `ClipCandidateSchema` — shared clip window type |
| `apps/web/src/lib/media/episodePlan.ts` (create) | Pure: episode limits, chunk-window planning, per-second energy accumulation, word-density check |
| `apps/web/src/lib/media/audioCodecSupport.ts` (create) | Detect ingest encode strategy: `opus` → `wav` ladder |
| `apps/web/src/lib/media/episodeIngest.ts` (create) | Browser-only: streaming decode (Mediabunny) → downmix 16k mono → encode chunk blobs + emit energy. No unit tests (WebCodecs unavailable in jsdom); pure logic lives in `episodePlan.ts` |
| `apps/web/src/lib/media/extractWindow.ts` (create) | Seek-based decode of one [start,end] window at original quality (Mediabunny `AudioBufferSink.buffers(start, end)`) |
| `apps/web/src/lib/transcription/transcribeChunk.ts` (create) | POST one chunk to `/api/transcribe`, retry once |
| `apps/web/src/lib/transcription/mergeChunkTranscripts.ts` (create) | Pure: offset chunk words to episode time, monotonicity checks |
| `apps/web/src/lib/clips/validateCandidates.ts` (create) | Pure: validate/clamp LLM candidates (bounds, 30–60s, overlap) |
| `apps/web/src/lib/clips/fallbackWindows.ts` (create) | Pure: top-energy 45s windows from `waveformData` when LLM fails |
| `apps/web/src/app/api/find-clips/route.ts` (create) | GPT-4o-mini structured output → validated `ClipCandidate[]` |
| `apps/web/src/hooks/audio/useEpisodeIngestion.ts` (create) | Orchestrator: validate → chunk → transcribe (retry/partial) → find clips → candidates state machine |
| `apps/web/src/components/soul/clips/ClipPickerSheet.tsx` (create) | Candidate cards UI; pick → window extraction → `createSession` → navigate |
| `apps/web/src/hooks/recording/useCreateFlow.ts` (modify) | Route long files (> 15 min) to the episode path |
| `apps/web/src/lib/fileValidation.ts` (modify) | Episode-path size constant + episode error messages |

---

### Task 1: `ClipCandidate` shared schema

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Test: `apps/web/src/__tests__/clipCandidate.test.ts`

**Interfaces:**
- Produces: `ClipCandidateSchema`, `type ClipCandidate = { start: number; end: number; hookText: string; rationale: string }` — consumed by Tasks 6, 7, 8, 10, 11.

- [ ] **Step 1: Add schema** — append to `packages/shared/src/schemas.ts`:

```typescript
/**
 * A candidate clip window found inside a long episode.
 * start/end are episode-absolute seconds; windows are 30–60s.
 */
export const ClipCandidateSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  hookText: z.string().min(1),
  rationale: z.string().min(1),
});

export type ClipCandidate = z.infer<typeof ClipCandidateSchema>;
```

- [ ] **Step 2: Write test** — `apps/web/src/__tests__/clipCandidate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ClipCandidateSchema } from '@Ordio/shared/schemas';

describe('ClipCandidateSchema', () => {
  it('accepts a valid candidate', () => {
    const c = { start: 61.2, end: 105.9, hookText: 'the moment everything changed', rationale: 'strong opener' };
    expect(ClipCandidateSchema.parse(c)).toEqual(c);
  });

  it('rejects negative times and empty hookText', () => {
    expect(ClipCandidateSchema.safeParse({ start: -1, end: 10, hookText: 'x', rationale: 'y' }).success).toBe(false);
    expect(ClipCandidateSchema.safeParse({ start: 0, end: 10, hookText: '', rationale: 'y' }).success).toBe(false);
  });
});
```

---

### Task 2: Episode planning pure module

**Files:**
- Create: `apps/web/src/lib/media/episodePlan.ts`
- Test: `apps/web/src/__tests__/episodePlan.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 5, 9, 10):
  - `MAX_EPISODE_SEC = 5400`, `MAX_EPISODE_BYTES = 250 * 1024 * 1024`, `EPISODE_ROUTE_THRESHOLD_SEC = 900`
  - `planChunkWindows(durationSec: number, chunkSec: number): Array<{ start: number; end: number }>`
  - `createEnergyAccumulator(durationSec: number): { add(samples: Float32Array, chunkStartSec: number, sampleRate: number): void; finish(): number[] }` (per-second RMS, normalized 0–1)
  - `isSparseTranscript(wordCount: number, durationSec: number): boolean` (< 30 words/min)

- [ ] **Step 1: Implement** — `apps/web/src/lib/media/episodePlan.ts`:

```typescript
/**
 * Pure planning + accumulation logic for the long-episode ingestion path.
 * No DOM, no WebCodecs — fully unit-testable.
 */

export const MAX_EPISODE_SEC = 90 * 60; // design: hard reject above 90 min
export const MAX_EPISODE_BYTES = 250 * 1024 * 1024;
/** Files longer than this route to the episode pipeline instead of processAudio. */
export const EPISODE_ROUTE_THRESHOLD_SEC = 15 * 60;
export const OPUS_CHUNK_SEC = 600; // ~10 min per design
export const WAV_CHUNK_SEC = 300; // ~5 min on WAV fallback
const SPARSE_WORDS_PER_MIN = 30;

export function planChunkWindows(
  durationSec: number,
  chunkSec: number
): Array<{ start: number; end: number }> {
  if (durationSec <= 0 || chunkSec <= 0) return [];
  const windows: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < durationSec; start += chunkSec) {
    windows.push({ start, end: Math.min(start + chunkSec, durationSec) });
  }
  return windows;
}

export function isSparseTranscript(wordCount: number, durationSec: number): boolean {
  if (durationSec <= 0) return true;
  return wordCount / (durationSec / 60) < SPARSE_WORDS_PER_MIN;
}

/**
 * Accumulates per-second RMS energy across streamed sample chunks.
 * finish() normalizes to 0–1 (all-silence input yields all zeros).
 */
export function createEnergyAccumulator(durationSec: number) {
  const seconds = Math.max(1, Math.ceil(durationSec));
  const sumSquares = new Float64Array(seconds);
  const counts = new Float64Array(seconds);

  return {
    add(samples: Float32Array, chunkStartSec: number, sampleRate: number): void {
      for (let i = 0; i < samples.length; i++) {
        const sec = Math.min(seconds - 1, Math.floor(chunkStartSec + i / sampleRate));
        const v = samples[i]!;
        sumSquares[sec]! += v * v;
        counts[sec]! += 1;
      }
    },
    finish(): number[] {
      const rms = Array.from({ length: seconds }, (_, s) =>
        counts[s]! > 0 ? Math.sqrt(sumSquares[s]! / counts[s]!) : 0
      );
      const max = Math.max(...rms);
      return max > 0 ? rms.map((v) => v / max) : rms;
    },
  };
}
```

- [ ] **Step 2: Write tests** — `apps/web/src/__tests__/episodePlan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  planChunkWindows,
  createEnergyAccumulator,
  isSparseTranscript,
  OPUS_CHUNK_SEC,
} from '@/lib/media/episodePlan';

describe('planChunkWindows', () => {
  it('splits a 25-min episode into 600s windows with a short tail', () => {
    expect(planChunkWindows(1500, OPUS_CHUNK_SEC)).toEqual([
      { start: 0, end: 600 },
      { start: 600, end: 1200 },
      { start: 1200, end: 1500 },
    ]);
  });

  it('returns one window when episode is shorter than a chunk', () => {
    expect(planChunkWindows(120, 600)).toEqual([{ start: 0, end: 120 }]);
  });

  it('returns [] for zero/negative duration', () => {
    expect(planChunkWindows(0, 600)).toEqual([]);
  });
});

describe('isSparseTranscript', () => {
  it('flags under 30 words/min', () => {
    expect(isSparseTranscript(29, 60)).toBe(true);
    expect(isSparseTranscript(31, 60)).toBe(false);
  });
});

describe('createEnergyAccumulator', () => {
  it('produces normalized per-second RMS with loud second > quiet second', () => {
    const acc = createEnergyAccumulator(2);
    const rate = 100;
    const loud = new Float32Array(rate).fill(0.8);
    const quiet = new Float32Array(rate).fill(0.2);
    acc.add(loud, 0, rate);
    acc.add(quiet, 1, rate);
    const energy = acc.finish();
    expect(energy).toHaveLength(2);
    expect(energy[0]).toBeCloseTo(1, 5);
    expect(energy[1]!).toBeLessThan(energy[0]!);
  });

  it('yields zeros for silence', () => {
    const acc = createEnergyAccumulator(1);
    acc.add(new Float32Array(10), 0, 10);
    expect(acc.finish()).toEqual([0]);
  });
});
```

---

### Task 3: Transcript merge

**Files:**
- Create: `apps/web/src/lib/transcription/mergeChunkTranscripts.ts`
- Test: `apps/web/src/__tests__/mergeChunkTranscripts.test.ts`

**Interfaces:**
- Consumes: `Word` from `@Ordio/shared/schemas`.
- Produces (consumed by Task 10): `mergeChunkTranscripts(chunks: Array<{ startSec: number; words: Word[] }>): Word[]` — episode-absolute, monotonic.

- [ ] **Step 1: Implement**:

```typescript
import type { Word } from '@Ordio/shared/schemas';

/**
 * Merge per-chunk Whisper transcripts into one episode-absolute word list.
 * Each chunk's words are offset by the chunk's start; monotonicity is
 * enforced across chunk seams (a word can never start before the previous
 * word's start — Whisper occasionally emits tiny overlaps at boundaries).
 */
export function mergeChunkTranscripts(
  chunks: Array<{ startSec: number; words: Word[] }>
): Word[] {
  const sorted = [...chunks].sort((a, b) => a.startSec - b.startSec);
  const out: Word[] = [];
  let lastStart = -Infinity;
  for (const chunk of sorted) {
    for (const w of chunk.words) {
      const start = Math.max(w.start + chunk.startSec, lastStart);
      const end = Math.max(w.end + chunk.startSec, start);
      out.push({ text: w.text, start, end });
      lastStart = start;
    }
  }
  return out;
}
```

- [ ] **Step 2: Write tests**:

```typescript
import { describe, it, expect } from 'vitest';
import { mergeChunkTranscripts } from '@/lib/transcription/mergeChunkTranscripts';

describe('mergeChunkTranscripts', () => {
  it('offsets words by chunk start', () => {
    const merged = mergeChunkTranscripts([
      { startSec: 0, words: [{ text: 'hello', start: 0.5, end: 0.9 }] },
      { startSec: 600, words: [{ text: 'world', start: 1.0, end: 1.4 }] },
    ]);
    expect(merged).toEqual([
      { text: 'hello', start: 0.5, end: 0.9 },
      { text: 'world', start: 601.0, end: 601.4 },
    ]);
  });

  it('clamps seam overlaps to keep starts monotonic', () => {
    const merged = mergeChunkTranscripts([
      { startSec: 0, words: [{ text: 'a', start: 599.8, end: 600.2 }] },
      { startSec: 600, words: [{ text: 'b', start: -0.5, end: 0.1 }] }, // would be 599.5
    ]);
    expect(merged[1]!.start).toBeGreaterThanOrEqual(merged[0]!.start);
    expect(merged[1]!.end).toBeGreaterThanOrEqual(merged[1]!.start);
  });

  it('sorts out-of-order chunks', () => {
    const merged = mergeChunkTranscripts([
      { startSec: 600, words: [{ text: 'later', start: 0, end: 1 }] },
      { startSec: 0, words: [{ text: 'first', start: 0, end: 1 }] },
    ]);
    expect(merged.map((w) => w.text)).toEqual(['first', 'later']);
  });
});
```

---

### Task 4: Candidate validation + energy fallback

**Files:**
- Create: `apps/web/src/lib/clips/validateCandidates.ts`
- Create: `apps/web/src/lib/clips/fallbackWindows.ts`
- Test: `apps/web/src/__tests__/clipWindows.test.ts`

**Interfaces:**
- Produces:
  - `validateCandidates(raw: unknown, durationSec: number): ClipCandidate[]` — parses with `ClipCandidateSchema`, drops out-of-bounds / non-30–60s / overlapping entries (keeps first of an overlapping pair), returns up to 3. Consumed by Task 6 (server) and Task 10 (client re-check).
  - `fallbackWindows(energy: number[], durationSec: number): ClipCandidate[]` — top-energy non-overlapping 45s windows, `hookText: 'High-energy moment'`, `rationale: 'Picked by audio energy (AI selection unavailable)'`. Consumed by Task 10.

- [ ] **Step 1: Implement `validateCandidates.ts`**:

```typescript
import { z } from 'zod';
import { ClipCandidateSchema, type ClipCandidate } from '@Ordio/shared/schemas';

const MIN_LEN = 30;
const MAX_LEN = 60;

/**
 * Parse and sanitize LLM-proposed clip windows.
 * Invalid entries are dropped, not repaired; overlap keeps the earlier window.
 */
export function validateCandidates(raw: unknown, durationSec: number): ClipCandidate[] {
  const parsed = z.array(ClipCandidateSchema).safeParse(raw);
  if (!parsed.success) return [];

  const valid = parsed.data
    .filter((c) => {
      const len = c.end - c.start;
      return c.start >= 0 && c.end <= durationSec && len >= MIN_LEN && len <= MAX_LEN;
    })
    .sort((a, b) => a.start - b.start);

  const out: ClipCandidate[] = [];
  for (const c of valid) {
    const overlaps = out.some((k) => c.start < k.end && c.end > k.start);
    if (!overlaps) out.push(c);
    if (out.length === 3) break;
  }
  return out;
}
```

- [ ] **Step 2: Implement `fallbackWindows.ts`**:

```typescript
import type { ClipCandidate } from '@Ordio/shared/schemas';

const WINDOW_SEC = 45;

/**
 * Deterministic fallback when the LLM can't produce valid candidates:
 * the top-energy non-overlapping 45s windows from per-second RMS data.
 */
export function fallbackWindows(energy: number[], durationSec: number): ClipCandidate[] {
  const maxStart = Math.floor(durationSec - WINDOW_SEC);
  if (maxStart < 0) return [];

  const scores: Array<{ start: number; score: number }> = [];
  for (let start = 0; start <= maxStart; start++) {
    let sum = 0;
    for (let s = start; s < start + WINDOW_SEC && s < energy.length; s++) sum += energy[s] ?? 0;
    scores.push({ start, score: sum });
  }
  scores.sort((a, b) => b.score - a.score);

  const out: ClipCandidate[] = [];
  for (const { start } of scores) {
    const end = start + WINDOW_SEC;
    if (!out.some((k) => start < k.end && end > k.start)) {
      out.push({
        start,
        end,
        hookText: 'High-energy moment',
        rationale: 'Picked by audio energy (AI selection unavailable)',
      });
    }
    if (out.length === 3) break;
  }
  return out;
}
```

- [ ] **Step 3: Write tests** — `apps/web/src/__tests__/clipWindows.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateCandidates } from '@/lib/clips/validateCandidates';
import { fallbackWindows } from '@/lib/clips/fallbackWindows';

const mk = (start: number, end: number) => ({ start, end, hookText: 'h', rationale: 'r' });

describe('validateCandidates', () => {
  it('keeps valid 30–60s in-bounds windows, max 3', () => {
    const raw = [mk(0, 45), mk(100, 150), mk(300, 340), mk(500, 550)];
    expect(validateCandidates(raw, 3600)).toHaveLength(3);
  });

  it('drops windows out of bounds or with bad length', () => {
    const raw = [mk(0, 20), mk(0, 90), mk(3590, 3650), mk(60, 100)];
    expect(validateCandidates(raw, 3600)).toEqual([mk(60, 100)]);
  });

  it('drops overlapping windows, keeping the earlier one', () => {
    const raw = [mk(0, 45), mk(30, 75)];
    expect(validateCandidates(raw, 3600)).toEqual([mk(0, 45)]);
  });

  it('returns [] for garbage input', () => {
    expect(validateCandidates('nope', 3600)).toEqual([]);
    expect(validateCandidates([{ start: 'x' }], 3600)).toEqual([]);
  });

  it('1–2 candidates is a valid result (never forces 3)', () => {
    expect(validateCandidates([mk(0, 45)], 3600)).toHaveLength(1);
  });
});

describe('fallbackWindows', () => {
  it('returns the highest-energy non-overlapping windows first', () => {
    const energy = new Array(200).fill(0.1);
    for (let s = 100; s < 145; s++) energy[s] = 1.0;
    const wins = fallbackWindows(energy, 200);
    expect(wins.length).toBeGreaterThan(0);
    expect(wins[0]!.start).toBeGreaterThanOrEqual(90);
    expect(wins[0]!.start).toBeLessThanOrEqual(110);
    for (let i = 1; i < wins.length; i++) {
      expect(wins[i]!.start >= wins[i - 1]!.end || wins[i]!.end <= wins[i - 1]!.start).toBe(true);
    }
  });

  it('returns [] when episode is shorter than a window', () => {
    expect(fallbackWindows([1, 1, 1], 30)).toEqual([]);
  });
});
```

---

### Task 5: Ingest codec support + episode ingest engine

**Files:**
- Create: `apps/web/src/lib/media/audioCodecSupport.ts`
- Create: `apps/web/src/lib/media/episodeIngest.ts`
- Test: `apps/web/src/__tests__/audioCodecSupport.test.ts`

**Interfaces:**
- Consumes: `planChunkWindows`, `createEnergyAccumulator`, `OPUS_CHUNK_SEC`, `WAV_CHUNK_SEC` (Task 2); `audioBufferToWavBlob` from `@/hooks/audio/processing/whisperAudio` (existing).
- Produces (consumed by Task 10):
  - `detectIngestStrategy(): Promise<'opus' | 'wav'>`
  - `ingestEpisode(file: File, opts: { signal: AbortSignal; onProgress?: (fraction: number) => void }): Promise<{ durationSec: number; chunks: Array<{ startSec: number; blob: Blob }>; energy: number[] }>` — throws `EpisodeIngestError` with `code: 'too_long' | 'undecodable'`.

- [ ] **Step 1: Implement `audioCodecSupport.ts`** (Mediabunny wraps the WebCodecs checks — design's fallback ladder collapses to opus→wav here because Mediabunny handles decode fallbacks internally, and MP3/AAC passthrough would require a demux-level splitter that YAGNI says we skip until the spike shows Opus support is actually missing on target devices):

```typescript
/**
 * Ingest encode strategy for episode chunks.
 * 'opus'  — encode mono 16kHz Opus in WebM (data-light path, ~10 min chunks)
 * 'wav'   — WAV fallback where Opus encoding is unavailable (~5 min chunks)
 */
export type IngestStrategy = 'opus' | 'wav';

export async function detectIngestStrategy(): Promise<IngestStrategy> {
  try {
    const { canEncodeAudio } = await import('mediabunny');
    return (await canEncodeAudio('opus')) ? 'opus' : 'wav';
  } catch {
    return 'wav';
  }
}
```

- [ ] **Step 2: Implement `episodeIngest.ts`** (streaming — at no point is more than one chunk of PCM alive):

```typescript
import {
  planChunkWindows,
  createEnergyAccumulator,
  OPUS_CHUNK_SEC,
  WAV_CHUNK_SEC,
  MAX_EPISODE_SEC,
} from './episodePlan';
import { detectIngestStrategy, type IngestStrategy } from './audioCodecSupport';
import { audioBufferToWavBlob } from '@/hooks/audio/processing/whisperAudio';

export type EpisodeIngestErrorCode = 'too_long' | 'undecodable';

export class EpisodeIngestError extends Error {
  code: EpisodeIngestErrorCode;
  constructor(code: EpisodeIngestErrorCode, message: string) {
    super(message);
    this.name = 'EpisodeIngestError';
    this.code = code;
  }
}

const TARGET_RATE = 16_000;

export interface EpisodeIngestResult {
  durationSec: number;
  strategy: IngestStrategy;
  chunks: Array<{ startSec: number; blob: Blob }>;
  energy: number[];
}

/** Resample+downmix one decoded window to mono 16kHz via OfflineAudioContext. */
async function toMono16k(buffer: AudioBuffer): Promise<AudioBuffer> {
  const length = Math.ceil(buffer.duration * TARGET_RATE);
  const ctx = new OfflineAudioContext(1, Math.max(1, length), TARGET_RATE);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

async function encodeChunk(mono16k: AudioBuffer, strategy: IngestStrategy): Promise<Blob> {
  if (strategy === 'wav') return audioBufferToWavBlob(mono16k);
  const { Output, BufferTarget, WebMOutputFormat, AudioBufferSource, QUALITY_LOW } = await import('mediabunny');
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const source = new AudioBufferSource({ codec: 'opus', bitrate: QUALITY_LOW });
  output.addAudioTrack(source);
  await output.start();
  await source.add(mono16k);
  source.close();
  await output.finalize();
  const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
  if (!buffer) throw new Error('Opus encode produced no output');
  return new Blob([buffer], { type: 'audio/webm' });
}

/**
 * Stream-ingest a long episode: decode window-by-window (never the whole
 * file), downmix each window to mono 16kHz, encode it as an upload-ready
 * chunk, and accumulate per-second energy as a byproduct.
 */
export async function ingestEpisode(
  file: File,
  opts: { signal: AbortSignal; onProgress?: (fraction: number) => void }
): Promise<EpisodeIngestResult> {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) {
      throw new EpisodeIngestError('undecodable', 'This browser cannot decode this file.');
    }
    const durationSec = await track.computeDuration();
    if (durationSec > MAX_EPISODE_SEC) {
      throw new EpisodeIngestError('too_long', 'Episodes longer than 90 minutes are not supported.');
    }

    const strategy = await detectIngestStrategy();
    const chunkSec = strategy === 'opus' ? OPUS_CHUNK_SEC : WAV_CHUNK_SEC;
    const windows = planChunkWindows(durationSec, chunkSec);
    const energyAcc = createEnergyAccumulator(durationSec);
    const chunks: Array<{ startSec: number; blob: Blob }> = [];

    for (let i = 0; i < windows.length; i++) {
      if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { start, end } = windows[i]!;

      // Decode only this window's samples; buffers stream and are dropped after use.
      const sink = new AudioBufferSink(track);
      const pieces: AudioBuffer[] = [];
      for await (const { buffer } of sink.buffers(start, end)) {
        if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        pieces.push(buffer);
      }
      if (pieces.length === 0) continue;

      const { concatAudioBuffers } = await import('./decodeMediaToAudioBuffer');
      const windowBuffer = concatAudioBuffers(pieces);
      pieces.length = 0;

      const mono = await toMono16k(windowBuffer);
      energyAcc.add(mono.getChannelData(0), start, TARGET_RATE);
      chunks.push({ startSec: start, blob: await encodeChunk(mono, strategy) });
      opts.onProgress?.((i + 1) / windows.length);
    }

    return { durationSec, strategy, chunks, energy: energyAcc.finish() };
  } finally {
    input.dispose();
  }
}
```

- [ ] **Step 3: Write test for the strategy detector** — `apps/web/src/__tests__/audioCodecSupport.test.ts` (`episodeIngest.ts` itself needs real WebCodecs; it is exercised by `/qa` on device, not jsdom):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('detectIngestStrategy', () => {
  beforeEach(() => vi.resetModules());

  it('returns opus when mediabunny reports Opus encodable', async () => {
    vi.doMock('mediabunny', () => ({ canEncodeAudio: vi.fn().mockResolvedValue(true) }));
    const { detectIngestStrategy } = await import('@/lib/media/audioCodecSupport');
    expect(await detectIngestStrategy()).toBe('opus');
  });

  it('returns wav when Opus is not encodable', async () => {
    vi.doMock('mediabunny', () => ({ canEncodeAudio: vi.fn().mockResolvedValue(false) }));
    const { detectIngestStrategy } = await import('@/lib/media/audioCodecSupport');
    expect(await detectIngestStrategy()).toBe('wav');
  });

  it('returns wav when mediabunny import fails', async () => {
    vi.doMock('mediabunny', () => { throw new Error('no webcodecs'); });
    const { detectIngestStrategy } = await import('@/lib/media/audioCodecSupport');
    expect(await detectIngestStrategy()).toBe('wav');
  });
});
```

---

### Task 6: `/api/find-clips` route

**Files:**
- Create: `apps/web/src/app/api/find-clips/route.ts`
- Test: covered by Task 4's `validateCandidates` tests (the route is a thin shell; its prompt/retry behavior is exercised in manual QA).

**Interfaces:**
- Consumes: `validateCandidates` (Task 4), `Word` type.
- Produces (consumed by Task 10): `POST /api/find-clips` with JSON body `{ words: Word[]; durationSec: number }` → `200 { candidates: ClipCandidate[] }` (possibly empty) or `4xx/5xx { error: string }`. Client treats empty/failed as "use fallbackWindows".

- [ ] **Step 1: Implement** (mirrors the lazy-client pattern from `app/api/transcribe/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { WordSchema } from '@Ordio/shared/schemas';
import { validateCandidates } from '@/lib/clips/validateCandidates';

// Lazy-init — never instantiate at module level (breaks `next build`)
let openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

const RequestSchema = z.object({
  words: z.array(WordSchema).min(1),
  durationSec: z.number().positive(),
});

const MODEL = 'gpt-4o-mini';

function buildPrompt(words: z.infer<typeof WordSchema>[], durationSec: number): string {
  // Timestamped transcript, one line per ~10s bucket, keeps tokens bounded.
  const lines: string[] = [];
  let bucket = -1;
  let current: string[] = [];
  for (const w of words) {
    const b = Math.floor(w.start / 10);
    if (b !== bucket) {
      if (current.length) lines.push(`[${bucket * 10}s] ${current.join(' ')}`);
      bucket = b;
      current = [];
    }
    current.push(w.text);
  }
  if (current.length) lines.push(`[${bucket * 10}s] ${current.join(' ')}`);

  return [
    `You select viral-worthy clips from a podcast transcript (total length ${Math.round(durationSec)}s).`,
    `Find up to 3 self-contained moments of 30-60 seconds each that would hook a listener in the first moment: strong claims, emotional peaks, surprising stories, punchlines.`,
    `Windows must not overlap and must fit within the episode. If the episode is short, fewer than 3 is fine.`,
    `Return JSON: {"candidates":[{"start":<sec>,"end":<sec>,"hookText":"<the hook phrase, verbatim from transcript>","rationale":"<why this hooks>"}]}`,
    ``,
    `TRANSCRIPT:`,
    ...lines,
  ].join('\n');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = RequestSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { words, durationSec } = body.data;

    const client = getClient();
    const ask = async (extraInstruction?: string) => {
      const completion = await client.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'user', content: buildPrompt(words, durationSec) },
          ...(extraInstruction ? [{ role: 'user' as const, content: extraInstruction }] : []),
        ],
      });
      const content = completion.choices[0]?.message?.content ?? '{}';
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return [];
      }
      const candidatesRaw = (parsed as { candidates?: unknown }).candidates;
      return validateCandidates(candidatesRaw, durationSec);
    };

    let candidates = await ask();
    if (candidates.length === 0) {
      // One corrective retry per design; after that the client falls back to energy windows.
      candidates = await ask(
        'Your previous answer contained no valid windows. Every window MUST be 30-60 seconds long, within the episode duration, and non-overlapping. Try again.'
      );
    }

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('[find-clips]', err);
    const message = err instanceof Error ? err.message : 'Clip finding failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

### Task 7: Per-chunk transcription client

**Files:**
- Create: `apps/web/src/lib/transcription/transcribeChunk.ts`
- Test: `apps/web/src/__tests__/transcribeChunk.test.ts`

**Interfaces:**
- Produces (consumed by Task 10): `transcribeChunk(blob: Blob, signal: AbortSignal): Promise<Word[]>` — one internal retry, then throws.

- [ ] **Step 1: Implement**:

```typescript
import type { Word } from '@Ordio/shared/schemas';

/**
 * POST one episode chunk to the existing stateless /api/transcribe route.
 * Retries once on failure (network or 5xx); aborts propagate immediately.
 */
export async function transcribeChunk(blob: Blob, signal: AbortSignal): Promise<Word[]> {
  const attempt = async (): Promise<Word[]> => {
    const formData = new FormData();
    const ext = blob.type.includes('webm') ? 'webm' : 'wav';
    formData.append('audio', blob, `chunk.${ext}`);
    const res = await fetch('/api/transcribe', { method: 'POST', body: formData, signal });
    if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
    const { words } = (await res.json()) as { words: Word[] };
    return words;
  };

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return attempt();
  }
}
```

- [ ] **Step 2: Write tests**:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';

const okResponse = { ok: true, json: async () => ({ words: [{ text: 'hi', start: 0, end: 1 }] }) };

afterEach(() => vi.unstubAllGlobals());

describe('transcribeChunk', () => {
  it('returns words on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse));
    const words = await transcribeChunk(new Blob(['x'], { type: 'audio/webm' }), new AbortController().signal);
    expect(words).toEqual([{ text: 'hi', start: 0, end: 1 }]);
  });

  it('retries once after a failure, then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(okResponse);
    vi.stubGlobal('fetch', fetchMock);
    const words = await transcribeChunk(new Blob(['x']), new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(words).toHaveLength(1);
  });

  it('throws after two failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      transcribeChunk(new Blob(['x']), new AbortController().signal)
    ).rejects.toThrow('Transcription failed (500)');
  });

  it('does not retry on abort', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(transcribeChunk(new Blob(['x']), new AbortController().signal)).rejects.toThrow('Aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

---

### Task 8: Window extraction (pick → full-quality clip audio)

**Files:**
- Create: `apps/web/src/lib/media/extractWindow.ts`

**Interfaces:**
- Consumes: `concatAudioBuffers` from `@/lib/media/decodeMediaToAudioBuffer` (existing).
- Produces (consumed by Task 11): `extractWindow(file: File, startSec: number, endSec: number): Promise<AudioBuffer>` — original-quality audio for just the picked window; the slice-1 no-full-decode rule carries over (seek-based).

- [ ] **Step 1: Implement**:

```typescript
import { concatAudioBuffers } from './decodeMediaToAudioBuffer';

/**
 * Seek-decode only [startSec, endSec] of the original local file at
 * original quality. Never decodes the whole episode (30-60s of PCM max).
 */
export async function extractWindow(
  file: File,
  startSec: number,
  endSec: number
): Promise<AudioBuffer> {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) {
      throw new Error('Cannot decode this file for clip extraction.');
    }
    const sink = new AudioBufferSink(track);
    const pieces: AudioBuffer[] = [];
    for await (const { buffer } of sink.buffers(startSec, endSec)) {
      pieces.push(buffer);
    }
    if (pieces.length === 0) throw new Error('No audio decoded in the selected window.');
    return concatAudioBuffers(pieces);
  } finally {
    input.dispose();
  }
}
```

*(No jsdom test — WebCodecs; exercised on device via `/qa` alongside `episodeIngest`.)*

---

### Task 9: Episode file validation + routing constants

**Files:**
- Modify: `apps/web/src/lib/fileValidation.ts`
- Test: extend `apps/web/src/__tests__/` (new file `episodeValidation.test.ts`)

**Interfaces:**
- Produces (consumed by Tasks 10, 12): `MAX_EPISODE_FILE_BYTES`, `validateEpisodeFile(file: File): FileValidationError | null`, extended `FileValidationError` union with `'episode_too_large'`, message in `FILE_ERROR_MESSAGES`.

- [ ] **Step 1: Implement** — append to `lib/fileValidation.ts`:

```typescript
export const MAX_EPISODE_FILE_BYTES = 250 * 1024 * 1024; // episodes route, per design

export function validateEpisodeFile(file: File): FileValidationError | null {
  if (file.size > MAX_EPISODE_FILE_BYTES) return 'episode_too_large';
  if (!isAcceptedFileType(file)) return 'unsupported_format';
  return null;
}
```

And modify the existing union + messages:

```typescript
export type FileValidationError = 'too_large' | 'unsupported_format' | 'episode_too_large';

export const FILE_ERROR_MESSAGES: Record<FileValidationError, string> = {
  too_large: 'File is too large — maximum is 50 MB',
  unsupported_format: 'Unsupported format — try MP3, M4A, WAV, WEBM, OGG, FLAC, or MP4',
  episode_too_large: 'Episode is too large — maximum is 250 MB',
};
```

- [ ] **Step 2: Write tests** — `apps/web/src/__tests__/episodeValidation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateEpisodeFile, MAX_EPISODE_FILE_BYTES } from '@/lib/fileValidation';

const mkFile = (size: number, type = 'audio/mpeg', name = 'ep.mp3') => {
  const f = new File([''], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('validateEpisodeFile', () => {
  it('accepts a 200MB mp3', () => {
    expect(validateEpisodeFile(mkFile(200 * 1024 * 1024))).toBeNull();
  });
  it('rejects above 250MB', () => {
    expect(validateEpisodeFile(mkFile(MAX_EPISODE_FILE_BYTES + 1))).toBe('episode_too_large');
  });
  it('rejects unsupported formats', () => {
    expect(validateEpisodeFile(mkFile(1000, 'application/pdf', 'x.pdf'))).toBe('unsupported_format');
  });
});
```

---

### Task 10: `useEpisodeIngestion` orchestrator hook

**Files:**
- Create: `apps/web/src/hooks/audio/useEpisodeIngestion.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 4, 5, 7 exports; `toast` from `sonner`.
- Produces (consumed by Task 12):

```typescript
interface UseEpisodeIngestionReturn {
  phase: 'idle' | 'ingesting' | 'transcribing' | 'finding' | 'picking' | 'error';
  progress: number;                    // 0–100 across ingest+transcribe
  candidates: ClipCandidate[];         // populated in 'picking'
  episodeFile: File | null;            // original file, kept for extractWindow
  episodeWords: Word[];                // merged episode-absolute transcript
  error: string | null;
  partialAvailable: boolean;           // a chunk failed twice; offer partial
  startEpisode: (file: File) => Promise<void>;
  usePartialTranscript: () => Promise<void>;
  cancel: () => void;                  // explicit exit → 'idle' (design rule)
}
```

- [ ] **Step 1: Implement**:

```typescript
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { ingestEpisode, EpisodeIngestError } from '@/lib/media/episodeIngest';
import { isSparseTranscript } from '@/lib/media/episodePlan';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';
import { mergeChunkTranscripts } from '@/lib/transcription/mergeChunkTranscripts';
import { fallbackWindows } from '@/lib/clips/fallbackWindows';
import { validateCandidates } from '@/lib/clips/validateCandidates';

type Phase = 'idle' | 'ingesting' | 'transcribing' | 'finding' | 'picking' | 'error';

export function useEpisodeIngestion() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [episodeFile, setEpisodeFile] = useState<File | null>(null);
  const [episodeWords, setEpisodeWords] = useState<Word[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [partialAvailable, setPartialAvailable] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // In-memory resume state (session-only per design): transcribed chunks survive a failure.
  const transcribedRef = useRef<Array<{ startSec: number; words: Word[] }>>([]);
  const energyRef = useRef<number[]>([]);
  const durationRef = useRef(0);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    transcribedRef.current = [];
    setPhase('idle');
    setProgress(0);
    setCandidates([]);
    setEpisodeFile(null);
    setEpisodeWords([]);
    setError(null);
    setPartialAvailable(false);
  }, []);

  const findClips = useCallback(async (words: Word[], durationSec: number, signal: AbortSignal) => {
    setPhase('finding');
    if (isSparseTranscript(words.length, durationSec)) {
      setError("We couldn't find enough speech in this episode to suggest clips. Music-heavy or mostly instrumental episodes aren't supported yet.");
      setPhase('error');
      return;
    }
    let found: ClipCandidate[] = [];
    try {
      const res = await fetch('/api/find-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, durationSec }),
        signal,
      });
      if (res.ok) {
        const { candidates: raw } = (await res.json()) as { candidates: unknown };
        found = validateCandidates(raw, durationSec);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // fall through to energy fallback
    }
    if (found.length === 0) {
      found = fallbackWindows(energyRef.current, durationSec);
      if (found.length > 0) toast.info('AI clip selection was unavailable — showing high-energy moments instead.');
    }
    if (found.length === 0) {
      setError('No clip candidates could be generated for this episode.');
      setPhase('error');
      return;
    }
    setEpisodeWords(words);
    setCandidates(found);
    setPhase('picking');
  }, []);

  const startEpisode = useCallback(async (file: File) => {
    const abort = new AbortController();
    abortRef.current = abort;
    setEpisodeFile(file);
    setError(null);
    setPartialAvailable(false);
    transcribedRef.current = [];
    try {
      // Phase 1: ingest (0–40%)
      setPhase('ingesting');
      setProgress(0);
      const result = await ingestEpisode(file, {
        signal: abort.signal,
        onProgress: (f) => setProgress(Math.round(f * 40)),
      });
      energyRef.current = result.energy;
      durationRef.current = result.durationSec;

      // Phase 2: per-chunk transcription (40–90%)
      setPhase('transcribing');
      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i]!;
        try {
          const words = await transcribeChunk(chunk.blob, abort.signal);
          transcribedRef.current.push({ startSec: chunk.startSec, words });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          // Chunk failed twice (transcribeChunk retries internally). Per design:
          // never silently discard already-spent upload data — offer partial.
          if (transcribedRef.current.length > 0) {
            setPartialAvailable(true);
            setError('Part of the episode could not be transcribed.');
            setPhase('error');
            return;
          }
          throw err;
        }
        setProgress(40 + Math.round(((i + 1) / result.chunks.length) * 50));
      }

      // Phase 3: clip finding (90–100%)
      const merged = mergeChunkTranscripts(transcribedRef.current);
      setProgress(95);
      await findClips(merged, result.durationSec, abort.signal);
      setProgress(100);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        cancel();
        return;
      }
      const message =
        err instanceof EpisodeIngestError
          ? err.message
          : 'Episode processing failed. Please try again.';
      console.error('[useEpisodeIngestion]', err);
      setError(message);
      setPhase('error');
    } finally {
      abortRef.current = null;
    }
  }, [cancel, findClips]);

  const usePartialTranscript = useCallback(async () => {
    const merged = mergeChunkTranscripts(transcribedRef.current);
    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    setPartialAvailable(false);
    try {
      await findClips(merged, durationRef.current, abort.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') { cancel(); return; }
      setError('Clip finding failed.');
      setPhase('error');
    } finally {
      abortRef.current = null;
    }
  }, [cancel, findClips]);

  return {
    phase, progress, candidates, episodeFile, episodeWords, error, partialAvailable,
    startEpisode, usePartialTranscript, cancel,
  };
}
```

*(Hook is integration-level; its pure dependencies are unit-tested in Tasks 2–4, 7. State-machine behavior is verified by the state-machine-reviewer agent + `/qa` before the user test.)*

---

### Task 11: `ClipPickerSheet` UI

**Files:**
- Create: `apps/web/src/components/soul/clips/ClipPickerSheet.tsx`

**Interfaces:**
- Consumes: `ClipCandidate`, `extractWindow` (Task 8), `audioBufferToWavBlob` (existing `@/hooks/audio/processing/whisperAudio`), `Sheet`/`SheetContent` (existing `@/components/ui/sheet`), Convex `api.jobs.generateUploadUrl` + `api.sessions.createSession` (existing).
- Produces: `<ClipPickerSheet isOpen candidates episodeFile episodeWords onClose onPicked(sessionId) />`.
- Behavior on pick: extract window audio → WAV blob → upload → `createSession` with window-relative transcript (words within [start,end], shifted by −start) → `onPicked(sessionId)` (caller navigates to `/create/export/[sessionId]`).

- [ ] **Step 1: Implement** (styling follows `UploadActionSheet.tsx` conventions — dark sheet, rows, `cn`, no inline styles):

```typescript
'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import { toast } from 'sonner';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { extractWindow } from '@/lib/media/extractWindow';
import { audioBufferToWavBlob } from '@/hooks/audio/processing/whisperAudio';

interface ClipPickerSheetProps {
  isOpen: boolean;
  candidates: ClipCandidate[];
  episodeFile: File | null;
  episodeWords: Word[];
  onClose: () => void;
  onPicked: (sessionId: string) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Words inside [start,end], re-based to clip-relative time. */
export function windowTranscript(words: Word[], start: number, end: number): Word[] {
  return words
    .filter((w) => w.start >= start && w.end <= end)
    .map((w) => ({ text: w.text, start: w.start - start, end: w.end - start }));
}

export function ClipPickerSheet({
  isOpen, candidates, episodeFile, episodeWords, onClose, onPicked,
}: ClipPickerSheetProps) {
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);

  const pick = async (candidate: ClipCandidate, index: number) => {
    if (!episodeFile || pickingIndex !== null) return;
    setPickingIndex(index);
    try {
      const buffer = await extractWindow(episodeFile, candidate.start, candidate.end);
      const blob = audioBufferToWavBlob(buffer);

      const uploadUrl = await generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error('Clip upload failed');
      const { storageId } = (await uploadRes.json()) as { storageId: string };

      const sessionId = await createSession({
        storageId: storageId as GenericId<'_storage'>,
        mimeType: 'audio/wav',
        durationSec: candidate.end - candidate.start,
        transcript: windowTranscript(episodeWords, candidate.start, candidate.end),
      });
      onPicked(sessionId);
    } catch (err) {
      console.error('[ClipPickerSheet]', err);
      toast.error('Could not prepare this clip. Try another one.');
      setPickingIndex(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && pickingIndex === null && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          'border-none bg-transparent gap-0 shadow-none min-h-0 h-auto max-h-[85vh]',
          'data-[side=bottom]:inset-x-auto data-[side=bottom]:w-auto',
          'data-[side=bottom]:left-2.5 data-[side=bottom]:right-2.5 data-[side=bottom]:bottom-3.5'
        )}
      >
        <div className="rounded-[28px] overflow-hidden bg-[#0d0d10] px-5 py-4">
          <h2 className="text-lg font-semibold text-white mb-1">Best moments</h2>
          <p className="text-[15px] text-white/45 mb-3">
            Ordio found {candidates.length === 1 ? 'this moment' : `${candidates.length} moments`} worth clipping
          </p>
          <ul className="flex flex-col gap-2.5">
            {candidates.map((c, i) => (
              <li key={`${c.start}-${c.end}`}>
                <button
                  type="button"
                  disabled={pickingIndex !== null}
                  onClick={() => pick(c, i)}
                  className={cn(
                    'w-full text-left rounded-2xl border border-white/10 bg-white/4 px-4 py-3',
                    'active:bg-white/8 disabled:opacity-50'
                  )}
                >
                  <span className="block text-[13px] font-medium text-white/45">
                    {formatTime(c.start)} – {formatTime(c.end)}
                  </span>
                  <span className="block text-[15px] text-white mt-1 line-clamp-2">
                    &ldquo;{c.hookText}&rdquo;
                  </span>
                  <span className="block text-[13px] text-white/45 mt-1">
                    {pickingIndex === i ? 'Preparing clip…' : c.rationale}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pickingIndex !== null}
          className="w-full mt-2.5 py-4 rounded-[28px] bg-white/6 border border-white/14 text-white text-lg font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Test `windowTranscript`** — add to `apps/web/src/__tests__/clipWindows.test.ts`:

```typescript
import { windowTranscript } from '@/components/soul/clips/ClipPickerSheet';

describe('windowTranscript', () => {
  it('keeps only in-window words, re-based to clip time', () => {
    const words = [
      { text: 'before', start: 10, end: 11 },
      { text: 'inside', start: 61, end: 62 },
      { text: 'edge', start: 89, end: 91 }, // ends after window — excluded
    ];
    expect(windowTranscript(words, 60, 90)).toEqual([
      { text: 'inside', start: 1, end: 2 },
    ]);
  });
});
```

---

### Task 12: Route long uploads into the episode path

**Files:**
- Modify: `apps/web/src/hooks/recording/useCreateFlow.ts` (around `handleFileSelect`, line ~183)
- Modify: `apps/web/src/app/create/page.tsx` (mount `ClipPickerSheet` + episode phase UI)

**Interfaces:**
- Consumes: `useEpisodeIngestion` (Task 10), `ClipPickerSheet` (Task 11), `validateEpisodeFile` (Task 9), `EPISODE_ROUTE_THRESHOLD_SEC` (Task 2).
- Produces: files longer than 15 min (or larger than the existing 50MB short-path cap) route to `startEpisode(file)` instead of `setStagedFile`; picking a clip navigates to `/create/export/[sessionId]` exactly like the existing upload confirm flow.

- [ ] **Step 1: Add duration probe + routing in `useCreateFlow.ts`** — replace the body of `handleFileSelect`:

```typescript
// New import at top:
import { validateEpisodeFile } from '@/lib/fileValidation';
import { EPISODE_ROUTE_THRESHOLD_SEC } from '@/lib/media/episodePlan';

/** Fast duration probe via metadata only (no decode). */
async function probeDurationSec(file: File): Promise<number | null> {
  try {
    const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      return await input.computeDuration();
    } finally {
      input.dispose();
    }
  } catch {
    return null;
  }
}

const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (e.target) e.target.value = '';
  if (!file) return;

  const durationSec = await probeDurationSec(file);
  const isEpisode =
    (durationSec !== null && durationSec > EPISODE_ROUTE_THRESHOLD_SEC) ||
    file.size > MAX_FILE_SIZE_BYTES; // too big for the short path — try episode path

  if (isEpisode) {
    const episodeError = validateEpisodeFile(file);
    if (episodeError) {
      toast.error(FILE_ERROR_MESSAGES[episodeError]);
      return;
    }
    void episode.startEpisode(file);
    return;
  }

  const error = validateFile(file);
  if (error) {
    toast.error(FILE_ERROR_MESSAGES[error]);
    return;
  }
  setStagedFile(file);
}, [episode]);
```

Where `episode` is the hook instance added near the top of `useCreateFlow`:

```typescript
import { useEpisodeIngestion } from '@/hooks/audio/useEpisodeIngestion';
// inside useCreateFlow():
const episode = useEpisodeIngestion();
// added to the returned public surface:
return { /* ...existing fields... */, episode };
```

(`MAX_FILE_SIZE_BYTES` is already exported from `@/lib/fileValidation` — add it to the existing import.)

- [ ] **Step 2: Mount picker + progress in `app/create/page.tsx`** — read `flow.episode` and render:

```tsx
// Inside the page component, after existing sheets/dialogs:
<ClipPickerSheet
  isOpen={flow.episode.phase === 'picking'}
  candidates={flow.episode.candidates}
  episodeFile={flow.episode.episodeFile}
  episodeWords={flow.episode.episodeWords}
  onClose={flow.episode.cancel}
  onPicked={(sessionId) => {
    flow.episode.cancel();
    router.push(`/create/export/${sessionId}`);
  }}
/>
{(flow.episode.phase === 'ingesting' ||
  flow.episode.phase === 'transcribing' ||
  flow.episode.phase === 'finding') && (
  <EpisodeProgressOverlay
    phase={flow.episode.phase}
    progress={flow.episode.progress}
    onCancel={flow.episode.cancel}
  />
)}
{flow.episode.phase === 'error' && (
  <EpisodeErrorDialog
    message={flow.episode.error ?? 'Something went wrong.'}
    partialAvailable={flow.episode.partialAvailable}
    onUsePartial={flow.episode.usePartialTranscript}
    onDismiss={flow.episode.cancel}
  />
)}
```

`EpisodeProgressOverlay` and `EpisodeErrorDialog` are small presentational components created in `apps/web/src/components/soul/clips/` following the existing modal/dialog patterns in `components/soul/modals/` (reuse the existing `dialog.tsx`; phase labels: ingesting → "Reading your episode…", transcribing → "Transcribing…", finding → "Finding your best moments…"; always render a Cancel control wired to `onCancel` — design rule: every async state has an exit).

---

### Task 13: Verification + commits (batch, per user workflow preference)

- [ ] **Step 1: Run the full verification suite once**

```bash
pnpm --filter web run test
pnpm --filter web run typecheck
pnpm --filter web run lint
```

Expected: all existing tests still pass; new tests (`clipCandidate`, `episodePlan`, `mergeChunkTranscripts`, `clipWindows`, `audioCodecSupport`, `transcribeChunk`, `episodeValidation`) pass; zero type or lint errors.

- [ ] **Step 2: Commit in logical groups**

```bash
git add packages/shared/src/schemas.ts apps/web/src/__tests__/clipCandidate.test.ts
git commit -m "feat(shared): add ClipCandidate schema for episode clip windows"

git add apps/web/src/lib/media/episodePlan.ts apps/web/src/lib/media/audioCodecSupport.ts apps/web/src/lib/media/episodeIngest.ts apps/web/src/lib/media/extractWindow.ts apps/web/src/lib/fileValidation.ts apps/web/src/__tests__/episodePlan.test.ts apps/web/src/__tests__/audioCodecSupport.test.ts apps/web/src/__tests__/episodeValidation.test.ts
git commit -m "feat(media): streaming episode ingestion — chunked decode, mono-16k Opus/WAV encode, energy, window extraction"

git add apps/web/src/lib/transcription/ apps/web/src/__tests__/mergeChunkTranscripts.test.ts apps/web/src/__tests__/transcribeChunk.test.ts
git commit -m "feat(transcription): per-chunk Whisper requests with retry and episode-absolute merge"

git add apps/web/src/lib/clips/ apps/web/src/app/api/find-clips/ apps/web/src/__tests__/clipWindows.test.ts
git commit -m "feat(clips): find-clips API with validated LLM candidates and energy fallback"

git add apps/web/src/hooks/audio/useEpisodeIngestion.ts apps/web/src/components/soul/clips/ apps/web/src/hooks/recording/useCreateFlow.ts apps/web/src/app/create/page.tsx
git commit -m "feat(create): episode upload path — ingestion state machine, clip picker, export handoff"
```

- [ ] **Step 3: On-device sanity** — run `/qa` (or manual): upload a >15-min MP3 in Chrome, confirm chunked progress, candidate cards appear, picking one lands on the export page with correct trimmed captions. Verify Cancel works from every phase.

---

## Self-Review Notes

- **Spec coverage:** slices 0–3 fully mapped (0 → Task 5 strategy detection; 1 → Tasks 2, 5, 7, 9; 2 → Tasks 1, 4, 6; 3 → Tasks 8, 10, 11, 12). Slice 4 (video backgrounds) deliberately excluded → separate plan. Convex candidate caching from the design (slice 2, "cached in Convex keyed by session document ID") is **simplified to in-memory client state**: at pick-time a session doesn't exist yet (sessions are created per-clip, not per-episode), so there is no session document to key on — caching would require a new episodes table, pure YAGNI before the user test. The design's intent (don't re-bill the LLM within a session) is satisfied by keeping candidates in hook state.
- **Placeholder scan:** all steps carry complete code; no TBDs.
- **Type consistency:** `ClipCandidate` fields (`start`, `end`, `hookText`, `rationale`) used identically in Tasks 1, 4, 6, 10, 11; `Word` re-based semantics consistent between `mergeChunkTranscripts` (episode-absolute) and `windowTranscript` (clip-relative).
- **Known jsdom gaps:** `episodeIngest.ts` and `extractWindow.ts` (WebCodecs/Mediabunny) — covered by on-device QA in Task 13, their pure logic is tested via Task 2.
- **Mediabunny API risk:** `AudioBufferSink.buffers(start, end)`, `Input.computeDuration()`, `Output`/`AudioBufferSource` Opus encode, and `canEncodeAudio` are used per Mediabunny 1.x docs — the implementer should verify exact signatures against `node_modules/mediabunny/dist/*.d.ts` before Task 5 and adjust call sites (not architecture) if names moved.
