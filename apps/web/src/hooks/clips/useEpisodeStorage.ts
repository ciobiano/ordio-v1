'use client';

/**
 * Where an Episode's work is kept between runs.
 *
 * Every chunk is uploaded to Convex storage (so it can reach Whisper without
 * passing through Vercel's 4.5MB request limit), and the Episode, its chunks,
 * their Words and its Clips are kept for 7 days. Dropping the same file again
 * within that window reopens its Clips — or resumes a run that stopped —
 * without reading, uploading or spending Credits twice.
 */

import { useMemo } from 'react';
import { useMutation } from 'convex/react';
import type { GenericId } from 'convex/values';
import { api } from '@Ordio/convex';
import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import type { EpisodeChunk } from '@Ordio/engine/media/episodeIngest';
import { isAbortError } from '@/lib/errors/OrdioError';
import { uploadAudio } from '@/lib/transcription/storedAudio';

export type EpisodeId = GenericId<'episodes'>;

export interface SavedEpisode {
  episodeId: EpisodeId;
  durationSec: number;
  candidates: ClipCandidate[] | null;
  chunks: Array<{ startSec: number; durationSec: number; words: Word[] | null }>;
}

/**
 * How the same file is recognised when it is dropped again. Name, size and
 * modification time together: cheap to read, and a different file matching
 * all three is vanishingly unlikely.
 */
export function episodeFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function useEpisodeStorage() {
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const claimUpload = useMutation(api.transcription.claimUpload);
  const resumeEpisode = useMutation(api.episodes.resume);
  const createEpisode = useMutation(api.episodes.create);
  const addChunk = useMutation(api.episodes.addChunk);
  const saveEpisodeCandidates = useMutation(api.episodes.saveCandidates);

  return useMemo(
    () => ({
      /**
       * The saved run for this file, or null. Never throws: a saved run being
       * unreachable means reading the Episode fresh, not failing it.
       */
      async resume(fingerprint: string): Promise<SavedEpisode | null> {
        try {
          return ((await resumeEpisode({ fingerprint })) as SavedEpisode | null | undefined) ?? null;
        } catch (err) {
          console.warn('[useEpisodeStorage] could not load a saved run; reading fresh', err);
          return null;
        }
      },

      async create(fingerprint: string, durationSec: number): Promise<EpisodeId> {
        return (await createEpisode({ fingerprint, durationSec })) as EpisodeId;
      },

      /**
       * Upload one chunk and attach it to the Episode; returns its storage ID.
       * The upload is retried once — a dropped connection is the usual cause,
       * and the chunk is already paid for in decode time. It is claimed before
       * it is attached, so a chunk whose attach fails is still swept.
       */
      async storeChunk(episodeId: EpisodeId, chunk: EpisodeChunk, signal: AbortSignal): Promise<string> {
        const upload = () => uploadAudio(chunk.blob, () => generateUploadUrl(), signal);
        let storageId: string;
        try {
          storageId = await upload();
        } catch (err) {
          if (isAbortError(err)) throw err;
          storageId = await upload();
        }
        await claimUpload({ storageId: storageId as GenericId<'_storage'> });
        await addChunk({
          episodeId,
          startSec: chunk.startSec,
          durationSec: chunk.durationSec,
          storageId: storageId as GenericId<'_storage'>,
        });
        return storageId;
      },

      /** Keep the Clips with the Episode. Best-effort: they are already on screen. */
      async saveCandidates(episodeId: EpisodeId, candidates: ClipCandidate[]): Promise<void> {
        try {
          await saveEpisodeCandidates({ episodeId, candidates });
        } catch (err) {
          console.warn('[useEpisodeStorage] could not save Clips', err);
        }
      },
    }),
    [generateUploadUrl, claimUpload, resumeEpisode, createEpisode, addChunk, saveEpisodeCandidates]
  );
}
