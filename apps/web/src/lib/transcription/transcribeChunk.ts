import type { Word } from '@Ordio/shared/schemas';

/**
 * POST one episode chunk to the existing stateless /api/transcribe route.
 * Retries once on failure (network or 5xx); aborts propagate immediately.
 */
export async function transcribeChunk(blob: Blob, signal: AbortSignal): Promise<Word[]> {
  const attempt = async (): Promise<Word[]> => {
    const formData = new FormData();
    const ext = blob.type.includes('webm') ? 'webm' : 'wav';
    formData.append('audio', blob, `chunk.${ext}`);
    const res = await fetch('/api/transcribe', { method: 'POST', body: formData, signal });
    if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
    const { words } = (await res.json()) as { words: Word[] };
    return words;
  };

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return attempt();
  }
}
