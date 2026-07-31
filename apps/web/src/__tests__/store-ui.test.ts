import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, LEGACY_CAPTION_MODE_MIGRATION } from '@/stores/uiStore';

describe('store: uiStore', () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useUIStore.setState({
      theme: 'dark',
      style: {
        width: 1080,
        height: 1080,
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontFamily: 'Inter' as const,
        fontSize: 72,
        waveColor: '#ffffff',
        characterSpacing: 0,
        lineHeight: 1.4,
        textAlign: 'center',
        verticalAlign: 'auto',
        captionStyleId: 'minimal-lower-third' as const,
      },
      waveformStyle: 'bars',
      graphicStyle: null,
      canvasLayout: 'compact',
      format: 'square',
    });
  });

  describe('initial persisted state', () => {
    it('should have dark theme', () => {
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('should have default style config', () => {
      const style = useUIStore.getState().style;
      expect(style.width).toBe(1080);
      expect(style.height).toBe(1080);
      expect(style.fontSize).toBe(72);
    });

    it('should have bars waveform style', () => {
      expect(useUIStore.getState().waveformStyle).toBe('bars');
    });

    it('should have compact canvas layout', () => {
      expect(useUIStore.getState().canvasLayout).toBe('compact');
    });

    it('should have minimal-lower-third caption style', () => {
      expect(useUIStore.getState().style.captionStyleId).toBe('minimal-lower-third');
    });

    it('should have square format', () => {
      expect(useUIStore.getState().format).toBe('square');
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      useUIStore.getState().setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
    });
  });

  describe('setStyle', () => {
    it('should partially update style', () => {
      useUIStore.getState().setStyle({ fontSize: 48 });
      expect(useUIStore.getState().style.fontSize).toBe(48);
      expect(useUIStore.getState().style.width).toBe(1080);
    });

    it('should merge multiple style updates', () => {
      useUIStore.getState().setStyle({ fontSize: 48, textColor: '#ff0000' });
      expect(useUIStore.getState().style.fontSize).toBe(48);
      expect(useUIStore.getState().style.textColor).toBe('#ff0000');
    });

    it('should allow tighter line spacing and negative character spacing', () => {
      useUIStore.getState().setStyle({ lineHeight: 0.4, characterSpacing: -6 });
      expect(useUIStore.getState().style.lineHeight).toBe(0.4);
      expect(useUIStore.getState().style.characterSpacing).toBe(-6);
    });
  });

  describe('setWaveformStyle', () => {
    it('should set waveform style to circle', () => {
      useUIStore.getState().setWaveformStyle('circle');
      expect(useUIStore.getState().waveformStyle).toBe('circle');
    });

    it('should set waveform style to spectrogram', () => {
      useUIStore.getState().setWaveformStyle('spectrogram');
      expect(useUIStore.getState().waveformStyle).toBe('spectrogram');
    });
  });

  describe('setGraphicStyle', () => {
    it('should set graphic style', () => {
      useUIStore.getState().setGraphicStyle('graphic-frame1');
      expect(useUIStore.getState().graphicStyle).toBe('graphic-frame1');
    });

    it('should allow null graphic style', () => {
      useUIStore.getState().setGraphicStyle('graphic-frame1');
      useUIStore.getState().setGraphicStyle(null);
      expect(useUIStore.getState().graphicStyle).toBeNull();
    });
  });

  describe('setCanvasLayout', () => {
    it('should set canvas layout to flipped', () => {
      useUIStore.getState().setCanvasLayout('flipped');
      expect(useUIStore.getState().canvasLayout).toBe('flipped');
    });
  });

  describe('setStyle (captionStyleId)', () => {
    it('should set caption style to karaoke-chip', () => {
      useUIStore.getState().setStyle({ captionStyleId: 'karaoke-chip' });
      expect(useUIStore.getState().style.captionStyleId).toBe('karaoke-chip');
    });

    it('should set caption style to word-pop', () => {
      useUIStore.getState().setStyle({ captionStyleId: 'word-pop' });
      expect(useUIStore.getState().style.captionStyleId).toBe('word-pop');
    });

    it('should set caption style to big-statement', () => {
      useUIStore.getState().setStyle({ captionStyleId: 'big-statement' });
      expect(useUIStore.getState().style.captionStyleId).toBe('big-statement');
    });
  });

  describe('setFormat', () => {
    it('should set format to vertical and update dimensions', () => {
      useUIStore.getState().setFormat('vertical');
      const state = useUIStore.getState();
      expect(state.format).toBe('vertical');
      expect(state.style.width).toBe(1080);
      expect(state.style.height).toBe(1920);
    });

    it('should set format to instagram', () => {
      useUIStore.getState().setFormat('instagram');
      const state = useUIStore.getState();
      expect(state.format).toBe('instagram');
      expect(state.style.width).toBe(1080);
      expect(state.style.height).toBe(1350);
    });

    it('should set format to horizontal', () => {
      useUIStore.getState().setFormat('horizontal');
      const state = useUIStore.getState();
      expect(state.format).toBe('horizontal');
      expect(state.style.width).toBe(1920);
      expect(state.style.height).toBe(1080);
    });
  });

  describe('setCurrentState', () => {
    it('should set current state', () => {
      useUIStore.getState().setCurrentState('recording');
      expect(useUIStore.getState().currentState).toBe('recording');
    });
  });

  describe('setUpgradeTarget', () => {
    it('should set upgrade target', () => {
      useUIStore.getState().setUpgradeTarget('export_limit');
      expect(useUIStore.getState().upgradeTarget).toBe('export_limit');
    });

    it('should allow null upgrade target', () => {
      useUIStore.getState().setUpgradeTarget('export_limit');
      useUIStore.getState().setUpgradeTarget(null);
      expect(useUIStore.getState().upgradeTarget).toBeNull();
    });
  });

  describe('resetUI', () => {
    it('should reset session state but keep persisted', () => {
      useUIStore.getState().setCurrentState('recording');
      useUIStore.getState().setUpgradeTarget('export_limit');

      useUIStore.getState().resetUI();

      const state = useUIStore.getState();
      expect(state.currentState).toBe('idle');
      expect(state.upgradeTarget).toBeNull();
      expect(state.theme).toBe('dark');
    });
  });

  describe('legacy CaptionMode migration', () => {
    it('maps every old CaptionMode value to a valid CaptionStyleId', () => {
      const validStyleIds = [
        'word-pop',
        'bold-outline',
        'karaoke-chip',
        'minimal-lower-third',
        'big-statement',
        'script-accent',
      ];
      const oldModes = ['phrase', 'karaoke', 'spotlight', 'stack'];
      for (const mode of oldModes) {
        expect(LEGACY_CAPTION_MODE_MIGRATION[mode]).toBeDefined();
        expect(validStyleIds).toContain(LEGACY_CAPTION_MODE_MIGRATION[mode]);
      }
    });

    it('is deterministic — the same old mode always maps to the same new style', () => {
      expect(LEGACY_CAPTION_MODE_MIGRATION.phrase).toBe('minimal-lower-third');
      expect(LEGACY_CAPTION_MODE_MIGRATION.karaoke).toBe('karaoke-chip');
      expect(LEGACY_CAPTION_MODE_MIGRATION.spotlight).toBe('big-statement');
      expect(LEGACY_CAPTION_MODE_MIGRATION.stack).toBe('word-pop');
    });
  });
});
