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
      deleteSession: 'sessions:deleteSession',
    },
    jobs: { generateUploadUrl: 'jobs:generateUploadUrl' },
  },
}));
vi.mock('@/components/soul/auth/UserAvatarButton', () => ({
  default: () => <div data-testid="user-avatar-button" />,
}));
vi.mock('@/components/soul/modals/UpgradeSheet', () => ({
  default: () => null,
}));
vi.mock('@/components/soul/captions/StyleControls', () => ({
  default: () => <div data-testid="style-controls" />,
}));
vi.mock('@/components/soul/shared/FormatToggle', () => ({
  default: () => <div data-testid="format-toggle" />,
}));
vi.mock('@/components/soul/recording/AudioSettings', () => ({
  default: () => <div data-testid="audio-settings" />,
}));
vi.mock('@/components/studio/StudioExportBody', () => ({
  StudioExportBody: () => <div data-testid="export-body" />,
}));
vi.mock('@/hooks/billing/useCheckout', () => ({
  useCheckout: () => ({ startCheckout: vi.fn(async () => {}) }),
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
    stop: vi.fn(),
    previewAt: vi.fn(),
    registerTimeListener: vi.fn(() => () => {}),
  }),
}));

describe('StudioDesk', () => {
  it('renders the frame in idle view', () => {
    render(<StudioDesk />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText(/what are we making/i)).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-strip')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar-button')).toBeInTheDocument();
  });

  it('the search bar opens the command palette', () => {
    render(<StudioDesk />);
    fireEvent.click(screen.getAllByRole('button', { name: /search actions, ask copilot/i })[0]);
    expect(screen.getByPlaceholderText(/record, drop, or ask/i)).toBeInTheDocument();
  });

  it('the command palette lists real actions', () => {
    render(<StudioDesk />);
    fireEvent.click(screen.getAllByRole('button', { name: /search actions, ask copilot/i })[0]);
    expect(screen.getByText('New recording')).toBeInTheDocument();
    expect(screen.getByText('Upload audio or video')).toBeInTheDocument();
  });
});
