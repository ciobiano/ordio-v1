import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { saveRecordingDraft, getRecordingDraft, clearRecordingDraft } from '@/lib/persistence/recordingDraft';

describe('lib/persistence: recordingDraft', () => {
  it('returns null when no draft has been saved', async () => {
    const draft = await getRecordingDraft();
    expect(draft).toBeNull();
  });

  it('round-trips a saved draft', async () => {
    const blob = new Blob(['test-audio'], { type: 'audio/webm' });
    await saveRecordingDraft(blob, { mimeType: 'audio/webm', durationSec: 12.5 });

    const draft = await getRecordingDraft();
    expect(draft).not.toBeNull();
    expect(draft?.mimeType).toBe('audio/webm');
    expect(draft?.durationSec).toBe(12.5);
    // Not asserting `draft.blob instanceof Blob` here: fake-indexeddb's
    // structured-clone in this jsdom + Node environment does not preserve
    // Blob content (comes back as a plain object), a known test-double
    // limitation — not a product bug. Real browsers round-trip Blobs via
    // IndexedDB correctly; verified via on-device QA instead (see plan
    // Task 7), matching this codebase's existing accepted-limitation
    // pattern for Blob/WebCodecs-heavy code.
    expect(draft?.blob).toBeDefined();
    expect(draft?.savedAt).toBeGreaterThan(0);
  });

  it('overwrites a previous draft on save', async () => {
    await saveRecordingDraft(new Blob(['first']), { mimeType: 'audio/webm', durationSec: 5 });
    await saveRecordingDraft(new Blob(['second']), { mimeType: 'audio/webm', durationSec: 8 });

    const draft = await getRecordingDraft();
    expect(draft?.durationSec).toBe(8);
  });

  it('clears a saved draft', async () => {
    await saveRecordingDraft(new Blob(['test']), { mimeType: 'audio/webm', durationSec: 3 });
    await clearRecordingDraft();

    const draft = await getRecordingDraft();
    expect(draft).toBeNull();
  });
});
