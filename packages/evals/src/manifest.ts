/**
 * The golden dataset.
 *
 * A manifest is a JSON file listing audio files and the transcript each one
 * *should* produce. Keeping it as data rather than code means adding a sample
 * is dropping in two files and one entry — low enough friction that the
 * dataset actually grows.
 *
 * `split` exists so results can be reported the way ASR results are
 * conventionally reported: clean speech and difficult speech scored
 * separately. A single averaged number hides the thing worth knowing, which is
 * usually how far quality falls on accented or noisy audio.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface Sample {
  /** Stable identifier, used as the row label in the report. */
  id: string;
  /** Path to the audio, relative to the manifest. */
  audio: string;
  /** Path to the reference transcript, relative to the manifest. */
  reference: string;
  /**
   * Which bucket this belongs to. `clean` is studio-quality read speech;
   * `other` is accented, noisy, fast, or otherwise hard. Free-form so you can
   * add your own — `nigerian`, `podcast`, `phone` — and get a per-split row.
   */
  split: string;
  /** Anything worth remembering about why this sample is in the set. */
  note?: string;
}

export interface LoadedSample extends Sample {
  /** Absolute path, resolved against the manifest's own location. */
  audioPath: string;
  referenceText: string;
}

/**
 * Read a manifest and pull in every reference transcript.
 *
 * Audio is deliberately *not* read here — the files are large and the runner
 * streams them one at a time. Transcripts are small and having them up front
 * means a broken path fails immediately rather than twenty minutes into a run
 * that costs money.
 */
export async function loadManifest(manifestPath: string): Promise<LoadedSample[]> {
  const raw = await readFile(manifestPath, 'utf8');
  const samples = JSON.parse(raw) as Sample[];

  if (!Array.isArray(samples)) {
    throw new Error(`${manifestPath}: expected a JSON array of samples`);
  }

  const base = dirname(resolve(manifestPath));

  return Promise.all(
    samples.map(async (sample) => {
      for (const field of ['id', 'audio', 'reference', 'split'] as const) {
        if (!sample[field]) {
          throw new Error(`${manifestPath}: sample "${sample.id ?? '?'}" is missing "${field}"`);
        }
      }

      const referencePath = resolve(base, sample.reference);
      let referenceText: string;
      try {
        referenceText = await readFile(referencePath, 'utf8');
      } catch {
        throw new Error(`${manifestPath}: cannot read reference for "${sample.id}" at ${referencePath}`);
      }

      return {
        ...sample,
        audioPath: resolve(base, sample.audio),
        referenceText,
      };
    })
  );
}
