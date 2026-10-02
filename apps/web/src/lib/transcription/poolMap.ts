/**
 * Run `worker` over items pulled from `source`, at most `concurrency` at once.
 *
 * Built for the Episode pipeline, where the source is a lazy decoder and the
 * worker is a paid upload, which is why it does not use a general-purpose
 * limiter such as p-limit:
 *
 * - **It pulls, so the decoder only runs ahead by the pool's width.** A
 *   push-style queue would decode the whole Episode up front.
 * - **The first failure stops new work but not work already started.** A
 *   chunk in flight has already been held against the person's credits;
 *   abandoning it would throw away transcription they are paying for. Its
 *   result is kept and the run reports a partial.
 *
 * Never rejects. Results arrive in completion order, not source order.
 */
export async function poolMap<T, R>(
  source: AsyncIterable<T>,
  worker: (item: T) => Promise<R>,
  concurrency: number,
  onResult?: (result: R) => void
): Promise<{ results: R[]; failure: { error: unknown } | null }> {
  const iterator = source[Symbol.asyncIterator]();
  const results: R[] = [];
  const inFlight = new Set<Promise<void>>();
  let failure: { error: unknown } | null = null;
  const fail = (error: unknown) => {
    failure ??= { error };
  };

  while (failure === null) {
    if (inFlight.size >= Math.max(1, concurrency)) {
      await Promise.race(inFlight);
      continue;
    }
    let next: IteratorResult<T>;
    try {
      next = await iterator.next();
    } catch (error) {
      fail(error);
      break;
    }
    // A worker can fail while the source is still producing; don't start the item it produced.
    if (next.done || failure !== null) break;

    const task: Promise<void> = worker(next.value)
      .then((result) => {
        results.push(result);
        onResult?.(result);
      })
      .catch(fail)
      .finally(() => inFlight.delete(task));
    inFlight.add(task);
  }

  await Promise.all(inFlight);
  // Stopped early: let the source release what it holds (the decoder's input).
  if (failure !== null) {
    try {
      await iterator.return?.();
    } catch {
      // The source already failed or finished; nothing left to release.
    }
  }
  return { results, failure };
}
