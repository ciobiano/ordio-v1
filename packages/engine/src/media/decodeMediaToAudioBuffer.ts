/**
 * Decode uploaded Blob to AudioBuffer: fast path via decodeAudioData,
 * fallback via Mediabunny for video containers (e.g. screen recordings) when the browser
 * cannot decode the file as a single audio bitstream.
 */

export type DecodeMediaResult = {
  audioBuffer: AudioBuffer;
  decodePath: 'native' | 'mediabunny';
};

/**
 * Why a file could not be decoded. Each reason asks something different of the
 * person — pick another file, convert this one, or record some sound — so the
 * app needs to tell them apart without matching on message text.
 */
export type MediaDecodeErrorCode = 'empty' | 'no_audio_track' | 'codec_unsupported' | 'unreadable';

export class MediaDecodeError extends Error {
  readonly code: MediaDecodeErrorCode;
  constructor(code: MediaDecodeErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'MediaDecodeError';
    this.code = code;
  }
}

/** Concatenate sequential AudioBuffers (same sample rate + channel count). */
export function concatAudioBuffers(chunks: AudioBuffer[]): AudioBuffer {
  if (chunks.length === 0) {
    throw new Error('concatAudioBuffers: no buffers');
  }
  if (chunks.length === 1) return chunks[0]!;

  const sampleRate = chunks[0]!.sampleRate;
  const channels = chunks[0]!.numberOfChannels;
  let totalLen = 0;
  for (const b of chunks) {
    if (b.sampleRate !== sampleRate) {
      throw new Error('concatAudioBuffers: sample rate mismatch');
    }
    if (b.numberOfChannels !== channels) {
      throw new Error('concatAudioBuffers: channel count mismatch');
    }
    totalLen += b.length;
  }

  const out = new AudioBuffer({
    length: totalLen,
    numberOfChannels: channels,
    sampleRate,
  });
  let offset = 0;
  for (const b of chunks) {
    for (let c = 0; c < channels; c++) {
      out.getChannelData(c).set(b.getChannelData(c), offset);
    }
    offset += b.length;
  }
  return out;
}

async function decodeViaMediabunny(blob: Blob): Promise<AudioBuffer> {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    /* Mediabunny throws on a container it does not recognise at all — a PDF
       renamed to .mp3, a truncated download. That is a different failure from
       a real media file without sound in it. */
    const track = await input.getPrimaryAudioTrack().catch((err: unknown) => {
      throw new MediaDecodeError('unreadable', 'This file could not be read as media.', err);
    });
    if (!track) {
      throw new MediaDecodeError('no_audio_track', 'This file has no audio track to decode.');
    }
    if (!(await track.canDecode())) {
      throw new MediaDecodeError(
        'codec_unsupported',
        'This browser cannot decode the audio in this file.'
      );
    }
    const sink = new AudioBufferSink(track);
    const chunks: AudioBuffer[] = [];
    for await (const wrapped of sink.buffers()) {
      chunks.push(wrapped.buffer);
    }
    if (chunks.length === 0) {
      throw new MediaDecodeError('empty', 'Decoded no audio from file.');
    }
    return concatAudioBuffers(chunks);
  } finally {
    input.dispose();
  }
}

export async function decodeBlobToAudioBuffer(blob: Blob): Promise<DecodeMediaResult> {
  if (blob.size === 0) {
    throw new MediaDecodeError('empty', 'This file is empty.');
  }
  const audioCtx = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const copy = arrayBuffer.byteLength > 0 ? arrayBuffer.slice(0) : arrayBuffer;
    const decoded = await audioCtx.decodeAudioData(copy);
    await audioCtx.close();
    return { audioBuffer: decoded, decodePath: 'native' };
  } catch {
    await audioCtx.close();
    const audioBuffer = await decodeViaMediabunny(blob);
    return { audioBuffer, decodePath: 'mediabunny' };
  }
}
