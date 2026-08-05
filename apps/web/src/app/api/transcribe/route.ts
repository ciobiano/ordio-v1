import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import type { Word } from '@Ordio/shared/schemas';
import { consumeRateLimit } from '@/lib/liveTranscription/rateLimit';
import { getOpenAITranscriptionFilename } from './audioFile';

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

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Whisper limit

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
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!consumeRateLimit(`transcribe:${userId}`, TRANSCRIBE_PER_HOUR, HOUR_MS)) {
      return NextResponse.json(
        { error: 'Too many transcription requests — try again later' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('audio');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio file in form data' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Audio file exceeds 25MB Whisper limit' }, { status: 413 });
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

    const rawWords = verboseResponse.words;
    if (!rawWords || !Array.isArray(rawWords) || rawWords.length === 0) {
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

    return NextResponse.json({ words });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    console.error('[/api/transcribe]', message);

    if (message.includes('OPENAI_API_KEY')) {
      // Deployment fault, not the caller's — and the detail stays in the log.
      return NextResponse.json({ error: 'Transcription is unavailable' }, { status: 503 });
    }

    // Never forward raw SDK/API error text to the client — it can carry request
    // IDs, org identifiers and provider doc URLs. Full message is logged above.
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
