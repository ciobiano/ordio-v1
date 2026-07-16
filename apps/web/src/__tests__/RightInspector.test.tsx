import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightInspector } from '@/components/studio/RightInspector';
import type { UseStudioEditsReturn } from '@/hooks/studio/useStudioEdits';

vi.mock('@/components/soul/captions/StyleControls', () => ({
  default: () => <div data-testid="style-controls" />,
}));
vi.mock('@/components/soul/shared/FormatToggle', () => ({
  default: () => <div data-testid="format-toggle" />,
}));
vi.mock('@/components/soul/recording/AudioSettings', () => ({
  default: () => <div data-testid="audio-settings" />,
}));
vi.mock('@/components/soul/editor/TrimPanel', () => ({
  TrimPanel: () => <div data-testid="trim-panel" />,
}));

const mics = {
  devices: [
    { deviceId: 'mic-1', label: 'MacBook Pro Mic' },
    { deviceId: 'mic-2', label: 'USB Interface' },
  ],
  selectedDeviceId: undefined,
  selectDevice: vi.fn(),
  refresh: vi.fn(async () => {}),
};

const edits = {
  trimmer: {} as UseStudioEditsReturn['trimmer'],
  cutRanges: [],
  markFillerWords: vi.fn(),
  commit: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
} satisfies UseStudioEditsReturn;

describe('RightInspector', () => {
  it('idle: shows the mic picker with detected devices and audio settings', () => {
    render(
      <RightInspector
        view="idle"
        audioLevel={0}
        mics={mics}
        edits={edits}
        audioBuffer={null}
        onPreviewAt={vi.fn()}
        onLocked={vi.fn()}
      />
    );
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByLabelText(/microphone/i)).toBeInTheDocument();
    expect(screen.getByText('USB Interface')).toBeInTheDocument();
    expect(screen.getByText('System default')).toBeInTheDocument();
    expect(screen.getByTestId('audio-settings')).toBeInTheDocument();
  });

  it('edit: renders the real TrimPanel, StyleControls, and FormatToggle', () => {
    render(
      <RightInspector
        view="edit"
        audioLevel={0}
        mics={mics}
        edits={edits}
        audioBuffer={null}
        onPreviewAt={vi.fn()}
        onLocked={vi.fn()}
      />
    );
    expect(screen.getByTestId('trim-panel')).toBeInTheDocument();
    expect(screen.getByTestId('style-controls')).toBeInTheDocument();
    expect(screen.getByTestId('format-toggle')).toBeInTheDocument();
  });
});
