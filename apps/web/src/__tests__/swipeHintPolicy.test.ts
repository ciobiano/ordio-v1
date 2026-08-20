import { describe, it, expect } from 'vitest';
import {
  MAX_HINT_SHOWINGS,
  INITIAL_SWIPE_HINT_STATE,
  parseSwipeHintState,
  serializeSwipeHintState,
  shouldShowSwipeHint,
} from '@/components/mobile/capture/swipeHintPolicy';

/**
 * The hint used to be "once, ever" — a flag set on the first render with
 * recordings present and never revisited. It fires 0.6s after the sidebar
 * opens, which is exactly when someone is still reading the list, so a single
 * chance was effectively no chance.
 */

describe('shouldShowSwipeHint', () => {
  it('hints a first-time visitor', () => {
    expect(shouldShowSwipeHint(INITIAL_SWIPE_HINT_STATE, true)).toBe(true);
  });

  it('has nothing to hint with when the list is empty', () => {
    expect(shouldShowSwipeHint(INITIAL_SWIPE_HINT_STATE, false)).toBe(false);
  });

  it('keeps hinting up to the cap', () => {
    for (let shownCount = 0; shownCount < MAX_HINT_SHOWINGS; shownCount++) {
      expect(shouldShowSwipeHint({ shownCount, hasSwiped: false }, true)).toBe(true);
    }
  });

  it('stops at the cap rather than nagging forever', () => {
    expect(shouldShowSwipeHint({ shownCount: MAX_HINT_SHOWINGS, hasSwiped: false }, true)).toBe(
      false
    );
    expect(
      shouldShowSwipeHint({ shownCount: MAX_HINT_SHOWINGS + 5, hasSwiped: false }, true)
    ).toBe(false);
  });

  it('stops immediately once the gesture has been used', () => {
    // Knowing beats being shown: someone who swipes on their first visit should
    // never see the demonstration again, cap or no cap.
    expect(shouldShowSwipeHint({ shownCount: 0, hasSwiped: true }, true)).toBe(false);
  });
});

describe('swipe hint persistence', () => {
  it('round-trips', () => {
    const state = { shownCount: 2, hasSwiped: false };
    expect(parseSwipeHintState(serializeSwipeHintState(state))).toEqual(state);
  });

  it('treats a first visit as never hinted', () => {
    expect(parseSwipeHintState(null)).toEqual(INITIAL_SWIPE_HINT_STATE);
  });

  it('survives the value the previous build wrote', () => {
    // The old key stored the bare string '1'. This value outlives deploys, so
    // reading it must not throw in a render path.
    expect(parseSwipeHintState('1')).toEqual(INITIAL_SWIPE_HINT_STATE);
  });

  it('survives anything unparseable', () => {
    expect(parseSwipeHintState('{oh no')).toEqual(INITIAL_SWIPE_HINT_STATE);
    expect(parseSwipeHintState('null')).toEqual(INITIAL_SWIPE_HINT_STATE);
    expect(parseSwipeHintState('[]')).toEqual({ shownCount: 0, hasSwiped: false });
  });

  it('rejects nonsense field types rather than trusting them', () => {
    expect(parseSwipeHintState('{"shownCount":"lots","hasSwiped":"yes"}')).toEqual(
      INITIAL_SWIPE_HINT_STATE
    );
    // A negative count would otherwise grant extra showings.
    expect(parseSwipeHintState('{"shownCount":-99,"hasSwiped":false}')).toEqual(
      INITIAL_SWIPE_HINT_STATE
    );
  });
});
