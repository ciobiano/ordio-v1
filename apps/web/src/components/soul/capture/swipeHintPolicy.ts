/**
 * When to flash the top recording row open, teaching swipe-to-delete.
 *
 * The previous rule was "once, ever": a localStorage flag set the first time a
 * row was hinted, never checked again. A hint you can miss by glancing away
 * should not be spent on one chance, and this one fires 0.6s after the sidebar
 * opens — squarely inside the window where someone is still reading the list.
 *
 * So it repeats until the gesture is actually learned. Two signals decide that,
 * and they mean different things:
 *
 *   hasSwiped   the user performed the gesture. They know. Stop permanently.
 *   shownCount  how many times we have offered it. A cap, so someone who never
 *               swipes is not nagged forever — after MAX_HINT_SHOWINGS the ⋯
 *               menu is the path we rely on.
 */

export const SWIPE_HINT_STORAGE_KEY = 'ordio-swipe-delete-hint';
export const MAX_HINT_SHOWINGS = 3;

export interface SwipeHintState {
  /** Times the hint animation has been played. */
  shownCount: number;
  /** The user has completed a swipe at least once. */
  hasSwiped: boolean;
}

export const INITIAL_SWIPE_HINT_STATE: SwipeHintState = {
  shownCount: 0,
  hasSwiped: false,
};

export function shouldShowSwipeHint(state: SwipeHintState, hasRows: boolean): boolean {
  if (!hasRows) return false;
  if (state.hasSwiped) return false;
  return state.shownCount < MAX_HINT_SHOWINGS;
}

/**
 * Reading is deliberately forgiving. This value outlives deploys and may have
 * been written by an older build — the previous key stored the string '1' — so
 * anything unparseable is treated as "never hinted" rather than throwing in a
 * render path.
 */
export function parseSwipeHintState(raw: string | null): SwipeHintState {
  if (!raw) return INITIAL_SWIPE_HINT_STATE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return INITIAL_SWIPE_HINT_STATE;

    const { shownCount, hasSwiped } = parsed as Partial<SwipeHintState>;
    return {
      shownCount: typeof shownCount === 'number' && shownCount >= 0 ? shownCount : 0,
      hasSwiped: hasSwiped === true,
    };
  } catch {
    return INITIAL_SWIPE_HINT_STATE;
  }
}

export function serializeSwipeHintState(state: SwipeHintState): string {
  return JSON.stringify(state);
}
