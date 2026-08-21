/**
 * Which processing stage the user is told is happening.
 *
 * The regression these guard is not a crash — it rendered fine. The list read
 * as complete from the first tick, so it silently told the user the work was
 * done while it was still starting. Nothing typed catches that: both sides of
 * the comparison were numbers.
 */

import { describe, it, expect } from 'vitest';
import { PROCESSING_STEPS, processingStepState } from '@/lib/capture/processingSteps';

const states = (progress: number) =>
  PROCESSING_STEPS.map((_, i) => processingStepState(i, progress));

describe('processing step state', () => {
  it('has nothing finished at the start', () => {
    expect(states(0)).toEqual(['now', 'todo', 'todo', 'todo']);
  });

  /* The exact value the bug was reported at: the first progress the pipeline
     ever emits. Read as a fraction, 10 cleared every threshold at once. */
  it('is still on the first stage at the pipeline\'s first tick', () => {
    expect(states(10)).toEqual(['now', 'todo', 'todo', 'todo']);
  });

  it('advances one stage at a time', () => {
    expect(states(20)).toEqual(['done', 'now', 'todo', 'todo']);
    expect(states(50)).toEqual(['done', 'done', 'now', 'todo']);
    expect(states(90)).toEqual(['done', 'done', 'done', 'now']);
  });

  it('only reports the last stage done when the pipeline says so', () => {
    expect(states(99)).toEqual(['done', 'done', 'done', 'now']);
    expect(states(100)).toEqual(['done', 'done', 'done', 'done']);
  });

  /* A stage cannot report its own completion — only its successor starting
     can — so the states must never go backwards as progress rises. */
  it('never regresses as progress climbs', () => {
    const rank = { todo: 0, now: 1, done: 2 } as const;
    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      let previous = -1;
      for (let p = 0; p <= 100; p++) {
        const current = rank[processingStepState(i, p)];
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }
    }
  });

  it('treats an index outside the list as not started', () => {
    expect(processingStepState(99, 100)).toBe('todo');
  });
});
