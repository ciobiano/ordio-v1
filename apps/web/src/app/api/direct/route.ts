import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { auth } from '@clerk/nextjs/server';
import type { Word } from '@Ordio/shared/schemas';
import { DirectorResponseSchema } from '@Ordio/shared/schemas';
import { consumeRateLimit } from '@/lib/liveTranscription/rateLimit';

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

// Small/cheap chat model — matches the cost-consciousness of the existing
// whisper-1 transcription choice. Swap here if a cheaper/better option ships.
const DIRECTOR_MODEL = 'gpt-4o-mini';

// Fires once per sheet-open plus once per reroll, so more frequent than
// find-clips but each call is a single short completion (no corrective
// retry) — same order of magnitude, in-memory-per-instance limiter.
const DIRECT_PER_HOUR = 15;
const HOUR_MS = 60 * 60 * 1000;

const LOOK_PRESET_DESCRIPTIONS = `
- neon-pop: word-pop captions (one bold word at a time), acid-green/cyan gradient background — energetic, internet-native
- street-bold: thick black-outline captions, solid black background — classic meme/street aesthetic
- sunset-karaoke: karaoke-style highlight chip, warm coral-to-pink gradient — cozy, conversational
- clean-minimal: small subtitle-style captions, solid dark background — restrained, editorial
- bold-statement: large centered phrase captions, cobalt-to-cyan gradient — declarative, confident
- editorial-script: italic serif accent word with glow, solid black background — elegant, thoughtful
- warm-pop: one bold word at a time, warm pink gradient — playful, upbeat
- electric-outline: thick-outline captions, cobalt gradient — bold, modern
- centered-block: a whole sentence held on screen in large serif, each word lighting up as it is spoken, on void black — cinematic, premium, quote-like
- urban-phrase: the same word-by-word serif reveal over a warm grained gradient — moody, editorial, suits spoken essays and street commentary
- orb-phrase: word-by-word reveal under a slowly spinning wireframe orb on black — calm, futuristic, made for reflective or technical talk
- cream-block: warm cream card, maroon type, the active word filling with a solid maroon block — soft, bookish, personal-brand quotes
`.trim();

/**
 * Both arrays are interpolated straight into the prompt, so an unbounded array
 * is an unbounded bill. The caps match find-clips (20k words) and leave ample
 * headroom for a real episode.
 */
const MAX_TRANSCRIPT_WORDS = 20_000;
const MAX_CAPTION_GROUPS = 2_000;

const VALID_FORMATS = ['square', 'vertical', 'horizontal', 'instagram'] as const;
type DirectFormat = (typeof VALID_FORMATS)[number];

interface DirectRequestBody {
  transcript: Word[];
  /** group.text per captionGroups index — lets the model pick a valid hookGroupIndex. */
  captionGroupTexts: string[];
  format: DirectFormat;
}

function isValidBody(body: unknown): body is DirectRequestBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.transcript) &&
    b.transcript.length <= MAX_TRANSCRIPT_WORDS &&
    b.transcript.every(
      (w) => typeof w === 'object' && w !== null && typeof (w as Word).text === 'string'
    ) &&
    Array.isArray(b.captionGroupTexts) &&
    b.captionGroupTexts.length > 0 &&
    b.captionGroupTexts.length <= MAX_CAPTION_GROUPS &&
    b.captionGroupTexts.every((t) => typeof t === 'string') &&
    // Checked against the enum, not just `typeof string` — this value lands in
    // the user prompt verbatim.
    VALID_FORMATS.includes(b.format as DirectFormat)
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!consumeRateLimit(userId, DIRECT_PER_HOUR, HOUR_MS)) {
      return NextResponse.json(
        { error: 'Too many Director requests — try again later' },
        { status: 429 }
      );
    }

    const body: unknown = await request.json();
    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Missing transcript, captionGroupTexts, or format' }, { status: 400 });
    }
    const { transcript, captionGroupTexts, format } = body;

    const transcriptText = transcript.map((w) => w.text).join(' ');
    const groupList = captionGroupTexts.map((text, i) => `${i}: "${text}"`).join('\n');

    const client = getClient();
    const completion = await client.chat.completions.parse({
      model: DIRECTOR_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are Ordio Director, an AI art director for short-form captioned video. ' +
            'Given a transcript and a numbered list of its caption phrases, pick 3 DIFFERENT ' +
            'looks from the preset library below that best match the tone and energy of what ' +
            'was said, and identify which numbered phrase is the strongest opening hook (the ' +
            'line most likely to grab attention in the first half-second — usually the opener, ' +
            'but not always).\n\nPreset library:\n' +
            LOOK_PRESET_DESCRIPTIONS +
            '\n\nEach look has an "overrides" object with accentColor and textColor (hex). ' +
            'Set either to a hex color only if the transcript suggests a specific mood the ' +
            'preset\'s default colors don\'t capture — otherwise set it to null.',
        },
        {
          role: 'user',
          content: `Format: ${format}\n\nTranscript: ${transcriptText}\n\nCaption phrases:\n${groupList}`,
        },
      ],
      response_format: zodResponseFormat(DirectorResponseSchema, 'director_response'),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      return NextResponse.json({ error: 'Director returned no usable looks' }, { status: 502 });
    }

    const maxGroupIndex = captionGroupTexts.length - 1;
    const outOfRange = parsed.looks.some((look) => look.hookGroupIndex > maxGroupIndex);
    if (outOfRange) {
      return NextResponse.json({ error: 'Director picked an invalid hook phrase' }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Director request failed';
    console.error('[/api/direct]', message);

    if (message.includes('OPENAI_API_KEY')) {
      // Deployment fault — the setup hint belongs in the log above, not in
      // front of a person who cannot act on it.
      return NextResponse.json({ error: 'The Director is unavailable' }, { status: 503 });
    }

    // Never forward raw SDK/API error text to the client — it can include
    // internal schema details or provider doc URLs. Full message is logged above.
    return NextResponse.json({ error: 'Director could not generate looks right now.' }, { status: 500 });
  }
}
