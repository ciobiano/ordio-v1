/**
 * Ingest encode strategy for episode chunks.
 * 'opus' — mono 16kHz Opus in WebM, through the browser's WebCodecs encoder
 * 'mp3'  — mono 16kHz MP3, through a WASM LAME encoder, where Opus is not
 *          encodable: Safari before 26 has no AudioEncoder at all, and Firefox
 *          on Android still has none
 *
 * Both fit a 10-minute chunk under the upload body limit (see episodePlan.ts).
 * `@mediabunny/mp3-encoder` is pinned to mediabunny's exact version: the two
 * ship in lockstep, and newer encoder builds import names older mediabunny
 * does not export.
 */
import { CHUNK_BITRATE_BPS } from './episodePlan';

export type IngestStrategy = 'opus' | 'mp3';

/** Checked against what is actually encoded, not mediabunny's stereo 48kHz default. */
function chunkConfig(strategy: IngestStrategy) {
  return { numberOfChannels: 1, sampleRate: 16_000, bitrate: CHUNK_BITRATE_BPS[strategy] };
}

/** Resolves to null when this browser can encode neither. */
export async function detectIngestStrategy(): Promise<IngestStrategy | null> {
  try {
    const { canEncodeAudio } = await import('mediabunny');
    if (await canEncodeAudio('opus', chunkConfig('opus'))) return 'opus';

    if (!(await canEncodeAudio('mp3', chunkConfig('mp3')))) {
      const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
      registerMp3Encoder();
    }
    return (await canEncodeAudio('mp3', chunkConfig('mp3'))) ? 'mp3' : null;
  } catch (err) {
    console.warn('[detectIngestStrategy] no usable chunk encoder', err);
    return null;
  }
}
