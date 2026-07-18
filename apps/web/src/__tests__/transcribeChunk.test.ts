import { describe, it, expect, vi, afterEach } from 'vitest';
import { transcribeChunk } from '@/lib/transcription/transcribeChunk';

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
});
