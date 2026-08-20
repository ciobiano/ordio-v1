/**
 * The desk's style, as the renderer reads it.
 *
 * Every failure here is invisible: a field mapped to the wrong place still
 * produces a video, just not the one that was on the canvas. So the mapping
 * is asserted against the schema the engine validates with, rather than by
 * looking at an export.
 */

import { describe, it, expect } from 'vitest';
import { StyleConfigSchema } from '@Ordio/shared';
import { deskStyleConfig, frameSize } from '@/lib/desktop/deskStyleConfig';
import { INITIAL_DESK_STATE, type DeskState } from '@/lib/desktop/deskState';

const desk = (over: Partial<DeskState> = {}): DeskState => ({
  ...INITIAL_DESK_STATE,
  ...over,
});

describe('frame size', () => {
  it('pins the short edge to 1080 for a vertical clip', () => {
    expect(frameSize('vertical')).toEqual({ width: 1080, height: 1920 });
  });

  it('pins the short edge to 1080 for a wide clip', () => {
    expect(frameSize('horizontal')).toEqual({ width: 1920, height: 1080 });
  });

  it('is square for 1:1', () => {
    expect(frameSize('square')).toEqual({ width: 1080, height: 1080 });
  });

  it('handles the portrait-but-not-9:16 case', () => {
    expect(frameSize('instagram')).toEqual({ width: 1080, height: 1350 });
  });
});

describe('desk state as a StyleConfig', () => {
  it('produces something the engine will accept', () => {
    expect(() => StyleConfigSchema.parse(deskStyleConfig(desk()))).not.toThrow();
  });

  it('carries the choices made in the Style panel', () => {
    const config = deskStyleConfig(
      desk({
        font: 'Montserrat',
        fontSize: 64,
        textColor: '#ff0066',
        bgColor: '#101010',
        waveColor: '#c6ff3d',
        align: 'start',
        lineHeight: 1.6,
      })
    );
    expect(config.fontFamily).toBe('Montserrat');
    expect(config.fontSize).toBe(64);
    expect(config.textColor).toBe('#ff0066');
    expect(config.backgroundColor).toBe('#101010');
    expect(config.waveColor).toBe('#c6ff3d');
    expect(config.textAlign).toBe('start');
    expect(config.lineHeight).toBe(1.6);
  });

  /* The desk stores em because that is what the DOM preview needs; the
     renderer works in pixels. Shipping the raw number would read as 0.02px
     and character spacing would silently do nothing. */
  it('resolves character spacing from em into pixels', () => {
    expect(deskStyleConfig(desk({ charSpacing: 0.05, fontSize: 60 })).characterSpacing).toBe(3);
  });

  it('keeps character spacing inside what the schema allows', () => {
    const wide = deskStyleConfig(desk({ charSpacing: 0.3, fontSize: 120 }));
    expect(wide.characterSpacing).toBe(12);
    expect(() => StyleConfigSchema.parse(wide)).not.toThrow();
  });

  /* The desk says "middle", the engine says "center". */
  it('translates the vertical anchor', () => {
    expect(deskStyleConfig(desk({ vAlign: 'middle' })).verticalAlign).toBe('center');
    expect(deskStyleConfig(desk({ vAlign: 'top' })).verticalAlign).toBe('top');
    expect(deskStyleConfig(desk({ vAlign: 'auto' })).verticalAlign).toBe('auto');
  });

  it('only sets a chunk size when the break mode is a fixed count', () => {
    expect(deskStyleConfig(desk({ breakMode: 'quantity', breakQty: 5 })).chunkWords).toBe(5);
    expect(deskStyleConfig(desk({ breakMode: 'punct' })).chunkWords).toBeUndefined();
    /* 'random' is a valid quantity in the desk and not a number the engine
       can chunk by. */
    expect(deskStyleConfig(desk({ breakMode: 'quantity', breakQty: 'random' })).chunkWords)
      .toBeUndefined();
  });

  it('omits stroke and glow rather than sending zeroes', () => {
    const plain = deskStyleConfig(desk({ strokeW: 0, glow: 0 }));
    expect(plain.strokeWidth).toBeUndefined();
    expect(plain.strokeColor).toBeUndefined();
    expect(plain.glowIntensity).toBeUndefined();
  });

  it('sends stroke and glow when they are set', () => {
    const marked = deskStyleConfig(desk({ strokeW: 3, strokeColor: '#0a0b0a', glow: 0.5 }));
    expect(marked.strokeWidth).toBe(3);
    expect(marked.strokeColor).toBe('#0a0b0a');
    expect(marked.glowIntensity).toBe(0.5);
    /* A halo in the text's own colour reads as light; a second hue reads as
       a drop shadow. Matches what PlayerStage draws. */
    expect(marked.glowColor).toBe(marked.textColor);
  });

  it('falls back to a face the engine knows', () => {
    expect(deskStyleConfig(desk({ font: 'Comic Sans' })).fontFamily).toBe('Inter');
  });

  it('stays valid for every ratio the desk offers', () => {
    for (const format of ['square', 'vertical', 'horizontal', 'instagram'] as const) {
      expect(() => StyleConfigSchema.parse(deskStyleConfig(desk({ format })))).not.toThrow();
    }
  });
});
