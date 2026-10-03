import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeVideoFFmpeg } from '@Ordio/engine/video';
import type { EncodeVideoOptions } from '@Ordio/engine/video/videoEncoder';

type LogListener = (event: { message: string }) => void;
type ExecOptions = { signal?: AbortSignal };

const ffmpeg = vi.hoisted(() => ({
  load: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  deleteFile: vi.fn(),
  exec: vi.fn(),
  terminate: vi.fn(),
  logListeners: [] as Array<(event: { message: string }) => void>,
}));

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = ffmpeg.load;
    writeFile = ffmpeg.writeFile;
    readFile = ffmpeg.readFile;
    deleteFile = ffmpeg.deleteFile;
    exec = ffmpeg.exec;
    terminate = ffmpeg.terminate;
    on = (_event: 'log', listener: LogListener) => ffmpeg.logListeners.push(listener);
  },
}));

vi.mock('@Ordio/engine/loaders', () => ({
  loadFont: vi.fn().mockResolvedValue(undefined),
  loadGraphic: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@Ordio/engine/video/frameRenderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@Ordio/engine/video/frameRenderer')>()),
  renderFrame: vi.fn(),
}));

const SAMPLE_RATE = 48_000;
const DURATION = 0.1; // 3 frames at 30fps

function options(signal?: AbortSignal): EncodeVideoOptions {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({}),
    toBlob: (done: BlobCallback) => done(new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' })),
  };
  const audioBuffer = {
    duration: DURATION,
    length: SAMPLE_RATE * DURATION,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(SAMPLE_RATE * DURATION),
  };
  return {
    canvas,
    audioBuffer,
    style: { fontFamily: 'Inter', width: 1080, height: 1920 },
    signal,
  } as unknown as EncodeVideoOptions;
}

function emitLog(...messages: string[]) {
  for (const message of messages) ffmpeg.logListeners.forEach((listener) => listener({ message }));
}

describe('engine: encodeVideoFFmpeg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ffmpeg.logListeners.length = 0;
    ffmpeg.load.mockResolvedValue(true);
    ffmpeg.writeFile.mockResolvedValue(true);
    ffmpeg.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    ffmpeg.deleteFile.mockResolvedValue(true);
    ffmpeg.exec.mockResolvedValue(0);
  });

  it('loads the self-hosted core and returns the MP4', async () => {
    const result = await encodeVideoFFmpeg(options());

    expect(ffmpeg.load).toHaveBeenCalledWith(
      {
        coreURL: `${window.location.origin}/ffmpeg/ffmpeg-core.js`,
        wasmURL: `${window.location.origin}/ffmpeg/ffmpeg-core.wasm`,
      },
      expect.anything()
    );
    expect(ffmpeg.writeFile.mock.calls.map(([path]) => path)).toEqual([
      'frame000000.jpg',
      'frame000001.jpg',
      'frame000002.jpg',
      'audio.wav',
    ]);
    expect(result.mimeType).toBe('video/mp4');
    expect(result.blob.size).toBe(3);
    expect(ffmpeg.terminate).toHaveBeenCalledOnce();
  });

  it('throws the reason ffmpeg logged when it exits non-zero', async () => {
    ffmpeg.exec.mockImplementation(async () => {
      emitLog('[libx264] width not divisible by 2 (1x1)', 'Conversion failed!', 'Aborted()');
      return 1;
    });

    await expect(encodeVideoFFmpeg(options())).rejects.toThrow(
      'ffmpeg exited with code 1: [libx264] width not divisible by 2 (1x1)'
    );
    expect(ffmpeg.readFile).not.toHaveBeenCalled();
    expect(ffmpeg.terminate).toHaveBeenCalledOnce();
  });

  it('cancelling mid-transcode rejects as a cancel and kills the worker', async () => {
    const controller = new AbortController();
    ffmpeg.exec.mockImplementation(
      (_args: string[], _timeout?: number, { signal }: ExecOptions = {}) =>
        new Promise((resolve, reject) => {
          // Like ffmpeg.wasm: only a signal handed to exec() can reject it.
          signal?.addEventListener('abort', () => reject(new DOMException('Message # 9 was aborted', 'AbortError')));
          controller.abort();
          resolve(0); // without one, the transcode just finishes
        })
    );

    await expect(encodeVideoFFmpeg(options(controller.signal))).rejects.toMatchObject({ name: 'AbortError' });
    expect(ffmpeg.terminate).toHaveBeenCalledOnce();
  });

  it('a cancel that lands just before the transcode never starts it', async () => {
    const controller = new AbortController();
    ffmpeg.writeFile.mockImplementation(async (path: string) => {
      if (path === 'audio.wav') controller.abort();
      return true;
    });

    await expect(encodeVideoFFmpeg(options(controller.signal))).rejects.toMatchObject({ name: 'AbortError' });
    expect(ffmpeg.exec).not.toHaveBeenCalled();
    expect(ffmpeg.terminate).toHaveBeenCalledOnce();
  });
});
