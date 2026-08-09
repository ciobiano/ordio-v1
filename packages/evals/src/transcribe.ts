/**
 * Calls the transcription model the way the product does.
 *
 * This deliberately hits OpenAI directly rather than going through
 * `/api/transcribe`. That route requires a Clerk session and holds credits,
 * neither of which belongs in a measurement — an eval that spends a user's
 * balance and can be rate-limited is an eval nobody runs twice.
 *
 * The cost of that choice: the route's punctuation merge is not exercised, so
 * this measures the *model as configured*, not the endpoint end to end. Since
 * the merge only reattaches punctuation — which normalisation strips before
 * scoring anyway — it cannot move WER. Worth stating rather than glossing.
 *
 * **Keep the parameters below in sync with `/api/transcribe`.** A number
 * measured against different settings than production runs is worse than no
 * number, because it looks trustworthy.
 */

import { createReadStream } from 'node:fs';
import OpenAI from 'openai';

/** Mirrors `apps/web/src/app/api/transcribe/route.ts`. */
export const TRANSCRIPTION_MODEL = 'whisper-1';
export const TRANSCRIPTION_LANGUAGE = 'en';

export interface Transcription {
  text: string;
  /** Audio length as the model reports it — used for cost, not scoring. */
  durationSec: number;
}

let client: OpenAI | null = null;

/**
 * Lazy, so importing this module does not throw in an environment that has no
 * key — the unit tests import `wer.ts` alongside it and must not need one.
 */
function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Export it before running the eval:\n' +
        '  export OPENAI_API_KEY="sk-..."'
    );
  }

  client = new OpenAI({ apiKey });
  return client;
}

export async function transcribe(audioPath: string): Promise<Transcription> {
  const response = await getClient().audio.transcriptions.create({
    model: TRANSCRIPTION_MODEL,
    file: createReadStream(audioPath),
    response_format: 'verbose_json',
    language: TRANSCRIPTION_LANGUAGE,
  });

  const verbose = response as unknown as { text: string; duration?: number };
  return { text: verbose.text, durationSec: verbose.duration ?? 0 };
}

/** Whisper list price, for the cost column. Update if OpenAI's pricing moves. */
export const USD_PER_AUDIO_MINUTE = 0.006;

export function estimateCostUsd(totalSeconds: number): number {
  return (totalSeconds / 60) * USD_PER_AUDIO_MINUTE;
}
