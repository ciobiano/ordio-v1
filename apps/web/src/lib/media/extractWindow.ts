import { concatAudioBuffers } from './decodeMediaToAudioBuffer';

/**
 * Seek-decode only [startSec, endSec] of the original local file at
 * original quality. Never decodes the whole episode (30-60s of PCM max).
 */
export async function extractWindow(
  file: File,
  startSec: number,
  endSec: number
): Promise<AudioBuffer> {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) {
      throw new Error('Cannot decode this file for clip extraction.');
    }
    const sink = new AudioBufferSink(track);
    const pieces: AudioBuffer[] = [];
    for await (const { buffer } of sink.buffers(startSec, endSec)) {
      pieces.push(buffer);
    }
    if (pieces.length === 0) throw new Error('No audio decoded in the selected window.');
    return concatAudioBuffers(pieces);
  } finally {
    input.dispose();
  }
}
