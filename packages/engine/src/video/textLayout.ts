type CanvasTextContext = CanvasRenderingContext2D & {
  letterSpacing?: string;
};

function supportsCanvasLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx;
}

function isWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

function pairSpacing(
  ctx: CanvasRenderingContext2D,
  currentChar: string,
  nextChar: string | undefined,
  characterSpacing: number
): number {
  if (!nextChar || isWhitespace(currentChar) || isWhitespace(nextChar)) return 0;
  if (characterSpacing >= 0) return characterSpacing;

  const currentWidth = ctx.measureText(currentChar).width;
  const nextWidth = ctx.measureText(nextChar).width;
  const maxTightening = Math.min(currentWidth, nextWidth) * 0.45;
  return Math.max(characterSpacing, -maxTightening);
}

export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  characterSpacing = 0
): number {
  if (text.length === 0) return 0;
  if (characterSpacing === 0) return ctx.measureText(text).width;

  if (supportsCanvasLetterSpacing(ctx)) {
    ctx.save();
    (ctx as CanvasTextContext).letterSpacing = `${characterSpacing}px`;
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }

  const chars = [...text];
  let width = 0;
  for (let i = 0; i < chars.length; i++) {
    width += ctx.measureText(chars[i]).width;
    width += pairSpacing(ctx, chars[i], chars[i + 1], characterSpacing);
  }
  return Math.max(0, width);
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

  if (characterSpacing === 0) {
    if (mode === 'stroke') {
      ctx.strokeText(text, x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    return;
  }

  if (supportsCanvasLetterSpacing(ctx)) {
    ctx.save();
    ctx.textAlign = textAlign;
    (ctx as CanvasTextContext).letterSpacing = `${characterSpacing}px`;
    if (mode === 'stroke') {
      ctx.strokeText(text, x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    ctx.restore();
    return;
  }

  const totalWidth = measureTextWidth(ctx, text, characterSpacing);
  let cursorX = x;

  if (textAlign === 'center') {
    cursorX -= totalWidth / 2;
  } else if (textAlign === 'right' || textAlign === 'end') {
    cursorX -= totalWidth;
  }

  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (mode === 'stroke') {
      ctx.strokeText(char, cursorX, y);
    } else {
      ctx.fillText(char, cursorX, y);
    }
    cursorX += ctx.measureText(char).width + pairSpacing(ctx, char, chars[i + 1], characterSpacing);
  }
}
