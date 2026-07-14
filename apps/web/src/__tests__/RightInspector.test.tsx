import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightInspector } from '@/components/studio/RightInspector';

vi.mock('@/components/soul/captions/StyleControls', () => ({
  default: () => <div data-testid="style-controls" />,
}));

describe('RightInspector', () => {
  it('idle: shows input settings', () => {
    render(<RightInspector view="idle" audioLevel={0} onLocked={vi.fn()} />);
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('edit: renders the real StyleControls and a background placeholder', () => {
    render(<RightInspector view="edit" audioLevel={0} onLocked={vi.fn()} />);
    expect(screen.getByTestId('style-controls')).toBeInTheDocument();
    expect(screen.getAllByText(/background/i).length).toBeGreaterThan(0);
  });
});
