import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureSidebar } from '@/components/soul/capture/CaptureSidebar';

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
  useMutation: () => vi.fn(),
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
    vi.clearAllMocks();
  });

  it('does not render a "New recording" button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText('New recording')).not.toBeInTheDocument();
  });

  it('still renders the Settings button', () => {
    render(<CaptureSidebar onOpenUpload={vi.fn()} onOpenSettings={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});
