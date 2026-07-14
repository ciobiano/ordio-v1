import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '@/components/studio/TopBar';

describe('TopBar', () => {
  it('renders the clip title and calls onExport when clicked', () => {
    const onExport = vi.fn();
    render(<TopBar title="Why I quit my design job" onExport={onExport} />);
    expect(screen.getByText('Why I quit my design job')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(onExport).toHaveBeenCalled();
  });
});
