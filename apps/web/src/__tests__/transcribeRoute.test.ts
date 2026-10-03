import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { createTranscription, fetchQuery, fetchMutation } = vi.hoisted(() => ({
  createTranscription: vi.fn(),
  fetchQuery: vi.fn(),
  fetchMutation: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user_1', getToken: async () => 'convex-token' }),
}));
vi.mock('convex/nextjs', () => ({ fetchQuery, fetchMutation }));
vi.mock('@Ordio/convex', () => ({
  api: {
    credits: { holdForTranscription: 'credits:hold', settleTranscription: 'credits:settle' },
    transcription: { authorize: 'transcription:authorize', saveChunkWords: 'transcription:saveChunkWords' },
  },
}));
vi.mock('@/lib/liveTranscription/rateLimit', () => ({ consumeRateLimit: () => true }));
vi.mock('openai', () => {
  class APIError extends Error {
    status?: number;
    code?: string;
  }
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}
  class OpenAI {
    static APIError = APIError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    audio = { transcriptions: { create: createTranscription } };
  }
  return { default: OpenAI };
});

import { POST } from '@/app/api/transcribe/route';

const WHISPER_REPLY = {
  text: 'Hello there.',
  duration: 2,
  words: [
    { word: 'Hello', start: 0, end: 0.5 },
    { word: 'there', start: 0.6, end: 1 },
  ],
  segments: [{ text: ' Hello there.', start: 0, end: 1 }],
};

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function storageResponse(bytes: number, type = 'audio/webm', declared = bytes): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': type, 'content-length': String(declared) },
  });
}

function mutationCalls(ref: string) {
  return fetchMutation.mock.calls.filter(([r]) => r === ref);
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  createTranscription.mockReset().mockResolvedValue(WHISPER_REPLY);
  fetchQuery.mockReset().mockResolvedValue({ url: 'https://storage.convex.cloud/f', chunkId: null });
  fetchMutation.mockReset().mockImplementation(async (ref: string) =>
    ref === 'credits:hold' ? { allowed: true, held: 20, minutes: 10 } : null
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(storageResponse(1024)));
});

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/transcribe — stored audio', () => {
  it('transcribes a file from storage by its ID, and bills what Whisper reports', async () => {
    const res = await POST(jsonRequest({ storageId: 'storage_1', durationSec: 2 }));

    expect(res.status).toBe(200);
    expect((await res.json()).words).toEqual([
      { text: 'Hello', start: 0, end: 0.5 },
      { text: 'there.', start: 0.6, end: 1 },
    ]);
    expect(fetchQuery).toHaveBeenCalledWith(
      'transcription:authorize',
      { storageId: 'storage_1' },
      { token: 'convex-token' }
    );
    expect(fetch).toHaveBeenCalledWith('https://storage.convex.cloud/f');
    // Named by its stored type: Whisper decodes by file name.
    expect(createTranscription.mock.calls[0]![0].file.name).toBe('audio.webm');
    expect(mutationCalls('credits:settle')[0]![1]).toEqual({ held: 20, actualSeconds: 2 });
  });

  it('refuses a file the caller does not own, before holding or downloading anything', async () => {
    fetchQuery.mockResolvedValue(null);
    const res = await POST(jsonRequest({ storageId: 'someone_elses' }));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('TRANSCRIBE_BAD_REQUEST');
    expect(mutationCalls('credits:hold')).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(createTranscription).not.toHaveBeenCalled();
  });

  it('refuses a stored file over Whisper’s 25MB without reading it, and returns the hold', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(storageResponse(16, 'audio/wav', 26 * 1024 * 1024)));
    const res = await POST(jsonRequest({ storageId: 'storage_1', durationSec: 900 }));

    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('TRANSCRIBE_FILE_TOO_LARGE');
    expect(createTranscription).not.toHaveBeenCalled();
    expect(mutationCalls('credits:settle')[0]![1]).toEqual({ held: 20, actualSeconds: 0 });
  });

  it('returns the hold when storage cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const res = await POST(jsonRequest({ storageId: 'storage_1' }));

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('TRANSCRIBE_FAILED');
    expect(mutationCalls('credits:settle')[0]![1]).toEqual({ held: 20, actualSeconds: 0 });
  });

  it('keeps an Episode chunk’s words in Convex, so a closed tab does not lose them', async () => {
    fetchQuery.mockResolvedValue({ url: 'https://storage.convex.cloud/f', chunkId: 'chunk_7' });
    await POST(jsonRequest({ storageId: 'storage_1', durationSec: 2 }));

    const [, args] = mutationCalls('transcription:saveChunkWords')[0]!;
    expect(args).toEqual({
      chunkId: 'chunk_7',
      words: [
        { text: 'Hello', start: 0, end: 0.5 },
        { text: 'there.', start: 0.6, end: 1 },
      ],
    });
  });

  it('still answers with the words when saving them to the chunk fails', async () => {
    fetchQuery.mockResolvedValue({ url: 'https://storage.convex.cloud/f', chunkId: 'chunk_7' });
    fetchMutation.mockImplementation(async (ref: string) => {
      if (ref === 'credits:hold') return { allowed: true, held: 20, minutes: 10 };
      if (ref === 'transcription:saveChunkWords') throw new Error('convex down');
      return null;
    });
    const res = await POST(jsonRequest({ storageId: 'storage_1' }));

    expect(res.status).toBe(200);
    expect((await res.json()).words).toHaveLength(2);
  });

  /* The first attempt's response was lost but its Words were saved. Answering
     from them is the difference between billing a chunk once and twice. */
  it('answers a retry for an already-transcribed chunk without billing or calling Whisper', async () => {
    const saved = [{ text: 'Saved', start: 0, end: 1 }];
    fetchQuery.mockResolvedValue({ url: 'https://storage.convex.cloud/f', chunkId: 'chunk_7', words: saved });
    const res = await POST(jsonRequest({ storageId: 'storage_1', durationSec: 600 }));

    expect(res.status).toBe(200);
    expect((await res.json()).words).toEqual(saved);
    expect(mutationCalls('credits:hold')).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(createTranscription).not.toHaveBeenCalled();
  });

  it('retries saving the words of a chunk once before giving up', async () => {
    fetchQuery.mockResolvedValue({ url: 'https://storage.convex.cloud/f', chunkId: 'chunk_7', words: null });
    let attempts = 0;
    fetchMutation.mockImplementation(async (ref: string) => {
      if (ref === 'credits:hold') return { allowed: true, held: 20, minutes: 10 };
      if (ref === 'transcription:saveChunkWords' && ++attempts === 1) throw new Error('blip');
      return null;
    });
    await POST(jsonRequest({ storageId: 'storage_1' }));

    expect(mutationCalls('transcription:saveChunkWords')).toHaveLength(2);
  });

  it('says transcription is unavailable when ownership cannot be checked', async () => {
    fetchQuery.mockRejectedValue(new Error('convex down'));
    const res = await POST(jsonRequest({ storageId: 'storage_1' }));

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('TRANSCRIBE_UNAVAILABLE');
  });

  it('rejects a JSON body without a storage ID', async () => {
    const res = await POST(jsonRequest({ durationSec: 4 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('TRANSCRIBE_BAD_REQUEST');
  });
});

describe('POST /api/transcribe — old multipart uploads', () => {
  /* Audio used to travel in the request body. Clients now send a storage ID;
     an old tab that still posts the file is refused before anything is
     authorized or charged, and a reload puts it on the new client. */
  it('refuses a multipart upload without charging anything', async () => {
    const boundary = 'ordio-test-boundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="audio"; filename="take.webm"',
      'Content-Type: audio/webm',
      '',
      'fake-audio-bytes',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const res = await POST(
      new NextRequest('http://localhost/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('TRANSCRIBE_BAD_REQUEST');
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(mutationCalls('credits:hold')).toHaveLength(0);
    expect(createTranscription).not.toHaveBeenCalled();
  });
});
