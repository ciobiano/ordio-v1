import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@Ordio/convex';
import type { GenericId } from 'convex/values';
import type { Word } from '@Ordio/shared/schemas';
import { consumeRateLimit } from '@/lib/liveTranscription/rateLimit';
import { ERROR_CATALOG, type ErrorCode } from '@/lib/errors/catalog';
import { getOpenAITranscriptionFilename } from './audioFile';
import { providerErrorCode, STATUS_FOR } from './providerError';
import {
  MAX_AUDIO_BYTES,
  StoredAudioError,
  downloadStoredAudio,
  readAudioSource,
} from './audioSource';

// Lazy-init — never instantiate at module level (breaks `next build`)
let openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

/**
 * A failure response the client can name. `code` is what the client reads;
 * `error` is the catalog title, kept for anything that only reads text.
 */
function fail(code: ErrorCode, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json(
    { error: ERROR_CATALOG[code].title, code, ...extra },
    { status: STATUS_FOR[code] ?? 500 }
  );
}

// This route bills OpenAI per audio-minute, so it is the most expensive thing a
// caller can trigger. Every other AI route already pairs auth with a per-hour
// ceiling; this one is held to the same contract.
//
// 15/hour is sized off a heavy legitimate session — recording, discarding and
// re-recording a handful of takes — rather than off cost, so a real user should
// never meet it. The effective ceiling is higher still, since the limiter is
// per warm serverless instance. Raise it if support ever sees a genuine 429.
const TRANSCRIBE_PER_HOUR = 15;
const HOUR_MS = 60 * 60 * 1000;

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperSegment {
  text: string;
  start: number;
  end: number;
}

function filterTimestamped<T extends { start: number; end: number }>(
  items: unknown[],
  textField: string
): T[] {
  return items.filter((item): item is T => {
    if (typeof item !== 'object' || item === null) return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec[textField] === 'string' &&
      (rec[textField] as string).trim().length > 0 &&
      typeof rec.start === 'number' &&
      typeof rec.end === 'number'
    );
  });
}

/**
 * Merge punctuation from segment text onto bare words.
 * Whisper's word-level output strips all punctuation (by design — punctuation
 * has no acoustic representation). Segments keep full punctuation from the
 * autoregressive decoder, so we align words to segment tokens and copy
 * trailing punctuation back.
 */
function mergePunctuation(words: WhisperWord[], segments: WhisperSegment[]): Word[] {
  const result: Word[] = words.map((w) => ({
    text: w.word.trim(),
    start: w.start,
    end: w.end,
  }));

  for (const segment of segments) {
    const tokens = segment.text.trim().match(/\S+/g) || [];

    // Find words within this segment's time range (small tolerance for float imprecision)
    const segWords = result.filter(
      (w) => w.start >= segment.start - 0.05 && w.end <= segment.end + 0.05
    );

    // Walk through tokens and match to words by lowercase root
    let tokenIdx = 0;
    for (const sw of segWords) {
      const wordClean = sw.text.toLowerCase().replace(/[^\w']/g, '');
      while (tokenIdx < tokens.length) {
        const tokenClean = tokens[tokenIdx].toLowerCase().replace(/[^\w']/g, '');
        if (tokenClean === wordClean) {
          // Keep the token version which includes punctuation (e.g. "Hello," or "right?")
          sw.text = tokens[tokenIdx];
          tokenIdx++;
          break;
        }
        tokenIdx++;
      }
    }
  }

  return result;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Declared outside the try so the catch can return the hold. A user must
  // never pay for a transcription that failed.
  let held = 0;
  let convexToken: string | undefined;

  /**
   * Reconcile the hold against what the transcription actually cost.
   *
   * Pass 0 seconds to return the whole hold — that is the failure path.
   * Settling must never throw: a ledger hiccup should not turn a successful
   * transcription into an error the user sees. Worst case the hold stands,
   * which is at most a few seconds of over-charge on an honest estimate.
   */
  const settle = async (actualSeconds: number): Promise<void> => {
    if (held === 0 || !convexToken) return;
    try {
      await fetchMutation(
        api.credits.settleTranscription,
        { held, actualSeconds },
        { token: convexToken }
      );
      held = 0;
    } catch (err) {
      console.error('[/api/transcribe] settle failed; hold stands', err);
    }
  };

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return fail('AUTH_REQUIRED');
    }

    // The rate limit is an anti-hammering brake; credits are the real spend
    // ceiling. Both, because the limiter also protects the credit ledger from
    // a client looping faster than Convex can settle.
    if (!consumeRateLimit(`transcribe:${userId}`, TRANSCRIBE_PER_HOUR, HOUR_MS)) {
      return fail('TRANSCRIBE_RATE_LIMITED');
    }

    const source = await readAudioSource(request);
    if (!source) {
      return fail('TRANSCRIBE_BAD_REQUEST');
    }
    if (source.kind === 'inline' && source.file.size > MAX_AUDIO_BYTES) {
      return fail('TRANSCRIBE_FILE_TOO_LARGE');
    }

    // Convex verifies this token itself; the route is only a courier.
    convexToken = (await getToken({ template: 'convex' })) ?? undefined;
    if (!convexToken) {
      console.error('[/api/transcribe] no Convex token — check the Clerk JWT template named "convex"');
      return fail('TRANSCRIBE_UNAVAILABLE');
    }

    /* Ownership is checked by Convex against the caller's own token, before
       anything is held or downloaded. A file the caller did not upload reads
       exactly like one that does not exist. */
    let loadAudio: () => Promise<Blob>;
    let chunkId: string | null = null;
    if (source.kind === 'inline') {
      loadAudio = async () => source.file;
    } else {
      const storageId = source.storageId as GenericId<'_storage'>;
      const authorized = await fetchQuery(
        api.transcription.authorize,
        { storageId },
        { token: convexToken }
      ).catch((err: unknown) => {
        console.error('[/api/transcribe] authorize failed', err);
        return undefined;
      });
      if (authorized === undefined) {
        return fail('TRANSCRIBE_UNAVAILABLE');
      }
      if (!authorized) {
        return fail('TRANSCRIBE_BAD_REQUEST');
      }
      /* Already transcribed: the first attempt's response was lost (a timeout,
         a dropped connection) but its Words were saved. Answer with those —
         transcribing again would bill the same audio twice. */
      if (authorized.words) {
        return NextResponse.json({ words: authorized.words });
      }
      loadAudio = () => downloadStoredAudio(authorized.url);
      chunkId = authorized.chunkId;
    }

    const hold = await fetchMutation(
      api.credits.holdForTranscription,
      { estimatedSeconds: source.declaredSeconds },
      { token: convexToken }
    ).catch((err: unknown) => {
      console.error('[/api/transcribe] CREDITS_CHECK_FAILED', err);
      return null;
    });

    // Nothing is held yet, so there is nothing to return.
    if (!hold) {
      return fail('CREDITS_CHECK_FAILED');
    }

    if (!hold.allowed) {
      return fail('INSUFFICIENT_CREDITS', { minutes: hold.minutes });
    }
    held = hold.held;

    let file: Blob;
    try {
      file = await loadAudio();
    } catch (err) {
      await settle(0);
      console.error('[/api/transcribe] stored audio unavailable', err);
      return fail(
        err instanceof StoredAudioError && err.reason === 'too_large'
          ? 'TRANSCRIBE_FILE_TOO_LARGE'
          : 'TRANSCRIBE_FAILED'
      );
    }

    const client = getClient();

    // Convert Blob to File for the OpenAI SDK
    const buffer = Buffer.from(await file.arrayBuffer());
    const audioFile = new File([buffer], getOpenAITranscriptionFilename(file), {
      type: file.type || 'audio/webm',
    });

    // Request both word + segment granularities.
    // Words give precise per-word timestamps (but stripped punctuation).
    // Segments give punctuated text (but coarser timestamps).
    // We merge them to get punctuated words with precise timestamps.
    const response = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
      language: 'en',
    });

    const verboseResponse = response as unknown as {
      words?: unknown[];
      segments?: unknown[];
      text: string;
      duration?: number;
    };

    // Whisper's own duration is the billable figure — the client's estimate
    // only ever sized the hold.
    const actualSeconds = verboseResponse.duration ?? 0;

    const rawWords = verboseResponse.words;
    if (!rawWords || !Array.isArray(rawWords) || rawWords.length === 0) {
      await settle(actualSeconds);
      return NextResponse.json({
        words: [{ text: response.text, start: 0, end: response.duration ?? 0 }],
      });
    }

    const validWords = filterTimestamped<WhisperWord>(rawWords, 'word');
    const validSegments = filterTimestamped<WhisperSegment>(
      Array.isArray(verboseResponse.segments) ? verboseResponse.segments : [],
      'text'
    );

    // Merge punctuation from segments onto bare words
    const words =
      validSegments.length > 0
        ? mergePunctuation(validWords, validSegments)
        : validWords.map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));

    await settle(actualSeconds);

    /* An Episode chunk keeps its Words in Convex, written here rather than by
       the browser: the transcription is paid for the moment Whisper returns,
       and must survive the tab closing before this response arrives. Saving
       is best-effort — the Words still go back in the response. */
    if (chunkId) {
      const save = () =>
        fetchMutation(
          api.transcription.saveChunkWords,
          { chunkId: chunkId as GenericId<'episodeChunks'>, words },
          { token: convexToken }
        );
      await save()
        .catch(save)
        .catch((err: unknown) => {
          console.error('[/api/transcribe] could not save chunk words', err);
        });
    }
    return NextResponse.json({ words });
  } catch (err) {
    // Nobody pays for a transcription that failed.
    await settle(0);

    // Never forward raw SDK/API error text to the client — it can carry request
    // IDs, org identifiers and provider doc URLs. The client gets the code; the
    // full message stays in this log line.
    const code = providerErrorCode(err);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/transcribe] ${code}`, message);
    return fail(code);
  }
}
