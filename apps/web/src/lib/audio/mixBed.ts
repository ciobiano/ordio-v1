/**
 * Mixing the music bed into the voice.
 *
 * Both intake paths converge on one AudioBuffer — a recording lands there via
 * processAudio, an upload decodes into the same place — so the mix belongs
 * between that buffer and the encoder, not in either path. One insertion point
 * covers recorded and uploaded audio identically.
 *
 * Ducking is computed from the transcript, not from a compressor. Web Audio
 * has no real sidechain, so the usual workaround is a DynamicsCompressorNode
 * fed the voice, which pumps and breathes and never quite lands. Ordio already
 * knows where every word starts and ends, so the music gain can be automated
 * directly against speech: exact, deterministic, and identical on every
 * render rather than dependent on how loud the take happened to be.
 */

import type { Word } from '@Ordio/shared';
import { bedDuration, type BedClip } from './bedGeometry';

/** How far the music drops while a word is being spoken. */
const DUCK_TO = 0.35;

/** Silence shorter than this is not a gap worth lifting the music into. */
const MIN_GAP_SEC = 0.4;

/** Fade either side of a duck. Fast enough to catch a word, slow enough not to click. */
const DUCK_RAMP_SEC = 0.12;

/**
 * Slack on the gap comparison, because word timings are decimals.
 *
 * A gap of exactly MIN_GAP_SEC is not exactly that once it has been through
 * binary floating point: `1.4 - 1` is 0.3999999999999999, so a pause sitting
 * on the threshold lands just under it and the spans either side merge. The
 * result is a bed that stays ducked through a silence it should have lifted
 * for — inaudible in review, wrong on export, and unreproducible because it
 * depends on the exact decimals Whisper returned.
 */
const GAP_EPSILON = 1e-6;

export interface MixBedArgs {
  voice: AudioBuffer;
  bed: BedClip;
  /** The decoded bed audio, full length and untrimmed. */
  bedBuffer: AudioBuffer;
  /** 0–140, matching the Audio panel. */
  voiceLevel: number;
  /** 0–100, matching the Audio panel. */
  musicLevel: number;
  duck: boolean;
  /** Word timings; empty disables ducking however the flag is set. */
  words: Word[];
}

/**
 * The spans where speech is happening, merged.
 *
 * Consecutive words separated by less than MIN_GAP_SEC become one span:
 * lifting the music for the 80ms between two words in a sentence would sound
 * like a fault, not like mixing.
 */
export function speechSpans(words: Word[], minGap = MIN_GAP_SEC): { start: number; end: number }[] {
  if (words.length === 0) return [];
  const spans: { start: number; end: number }[] = [];
  let start = words[0].start;
  let end = words[0].end;

  for (let i = 1; i < words.length; i++) {
    if (words[i].start - end < minGap - GAP_EPSILON) {
      end = Math.max(end, words[i].end);
    } else {
      spans.push({ start, end });
      start = words[i].start;
      end = words[i].end;
    }
  }
  spans.push({ start, end });
  return spans;
}

/**
 * Render voice and bed into one buffer.
 *
 * The output is the voice's length: the voice is the piece of work, and the
 * bed is under it. A bed dropped past the end of the voice is simply not
 * heard, which is what makes placing one there harmless.
 */
export async function mixBedIntoVoice({
  voice,
  bed,
  bedBuffer,
  voiceLevel,
  musicLevel,
  duck,
  words,
}: MixBedArgs): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(
    Math.max(1, voice.numberOfChannels),
    voice.length,
    voice.sampleRate
  );

  const voiceSource = context.createBufferSource();
  voiceSource.buffer = voice;
  const voiceGain = context.createGain();
  voiceGain.gain.value = voiceLevel / 100;
  voiceSource.connect(voiceGain).connect(context.destination);
  voiceSource.start(0);

  const audible = bedDuration(bed);
  if (audible > 0 && bed.startAt < voice.duration) {
    const bedSource = context.createBufferSource();
    bedSource.buffer = bedBuffer;

    const bedGain = context.createGain();
    const base = musicLevel / 100;
    bedGain.gain.setValueAtTime(base, 0);

    if (duck && words.length > 0) {
      for (const span of speechSpans(words)) {
        /* Ramp rather than step: a gain edge at speaking volume is an audible
           click, and the ramp start is pulled back so the duck has already
           happened by the time the word arrives. */
        const down = Math.max(0, span.start - DUCK_RAMP_SEC);
        bedGain.gain.setValueAtTime(bedGain.gain.value, down);
        bedGain.gain.linearRampToValueAtTime(base * DUCK_TO, span.start);
        bedGain.gain.setValueAtTime(base * DUCK_TO, span.end);
        bedGain.gain.linearRampToValueAtTime(base, span.end + DUCK_RAMP_SEC);
      }
    }

    bedSource.connect(bedGain).connect(context.destination);
    /* `start(when, offset, duration)` does the trim: the head trim is the
       offset into the source, and the audible length is the duration. No
       separate slicing pass, and no chance of the drawn block and the played
       audio disagreeing. */
    bedSource.start(bed.startAt, bed.trimIn, Math.min(audible, voice.duration - bed.startAt));
  }

  return context.startRendering();
}
