'use client';

import { useQuery } from 'convex/react';
import { api } from '@Ordio/convex';

export interface CreditsState {
  /** Raw balance. Prefer `minutes` for anything the user reads. */
  credits: number;
  /** Whole minutes of transcription the balance covers. */
  minutes: number;
  /** True once the balance can no longer pay for anything. */
  isEmpty: boolean;
  /** True while the balance is still unknown — render neither a figure nor a zero. */
  isLoading: boolean;
}

/**
 * The signed-in user's transcription balance.
 *
 * Credits are the internal unit (10 to the minute) because they let different
 * work carry different rates. Minutes are what a person understands, so the UI
 * shows those — "23 minutes left" rather than "230 credits left".
 *
 * Provisioning — the welcome grant and the monthly refill — happens in
 * `useCurrentUser`, which owns creating the user row those mutations depend on.
 * This hook only reads.
 */
export function useCredits(): CreditsState {
  const balance = useQuery(api.credits.getMyCredits);

  // `undefined` is Convex's "still loading"; `null` is a signed-out or missing
  // user. Both must read as loading rather than as zero, or the UI flashes
  // "0 minutes left" and an upgrade prompt at someone who has plenty.
  if (balance === undefined || balance === null) {
    return { credits: 0, minutes: 0, isEmpty: false, isLoading: true };
  }

  return {
    credits: balance.credits,
    minutes: balance.minutes,
    isEmpty: balance.credits <= 0,
    isLoading: false,
  };
}
