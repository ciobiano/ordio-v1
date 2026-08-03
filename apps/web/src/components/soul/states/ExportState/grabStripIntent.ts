/**
 * Does a click on the sheet's grab strip mean "close", or is it the tail of a
 * drag the user already cancelled?
 *
 * The strip is both the drag handle and a tap-to-close button. That was
 * harmless while the sheet barely moved, but it now tracks the thumb 1:1: the
 * strip travels with the pointer, so on release the pointer is still over it
 * and the browser fires a click. Without this, dragging down and letting go
 * short of the dismiss threshold would spring the sheet back *and* then close
 * it — the gesture you just cancelled still firing.
 *
 * Extracted from the component because the rule has four cases and only one of
 * them is obvious from reading the JSX.
 */
export interface GrabStripClick {
  /**
   * `MouseEvent.detail` — the click count. Pointer-driven clicks report 1 or
   * more; a click synthesised by activating a `<button>` with Enter or Space
   * reports 0.
   */
  detail: number;
  /** Whether framer has reported a drag since the last pointer press. */
  didDrag: boolean;
}

export function shouldCloseOnGrabStripClick({ detail, didDrag }: GrabStripClick): boolean {
  // Keyboard activation cannot be the tail of a drag — there was no pointer
  // press to drag with. It is also the only keyboard route to closing the
  // panel, so it must never be swallowed by a stale flag. Some browsers
  // suppress the click after a drag entirely, which leaves `didDrag` set with
  // nothing to consume it; checking the origin first means that staleness can
  // never strand a keyboard user.
  const fromPointer = detail > 0;
  if (!fromPointer) return true;

  return !didDrag;
}
