import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioDesk } from '@/components/studio/StudioDesk';

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  usePaginatedQuery: () => ({ results: [] }),
  useMutation: () => vi.fn(),
}));
vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: { listMySessionsPaginated: 'sessions:listMySessionsPaginated', createSession: 'sessions:createSession' },
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
  },
}));
vi.mock('@/hooks/playback/usePlayback', () => ({
  usePlayback: () => ({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    load: vi.fn(),
  }),
}));

describe('StudioDesk', () => {
  it('renders the frame in idle view', () => {
    render(<StudioDesk />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText(/what are we making/i)).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-strip')).toBeInTheDocument();
  });
});
