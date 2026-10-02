'use client';

/**
 * Turning a chosen candidate into a real Session.
 *
 * Extract the window from the episode file, encode it, upload it, and create
 * the Session carrying the transcript re-based to the clip. None of that is
 * viewport-specific, and it was living inside the mobile sheet — so the
 * desktop picker would either have imported a phone bottom-sheet to reach it
 * or grown a second copy of an upload sequence with four failure points.
 *
 * The `picking` index is returned rather than kept private because both
 * pickers need it for the same two jobs: naming which row is working, and
 * refusing a second pick while one is in flight. Two concurrent extracts of a
 * multi-megabyte file is the one thing this must not allow.
 */

import { useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { notifyError } from '@/lib/errors/notify';
import { OrdioError } from '@/lib/errors/OrdioError';
import { uploadCodeFor } from '@/lib/errors/classify';
import type { GenericId } from 'convex/values';
import { api } from '@Ordio/convex';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { extractWindow } from '@Ordio/engine/media/extractWindow';
import { audioBufferToWavBlob } from '@Ordio/engine/media/whisperAudio';
import { windowTranscript } from '@/lib/clips/windowTranscript';

interface UseClipPickerArgs {
  episodeFile: File | null;
  episodeWords: Word[];
  onPicked: (sessionId: string) => void;
}

export function useClipPicker({ episodeFile, episodeWords, onPicked }: UseClipPickerArgs) {
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);

  const pick = useCallback(
    async (candidate: ClipCandidate, index: number) => {
      if (!episodeFile || pickingIndex !== null) return;
      setPickingIndex(index);
      try {
        const buffer = await extractWindow(episodeFile, candidate.start, candidate.end);
        const blob = audioBufferToWavBlob(buffer);

        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'audio/wav' },
          body: blob,
        });
        if (!uploadRes.ok) {
          throw new OrdioError(uploadCodeFor(uploadRes.status), {
            message: `Clip upload returned HTTP ${uploadRes.status}`,
          });
        }
        const { storageId } = (await uploadRes.json()) as { storageId: string };

        const sessionId = await createSession({
          storageId: storageId as GenericId<'_storage'>,
          mimeType: 'audio/wav',
          durationSec: candidate.end - candidate.start,
          transcript: windowTranscript(episodeWords, candidate.start, candidate.end),
        });
        onPicked(sessionId);
      } catch (err) {
        notifyError(err, { fallback: 'CLIP_PREPARE_FAILED' });
        /* Cleared only on failure. On success the sheet is closing, and
           releasing the lock first would let a second row be pressed
           during the teardown frame. */
        setPickingIndex(null);
      }
    },
    [episodeFile, episodeWords, pickingIndex, generateUploadUrl, createSession, onPicked]
  );

  return { pick, pickingIndex, busy: pickingIndex !== null };
}
