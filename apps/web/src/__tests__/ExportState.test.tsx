import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportState from '@/components/soul/states/ExportState';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

// Covers ExportState's own orchestration logic, which had zero test coverage:
// the primaryLabel derivation (Export / Retry export / Save) and the export
// gate ordering (video-background creator gate checked before the billing
// onExportStart gate, before any exporter.startExport call).

vi.mock('@/components/soul/states/ExportState/ExportCanvas', () => ({ ExportCanvas: () => null }));
vi.mock('@/components/soul/states/ExportState/ExportControls', () => ({ ExportControls: () => null }));
vi.mock('@/components/soul/states/ExportState/ExportFooter', () => ({ ExportFooter: () => null }));
vi.mock('@/components/soul/states/ExportState/ExportOverlay', () => ({ ExportOverlay: () => null }));
vi.mock('@/components/soul/states/ExportState/DiscardDialog', () => ({ DiscardDialog: () => null }));

vi.mock('@/hooks/audio/useAudioTrimmer', () => ({
  useAudioTrimmer: () => ({
    isEmpty: false,
    hasChanges: false,
    trimState: {},
    getTrimmedAudio: vi.fn(() => [new Float32Array(1)]),
    getTrimmedTranscript: vi.fn(() => []),
    resetAll: vi.fn(),
  }),
}));

let isLocked = vi.fn().mockReturnValue(false);
vi.mock('@/hooks/auth/useFeatureGates', () => ({
  useFeatureGates: () => ({ isLocked }),
}));

let uiStyle = { background: undefined as { type: string } | undefined, backgroundColor: '#000' };

vi.mock('@/stores', () => ({
  getCanvasDimensions: () => ({ width: 1080, height: 1080 }),
  useCaptureStore: Object.assign(
    (selector: (s: { audioBuffer: AudioBuffer }) => unknown) =>
      selector({ audioBuffer: { duration: 5, sampleRate: 48000 } as unknown as AudioBuffer }),
    { getState: () => ({ setAudioBuffer: vi.fn() }) }
  ),
  useProcessingStore: Object.assign(
    (selector: (s: { transcript: unknown[] }) => unknown) => selector({ transcript: [{ text: 'hi', start: 0, end: 1 }] }),
    { getState: () => ({ transcript: [], setTranscript: vi.fn() }), setState: vi.fn() }
  ),
  useUIStore: { getState: () => ({ style: uiStyle }) },
}));

function baseProps() {
  return {
    playback: { duration: 5, load: vi.fn() } as unknown as UsePlaybackReturn,
    exporter: {
      isExporting: false,
      exportProgress: 0,
      exportedUrl: null as string | null,
      exportMimeType: null,
      error: null as string | null,
      startExport: vi.fn().mockResolvedValue(undefined),
      cancelExport: vi.fn(),
    },
    format: 'square' as const,
    waveformStyle: 'bars' as const,
    captionMode: 'phrase' as const,
    onExportStart: vi.fn().mockResolvedValue(true),
    onDownload: vi.fn(),
    onReset: vi.fn(),
    onLocked: vi.fn(),
  };
}

describe('components/soul/states: ExportState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLocked = vi.fn().mockReturnValue(false);
    uiStyle = { background: undefined, backgroundColor: '#000' };
  });

  it('shows "Export" by default', () => {
    render(<ExportState {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('shows "Retry export" after a failed export', () => {
    const props = baseProps();
    props.exporter.error = 'boom';
    render(<ExportState {...props} />);
    expect(screen.getByRole('button', { name: 'Retry export' })).toBeInTheDocument();
  });

  it('shows "Save" once a render exists', () => {
    const props = baseProps();
    props.exporter.exportedUrl = 'blob:test';
    render(<ExportState {...props} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onExportStart and startExport on the happy path', async () => {
    const props = baseProps();
    render(<ExportState {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await vi.waitFor(() => expect(props.exporter.startExport).toHaveBeenCalledTimes(1));
    expect(props.onExportStart).toHaveBeenCalledTimes(1);
    expect(props.onLocked).not.toHaveBeenCalled();
  });

  it('blocks export on a locked video background before calling onExportStart at all', async () => {
    uiStyle = { background: { type: 'video' }, backgroundColor: '#000' };
    isLocked = vi.fn().mockReturnValue(true);
    const props = baseProps();
    render(<ExportState {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await vi.waitFor(() => expect(props.onLocked).toHaveBeenCalledWith('background_video'));
    expect(props.onExportStart).not.toHaveBeenCalled();
    expect(props.exporter.startExport).not.toHaveBeenCalled();
  });

  it('does not start the export when onExportStart (the billing gate) denies it', async () => {
    const props = baseProps();
    props.onExportStart = vi.fn().mockResolvedValue(false);
    render(<ExportState {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await vi.waitFor(() => expect(props.onExportStart).toHaveBeenCalledTimes(1));
    expect(props.exporter.startExport).not.toHaveBeenCalled();
  });
});
