import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportHeader } from '@/components/soul/states/ExportState/ExportHeader';

describe('components/soul/states/ExportState: ExportHeader', () => {
  const baseProps = {
    exportedUrl: null,
    exportDisabled: false,
    onBack: vi.fn(),
    onExport: vi.fn(),
    onDownload: vi.fn(),
  };

  it('shows "Export" by default', () => {
    render(<ExportHeader {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('shows "Retry export" when exportFailed is true', () => {
    render(<ExportHeader {...baseProps} exportFailed />);
    expect(screen.getByRole('button', { name: 'Retry export' })).toBeInTheDocument();
  });

  it('still shows "Download" when exportedUrl is set, regardless of exportFailed', () => {
    render(<ExportHeader {...baseProps} exportedUrl="blob:test" exportFailed />);
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});
