import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '@/components/studio/CommandPalette';

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} onExport={vi.fn()} onGoLibrary={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('runs the Export action and closes', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onExport={onExport} onGoLibrary={vi.fn()} />);
    fireEvent.click(screen.getByText(/export all formats/i));
    expect(onExport).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('filters actions by the typed query', () => {
    render(<CommandPalette open onClose={vi.fn()} onExport={vi.fn()} onGoLibrary={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search actions/i), { target: { value: 'library' } });
    expect(screen.queryByText(/export all formats/i)).not.toBeInTheDocument();
    expect(screen.getByText(/go to library/i)).toBeInTheDocument();
  });

  it('pressing Escape closes the palette', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onExport={vi.fn()} onGoLibrary={vi.fn()} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search actions/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
