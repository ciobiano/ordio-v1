import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { Word } from '@Ordio/shared/schemas';
import { DirectorResponseSchema } from '@Ordio/shared/schemas';

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

const LOOK_PRESET_DESCRIPTIONS = `
- neon-pop: word-pop captions (one bold word at a time), acid-green/cyan gradient background — energetic, internet-native
- street-bold: thick black-outline captions, solid black background — classic meme/street aesthetic
- sunset-karaoke: karaoke-style highlight chip, warm coral-to-pink gradient — cozy, conversational
- clean-minimal: small subtitle-style captions, solid dark background — restrained, editorial
- bold-statement: large centered phrase captions, cobalt-to-cyan gradient — declarative, confident
- editorial-script: italic serif accent word with glow, solid black background — elegant, thoughtful
- warm-pop: one bold word at a time, warm pink gradient — playful, upbeat
- electric-outline: thick-outline captions, cobalt gradient — bold, modern
`.trim();

interface DirectRequestBody {
  transcript: Word[];
  /** group.text per captionGroups index — lets the model pick a valid hookGroupIndex. */
  captionGroupTexts: string[];
  format: 'square' | 'vertical' | 'horizontal' | 'instagram';
}

function isValidBody(body: unknown): body is DirectRequestBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.transcript) &&
    Array.isArray(b.captionGroupTexts) &&
    b.captionGroupTexts.length > 0 &&
    typeof b.format === 'string'
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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
            '\n\nOptionally override accentColor/textColor (hex) per look if the transcript ' +
            'suggests a specific mood the preset\'s default colors don\'t capture — leave them ' +
            'out otherwise.',
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
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
