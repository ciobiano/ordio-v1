import { describe, it, expect, vi } from 'vitest';
import { BackgroundSchema } from '@Ordio/shared/schemas';
import { BACKGROUND_LIBRARY, getCuratedBackground } from '@Ordio/engine/backgrounds/backgroundLibrary';
import {
  clampBackgroundDuration,
  BACKGROUND_MAX_DURATION_SEC,
  transcodeBackgroundUpload,
} from '@Ordio/engine/media/transcodeBackgroundUpload';
import { coverFit, BACKGROUND_SCRIM_ALPHA } from '@Ordio/engine/video/frameRenderer';
import { loopTimestamps } from '@Ordio/engine/video/backgroundFrameStream';
import { FEATURE_GATES, tierHasAccess } from '@/lib/featureGates';

const mockConversion: { onProgress?: (p: number) => void; isValid: boolean } = { isValid: true };

class MockInput {
  computeDuration = vi.fn().mockResolvedValue(5);
  dispose = vi.fn();
}

class MockOutput {
  target = { buffer: new ArrayBuffer(8) };
}

vi.mock('mediabunny', () => ({
  Input: MockInput,
  Output: MockOutput,
  Conversion: {
    init: vi.fn().mockResolvedValue(
      Object.assign(mockConversion, {
        execute: vi.fn().mockImplementation(async () => {
          mockConversion.onProgress?.(0.5);
          mockConversion.onProgress?.(1);
        }),
      })
    ),
  },
  BlobSource: class {},
  BufferTarget: class {},
  Mp4OutputFormat: class {},
  ALL_FORMATS: {},
}));

describe('BackgroundSchema', () => {
  it('accepts a solid background', () => {
    expect(BackgroundSchema.parse({ type: 'solid', color: '#1a2b3c' })).toEqual({
      type: 'solid',
      color: '#1a2b3c',
    });
  });

  it('accepts curated and custom video backgrounds', () => {
    expect(
      BackgroundSchema.parse({ type: 'video', source: 'curated', assetId: 'cafe' }).type
    ).toBe('video');
    expect(
      BackgroundSchema.parse({ type: 'video', source: 'custom', assetId: 'k123abc' }).type
    ).toBe('video');
  });

  it('rejects bad colors, unknown sources, and empty assetIds', () => {
    expect(BackgroundSchema.safeParse({ type: 'solid', color: 'red' }).success).toBe(false);
    expect(
      BackgroundSchema.safeParse({ type: 'video', source: 'internet', assetId: 'x' }).success
    ).toBe(false);
    expect(
      BackgroundSchema.safeParse({ type: 'video', source: 'curated', assetId: '' }).success
    ).toBe(false);
  });
});

describe('BACKGROUND_LIBRARY', () => {
  it('every manifest entry resolves by id and has asset paths', () => {
    expect(BACKGROUND_LIBRARY.length).toBeGreaterThanOrEqual(3);
    for (const asset of BACKGROUND_LIBRARY) {
      expect(getCuratedBackground(asset.id)).toEqual(asset);
      expect(asset.videoPath).toMatch(/^\/backgrounds\/.+\.mp4$/);
      expect(asset.thumbPath).toMatch(/^\/backgrounds\/.+\.jpg$/);
    }
  });

  it('returns null for unknown ids', () => {
    expect(getCuratedBackground('nope')).toBeNull();
  });
});

describe('feature gates', () => {
  it('leaves backgrounds open, since there is no tier that could unlock them', () => {
    // Nothing is for sale, so a 'creator' gate here would be a door with no
    // key rather than an upgrade prompt. Storage cost is bounded by the credit
    // ledger instead. See the note on FEATURE_GATES.
    expect(FEATURE_GATES.background_video).toBe('free');
    expect(FEATURE_GATES.background_upload).toBe('free');
    expect(tierHasAccess('free', FEATURE_GATES.background_video)).toBe(true);
  });

  it('still refuses access when a gate is raised above the user tier', () => {
    // tierHasAccess is the mechanism a paid tier would come back through, so
    // it is asserted independently of what the table currently says.
    expect(tierHasAccess('free', 'creator')).toBe(false);
    expect(tierHasAccess('creator', 'creator')).toBe(true);
  });

  it('never leaves a gate above the highest tier an account can actually reach', () => {
    // The regression this pins: `backgrounds.uploadBackground` used to carry its
    // own hand-written `tier === "free"` throw. Once the checkout routes went
    // away, `free` became the only reachable tier, so that gate rejected every
    // upload — while the client table said the feature was unlocked and let the
    // user get all the way through storing the file first.
    //
    // Any gate set above HIGHEST_REACHABLE_TIER is a door with no key. Raise
    // this constant in the same change that makes a higher tier purchasable.
    const HIGHEST_REACHABLE_TIER = 'free' as const;
    const unreachable = Object.entries(FEATURE_GATES).filter(
      ([, required]) => !tierHasAccess(HIGHEST_REACHABLE_TIER, required)
    );
    expect(unreachable).toEqual([]);
  });

  it('exposes the same gate table to the Convex backend', async () => {
    // Both sides must read one table — a duplicated rule is a rule that drifts.
    // `packages/convex/convex/backgrounds.ts` imports from here.
    const shared = await import('@Ordio/shared/featureGates');
    expect(shared.FEATURE_GATES).toBe(FEATURE_GATES);
    expect(shared.tierHasAccess).toBe(tierHasAccess);
  });
});

describe('clampBackgroundDuration', () => {
  it('trims sources longer than the cap to exactly the cap', () => {
    expect(clampBackgroundDuration(37.2)).toBe(BACKGROUND_MAX_DURATION_SEC);
  });

  it('keeps shorter sources as-is and floors invalid input to 0', () => {
    expect(clampBackgroundDuration(5.5)).toBe(5.5);
    expect(clampBackgroundDuration(0)).toBe(0);
    expect(clampBackgroundDuration(-3)).toBe(0);
  });
});

describe('coverFit', () => {
  it('fills a square canvas from a landscape source, centered', () => {
    const { dx, dy, dw, dh } = coverFit(1280, 720, 1080, 1080);
    expect(dh).toBe(1080); // height is the constraint
    expect(dw).toBe(1920); // scaled proportionally
    expect(dx).toBe((1080 - 1920) / 2); // centered horizontally
    expect(dy).toBe(0);
  });

  it('fills a vertical canvas from a landscape source', () => {
    const { dw, dh } = coverFit(1280, 720, 720, 1280);
    expect(dw).toBeGreaterThanOrEqual(720);
    expect(dh).toBeGreaterThanOrEqual(1280);
  });

  it('scrim alpha stays in a legible range', () => {
    expect(BACKGROUND_SCRIM_ALPHA).toBeGreaterThan(0.2);
    expect(BACKGROUND_SCRIM_ALPHA).toBeLessThan(0.6);
  });
});

describe('transcodeBackgroundUpload', () => {
  it('forwards conversion progress to the caller-supplied callback', async () => {
    const file = new File([new Uint8Array(8)], 'clip.mp4', { type: 'video/mp4' });
    const onProgress = vi.fn();

    await transcodeBackgroundUpload(file, onProgress);

    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(onProgress).toHaveBeenCalledWith(1);
  });

  it('does not throw when no progress callback is supplied', async () => {
    const file = new File([new Uint8Array(8)], 'clip.mp4', { type: 'video/mp4' });
    await expect(transcodeBackgroundUpload(file)).resolves.toBeDefined();
  });
});

/**
 * Places the sequence steps backwards. Each one costs the decoder a re-seek to
 * the previous keyframe, so this is the number that decides whether background
 * playback is cheap or unusable.
 */
function backwardSteps(timestamps: number[]): number {
  let count = 0;
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] < timestamps[i - 1]) count++;
  }
  return count;
}

describe('loopTimestamps', () => {
  it('wraps output timestamps modulo the loop duration', () => {
    const ts = loopTimestamps(6, 2, 1.5); // 6 frames @2fps over a 1.5s loop
    expect(ts).toEqual([0, 0.5, 1.0, 0, 0.5, 1.0]);
  });

  it('steps backwards only once per loop', () => {
    // The regression this pins is a production outage, not a nicety. Every
    // background sat on a loading spinner forever because a reflecting
    // ("ping-pong") sequence was substituted here to remove the visible cut at
    // the wrap. mediabunny's `samplesAtTimestamps` documents an optimized path
    // taken *only* for monotonically sorted timestamps; a reflecting sequence
    // descends on every frame of its reverse leg, so ~300 of 600 frames each
    // re-decoded from the previous keyframe — on the order of 9,000 extra
    // frame-decodes per 10s loop, run at load time with the spinner up.
    //
    // Note the bound is not "never steps backwards": modulo wrapping descends
    // too, once per loop. One re-seek per 10s of output is the cheap case the
    // stream is designed around. The count is what matters.
    const fps = 30;
    const loopSec = 10;
    const ts = loopTimestamps(fps * loopSec * 3, fps, loopSec); // 3 loops
    expect(backwardSteps(ts)).toBe(2); // one per wrap; 3 loops means 2 wraps
  });

  it('a reflecting sequence would step backwards on nearly every frame', () => {
    // The counter-example, kept so the bound above cannot be mistaken for
    // something that passes trivially. This is what shipped and broke.
    const fps = 30;
    const loopSec = 10;
    const period = 2 * loopSec;
    const pingPong = Array.from({ length: fps * loopSec * 2 }, (_, i) => {
      const phase = (i / fps) % period;
      return phase <= loopSec ? phase : period - phase;
    });
    expect(backwardSteps(pingPong)).toBeGreaterThan(fps * loopSec * 0.4);
  });

  it('returns [] for invalid inputs', () => {
    expect(loopTimestamps(0, 30, 10)).toEqual([]);
    expect(loopTimestamps(10, 0, 10)).toEqual([]);
    expect(loopTimestamps(10, 30, 0)).toEqual([]);
  });
});
