import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette, type PaletteAction } from '@/components/studio/CommandPalette';

function makeActions(overrides: Partial<Record<string, () => void>> = {}): PaletteAction[] {
  return [
    { id: 'export', label: 'Export clip', run: overrides.export ?? vi.fn() },
    { id: 'library', label: 'Go to Library', run: overrides.library ?? vi.fn() },
  ];
}

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} actions={makeActions()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('runs a clicked action and closes', () => {
    const exportAction = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette open onClose={onClose} actions={makeActions({ export: exportAction })} />
    );
    fireEvent.click(screen.getByText(/export clip/i));
    expect(exportAction).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('filters actions by the typed query', () => {
    render(<CommandPalette open onClose={vi.fn()} actions={makeActions()} />);
    fireEvent.change(screen.getByPlaceholderText(/record, drop, or ask/i), {
      target: { value: 'library' },
    });
    expect(screen.queryByText(/export clip/i)).not.toBeInTheDocument();
    expect(screen.getByText(/go to library/i)).toBeInTheDocument();
  });

  it('Enter runs the highlighted action', () => {
    const exportAction = vi.fn();
    render(
      <CommandPalette open onClose={vi.fn()} actions={makeActions({ export: exportAction })} />
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/record, drop, or ask/i), { key: 'Enter' });
    expect(exportAction).toHaveBeenCalled();
  });

  it('pressing Escape closes the palette', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} actions={makeActions()} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/record, drop, or ask/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
