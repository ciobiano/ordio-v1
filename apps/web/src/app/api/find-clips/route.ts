import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { WordSchema } from '@Ordio/shared/schemas';
import { validateCandidates } from '@/lib/clips/validateCandidates';
import { consumeRateLimit } from '@/lib/liveTranscription/rateLimit';

// Each request can trigger up to 2 OpenAI chat completions (initial +
// corrective retry) against a transcript up to 20,000 words — generous for
// real use (a handful of long episodes per session) but a brake on a
// runaway/abusive client hammering this route. In-memory per instance, same
// limitation as the transcription-token route's limiter.
const FIND_CLIPS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

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
  words: z.array(WordSchema).min(1).max(20000),
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!consumeRateLimit(`find-clips:${userId}`, FIND_CLIPS_PER_HOUR, HOUR_MS)) {
      return NextResponse.json(
        { error: 'Too many clip-finding requests — try again later' },
        { status: 429 }
      );
    }

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
    return NextResponse.json({ error: 'Clip finding failed' }, { status: 500 });
  }
}
