import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { consumeRateLimit } from '@/lib/liveTranscription/rateLimit';

// Purpose-built streaming model (spec's designated latency fallback, promoted
// after mobile QA): gpt-4o-mini-transcribe only emitted turn-level chunks —
// captions lagged by whole utterances. gpt-realtime-whisper streams deltas
// continuously, supports the `delay` knob, and uses manual buffer commits
// (the client's frame gate commits at end-of-speech). ~$0.017/min vs $0.003 —
// still ~$0.05 per 3-min recording.
const LIVE_TRANSCRIPTION_MODEL = 'gpt-realtime-whisper';

// Generous for real use (a mint per recording + reconnects), a brake on
// runaway loops. In-memory per instance — see rateLimit.ts for limits.
const MINTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Mints a short-lived OpenAI ephemeral client secret for a transcription-only
 * Realtime session. The browser uses it to open a WebSocket directly to
 * OpenAI — the real API key never leaves the server, and this route holds no
 * state (fits Vercel serverless). Session parameters (model, PCM format) are
 * fixed server-side here so a client can't request a pricier model.
 */
export async function POST(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!consumeRateLimit(userId, MINTS_PER_HOUR, HOUR_MS)) {
    return NextResponse.json(
      { error: 'Too many live caption sessions — try again later' },
      { status: 429 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 120 },
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              // gpt-realtime-whisper requires manual commits (no server VAD);
              // the client's frame gate commits when speech ends.
              turn_detection: null,
              transcription: {
                model: LIVE_TRANSCRIPTION_MODEL,
                language: 'en',
                // Earlier partials at slightly higher word-error — right
                // trade for disposable captions ('minimal' if still laggy).
                delay: 'low',
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[/api/realtime/transcription-token] OpenAI error', res.status, detail);
      return NextResponse.json({ error: 'Failed to create live transcription session' }, { status: 502 });
    }

    const data = (await res.json()) as { value?: string; expires_at?: number };
    if (!data.value) {
      console.error('[/api/realtime/transcription-token] missing secret in OpenAI response');
      return NextResponse.json({ error: 'Failed to create live transcription session' }, { status: 502 });
    }

    return NextResponse.json({ token: data.value, expiresAt: data.expires_at ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token mint failed';
    console.error('[/api/realtime/transcription-token]', message);
    return NextResponse.json({ error: 'Failed to create live transcription session' }, { status: 502 });
  }
}
