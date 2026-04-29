export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  characterSpacing = 0
): number {
  if (text.length === 0) return 0;
  if (characterSpacing <= 0) return ctx.measureText(text).width;

  const chars = [...text];
  let width = 0;
  for (const char of chars) {
    width += ctx.measureText(char).width;
  }
  return width + characterSpacing * Math.max(0, chars.length - 1);
}

interface DrawSpacedTextOptions {
  textAlign?: CanvasTextAlign;
  mode?: 'fill' | 'stroke';
  characterSpacing?: number;
}

export function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: DrawSpacedTextOptions = {}
): void {
  const {
    textAlign = 'left',
    mode = 'fill',
    characterSpacing = 0,
  } = options;

  if (text.length === 0) return;

  if (characterSpacing <= 0) {
    if (mode === 'stroke') {
      ctx.strokeText(text, x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    return;
  }

  const totalWidth = measureTextWidth(ctx, text, characterSpacing);
  let cursorX = x;

  if (textAlign === 'center') {
    cursorX -= totalWidth / 2;
  } else if (textAlign === 'right' || textAlign === 'end') {
    cursorX -= totalWidth;
  }

  for (const char of [...text]) {
    if (mode === 'stroke') {
      ctx.strokeText(char, cursorX, y);
    } else {
      ctx.fillText(char, cursorX, y);
    }
    cursorX += ctx.measureText(char).width + characterSpacing;
  }
}
