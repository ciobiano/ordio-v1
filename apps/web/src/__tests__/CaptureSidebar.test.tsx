import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptureSidebar } from '@/components/soul/capture/CaptureSidebar';

const mockDeleteSession = vi.fn().mockResolvedValue({ success: true });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({
    results: [
      { id: 'session_1', name: 'Morning thoughts', createdAt: Date.now(), durationMs: 65000 },
    ],
  }),
  useMutation: () => mockDeleteSession,
}));

vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: {
      listMySessionsPaginated: 'sessions:listMySessionsPaginated',
      deleteSession: 'sessions:deleteSession',
    },
  },
}));

describe('CaptureSidebar', () => {
  beforeEach(() => {
    mockDeleteSession.mockClear();
  });

  it('does not render a "New recording" button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('New recording')).not.toBeInTheDocument();
  });

  it('still renders the Settings button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('opens a confirmation dialog when a recording row is deleted', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Delete Morning thoughts'));
    expect(screen.getByText('Delete this recording?')).toBeInTheDocument();
  });

  it('calls deleteSession with the correct id when the dialog is confirmed', async () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Delete Morning thoughts'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith({ sessionId: 'session_1' });
    });
    await waitFor(() => {
      expect(screen.queryByText('Delete this recording?')).not.toBeInTheDocument();
    });
  });
});
