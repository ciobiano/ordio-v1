import { describe, it, expect, vi } from 'vitest';
import { poolMap } from '@/lib/transcription/poolMap';

/** A lazy source that records how far it has been pulled and whether it was released. */
function trackedSource(items: number[], failAt?: number) {
  const state = { pulled: 0, released: false };
  async function* gen() {
    try {
      for (const item of items) {
        if (item === failAt) throw new Error(`decode ${item}`);
        state.pulled++;
        yield item;
      }
    } finally {
      state.released = true;
    }
  }
  return { source: gen(), state };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('poolMap', () => {
  it('maps every item and reports no failure', async () => {
    const { source } = trackedSource([1, 2, 3, 4, 5]);
    const { results, failure } = await poolMap(source, async (n) => n * 10, 2);
    expect(failure).toBeNull();
    expect([...results].sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50]);
  });

  it('never runs more than `concurrency` workers, and pulls no further ahead', async () => {
    const { source, state } = trackedSource([1, 2, 3, 4, 5, 6]);
    const gates = new Map<number, ReturnType<typeof deferred<number>>>();
    let running = 0;
    let peak = 0;
    const run = poolMap(
      source,
      (n) => {
        running++;
        peak = Math.max(peak, running);
        const d = deferred<number>();
        gates.set(n, d);
        return d.promise.finally(() => running--);
      },
      3
    );

    await tick();
    expect(running).toBe(3);
    expect(state.pulled).toBe(3); // the decoder waits for a free slot

    gates.get(2)!.resolve(2);
    await tick();
    expect(state.pulled).toBe(4);

    // Drain: release every worker as it arrives.
    for (let round = 0; round < 6; round++) {
      for (const [n, gate] of gates) gate.resolve(n);
      await tick();
    }
    const { results } = await run;
    expect(results).toHaveLength(6);
    expect(peak).toBe(3);
  });

  it('stops starting work after a failure but keeps what was already in flight', async () => {
    const { source, state } = trackedSource([1, 2, 3, 4, 5, 6]);
    const slow = deferred<number>();
    const run = poolMap(
      source,
      (n) => {
        if (n === 1) return slow.promise; // already uploading when 2 fails
        if (n === 2) return Promise.reject(new Error('chunk 2'));
        return Promise.resolve(n);
      },
      2
    );

    await tick();
    slow.resolve(1);
    const { results, failure } = await run;
    expect((failure?.error as Error).message).toBe('chunk 2');
    expect(results).toContain(1);
    expect(state.pulled).toBeLessThan(6);
    expect(state.released).toBe(true);
  });

  it('does not start an item the source produced after a failure', async () => {
    const decoding = deferred<void>();
    let released = false;
    const source: AsyncIterable<number> = {
      [Symbol.asyncIterator]: () => {
        let n = 0;
        return {
          async next() {
            n++;
            if (n === 2) await decoding.promise; // still decoding when chunk 1 fails
            return { done: false, value: n };
          },
          async return() {
            released = true;
            return { done: true, value: undefined };
          },
        };
      },
    };
    const started: number[] = [];
    const run = poolMap(
      source,
      (n) => {
        started.push(n);
        return Promise.reject(new Error(`chunk ${n}`));
      },
      3
    );
    await tick();
    decoding.resolve();
    const { failure } = await run;
    expect(started).toEqual([1]);
    expect((failure?.error as Error).message).toBe('chunk 1');
    expect(released).toBe(true);
  });

  it('reports a source failure and keeps the results before it', async () => {
    const { source } = trackedSource([1, 2, 3], 3);
    const { results, failure } = await poolMap(source, async (n) => n, 2);
    expect((failure?.error as Error).message).toBe('decode 3');
    expect([...results].sort()).toEqual([1, 2]);
  });

  it('records a throwing onResult as the failure instead of rejecting', async () => {
    const { source } = trackedSource([1, 2]);
    const onResult = vi.fn(() => {
      throw new Error('listener');
    });
    const { failure } = await poolMap(source, async (n) => n, 1, onResult);
    expect((failure?.error as Error).message).toBe('listener');
  });

  it('keeps the first failure when several workers fail', async () => {
    const { source } = trackedSource([1, 2]);
    const { failure } = await poolMap(
      source,
      (n) => Promise.reject(new Error(`chunk ${n}`)),
      2
    );
    expect((failure?.error as Error).message).toBe('chunk 1');
  });
});
