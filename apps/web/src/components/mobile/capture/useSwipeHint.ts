'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INITIAL_SWIPE_HINT_STATE,
  SWIPE_HINT_STORAGE_KEY,
  parseSwipeHintState,
  serializeSwipeHintState,
  shouldShowSwipeHint,
  type SwipeHintState,
} from './swipeHintPolicy';

interface UseSwipeHintResult {
  /** The row that should play the hint right now, or null. */
  hintRowId: string | null;
  /** The hint animation finished — bank it and clear. */
  onHintPlayed: () => void;
  /** The user completed a swipe. Retires the hint for good. */
  onUserSwiped: () => void;
}

/**
 * Decides whether to flash the first row open, and remembers the answer.
 *
 * localStorage is read in an effect rather than during render: this component
 * server-renders, and touching storage in the render path is a hydration
 * mismatch waiting to happen — the server has no localStorage, so it would
 * always disagree with the client on the first paint.
 */
export function useSwipeHint(firstRowId: string | undefined): UseSwipeHintResult {
  const [hintRowId, setHintRowId] = useState<string | null>(null);
  const stateRef = useRef<SwipeHintState>(INITIAL_SWIPE_HINT_STATE);
  /** One decision per mount. Rows arrive asynchronously and the list re-renders
   *  often; without this the hint would re-arm on every query update. */
  const decidedRef = useRef(false);

  const persist = useCallback((next: SwipeHintState) => {
    stateRef.current = next;
    try {
      localStorage.setItem(SWIPE_HINT_STORAGE_KEY, serializeSwipeHintState(next));
    } catch {
      // Private mode, or storage full. The hint is a nicety — losing the record
      // means it may show again, which is far better than breaking the sidebar.
    }
  }, []);

  useEffect(() => {
    if (decidedRef.current || !firstRowId) return;
    decidedRef.current = true;

    let stored = INITIAL_SWIPE_HINT_STATE;
    try {
      stored = parseSwipeHintState(localStorage.getItem(SWIPE_HINT_STORAGE_KEY));
    } catch {
      // Unreadable storage — treat as a first visit.
    }
    stateRef.current = stored;

    if (shouldShowSwipeHint(stored, true)) setHintRowId(firstRowId);
  }, [firstRowId]);

  const onHintPlayed = useCallback(() => {
    setHintRowId(null);
    persist({ ...stateRef.current, shownCount: stateRef.current.shownCount + 1 });
  }, [persist]);

  const onUserSwiped = useCallback(() => {
    if (stateRef.current.hasSwiped) return;
    // Cancel a hint mid-flight too: the user got there first, so finishing the
    // demonstration would just be talking over them.
    setHintRowId(null);
    persist({ ...stateRef.current, hasSwiped: true });
  }, [persist]);

  return { hintRowId, onHintPlayed, onUserSwiped };
}
