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
const mockRenameSession = vi.fn().mockResolvedValue({ id: 'session_1', name: 'Evening notes' });

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
  // Dispatch on the reference: the sidebar now takes two mutations, and a
  // single shared mock would let a rename assertion pass on a delete call.
  useMutation: (ref: string) =>
    ref === 'sessions:renameSession' ? mockRenameSession : mockDeleteSession,
}));

vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: {
      listMySessionsPaginated: 'sessions:listMySessionsPaginated',
      deleteSession: 'sessions:deleteSession',
      renameSession: 'sessions:renameSession',
    },
  },
}));

// File-level, not inside a describe: a beforeEach declared within one block
// does not run for its siblings, so scoping this to the first describe left the
// rename tests inheriting call counts from the ones before them.
beforeEach(() => {
  mockDeleteSession.mockClear();
  mockRenameSession.mockClear();
  mockSignOut.mockClear();
  mockOpenUserProfile.mockClear();
  // The swipe hint persists its count here; without a reset the later tests in
  // this file would run under a different hint state than the earlier ones.
  localStorage.clear();
});

describe('CaptureSidebar', () => {

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

/**
 * Rename had no way in at all: `sessions.renameSession` was implemented and
 * ownership-checked in Convex, and nothing in the app ever called it. The ⋯
 * menu is that way in, and it doubles as the visible route to delete so a
 * destructive action no longer depends on discovering a swipe.
 */
describe('CaptureSidebar rename', () => {
  function openRenameField() {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Options for Morning thoughts'));
    fireEvent.click(screen.getByText('Rename'));
    return screen.getByLabelText('Recording name');
  }

  it('offers rename and delete from the row menu', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Options for Morning thoughts'));

    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('seeds the field with the current name', () => {
    expect(openRenameField()).toHaveValue('Morning thoughts');
  });

  it('saves on Enter', async () => {
    const input = openRenameField();
    fireEvent.change(input, { target: { value: 'Evening notes' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockRenameSession).toHaveBeenCalledWith({
        sessionId: 'session_1',
        title: 'Evening notes',
      });
    });
  });

  it('saves when the field loses focus', async () => {
    // Tapping elsewhere is how most people leave a field on a phone; treating
    // that as "discard what I typed" would be the surprising reading.
    const input = openRenameField();
    fireEvent.change(input, { target: { value: 'Evening notes' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockRenameSession).toHaveBeenCalledWith({
        sessionId: 'session_1',
        title: 'Evening notes',
      });
    });
  });

  it('discards on Escape', async () => {
    const input = openRenameField();
    fireEvent.change(input, { target: { value: 'Evening notes' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByLabelText('Recording name')).not.toBeInTheDocument();
    });
    expect(mockRenameSession).not.toHaveBeenCalled();
  });

  it('does not commit an Escape twice when the field also blurs', async () => {
    // Escape and Enter both end with the field unmounting, which fires blur —
    // and blur commits. Without a settled guard, cancelling would save.
    const input = openRenameField();
    fireEvent.change(input, { target: { value: 'Evening notes' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByLabelText('Recording name')).not.toBeInTheDocument();
    });
    expect(mockRenameSession).not.toHaveBeenCalled();
  });

  it('skips the round trip when nothing changed', async () => {
    const input = openRenameField();
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByLabelText('Recording name')).not.toBeInTheDocument();
    });
    expect(mockRenameSession).not.toHaveBeenCalled();
  });

  it('refuses to save an empty name', async () => {
    // The mutation throws on an empty title, so this would be a guaranteed
    // round trip to an error toast.
    const input = openRenameField();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByLabelText('Recording name')).not.toBeInTheDocument();
    });
    expect(mockRenameSession).not.toHaveBeenCalled();
  });
});
