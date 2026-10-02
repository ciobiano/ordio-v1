import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Mock mediabunny's canEncodeAudio, and an MP3 encoder whose registration flips `mp3Registered`. */
function mockCodecs(canEncode: (codec: string, mp3Registered: boolean) => boolean) {
  let mp3Registered = false;
  const canEncodeAudio = vi.fn<(codec: string, options?: object) => Promise<boolean>>(
    async (codec) => canEncode(codec, mp3Registered)
  );
  const registerMp3Encoder = vi.fn(() => {
    mp3Registered = true;
  });
  vi.doMock('mediabunny', () => ({ canEncodeAudio }));
  vi.doMock('@mediabunny/mp3-encoder', () => ({ registerMp3Encoder }));
  return { canEncodeAudio, registerMp3Encoder };
}

async function detect() {
  const { detectIngestStrategy } = await import('@Ordio/engine/media/audioCodecSupport');
  return detectIngestStrategy();
}

describe('detectIngestStrategy', () => {
  beforeEach(() => vi.resetModules());

  it('returns opus when mediabunny reports Opus encodable', async () => {
    const { registerMp3Encoder } = mockCodecs((codec) => codec === 'opus');
    expect(await detect()).toBe('opus');
    expect(registerMp3Encoder).not.toHaveBeenCalled();
  });

  /* mediabunny checks stereo 48kHz unless told otherwise. A browser that can
     encode that but not mono 16kHz would pass the check and then fail on the
     first chunk. */
  it('checks Opus against the mono 16kHz audio it will actually encode', async () => {
    const { canEncodeAudio } = mockCodecs((codec) => codec === 'opus');
    await detect();
    expect(canEncodeAudio).toHaveBeenCalledWith(
      'opus',
      expect.objectContaining({ numberOfChannels: 1, sampleRate: 16_000 })
    );
  });

  // Safari before 26 has no AudioEncoder, so it lands here.
  it('registers the WASM MP3 encoder and returns mp3 when Opus is not encodable', async () => {
    const { registerMp3Encoder } = mockCodecs((codec, registered) => codec === 'mp3' && registered);
    expect(await detect()).toBe('mp3');
    expect(registerMp3Encoder).toHaveBeenCalledTimes(1);
  });

  it('does not register a second MP3 encoder when one is already available', async () => {
    const { registerMp3Encoder } = mockCodecs((codec) => codec === 'mp3');
    expect(await detect()).toBe('mp3');
    expect(registerMp3Encoder).not.toHaveBeenCalled();
  });

  it('returns null when neither codec can be encoded', async () => {
    mockCodecs(() => false);
    expect(await detect()).toBeNull();
  });

  it('returns null when mediabunny import fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('mediabunny', () => {
      throw new Error('no webcodecs');
    });
    expect(await detect()).toBeNull();
  });
});
