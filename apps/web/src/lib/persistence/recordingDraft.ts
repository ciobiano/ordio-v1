import { get, set, del } from 'idb-keyval';

const DRAFT_KEY = 'ordio:recording-draft';

export interface RecordingDraft {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  savedAt: number;
}

export async function saveRecordingDraft(
  blob: Blob,
  meta: { mimeType: string; durationSec: number }
): Promise<void> {
  const draft: RecordingDraft = {
    blob,
    mimeType: meta.mimeType,
    durationSec: meta.durationSec,
    savedAt: Date.now(),
  };
  await set(DRAFT_KEY, draft);
}

export async function getRecordingDraft(): Promise<RecordingDraft | null> {
  const draft = await get<RecordingDraft>(DRAFT_KEY);
  return draft ?? null;
}

export async function clearRecordingDraft(): Promise<void> {
  await del(DRAFT_KEY);
}
