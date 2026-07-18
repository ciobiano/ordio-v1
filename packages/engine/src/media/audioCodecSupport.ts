/**
 * Ingest encode strategy for episode chunks.
 * 'opus'  — encode mono 16kHz Opus in WebM (data-light path, ~10 min chunks)
 * 'wav'   — WAV fallback where Opus encoding is unavailable (~5 min chunks)
 */
export type IngestStrategy = 'opus' | 'wav';

export async function detectIngestStrategy(): Promise<IngestStrategy> {
  try {
    const { canEncodeAudio } = await import('mediabunny');
    return (await canEncodeAudio('opus')) ? 'opus' : 'wav';
  } catch {
    return 'wav';
  }
}
