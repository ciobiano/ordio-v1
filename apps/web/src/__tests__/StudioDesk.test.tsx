import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioDesk } from '@/components/studio/StudioDesk';

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  usePaginatedQuery: () => ({ results: [] }),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));
vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: {
      listMySessionsPaginated: 'sessions:listMySessionsPaginated',
      createSession: 'sessions:createSession',
      getSession: 'sessions:getSession',
      getAudioUrl: 'sessions:getAudioUrl',
    },
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
  },
}));
vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
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

  it('the search bar opens the command palette', () => {
    render(<StudioDesk />);
    fireEvent.click(screen.getByRole('button', { name: /search actions, ask copilot/i }));
    expect(screen.getByPlaceholderText(/search actions/i)).toBeInTheDocument();
  });
});
