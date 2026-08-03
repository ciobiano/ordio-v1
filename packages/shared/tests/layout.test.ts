import { describe, it, expect } from 'vitest';
import { layoutCaption, estimateTextWidth } from '../src/layout';
import { StyleConfig } from '../src/schemas';

describe('Layout Engine', () => {
  const mockStyle: StyleConfig = {
    width: 1000,
    height: 1000,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 20,
    waveColor: '#ff0000',
    characterSpacing: 0,
    lineHeight: 1.4,
    textAlign: 'center',
    verticalAlign: 'auto',
    backgroundScrim: 'flat',
    captionStyleId: 'minimal-lower-third'
  };

  it('should split long text into multiple lines', () => {
    // estimateTextWidth assumes 0.6em per char
    // 20px * 0.6 = 12px per char
    // "Hello World" = 11 chars * 12 = 132px
    
    // Max width 60px should force split
    const result = layoutCaption(
      "Hello World",
      mockStyle,
      60,
      estimateTextWidth
    );

    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines).toEqual(['Hello', 'World']);
  });

  it('should keep text on one line if it fits', () => {
    const result = layoutCaption(
      "Hello",
      mockStyle,
      200,
      estimateTextWidth
    );

    expect(result.lines.length).toBe(1);
    expect(result.lines[0]).toBe("Hello");
  });
});
