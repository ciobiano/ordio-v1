/**
 * What survives a trim, and where it lands afterwards.
 *
 * Pulled out of `useAudioTrimmer` so the desktop editor can cut audio with the
 * same arithmetic the phone uses rather than a third implementation of it. The
 * desk had no implementation at all: its trim handles wrote two numbers that
 * shaded the timeline and were read by nothing, so a clip exported at full
 * length however much you cut. Sharing the maths is what stops the two from
 * disagreeing about where a word ends up once the silence before it is gone.
 *
 * Pure and sample-based, because the failure it prevents is a drift of a few
 * milliseconds per cut — invisible on one edit and glaring after six, when the
 * captions have walked off the voice.
 */

import type { Word } from '@Ordio/shared/schemas';

export interface TimeRange {
  start: number;
  end: number;
}

export interface TrimPlan {
  /** Head trim, in seconds. Everything before this goes. */
  startTime: number;
  /** Tail trim, in seconds. Everything after this goes. */
  endTime: number;
  /** Interior cuts — detected pauses, deleted words — in seconds. */
  deletedRanges: TimeRange[];
}

/**
 * The stretches of audio that survive, in samples.
 *
 * Interior cuts are clipped to the head/tail window first, and the cursor
 * never moves backwards, so ranges that overlap each other collapse instead of
 * duplicating audio between them.
 */
export function keptSampleRanges(plan: TrimPlan, sampleRate: number): TimeRange[] {
  const startSample = Math.floor(plan.startTime * sampleRate);
  const endSample = Math.floor(plan.endTime * sampleRate);

  const deleted = plan.deletedRanges
    .map((r) => ({
      start: Math.floor(r.start * sampleRate),
      end: Math.floor(r.end * sampleRate),
    }))
    .sort((a, b) => a.start - b.start);

  const kept: TimeRange[] = [];
  let cursor = startSample;
  for (const cut of deleted) {
    if (cut.end <= startSample || cut.start >= endSample) continue;
    const cutStart = Math.max(cut.start, startSample);
    const cutEnd = Math.min(cut.end, endSample);
    if (cursor < cutStart) kept.push({ start: cursor, end: cutStart });
    cursor = Math.max(cursor, cutEnd);
  }
  if (cursor < endSample) kept.push({ start: cursor, end: endSample });

  return kept;
}

/** Concatenate the surviving ranges, one output array per channel. */
export function sliceChannels(
  buffer: AudioBuffer,
  kept: TimeRange[]
): Float32Array[] {
  const total = kept.reduce((sum, r) => sum + (r.end - r.start), 0);
  const channels: Float32Array[] = [];

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const source = buffer.getChannelData(ch);
    const output = new Float32Array(total);
    let offset = 0;
    for (const range of kept) {
      const segment = source.subarray(range.start, range.end);
      output.set(segment, offset);
      offset += segment.length;
    }
    channels.push(output);
  }
  return channels;
}

/**
 * The transcript as it reads after the cut.
 *
 * A word keeps its place relative to the audio by losing the head trim plus
 * every interior cut that finished before it started. Only cuts that ended
 * before the word count — one straddling it would move the word by time that
 * is still there in front of it.
 */
export function shiftTranscript(plan: TrimPlan, transcript: Word[]): Word[] {
  const cuts = [...plan.deletedRanges].sort((a, b) => a.start - b.start);

  /* A word the cut removed from the audio must leave the transcript with it,
     or the captions claim a word that is no longer spoken. Tested against the
     midpoint rather than the edges: a deleted word's cut matches its own
     timing exactly, and comparing edges makes that a float coin-toss. */
  const removed = (word: Word) => {
    const midpoint = (word.start + word.end) / 2;
    return cuts.some((cut) => cut.start <= midpoint && midpoint < cut.end);
  };

  return transcript
    .filter((word) => word.end > plan.startTime && word.start < plan.endTime && !removed(word))
    .map((word) => {
      const removedBefore = cuts
        .filter((cut) => cut.end <= word.start)
        .reduce((sum, cut) => sum + (cut.end - cut.start), 0);
      const shift = plan.startTime + removedBefore;
      return { ...word, start: word.start - shift, end: word.end - shift };
    });
}

/** Whether a plan would change anything at all. */
export function trimChangesAnything(plan: TrimPlan, duration: number): boolean {
  return plan.startTime > 0 || plan.endTime < duration || plan.deletedRanges.length > 0;
}

/**
 * Wrap raw channel data back into a buffer the player and encoder can take.
 *
 * The channel arrays are re-wrapped rather than passed straight to
 * `copyToChannel`: a `Float32Array` produced by `subarray` is a view onto a
 * larger buffer, and its type says `ArrayBufferLike`, which the Web Audio
 * signature will not accept. Re-wrapping pins the offset and length.
 */
export function buildAudioBuffer(
  channels: Float32Array[],
  sampleRate: number
): AudioBuffer {
  const buffer = new AudioBuffer({
    numberOfChannels: Math.max(1, channels.length),
    length: Math.max(1, channels[0]?.length ?? 0),
    sampleRate,
  });
  channels.forEach((channel, i) =>
    buffer.copyToChannel(
      new Float32Array(channel.buffer as ArrayBuffer, channel.byteOffset, channel.length),
      i
    )
  );
  return buffer;
}
