import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/store';

describe('graphicStyle store', () => {
  beforeEach(() => {
    useStore.setState({ graphicStyle: null });
  });

  it('defaults to null', () => {
    expect(useStore.getState().graphicStyle).toBeNull();
  });

  it('setGraphicStyle updates graphicStyle', () => {
    useStore.getState().setGraphicStyle('graphic-frame1');
    expect(useStore.getState().graphicStyle).toBe('graphic-frame1');
  });

  it('setGraphicStyle accepts null to return to waveform mode', () => {
    useStore.getState().setGraphicStyle('graphic-frame1');
    useStore.getState().setGraphicStyle(null);
    expect(useStore.getState().graphicStyle).toBeNull();
  });

  it('setGraphicStyle accepts graphic-frame2', () => {
    useStore.getState().setGraphicStyle('graphic-frame2');
    expect(useStore.getState().graphicStyle).toBe('graphic-frame2');
  });
});
