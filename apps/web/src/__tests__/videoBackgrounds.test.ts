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
  it('gates background_video and background_upload at creator', () => {
    expect(FEATURE_GATES.background_video).toBe('creator');
    expect(FEATURE_GATES.background_upload).toBe('creator');
    expect(tierHasAccess('free', FEATURE_GATES.background_video)).toBe(false);
    expect(tierHasAccess('creator', FEATURE_GATES.background_video)).toBe(true);
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

describe('loopTimestamps', () => {
  it('wraps output timestamps modulo the loop duration', () => {
    const ts = loopTimestamps(6, 2, 1.5); // 6 frames @2fps over a 1.5s loop
    expect(ts).toEqual([0, 0.5, 1.0, 0, 0.5, 1.0]);
  });

  it('returns [] for invalid inputs', () => {
    expect(loopTimestamps(0, 30, 10)).toEqual([]);
    expect(loopTimestamps(10, 0, 10)).toEqual([]);
    expect(loopTimestamps(10, 30, 0)).toEqual([]);
  });
});
