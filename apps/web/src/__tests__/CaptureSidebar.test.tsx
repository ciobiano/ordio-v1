import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptureSidebar } from '@/components/soul/capture/CaptureSidebar';

const mockSignOut = vi.fn();
const mockOpenUserProfile = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { firstName: 'Ada', emailAddresses: [{ emailAddress: 'ada@example.com' }] } }),
  useClerk: () => ({ signOut: mockSignOut, openUserProfile: mockOpenUserProfile }),
}));

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
    mockSignOut.mockClear();
    mockOpenUserProfile.mockClear();
  });

  it('does not render a "New recording" button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('New recording')).not.toBeInTheDocument();
  });

  it('opens an account popover — not the recording settings sheet — from the footer trigger', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Account options'));
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Manage account')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('signs out via the account popover', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Account options'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('opens a confirmation dialog when a recording row is deleted', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Delete Morning thoughts'));
    expect(screen.getByText('Delete this recording?')).toBeInTheDocument();
  });

  it('calls deleteSession with the correct id when the dialog is confirmed', async () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
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
