import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useRecordingRecovery } from '@/hooks/recording/useRecordingRecovery';
import * as recordingDraft from '@/lib/persistence/recordingDraft';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {}),
}));

vi.mock('@/lib/persistence/recordingDraft', () => ({
  getRecordingDraft: vi.fn(),
  clearRecordingDraft: vi.fn().mockResolvedValue(undefined),
}));

describe('hooks/recording: useRecordingRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when no draft is found', async () => {
    vi.mocked(recordingDraft.getRecordingDraft).mockResolvedValue(null);
    const onResume = vi.fn();

    renderHook(() => useRecordingRecovery(onResume));

    await waitFor(() => {
      expect(recordingDraft.getRecordingDraft).toHaveBeenCalledTimes(1);
    });
    expect(toast).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
  });

  it('shows a Resume/Discard toast when a draft is found', async () => {
    const draft = {
      blob: new Blob(['test']),
      mimeType: 'audio/webm',
      durationSec: 10,
      savedAt: Date.now(),
    };
    vi.mocked(recordingDraft.getRecordingDraft).mockResolvedValue(draft);
    const onResume = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useRecordingRecovery(onResume));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledTimes(1);
    });

    const [, options] = vi.mocked(toast).mock.calls[0] as unknown as [
      string,
      { action: { onClick: () => void }; cancel: { onClick: () => void } },
    ];
    options.action.onClick();
    expect(onResume).toHaveBeenCalledWith(draft.blob);

    options.cancel.onClick();
    expect(recordingDraft.clearRecordingDraft).toHaveBeenCalledTimes(1);
  });
});
