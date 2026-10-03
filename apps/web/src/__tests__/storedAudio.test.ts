import { describe, it, expect, vi, afterEach } from 'vitest';
import { uploadAudio, transcribeStoredAudio } from '@/lib/transcription/storedAudio';
import { InsufficientCreditsError } from '@/lib/transcription/insufficientCredits';
import { OrdioError } from '@/lib/errors/OrdioError';

afterEach(() => vi.unstubAllGlobals());

const stored = (storageId: unknown = 'storage_1') => ({
  ok: true,
  status: 200,
  json: async () => ({ storageId }),
});

describe('uploadAudio', () => {
  it('posts the audio to the upload URL with its own type, and returns the storage ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(stored());
    vi.stubGlobal('fetch', fetchMock);
    const wav = new Blob(['x'], { type: 'audio/wav' });

    const id = await uploadAudio(wav, async () => 'https://upload.convex.cloud/u');

    expect(id).toBe('storage_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://upload.convex.cloud/u');
    // The route later names the file by this type, and Whisper decodes by name.
    expect(init.headers).toEqual({ 'Content-Type': 'audio/wav' });
    expect(init.body).toBe(wav);
  });

  it('names a failure to get an upload URL', async () => {
    const failing = () => Promise.reject(new Error('convex down'));
    await expect(uploadAudio(new Blob(['x']), failing)).rejects.toMatchObject({
      code: 'UPLOAD_URL_FAILED',
    });
  });

  it('names a rejected upload by its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(uploadAudio(new Blob(['x']), async () => 'u')).rejects.toMatchObject({
      code: 'UPLOAD_FAILED',
    });
  });

  it('treats a response without a storage ID as a failed upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stored(null)));
    const err = await uploadAudio(new Blob(['x']), async () => 'u').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OrdioError);
    expect((err as OrdioError).code).toBe('UPLOAD_FAILED');
  });

  it('lets a cancel through as a cancel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(uploadAudio(new Blob(['x']), async () => 'u')).rejects.toThrow('Aborted');
  });
});

describe('transcribeStoredAudio', () => {
  it('returns the words the route sends back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ words: [{ text: 'hi', start: 0, end: 1 }] }) })
    );
    await expect(transcribeStoredAudio('storage_1', 12)).resolves.toEqual([
      { text: 'hi', start: 0, end: 1 },
    ]);
  });

  it('keeps out-of-credits distinct from other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({ code: 'INSUFFICIENT_CREDITS' }) })
    );
    await expect(transcribeStoredAudio('storage_1', 12)).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it('keeps the name the route gave a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({ code: 'TRANSCRIBE_FILE_TOO_LARGE', error: 'Audio is too large to transcribe' }),
      })
    );
    await expect(transcribeStoredAudio('storage_1', 12)).rejects.toMatchObject({
      code: 'TRANSCRIBE_FILE_TOO_LARGE',
    });
  });
});
