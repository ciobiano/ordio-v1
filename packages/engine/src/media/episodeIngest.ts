/**
 * Stream-ingest a long podcast episode: decode window-by-window (never the
 * whole file into memory), downmix each window to mono 16kHz, cut it at a
 * pause, encode it as lossless WAV, and accumulate per-second energy as a
 * byproduct.
 *
 * WAV, not Opus or MP3: 16kHz mono is exactly what Whisper listens to, so it
 * loses nothing, and no browser needs an encoder to produce it. Chunks reach
 * Whisper through Convex storage, so their size is bounded by Whisper's 25MB,
 * not by a request-body limit.
 *
 * NOTE: not unit-testable in jsdom (requires real WebCodecs / OfflineAudioContext
 * decode). Exercised via on-device QA. The window planning and cut-finding it
 * relies on live in episodePlan.ts and are tested there.
 */
import type { InputAudioTrack } from 'mediabunny';
import {
  nextWindowEnd,
  findQuietCut,
  createEnergyAccumulator,
  resumeStep,
  CUT_SEARCH_SEC,
  CHUNK_SEC,
  MAX_EPISODE_SEC,
} from './episodePlan';
import { audioBufferToWavBlob } from './whisperAudio';

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

export interface EpisodeChunk {
  /** Exact episode time of the chunk's first sample — word offsets are added to it. */
  startSec: number;
  /**
   * The decoded length of the chunk, not the wall between `startSec` values —
   * the last window is short, and a pause-aligned plan makes every window a
   * different length. It is carried because the credit hold is sized from it:
   * a chunk that declares nothing is held at the one-credit floor and then
   * settled at full price, which overdraws the balance by the whole episode.
   */
  durationSec: number;
  blob: Blob;
}

export interface EpisodeStream {
  durationSec: number;
  /**
   * Decodes lazily: each chunk is decoded only when it is pulled, so a
   * consumer busy uploading holds the decoder back rather than letting it race
   * ahead. The input is disposed when the generator finishes, fails, or is
   * stopped early with `return()`.
   */
  chunks: AsyncGenerator<EpisodeChunk, void, undefined>;
  /**
   * Release the file. Safe to call more than once, and required on any path
   * that may never pull a chunk: a generator that never started skips its
   * own cleanup, even when `return()` is called on it.
   */
  dispose: () => void;
  /**
   * Per-second energy (0–1) for everything decoded so far. Windows skipped on
   * resume are not decoded, so they read as silence here; energy only feeds
   * the fallback when the model proposes no Clips.
   */
  energy: () => number[];
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
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

/** [fromSec, toSec) of a mono buffer, or the buffer itself when that is all of it. */
function sliceMono(buffer: AudioBuffer, fromSec: number, toSec: number): AudioBuffer {
  const from = Math.max(0, Math.round(fromSec * buffer.sampleRate));
  const to = Math.min(buffer.length, Math.round(toSec * buffer.sampleRate));
  if (from === 0 && to === buffer.length) return buffer;
  const out = new AudioBuffer({
    length: Math.max(1, to - from),
    numberOfChannels: 1,
    sampleRate: buffer.sampleRate,
  });
  out.copyToChannel(buffer.getChannelData(0).subarray(from, to), 0);
  return out;
}

/**
 * Decode [start, end) to mono 16kHz, trimmed so sample 0 sits exactly at the
 * returned `startSec`. The first decoded packet usually begins a few
 * milliseconds before `start`; untrimmed, every word in the chunk is offset by
 * that much and neighbouring chunks overlap by a packet at the seam.
 */
async function decodeWindow(
  track: InputAudioTrack,
  start: number,
  end: number,
  signal: AbortSignal
): Promise<{ startSec: number; mono: AudioBuffer } | null> {
  const { AudioBufferSink } = await import('mediabunny');
  const sink = new AudioBufferSink(track);
  const pieces: AudioBuffer[] = [];
  let firstTimestamp: number | null = null;
  for await (const { buffer, timestamp } of sink.buffers(start, end)) {
    throwIfAborted(signal);
    firstTimestamp ??= timestamp;
    pieces.push(buffer);
  }
  if (pieces.length === 0 || firstTimestamp === null) return null;

  const { concatAudioBuffers } = await import('./decodeMediaToAudioBuffer');
  const windowBuffer = concatAudioBuffers(pieces);
  pieces.length = 0;
  // startRendering() isn't interruptible mid-flight; this discards a finished one promptly.
  const mono = await toMono16k(windowBuffer);
  throwIfAborted(signal);

  const startSec = Math.max(start, firstTimestamp);
  return { startSec, mono: sliceMono(mono, startSec - firstTimestamp, end - firstTimestamp) };
}

/**
 * Open a long episode for streamed ingestion. Rejects up front when the file
 * cannot be decoded or is too long; all decoding happens as `chunks` is pulled.
 */
export async function openEpisode(
  file: File,
  opts: {
    signal: AbortSignal;
    onProgress?: (fraction: number) => void;
    /**
     * Chunks a previous run of this file already transcribed. Their windows
     * are skipped — not decoded, not yielded — and the next window starts
     * where each one ended.
     */
    skip?: Array<{ startSec: number; durationSec: number }>;
  }
): Promise<EpisodeStream> {
  const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let track: InputAudioTrack;
  let durationSec: number;
  try {
    const primary = await input.getPrimaryAudioTrack();
    if (!primary || !(await primary.canDecode())) {
      throw new EpisodeIngestError('undecodable', 'This browser cannot decode this file.');
    }
    track = primary;
    durationSec = await track.computeDuration();
    if (durationSec > MAX_EPISODE_SEC) {
      throw new EpisodeIngestError('too_long', 'Episodes longer than 90 minutes are not supported.');
    }
  } catch (err) {
    input.dispose();
    throw err;
  }

  const skip = opts.skip ?? [];
  const energyAcc = createEnergyAccumulator(durationSec);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    input.dispose();
  };

  async function* chunks(): AsyncGenerator<EpisodeChunk, void, undefined> {
    try {
      let start = 0;
      while (start < durationSec) {
        throwIfAborted(opts.signal);
        const step = resumeStep(start, skip);
        if ('skipTo' in step) {
          start = step.skipTo;
          opts.onProgress?.(Math.min(1, start / durationSec));
          continue;
        }
        const planned = nextWindowEnd(start, durationSec, CHUNK_SEC);
        // A saved chunk begins inside this window: end exactly at it, not at a pause.
        const { stopAt } = step;
        const stopsAtSaved = stopAt !== null && stopAt < planned.end;
        const end = stopsAtSaved ? stopAt : planned.end;
        const cutAtEnd = planned.isLast || stopsAtSaved;
        const decoded = await decodeWindow(track, start, end, opts.signal);
        // The container overstated its duration — there is nothing left to read.
        if (!decoded) return;

        const { startSec, mono } = decoded;
        const cutSec = cutAtEnd
          ? mono.duration
          : findQuietCut(mono.getChannelData(0), TARGET_RATE, CUT_SEARCH_SEC);
        const piece = sliceMono(mono, 0, cutSec);

        energyAcc.add(piece.getChannelData(0), startSec, TARGET_RATE);
        const blob = audioBufferToWavBlob(piece);

        start = startSec + piece.duration;
        opts.onProgress?.(Math.min(1, start / durationSec));
        yield { startSec, durationSec: piece.duration, blob };
      }
    } finally {
      dispose();
    }
  }

  return { durationSec, chunks: chunks(), energy: () => energyAcc.finish(), dispose };
}
