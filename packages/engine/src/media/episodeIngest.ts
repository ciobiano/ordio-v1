/**
 * Stream-ingest a long podcast episode: decode window-by-window (never the
 * whole file into memory), downmix each window to mono 16kHz, encode it as
 * an upload-ready chunk (Opus/WebM, WAV fallback), and accumulate per-second
 * energy as a byproduct.
 *
 * NOTE: not unit-testable in jsdom (requires real WebCodecs / OfflineAudioContext
 * decode). Exercised via on-device QA. Only audioCodecSupport.ts has automated tests.
 */
import {
  planChunkWindows,
  createEnergyAccumulator,
  OPUS_CHUNK_SEC,
  WAV_CHUNK_SEC,
  MAX_EPISODE_SEC,
} from './episodePlan';
import { detectIngestStrategy, type IngestStrategy } from './audioCodecSupport';
import { audioBufferToWavBlob } from './whisperAudio';

export type EpisodeIngestErrorCode = 'too_long' | 'undecodable';

export class EpisodeIngestError extends Error {
  code: EpisodeIngestErrorCode;
  constructor(code: EpisodeIngestErrorCode, message: string) {
    super(message);
    this.name = 'EpisodeIngestError';
    this.code = code;
  }
}

const TARGET_RATE = 16_000;

export interface EpisodeIngestResult {
  durationSec: number;
  strategy: IngestStrategy;
  chunks: Array<{ startSec: number; blob: Blob }>;
  energy: number[];
}

/** Resample+downmix one decoded window to mono 16kHz via OfflineAudioContext. */
async function toMono16k(buffer: AudioBuffer): Promise<AudioBuffer> {
  const length = Math.ceil(buffer.duration * TARGET_RATE);
  const ctx = new OfflineAudioContext(1, Math.max(1, length), TARGET_RATE);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

async function encodeChunk(mono16k: AudioBuffer, strategy: IngestStrategy): Promise<Blob> {
  if (strategy === 'wav') return audioBufferToWavBlob(mono16k);
  const { Output, BufferTarget, WebMOutputFormat, AudioBufferSource, QUALITY_LOW } = await import(
    'mediabunny'
  );
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const source = new AudioBufferSource({ codec: 'opus', bitrate: QUALITY_LOW });
  output.addAudioTrack(source);
  await output.start();
  await source.add(mono16k);
  source.close();
  await output.finalize();
  const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
  if (!buffer) throw new Error('Opus encode produced no output');
  return new Blob([buffer], { type: 'audio/webm' });
}

/**
 * Stream-ingest a long episode: decode window-by-window (never the whole
 * file), downmix each window to mono 16kHz, encode it as an upload-ready
 * chunk, and accumulate per-second energy as a byproduct.
 */
export async function ingestEpisode(
  file: File,
  opts: { signal: AbortSignal; onProgress?: (fraction: number) => void }
): Promise<EpisodeIngestResult> {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) {
      throw new EpisodeIngestError('undecodable', 'This browser cannot decode this file.');
    }
    const durationSec = await track.computeDuration();
    if (durationSec > MAX_EPISODE_SEC) {
      throw new EpisodeIngestError('too_long', 'Episodes longer than 90 minutes are not supported.');
    }

    const strategy = await detectIngestStrategy();
    const chunkSec = strategy === 'opus' ? OPUS_CHUNK_SEC : WAV_CHUNK_SEC;
    const windows = planChunkWindows(durationSec, chunkSec);
    const energyAcc = createEnergyAccumulator(durationSec);
    const chunks: Array<{ startSec: number; blob: Blob }> = [];

    for (let i = 0; i < windows.length; i++) {
      if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { start, end } = windows[i]!;

      // Decode only this window's samples; buffers stream and are dropped after use.
      const sink = new AudioBufferSink(track);
      const pieces: AudioBuffer[] = [];
      for await (const { buffer } of sink.buffers(start, end)) {
        if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        pieces.push(buffer);
      }
      if (pieces.length === 0) continue;

      const { concatAudioBuffers } = await import('./decodeMediaToAudioBuffer');
      const windowBuffer = concatAudioBuffers(pieces);
      pieces.length = 0;

      // Note: startRendering()/finalize() below aren't interruptible mid-flight;
      // these checks discard an already-completed window promptly instead.
      const mono = await toMono16k(windowBuffer);
      if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      energyAcc.add(mono.getChannelData(0), start, TARGET_RATE);
      const blob = await encodeChunk(mono, strategy);
      if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      chunks.push({ startSec: start, blob });
      opts.onProgress?.((i + 1) / windows.length);
    }

    return { durationSec, strategy, chunks, energy: energyAcc.finish() };
  } finally {
    input.dispose();
  }
}
