import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/stores';

describe('graphicStyle store', () => {
  beforeEach(() => {
    useUIStore.setState({ graphicStyle: null });
  });

  it('defaults to null', () => {
    expect(useUIStore.getState().graphicStyle).toBeNull();
  });

  it('setGraphicStyle updates graphicStyle', () => {
    useUIStore.getState().setGraphicStyle('graphic-frame1');
    expect(useUIStore.getState().graphicStyle).toBe('graphic-frame1');
  });

  it('setGraphicStyle accepts null to return to waveform mode', () => {
    useUIStore.getState().setGraphicStyle('graphic-frame1');
    useUIStore.getState().setGraphicStyle(null);
    expect(useUIStore.getState().graphicStyle).toBeNull();
  });

  it('setGraphicStyle accepts graphic-frame2', () => {
    useUIStore.getState().setGraphicStyle('graphic-frame2');
    expect(useUIStore.getState().graphicStyle).toBe('graphic-frame2');
  });
});
