import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioExportBody } from '@/components/studio/StudioExportBody';
import type { UsePlaybackReturn } from '@/hooks/playback/usePlayback';

// Regression coverage for the export-gate bypass fix: StudioExportBody used
// to call exporter.startExport directly with no billing-limit check and no
// video-background creator-gate check at all -- these tests assert both
// gates actually run before an export starts.

const startExport = vi.fn();
const checkAndConsume = vi.fn();
const setUpgradeTarget = vi.fn();
let isLocked = vi.fn().mockReturnValue(false);
let uiState = {
  format: 'square' as const,
  waveformStyle: 'bars' as const,
  captionMode: 'phrase' as const,
  canvasLayout: undefined,
  graphicStyle: undefined,
  setUpgradeTarget,
  style: { background: undefined as { type: string } | undefined },
};

vi.mock('@/components/primitives/video/CanvasPreview', () => ({
  default: () => null,
}));

vi.mock('@/hooks/video/useVideoExporter', () => ({
  useVideoExporter: () => ({
    isExporting: false,
    exportProgress: 0,
    exportedUrl: null,
    exportMimeType: null,
    error: null,
    startExport,
    cancelExport: vi.fn(),
  }),
  fileExtension: () => 'webm',
}));

vi.mock('@/hooks/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ tier: 'free' }),
}));

vi.mock('@/hooks/billing/useExportGate', () => ({
  useExportGate: () => ({ checkAndConsume }),
}));

vi.mock('@/hooks/auth/useFeatureGates', () => ({
  useFeatureGates: () => ({ isLocked }),
}));

vi.mock('@/stores', () => ({
  useUIStore: Object.assign(
    (selector: (s: typeof uiState) => unknown) => selector(uiState),
    { getState: () => uiState }
  ),
  useCaptureStore: (selector: (s: { audioBuffer: AudioBuffer }) => unknown) =>
    selector({ audioBuffer: { duration: 5 } as unknown as AudioBuffer }),
  getCanvasDimensions: () => ({ width: 1080, height: 1080 }),
}));

const playback = {} as UsePlaybackReturn;

describe('components/studio: StudioExportBody export gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLocked = vi.fn().mockReturnValue(false);
    uiState = { ...uiState, style: { background: undefined } };
    checkAndConsume.mockResolvedValue({ allowed: true });
  });

  it('starts the export when the billing gate allows it', async () => {
    render(<StudioExportBody playback={playback} />);
    fireEvent.click(screen.getByText('Render video'));
    await vi.waitFor(() => expect(startExport).toHaveBeenCalledTimes(1));
    expect(setUpgradeTarget).not.toHaveBeenCalled();
  });

  it('blocks the export and opens the export-limit upgrade sheet when the billing gate denies it', async () => {
    checkAndConsume.mockResolvedValue({ allowed: false });
    render(<StudioExportBody playback={playback} />);
    fireEvent.click(screen.getByText('Render video'));
    await vi.waitFor(() => expect(setUpgradeTarget).toHaveBeenCalledWith('export_limit'));
    expect(startExport).not.toHaveBeenCalled();
  });

  it('blocks the export on a locked video background before even checking the billing gate', async () => {
    uiState = { ...uiState, style: { background: { type: 'video' } } };
    isLocked = vi.fn().mockReturnValue(true);
    render(<StudioExportBody playback={playback} />);
    fireEvent.click(screen.getByText('Render video'));
    await vi.waitFor(() => expect(setUpgradeTarget).toHaveBeenCalledWith('background_video'));
    expect(checkAndConsume).not.toHaveBeenCalled();
    expect(startExport).not.toHaveBeenCalled();
  });
});
