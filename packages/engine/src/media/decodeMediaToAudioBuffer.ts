/**
 * Decode uploaded Blob to AudioBuffer: fast path via decodeAudioData,
 * fallback via Mediabunny for video containers (e.g. screen recordings) when the browser
 * cannot decode the file as a single audio bitstream.
 */

export type DecodeMediaResult = {
  audioBuffer: AudioBuffer;
  decodePath: 'native' | 'mediabunny';
};

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
    const track = await input.getPrimaryAudioTrack();
    if (!track) {
      throw new Error('This file has no audio track to decode.');
    }
    if (!(await track.canDecode())) {
      throw new Error('This browser cannot decode the audio in this file.');
    }
    const sink = new AudioBufferSink(track);
    const chunks: AudioBuffer[] = [];
    for await (const wrapped of sink.buffers()) {
      chunks.push(wrapped.buffer);
    }
    if (chunks.length === 0) {
      throw new Error('Decoded no audio from file.');
    }
    return concatAudioBuffers(chunks);
  } finally {
    input.dispose();
  }
}

export async function decodeBlobToAudioBuffer(blob: Blob): Promise<DecodeMediaResult> {
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
