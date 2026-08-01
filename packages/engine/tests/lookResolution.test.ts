import { describe, it, expect } from 'vitest';
import type { StyleConfig } from '@Ordio/shared/schemas';
import { StyleConfigSchema } from '@Ordio/shared/schemas';
import { LOOK_PRESETS, resolveLookStyle, type LookPresetId } from '../src/captions/lookPresets';

const base: StyleConfig = {
  width: 1080,
  height: 1080,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 72,
  waveColor: '#ffffff',
  characterSpacing: 0,
  lineHeight: 1.4,
  textAlign: 'center',
  verticalAlign: 'auto',
  backgroundScrim: 'flat',
  captionStyleId: 'minimal-lower-third',
};

/** Every export format the app offers, plus the Director card's tiny canvas. */
const FORMATS: Array<[string, number, number]> = [
  ['square', 1080, 1080],
  ['vertical', 1080, 1920],
  ['horizontal', 1920, 1080],
  ['director-card', 160, 160],
];

const STUDY_LOOKS: LookPresetId[] = ['centered-block', 'urban-phrase', 'orb-phrase', 'cream-block'];
const ALL_LOOKS = Object.keys(LOOK_PRESETS) as LookPresetId[];

describe('resolveLookStyle', () => {
  it('produces a schema-valid style for every look at every format', () => {
    for (const id of ALL_LOOKS) {
      for (const [name, width, height] of FORMATS) {
        const result = StyleConfigSchema.safeParse(resolveLookStyle({ ...base, width, height }, id));
        expect(result.success, `${id} @ ${name}: ${result.success ? '' : result.error.message}`).toBe(true);
      }
    }
  });

  it('scales type with the frame instead of pinning the study 360px pixel values', () => {
    const square = resolveLookStyle({ ...base, width: 1080, height: 1080 }, 'centered-block');
    const wide = resolveLookStyle({ ...base, width: 1920, height: 1080 }, 'centered-block');

    expect(square.fontSize).toBe(Math.round(1080 * (33 / 360)));
    expect(wide.fontSize).toBe(Math.round(1920 * (33 / 360)));
    // Same fraction of the frame either way — that is the whole point.
    expect(wide.fontSize / 1920).toBeCloseTo(square.fontSize / 1080, 3);
  });

  it('keeps type legible even on the Director card canvas', () => {
    for (const id of STUDY_LOOKS) {
      const tiny = resolveLookStyle({ ...base, width: 160, height: 160 }, id);
      expect(tiny.fontSize).toBeGreaterThanOrEqual(8);
    }
  });

  it('resolves letter-spacing against the size it actually rendered at', () => {
    const look = resolveLookStyle({ ...base, width: 1080, height: 1080 }, 'cream-block');
    expect(look.characterSpacing).toBeCloseTo(look.fontSize * -0.02, 2);
  });

  it('never inherits stale session state — a look is a complete bundle', () => {
    // A session left in a wildly different state by earlier manual edits.
    const dirty: StyleConfig = {
      ...base,
      textAlign: 'end',
      verticalAlign: 'top',
      chunkWords: 11,
      characterSpacing: 9,
      lineHeight: 2.4,
      backgroundScrim: 'none',
    };

    for (const id of STUDY_LOOKS) {
      const clean = resolveLookStyle({ ...base }, id);
      const fromDirty = resolveLookStyle(dirty, id);
      for (const key of ['textAlign', 'verticalAlign', 'chunkWords', 'lineHeight', 'characterSpacing'] as const) {
        expect(fromDirty[key], `${id}.${key} leaked from the session`).toEqual(clean[key]);
      }
    }
  });

  it('leaves the pre-existing looks free of study-only typography', () => {
    // The original eight deliberately defer to the user's size slider.
    for (const id of ALL_LOOKS.filter((l) => !STUDY_LOOKS.includes(l))) {
      const resolved = resolveLookStyle(base, id);
      expect(resolved.fontSize).toBe(base.fontSize);
    }
  });

  it('still applies colour overrides on top of the resolved bundle', () => {
    const resolved = resolveLookStyle(base, 'centered-block', {
      accentColor: '#123456',
      textColor: '#abcdef',
    });
    expect(resolved.accentColor).toBe('#123456');
    expect(resolved.textColor).toBe('#abcdef');
  });

  it('pins the study composition: only cream-block carries a waveform', () => {
    expect(LOOK_PRESETS['centered-block'].waveformStyle).toBe('none');
    expect(LOOK_PRESETS['urban-phrase'].waveformStyle).toBe('none');
    expect(LOOK_PRESETS['orb-phrase'].waveformStyle).toBe('orb');
    expect(LOOK_PRESETS['cream-block'].waveformStyle).toBe('baseline');
  });
});
