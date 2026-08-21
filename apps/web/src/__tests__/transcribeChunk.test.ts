import { describe, it, expect, vi, afterEach } from 'vitest';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';
import { InsufficientCreditsError } from '@/lib/transcription/insufficientCredits';

const okResponse = { ok: true, json: async () => ({ words: [{ text: 'hi', start: 0, end: 1 }] }) };

afterEach(() => vi.unstubAllGlobals());

describe('transcribeChunk', () => {
  it('returns words on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse));
    const words = await transcribeChunk(new Blob(['x'], { type: 'audio/webm' }), new AbortController().signal);
    expect(words).toEqual([{ text: 'hi', start: 0, end: 1 }]);
  });

  it('retries once after a failure, then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(okResponse);
    vi.stubGlobal('fetch', fetchMock);
    const words = await transcribeChunk(new Blob(['x']), new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(words).toHaveLength(1);
  });

  it('throws after two failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      transcribeChunk(new Blob(['x']), new AbortController().signal)
    ).rejects.toThrow('Transcription failed (500)');
  });

  it('does not retry on abort', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(transcribeChunk(new Blob(['x']), new AbortController().signal)).rejects.toThrow('Aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /* The hold is sized from what the caller declares. A chunk that declares
     nothing is held at the one-credit floor and then settled at full price,
     so a long episode walks the balance far below zero and every later
     transcription is refused. */
  it('declares the chunk length so the hold matches the work', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse);
    vi.stubGlobal('fetch', fetchMock);
    await transcribeChunk(new Blob(['x']), new AbortController().signal, 300);

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('durationSec')).toBe('300');
  });

  it('omits the length rather than declaring a nonsense one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse);
    vi.stubGlobal('fetch', fetchMock);
    await transcribeChunk(new Blob(['x']), new AbortController().signal, 0);

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('durationSec')).toBeNull();
  });

  it('surfaces running out of credits as its own error, not a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ code: 'INSUFFICIENT_CREDITS', minutes: 0 }),
      })
    );
    await expect(
      transcribeChunk(new Blob(['x']), new AbortController().signal, 60)
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  /* Retrying a refusal costs a second round trip to be refused identically. */
  it('does not retry when the balance is spent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ code: 'INSUFFICIENT_CREDITS', minutes: 0 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      transcribeChunk(new Blob(['x']), new AbortController().signal, 60)
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still retries a transient failure that returns no JSON body', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce(okResponse);
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      transcribeChunk(new Blob(['x']), new AbortController().signal, 60)
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
