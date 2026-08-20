import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StyleControls from '@/components/mobile/captions/StyleControls';

// Covers the Style panel's tab strip, which had no coverage. The bodies are
// mocked out — what is under test is the strip: that every tab is reachable,
// that deep-linking opens on the requested tab, and that a tab which is
// off-screen gets scrolled into view.
//
// The strip's other three fixes (x-only scroll, definite widths, 44px row) are
// pure CSS. jsdom has no layout engine and no Tailwind stylesheet, so asserting
// them here would only re-state class names; they are verified on device.

vi.mock('@/components/mobile/captions/style/tabs/MotionTab', () => ({ MotionTab: () => null }));
vi.mock('@/components/mobile/captions/style/tabs/ColorsTab', () => ({ ColorsTab: () => null }));
vi.mock('@/components/mobile/captions/style/tabs/FontTab', () => ({ FontTab: () => null }));
vi.mock('@/components/mobile/captions/style/tabs/BreaksTab', () => ({ BreaksTab: () => null }));
vi.mock('@/components/mobile/captions/style/tabs/TemplatesTab', () => ({ TemplatesTab: () => null }));
vi.mock('@/components/mobile/captions/style/tabs/LayoutTab', () => ({ LayoutTab: () => null }));
vi.mock('@/components/mobile/captions/style/tabs/VisualTab', () => ({ VisualTab: () => null }));

const TAB_LABELS = ['Motion', 'Colors', 'Font', 'Breaks', 'Templates', 'Layout', 'Visual'];

/** The strip is horizontally scrollable, so the active tab can start off-screen. */
function scrollSpy() {
  return vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
}

describe('StyleControls tab strip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every tab', () => {
    render(<StyleControls />);
    for (const label of TAB_LABELS) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('opens on Motion by default and marks exactly one tab active', () => {
    render(<StyleControls />);
    const active = screen.getAllByRole('tab').filter((tab) => tab.hasAttribute('data-active'));
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent('Motion');
  });

  it('opens on the requested tab when deep-linked', () => {
    // Add ▸ Pick artwork jumps straight here, past four tabs.
    render(<StyleControls initialTab="templates" />);
    expect(screen.getByRole('tab', { name: 'Templates' })).toHaveAttribute('data-active');
  });

  it('scrolls a deep-linked tab into view, since it starts off-screen', () => {
    const spy = scrollSpy();
    render(<StyleControls initialTab="templates" />);

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.instances.at(-1)).toHaveTextContent('Templates');
  });

  it('scrolls the strip only, never the panel underneath it', () => {
    const spy = scrollSpy();
    render(<StyleControls initialTab="visual" />);

    // `block: 'nearest'` is what stops the browser also scrolling the nearest
    // vertical ancestor — here the panel body — to bring the tab into view.
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'nearest', block: 'nearest' })
    );
  });

  it('follows the active tab when the user moves along the strip', () => {
    const spy = scrollSpy();
    render(<StyleControls />);
    spy.mockClear();

    fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('data-active');
    expect(spy.mock.instances.at(-1)).toHaveTextContent('Layout');
  });
});
