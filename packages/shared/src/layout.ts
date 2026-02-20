/**
 * Deterministic text layout engine.
 * Decouples layout logic from the DOM to ensure server-side parity.
 */

import { StyleConfig } from './schemas';

export interface LayoutResult {
  lines: string[];
  totalHeight: number;
}

export type MeasureTextFn = (text: string, fontSize: number, fontFamily: string) => number;

/**
 * Splits text into lines ensuring they fit within the maxWidth.
 * Requires a measureText function to be injected for environment independence.
 * 
 * @param text The full caption text
 * @param style visual style config
 * @param maxWidth maximum width in pixels
 * @param measureText function to measure string width
 */
export function layoutCaption(
  text: string,
  style: StyleConfig,
  maxWidth: number,
  measureText: MeasureTextFn
): LayoutResult {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    const width = measureText(testLine, style.fontSize, style.fontFamily);

    if (width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  // Simple line height calculation (can be improved)
  const lineHeight = style.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  return {
    lines,
    totalHeight,
  };
}

/**
 * Estimated width calculator for fallback/testing.
 * NEVER use for production rendering if exact precision is needed.
 */
export const estimateTextWidth: MeasureTextFn = (text, fontSize) => {
  // Rough estimate: average char is 0.6em wide
  return text.length * fontSize * 0.6;
};
