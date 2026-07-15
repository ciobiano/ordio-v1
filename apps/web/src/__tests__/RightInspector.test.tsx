import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightInspector } from '@/components/studio/RightInspector';

vi.mock('@/components/soul/captions/StyleControls', () => ({
  default: () => <div data-testid="style-controls" />,
}));
vi.mock('@/components/soul/shared/FormatToggle', () => ({
  default: () => <div data-testid="format-toggle" />,
}));
vi.mock('@/components/soul/recording/AudioSettings', () => ({
  default: () => <div data-testid="audio-settings" />,
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

describe('RightInspector', () => {
  it('idle: shows the mic picker with detected devices and audio settings', () => {
    render(<RightInspector view="idle" audioLevel={0} mics={mics} onLocked={vi.fn()} />);
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByLabelText(/microphone/i)).toBeInTheDocument();
    expect(screen.getByText('USB Interface')).toBeInTheDocument();
    expect(screen.getByText('System default')).toBeInTheDocument();
    expect(screen.getByTestId('audio-settings')).toBeInTheDocument();
  });

  it('edit: renders the real StyleControls and FormatToggle', () => {
    render(<RightInspector view="edit" audioLevel={0} mics={mics} onLocked={vi.fn()} />);
    expect(screen.getByTestId('style-controls')).toBeInTheDocument();
    expect(screen.getByTestId('format-toggle')).toBeInTheDocument();
  });
});
