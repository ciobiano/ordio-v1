/**
 * Should a pointer landing here be allowed to drag the sheet shut?
 *
 * Reframe is a vaul drawer and swipes closed from anywhere. These panels are
 * in flow instead — the height they take is height the stage gives up, which is
 * what makes the canvas shrink rather than the transport getting pushed
 * off-screen — so they carry a hand-rolled Framer drag, and only the 44px grab
 * strip started it. Everything else read as a dead surface.
 *
 * The strip is now the minimum rather than the whole of it: any part of the
 * panel that is not itself scrolling vertically can start the gesture. The
 * exclusions below are what keeps that from stealing gestures that belong to
 * something else.
 *
 * Not attempted here: taking over from a scrolling body once it reaches its
 * top. That needs a non-passive touchmove that preventDefaults at the boundary
 * — once the browser commits a touch to a scroller, JS cannot claim it back.
 */

/**
 * Controls that run their own pointer gesture. A slider in particular captures
 * the pointer, so its events keep bubbling here while the user drags it.
 */
const GESTURE_OWNERS = '[role="slider"],input,textarea,select,[contenteditable="true"]';

/** Opt-out hook for anything that needs to keep its own vertical gesture. */
const OPT_OUT = '[data-no-sheet-drag]';

function scrollsVertically(element: Element): boolean {
  const overflowY = getComputedStyle(element).overflowY;
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false;
  // A scroller with nothing to scroll is just a box, and swiping it should
  // close the sheet — which is what makes a short panel fully swipeable.
  return element.scrollHeight > element.clientHeight;
}

/**
 * @param target  the element the pointer went down on
 * @param surface the panel root; the walk stops here
 */
export function shouldStartSheetDrag(target: Element | null, surface: Element): boolean {
  if (!target || !surface.contains(target)) return false;
  if (target.closest(GESTURE_OWNERS) || target.closest(OPT_OUT)) return false;

  // Walk up to the panel root. Crossing a live vertical scroller on the way
  // means the gesture belongs to that scroller, not to the sheet.
  let node: Element | null = target;
  while (node && node !== surface) {
    if (scrollsVertically(node)) return false;
    node = node.parentElement;
  }

  return true;
}
