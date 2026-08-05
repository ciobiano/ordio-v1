import { describe, it, expect } from 'vitest';
import {
  deriveBackgroundLabel,
  backgroundLabelForUpload,
} from '@/lib/backgroundLabel';

/**
 * Both background pickers stored `file.name` with the extension stripped, and
 * on iOS that is often a transport handle rather than a name — a background
 * uploaded through the Files app came back labelled
 * `CFNetworkDownload_34hlmZ.tmp`.
 */

describe('deriveBackgroundLabel', () => {
  it('keeps a name a person actually chose', () => {
    expect(deriveBackgroundLabel('sunset loop.mp4')).toBe('sunset loop');
    expect(deriveBackgroundLabel('Brand Backdrop v2.png')).toBe('Brand Backdrop v2');
  });

  it('rejects the iOS download handle that started this', () => {
    expect(deriveBackgroundLabel('CFNetworkDownload_34hlmZ.tmp')).toBeUndefined();
  });

  it('rejects files still in transit, whatever they are called', () => {
    expect(deriveBackgroundLabel('sunset.tmp')).toBeUndefined();
    expect(deriveBackgroundLabel('clip.part')).toBeUndefined();
    expect(deriveBackgroundLabel('movie.crdownload')).toBeUndefined();
  });

  it('rejects machine-generated names', () => {
    expect(deriveBackgroundLabel('tmp_9931.mp4')).toBeUndefined();
    expect(deriveBackgroundLabel('RPReplay_Final1712.mp4')).toBeUndefined();
    expect(deriveBackgroundLabel('1000000123.mp4')).toBeUndefined();
    expect(
      deriveBackgroundLabel('f47ac10b-58cc-4372-a567-0e02b2c3d479.png')
    ).toBeUndefined();
  });

  it('rejects generic one-word names that name nothing', () => {
    expect(deriveBackgroundLabel('image.jpg')).toBeUndefined();
    expect(deriveBackgroundLabel('Video.mov')).toBeUndefined();
    expect(deriveBackgroundLabel('untitled.png')).toBeUndefined();
  });

  it('keeps camera-roll names', () => {
    // Noise to read, but it is exactly what the user's photo library shows, so
    // it still helps them match the item. Deliberately not rejected.
    expect(deriveBackgroundLabel('IMG_4523.HEIC')).toBe('IMG_4523');
    expect(deriveBackgroundLabel('PXL_20260804_101530.jpg')).toBe('PXL_20260804_101530');
  });

  it('handles names with no usable stem', () => {
    expect(deriveBackgroundLabel('.hidden')).toBeUndefined();
    expect(deriveBackgroundLabel('   .png')).toBeUndefined();
    expect(deriveBackgroundLabel('')).toBeUndefined();
  });

  it('keeps a name that has no extension at all', () => {
    expect(deriveBackgroundLabel('my backdrop')).toBe('my backdrop');
  });

  it('truncates something too long to read', () => {
    // Deliberately not a run of one letter: a-f are hex, so a long enough run
    // of them is caught by the blob rule above and never reaches truncation.
    const long = `${'wide sweeping landscape loop '.repeat(4)}.mp4`;
    const label = deriveBackgroundLabel(long);

    expect(label).toHaveLength(61); // 60 + the ellipsis
    expect(label?.endsWith('…')).toBe(true);
  });

  it('does not mistake an ordinary long name for a hex blob', () => {
    // The blob rule is length + charset, and a-f are letters. Guarding that it
    // stays narrow enough to leave real words alone.
    expect(deriveBackgroundLabel('cafe backdrop faded.png')).toBe('cafe backdrop faded');
  });
});

describe('backgroundLabelForUpload', () => {
  it('passes a real name straight through', () => {
    expect(backgroundLabelForUpload('sunset loop.mp4', 0)).toBe('sunset loop');
  });

  it('numbers the fallback off what is already there', () => {
    // Three uploads from the Files app would otherwise be three identical
    // labels, which is no more useful than three temp handles.
    expect(backgroundLabelForUpload('CFNetworkDownload_a.tmp', 0)).toBe('Background 1');
    expect(backgroundLabelForUpload('CFNetworkDownload_b.tmp', 1)).toBe('Background 2');
    expect(backgroundLabelForUpload('CFNetworkDownload_c.tmp', 2)).toBe('Background 3');
  });
});
