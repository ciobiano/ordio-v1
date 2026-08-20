import { describe, it, expect, beforeEach } from 'vitest';
import { shouldStartSheetDrag } from '@/components/mobile/states/ExportState/sheetDragIntent';

/**
 * Reframe is a vaul drawer and swipes closed from anywhere. The in-flow panels
 * carry a hand-rolled Framer drag that only started on the 44px grab strip, so
 * the rest of the surface read as dead. This is the rule that widened it.
 */

let surface: HTMLElement;

/** jsdom computes no layout, so scroll extent has to be declared. */
function makeScroller(scrollable: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { value: scrollable ? 800 : 100 });
  Object.defineProperty(el, 'clientHeight', { value: 100 });
  return el;
}

function appendChild(parent: HTMLElement, tag = 'div'): HTMLElement {
  const el = document.createElement(tag);
  parent.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.replaceChildren();
  surface = document.createElement('div');
  document.body.appendChild(surface);
});

describe('shouldStartSheetDrag', () => {
  it('drags from static chrome — the grab strip, a header', () => {
    const strip = appendChild(surface, 'button');
    expect(shouldStartSheetDrag(strip, surface)).toBe(true);
  });

  it('drags from the tab row, which only scrolls sideways', () => {
    const tabRow = appendChild(surface);
    tabRow.style.overflowX = 'auto';
    tabRow.style.overflowY = 'hidden';
    const tab = appendChild(tabRow, 'button');

    expect(shouldStartSheetDrag(tab, surface)).toBe(true);
  });

  it('yields to a body that has somewhere to scroll', () => {
    const body = makeScroller(true);
    surface.appendChild(body);
    const row = appendChild(body);

    expect(shouldStartSheetDrag(row, surface)).toBe(false);
  });

  it('drags from a scroller with nothing to scroll', () => {
    // A short panel should be swipeable end to end rather than dead below the
    // strip just because its container could scroll in principle.
    const body = makeScroller(false);
    surface.appendChild(body);
    const row = appendChild(body);

    expect(shouldStartSheetDrag(row, surface)).toBe(true);
  });

  it('leaves a slider its own gesture', () => {
    // Sliders capture the pointer, so their events keep bubbling to the surface
    // for the whole drag. Stealing that would make every size adjustment also
    // try to close the panel.
    const slider = appendChild(surface);
    slider.setAttribute('role', 'slider');
    const thumb = appendChild(slider);

    expect(shouldStartSheetDrag(slider, surface)).toBe(false);
    expect(shouldStartSheetDrag(thumb, surface)).toBe(false);
  });

  it('leaves text entry alone', () => {
    const input = appendChild(surface, 'input');
    const editable = appendChild(surface);
    editable.setAttribute('contenteditable', 'true');

    expect(shouldStartSheetDrag(input, surface)).toBe(false);
    expect(shouldStartSheetDrag(editable, surface)).toBe(false);
  });

  it('honours an explicit opt-out', () => {
    const zone = appendChild(surface);
    zone.setAttribute('data-no-sheet-drag', '');
    const inner = appendChild(zone);

    expect(shouldStartSheetDrag(inner, surface)).toBe(false);
  });

  it('ignores a target outside the panel', () => {
    const stray = appendChild(document.body);
    expect(shouldStartSheetDrag(stray, surface)).toBe(false);
    expect(shouldStartSheetDrag(null, surface)).toBe(false);
  });

  it('stops walking at the panel root', () => {
    // An ancestor above the surface that happens to scroll must not veto the
    // drag — only scrollers inside the panel own a gesture.
    const outerScroller = makeScroller(true);
    document.body.appendChild(outerScroller);
    outerScroller.appendChild(surface);
    const strip = appendChild(surface, 'button');

    expect(shouldStartSheetDrag(strip, surface)).toBe(true);
  });
});
