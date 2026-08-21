/**
 * The stages of processing, and which one is happening now.
 *
 * Lives beside `phase.ts` for the same reason: it is a pure derivation over a
 * number, it decides what the user is told, and it is far easier to get wrong
 * inline in JSX than it looks. It was — the thresholds were written as
 * fractions while the progress value is a percentage, so at the first tick
 * every stage compared as already finished and the list rendered complete
 * before any work had started.
 */

/**
 * Where each stage begins, on the 0–100 scale `useAudioProcessing` reports.
 *
 * The figures mirror that hook's checkpoints: decode ends at 15 or 25
 * depending on whether enhancement runs, enhancement occupies 15–40,
 * transcription runs to 85, and caption layout finishes at 100.
 */
export const PROCESSING_STEPS = [
  { at: 0, label: 'Decoding the audio' },
  { at: 15, label: 'Cleaning it up' },
  { at: 30, label: 'Transcribing' },
  { at: 85, label: 'Laying out captions' },
] as const;

export type ProcessingStepState = 'done' | 'now' | 'todo';

/**
 * What to draw for one stage.
 *
 * A stage is done once the *next* stage has begun — a stage cannot report its
 * own completion, only its successor's start can. The last stage is done at
 * 100, which only the finished pipeline sets.
 */
export function processingStepState(index: number, progress: number): ProcessingStepState {
  const step = PROCESSING_STEPS[index];
  if (!step) return 'todo';

  const next = PROCESSING_STEPS[index + 1];
  if (progress >= (next ? next.at : 100)) return 'done';
  return progress >= step.at ? 'now' : 'todo';
}
