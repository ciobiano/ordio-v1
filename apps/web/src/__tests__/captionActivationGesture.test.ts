import { describe, expect, it } from 'vitest';
import { isCaptionActivationDoubleTap } from '@/components/primitives/video/canvas-preview/captionActivationGesture';

describe('captionActivationGesture', () => {
  it('does not activate on the first tap', () => {
    expect(
      isCaptionActivationDoubleTap(null, {
        timestamp: 100,
        clientX: 40,
        clientY: 40,
      })
    ).toBe(false);
  });

  it('activates on a nearby second tap within the double-tap window', () => {
    expect(
      isCaptionActivationDoubleTap(
        {
          timestamp: 100,
          clientX: 40,
          clientY: 40,
        },
        {
          timestamp: 360,
          clientX: 52,
          clientY: 50,
        }
      )
    ).toBe(true);
  });

  it('does not activate when the second tap is too late', () => {
    expect(
      isCaptionActivationDoubleTap(
        {
          timestamp: 100,
          clientX: 40,
          clientY: 40,
        },
        {
          timestamp: 500,
          clientX: 45,
          clientY: 45,
        }
      )
    ).toBe(false);
  });

  it('does not activate when the second tap moves too far', () => {
    expect(
      isCaptionActivationDoubleTap(
        {
          timestamp: 100,
          clientX: 40,
          clientY: 40,
        },
        {
          timestamp: 260,
          clientX: 80,
          clientY: 80,
        }
      )
    ).toBe(false);
  });
});
