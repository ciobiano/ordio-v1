import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '@/components/studio/TopBar';

vi.mock('@/components/soul/auth/UserAvatarButton', () => ({
  default: () => <div data-testid="user-avatar-button" />,
}));

describe('TopBar', () => {
  it('renders the clip title and calls onExport when clicked', () => {
    const onExport = vi.fn();
    render(<TopBar title="Why I quit my design job" onExport={onExport} onOpenSearch={vi.fn()} />);
    expect(screen.getByText('Why I quit my design job')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(onExport).toHaveBeenCalled();
  });

  it('logo links back to the marketing home page', () => {
    render(<TopBar title="Untitled recording" onExport={vi.fn()} onOpenSearch={vi.fn()} />);
    expect(screen.getByRole('link', { name: /ordio home/i })).toHaveAttribute('href', '/');
  });

  it('search bar opens the command palette', () => {
    const onOpenSearch = vi.fn();
    render(<TopBar title="Untitled recording" onExport={vi.fn()} onOpenSearch={onOpenSearch} />);
    fireEvent.click(screen.getByRole('button', { name: /search actions, ask copilot/i }));
    expect(onOpenSearch).toHaveBeenCalled();
  });

  it('renders a real profile menu, not a static avatar', () => {
    render(<TopBar title="Untitled recording" onExport={vi.fn()} onOpenSearch={vi.fn()} />);
    expect(screen.getByTestId('user-avatar-button')).toBeInTheDocument();
  });
});
