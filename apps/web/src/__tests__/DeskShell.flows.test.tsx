/**
 * The desk's capture flows, driven rather than asserted about.
 *
 * These exist because the desk shipped with every one of these paths dead and
 * a fully green suite: the flow hook was mounted, so choosing a file *started*
 * the pipeline, but nothing rendered its states. A short file staged and
 * waited on a confirmation that was never drawn; a long one ingested behind a
 * toast and appeared to hang. Types passed, 485 tests passed, and upload did
 * nothing at all.
 *
 * So each test here drives a real user action and asserts on what a person
 * would see, not on whether a component exists.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const flow = vi.hoisted(() => ({
  currentState: 'idle' as 'idle' | 'recording' | 'processing',
  audioLevel: 0,
  isSpeaking: false,
  isStarting: false,
  micDenied: false,
  startError: null as string | null,
  processingAlert: null as { stage: string; title: string; detail: string } | null,
  processingProgress: 0,
  stagedFile: null as File | null,
  fileInputRef: { current: null },
  capabilities: { canRecord: true, warnings: [], isLoading: false },
  committedCaptionLines: [] as string[],
  interimCaptionText: '',
  recorder: { isPaused: false, audioBlob: null },
  handleStartRecording: vi.fn(),
  handleStopRecording: vi.fn(),
  handlePauseRecording: vi.fn(),
  handleResumeRecording: vi.fn(),
  handleProceed: vi.fn(),
  handleRestart: vi.fn(),
  handleFileSelect: vi.fn(),
  handleFileConfirm: vi.fn(),
  setStagedFile: vi.fn(),
  setUpgradeTarget: vi.fn(),
  handleReset: vi.fn(),
  handleDisableEnhancement: vi.fn(),
  dismissAlert: vi.fn(),
  dismissStartError: vi.fn(),
  deliverSession: vi.fn(),
  episode: {
    phase: 'idle' as string,
    candidates: [] as { start: number; end: number; hookText: string; rationale: string }[],
    episodeFile: null as File | null,
    episodeWords: [],
    progress: 0,
    error: null as string | null,
    partialAvailable: false,
    cancel: vi.fn(),
    usePartialTranscript: vi.fn(),
    startEpisode: vi.fn(),
  },
}));

vi.mock('@/hooks/recording/useCreateFlow', () => ({ useCreateFlow: () => flow }));
vi.mock('@/hooks/playback/usePlayback', () => ({
  usePlayback: () => ({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    load: vi.fn(),
  }),
}));
vi.mock('@/hooks/session/useSessionHydration', () => ({ useSessionHydration: () => {} }));
vi.mock('@/hooks/auth/useFeatureGates', () => ({
  useFeatureGates: () => ({ isLocked: () => false }),
}));
vi.mock('@/hooks/clips/useClipPicker', () => ({
  useClipPicker: () => ({ pick: vi.fn(), pickingIndex: null, busy: false }),
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted' }),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));
vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: { listMySessionsPaginated: 'x', getSession: 'x', getAudioUrl: 'x', createSession: 'x' },
    jobs: { generateUploadUrl: 'x' },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { firstName: 'Ralph', emailAddresses: [{ emailAddress: 'r@x.dev' }] } }),
  useClerk: () => ({ signOut: vi.fn(), openUserProfile: vi.fn() }),
}));
/* The orb is a WebGL-ish canvas shader; jsdom has no use for it and it is not
   what these tests are about. Kept as a button so the press path still works. */
vi.mock('@/components/media/orb/Orb', () => ({
  Orb: ({ onPressStart, ariaLabel }: { onPressStart?: () => void; ariaLabel?: string }) =>
    onPressStart ? (
      <button type="button" aria-label={ariaLabel} onPointerDown={onPressStart} />
    ) : (
      <div aria-label={ariaLabel} />
    ),
}));

import { DeskShell } from '@/components/desktop/DeskShell';

function reset() {
  flow.currentState = 'idle';
  flow.stagedFile = null;
  flow.processingAlert = null;
  flow.micDenied = false;
  flow.startError = null;
  flow.episode.phase = 'idle';
  flow.episode.candidates = [];
  vi.clearAllMocks();
}

describe('DeskShell — bringing audio in', () => {
  beforeEach(reset);

  it('starts recording when Record in the left panel is pressed', () => {
    render(<DeskShell />);
    fireEvent.click(screen.getByRole('button', { name: /^Record/i }));
    expect(flow.handleStartRecording).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker when Upload is pressed', () => {
    /* Spying on the real input, not a stand-in: React assigns the mounted
       node onto fileInputRef, replacing anything the test put there. That
       overwrite is the point — it is what connects the button to the
       picker — so a mocked ref would have tested nothing. */
    const { container } = render(<DeskShell />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: /^Upload/i }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  /* The bug this file exists for: a staged file rendered nothing at all. */
  it('shows a confirmation once a file is staged', () => {
    flow.stagedFile = new File(['x'], 'talk.m4a', { type: 'audio/mp4' });
    render(<DeskShell />);
    expect(screen.getByText('Process this file?')).toBeInTheDocument();
    expect(screen.getByText('talk.m4a')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Process audio/i }));
    expect(flow.handleFileConfirm).toHaveBeenCalledTimes(1);
  });

  it('lets a staged file be cancelled without processing it', () => {
    flow.stagedFile = new File(['x'], 'talk.m4a', { type: 'audio/mp4' });
    render(<DeskShell />);
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(flow.setStagedFile).toHaveBeenCalledWith(null);
    expect(flow.handleFileConfirm).not.toHaveBeenCalled();
  });
});

describe('DeskShell — long episodes', () => {
  beforeEach(reset);

  it.each(['ingesting', 'transcribing', 'finding'])(
    'shows progress while %s, with a way out',
    (phase) => {
      flow.episode.phase = phase;
      flow.episode.progress = 40;
      render(<DeskShell />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
      expect(flow.episode.cancel).toHaveBeenCalled();
    }
  );

  it('offers the found moments to pick from', () => {
    flow.episode.phase = 'picking';
    flow.episode.candidates = [
      { start: 12, end: 40, hookText: 'the part that matters', rationale: 'Strong open' },
    ];
    render(<DeskShell />);
    expect(screen.getByText(/Best moments/)).toBeInTheDocument();
    expect(screen.getByText(/the part that matters/)).toBeInTheDocument();
    expect(screen.getByText('0:12 – 0:40')).toBeInTheDocument();
  });

  it('offers the partial transcript when some chunks succeeded', () => {
    flow.episode.phase = 'error';
    flow.episode.error = 'Chunk 3 failed';
    flow.episode.partialAvailable = true;
    render(<DeskShell />);
    expect(screen.getByText('Chunk 3 failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Use what transcribed/i }));
    expect(flow.episode.usePartialTranscript).toHaveBeenCalledTimes(1);
  });
});

describe('DeskShell — failures are visible', () => {
  beforeEach(reset);

  it('says so when the microphone cannot be opened', () => {
    flow.startError = 'Your microphone is in use by another app.';
    render(<DeskShell />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your microphone is in use by another app.'
    );
  });

  it('says so when permission was refused', () => {
    flow.micDenied = true;
    render(<DeskShell />);
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot reach your microphone/i);
  });

  it('surfaces a processing failure with a way to retry without enhancement', () => {
    flow.processingAlert = {
      stage: 'enhancement',
      title: 'Enhancement failed',
      detail: 'Processing stopped before transcription.',
    };
    render(<DeskShell />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enhancement failed');
    fireEvent.click(screen.getByRole('button', { name: /Turn enhancement off/i }));
    expect(flow.handleDisableEnhancement).toHaveBeenCalledTimes(1);
  });
});

describe('DeskShell — the transport follows the phase', () => {
  beforeEach(reset);

  it('has nothing to control while idle', () => {
    render(<DeskShell />);
    expect(screen.queryByRole('button', { name: /Stop and review/i })).toBeNull();
  });

  it('offers stop, pause and cancel while recording', () => {
    flow.currentState = 'recording';
    render(<DeskShell />);
    expect(screen.getByRole('button', { name: /Stop and review recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pause recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel and discard/i })).toBeInTheDocument();
  });

  it('offers resume rather than pause once paused', () => {
    flow.currentState = 'recording';
    flow.recorder.isPaused = true;
    render(<DeskShell />);
    expect(screen.getByRole('button', { name: /Resume recording/i })).toBeInTheDocument();
    flow.recorder.isPaused = false;
  });

  it('drops the pause slot while processing, keeping cancel', () => {
    flow.currentState = 'processing';
    render(<DeskShell />);
    expect(screen.queryByRole('button', { name: /Pause recording/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^Cancel and discard/i })).toBeInTheDocument();
  });
});

describe('DeskShell — audio settings', () => {
  beforeEach(reset);

  /* This button used to open the waitlist sheet: the one control that changes
     what happens to your audio asked you to join a mailing list. */
  it('opens real settings, not the waitlist', () => {
    render(<DeskShell />);
    fireEvent.click(screen.getByRole('button', { name: /Audio settings/i }));
    expect(screen.getByRole('dialog', { name: /Audio settings/i })).toBeInTheDocument();
    expect(flow.setUpgradeTarget).not.toHaveBeenCalled();
  });
});

describe('DeskShell — the account menu', () => {
  beforeEach(reset);

  /* The desk had no way to reach the avatar picker, Manage Account or Sign
     Out: signing in was the last thing the app said about who you were. */
  it('reaches the account menu from the top bar', () => {
    render(<DeskShell />);
    fireEvent.click(screen.getByRole('button', { name: /Open user menu/i }));
    expect(screen.getByText('Ralph')).toBeInTheDocument();
    expect(screen.getByText('r@x.dev')).toBeInTheDocument();
    expect(screen.getByText('Manage Account')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });
});
