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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const flow = vi.hoisted(() => ({
  currentState: 'idle' as 'idle' | 'recording' | 'processing',
  audioLevel: 0,
  isSpeaking: false,
  isStarting: false,
  micDenied: false,
  startError: null as string | null,
  processingAlert: null as { stage: string; code: string; title: string; detail: string } | null,
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
    error: null as import('@/lib/errors/OrdioError').OrdioError | null,
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
    /* The canvas subscribes to the clock rather than re-rendering per frame,
       so the mock has to offer the subscription and an unsubscribe. */
    registerTimeListener: () => () => {},
  }),
}));
vi.mock('@/hooks/session/useSessionHydration', () => ({ useSessionHydration: () => {} }));
vi.mock('@/hooks/auth/useFeatureGates', () => ({
  useFeatureGates: () => ({ isLocked: () => false }),
}));
vi.mock('@/hooks/clips/useClipPicker', () => ({
  useClipPicker: () => ({ pick: vi.fn(), pickingIndex: null, busy: false }),
}));
/* Saved clips the media pane will list. Mutable so a test can put one there
   and click into the editor — several surfaces only exist once a clip is
   loaded, and with none the desk is still on the capture stage. */
const sessions: { id: string; name: string; durationMs: number }[] = [];

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({ results: sessions, status: 'Exhausted' }),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));
vi.mock('@Ordio/convex', () => ({
  api: {
    sessions: { listMySessionsPaginated: 'x', getSession: 'x', getAudioUrl: 'x', createSession: 'x' },
    jobs: { generateUploadUrl: 'x' },
    credits: { getMyCredits: 'x' },
    backgrounds: { getBackgroundUrl: 'x', listMyBackgrounds: 'x', uploadBackground: 'x' },
    transcription: { claimUpload: 'transcription:claimUpload' },
    episodes: {
      resume: 'episodes:resume',
      create: 'episodes:create',
      addChunk: 'episodes:addChunk',
      saveCandidates: 'episodes:saveCandidates',
    },
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
import { useDirectorStore } from '@/stores';
import { OrdioError } from '@/lib/errors/OrdioError';

function reset() {
  flow.currentState = 'idle';
  flow.stagedFile = null;
  flow.processingAlert = null;
  flow.micDenied = false;
  flow.startError = null;
  flow.episode.phase = 'idle';
  flow.episode.candidates = [];
  sessions.length = 0;
  vi.clearAllMocks();
}

/** Render with a clip loaded, which is what puts the desk in the editor. */
function renderEditing() {
  sessions.push({ id: 'clip-1', name: 'Take one', durationMs: 30_000 });
  const view = render(<DeskShell />);
  fireEvent.click(screen.getByRole('button', { name: /Take one/i }));
  return view;
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
    flow.episode.error = new OrdioError('EPISODE_PARTIAL_TRANSCRIPT');
    flow.episode.partialAvailable = true;
    render(<DeskShell />);
    expect(screen.getAllByText('Part of the episode was not transcribed').length).toBeGreaterThan(0);
    expect(screen.getByText('Ref: EPISODE_PARTIAL_TRANSCRIPT')).toBeInTheDocument();
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
      code: 'ENHANCE_TIMEOUT',
      title: 'Enhancement took too long',
      detail: 'The enhancement service did not answer in time.',
    };
    render(<DeskShell />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enhancement took too long');
    expect(screen.getByRole('alert')).toHaveTextContent('Ref: ENHANCE_TIMEOUT');
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

  /* `processingProgress` is a percentage. Read as a fraction and multiplied by
     100 it put the fill at 1000% wide, which the browser clips — so the bar
     was solid and motionless from the first tick and reported as broken.
     Asserting the figure rather than the width, because the width is what was
     wrong and the figure is what the user reads. */
  it('reports how far processing has actually got', () => {
    flow.currentState = 'processing';
    flow.processingProgress = 42;
    render(<DeskShell />);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.queryByText('4200%')).toBeNull();
    flow.processingProgress = 0;
  });

  it('does not show processing as complete before it has started', () => {
    flow.currentState = 'processing';
    flow.processingProgress = 10;
    render(<DeskShell />);
    expect(screen.getByText('10%')).toBeInTheDocument();
    /* The step list read as fully done at this value for the same reason. */
    const steps = screen.getAllByText(/Decoding the audio|Laying out captions/);
    expect(steps.length).toBeGreaterThan(0);
    expect(screen.getByText('Laying out captions').closest('li')).toHaveAttribute(
      'data-state',
      'todo'
    );
    flow.processingProgress = 0;
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

describe('DeskShell — trim commits', () => {
  beforeEach(reset);

  /* The handles wrote two numbers that shaded the timeline and were read by
     nothing: export took the whole buffer however much you trimmed. The
     panel's own hint said "cuts commit with Apply" while offering no Apply. */
  it('offers a way to commit a trim', () => {
    renderEditing();
    fireEvent.click(screen.getByRole('button', { name: /^Trim$/i }));
    expect(screen.getByRole('button', { name: /Apply cuts/i })).toBeInTheDocument();
  });

  /* Destructive, so it must not be pressable when it would do nothing. */
  it('keeps Apply out of reach until something is actually cut', () => {
    renderEditing();
    fireEvent.click(screen.getByRole('button', { name: /^Trim$/i }));
    expect(screen.getByRole('button', { name: /Apply cuts/i })).toBeDisabled();
  });
});

describe('DeskShell — the canvas is the real renderer', () => {
  beforeEach(reset);

  /* The desk used to paint captions in DOM, stacking every segment of the
     transcript on the frame at once. The engine draws the line being spoken.
     Asserting on the canvas element rather than on caption text, because the
     absence of that text is the fix. */
  it('draws the clip on a canvas rather than in markup', () => {
    renderEditing();
    expect(document.querySelector('canvas')).not.toBeNull();
  });
});

describe('DeskShell — Director reads the clip', () => {
  beforeEach(() => {
    reset();
    useDirectorStore.getState().reset();
  });

  /* The panel used to list three hardcoded looks and a reroll that re-picked
     from the same static three. Nothing was read, so the names were there
     before the clip was. */
  it('has no looks to show until it has read something', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderEditing();
    fireEvent.click(screen.getByRole('button', { name: /^Director$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Reroll the three/i })).toBeEnabled()
    );
    expect(screen.queryByRole('button', { name: /Apply the ".*" look/i })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('asks the director for looks rather than reciting a list', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    renderEditing();
    fireEvent.click(screen.getByRole('button', { name: /^Director$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/direct');
    vi.unstubAllGlobals();
  });
});

