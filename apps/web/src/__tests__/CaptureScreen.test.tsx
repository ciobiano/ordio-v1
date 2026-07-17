import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureScreen } from '@/components/soul/capture/CaptureScreen';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  usePaginatedQuery: () => ({ results: [] }),
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProps = {
  currentState: 'idle' as const,
  audioLevel: 0,
  isSpeaking: false,
  isStarting: false,
  micDenied: false,
  canRecord: true,
  processingProgress: 0,
  fileInputRef: { current: null },
  onFileUpload: vi.fn(),
  isPaused: false,
  committedCaptionLines: [],
  interimCaptionText: '',
  onStartRecording: vi.fn(),
  onPauseRecording: vi.fn(),
  onResumeRecording: vi.fn(),
  onStopRecording: vi.fn(),
  onRestart: vi.fn(),
  onProceed: vi.fn(),
  onCancel: vi.fn(),
  onLocked: vi.fn(),
};

describe('CaptureScreen sidebar swipe zones', () => {
  it('renders the left-edge swipe hitbox when the sidebar is closed', () => {
    render(<CaptureScreen {...baseProps} />);
    expect(screen.getByLabelText('Open recordings by swiping')).toBeInTheDocument();
    expect(screen.queryByLabelText('Close recordings')).not.toBeInTheDocument();
  });
});
