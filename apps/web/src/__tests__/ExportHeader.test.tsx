import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportHeader } from '@/components/mobile/states/ExportState/ExportHeader';

describe('components/soul/states/ExportState: ExportHeader', () => {
  const baseProps = {
    primaryLabel: 'Export',
    primaryDisabled: false,
    onBack: vi.fn(),
    onPrimary: vi.fn(),
  };

  it('renders whatever primaryLabel it is given', () => {
    render(<ExportHeader {...baseProps} primaryLabel="Retry export" />);
    expect(screen.getByRole('button', { name: 'Retry export' })).toBeInTheDocument();
  });

  it('disables the primary button when primaryDisabled is true', () => {
    render(<ExportHeader {...baseProps} primaryDisabled />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });
});
