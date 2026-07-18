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

// Text measurement is on the render hot path — the preview measures the same
// phrase strings every animation frame (and per character on the fallback
// path). Widths only depend on font + spacing + text, so memoize them.
const measureCache = new Map<string, number>();
const MEASURE_CACHE_MAX = 2000;

/**
 * Widths measured before a web font finishes loading are wrong once the real
 * glyphs arrive (the ctx.font string is identical either way). Font loaders
 * must call this after a face loads.
 */
export function invalidateTextMeasureCache(): void {
  measureCache.clear();
}

export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  characterSpacing = 0
): number {
  if (text.length === 0) return 0;

  const cacheKey = `${ctx.font}|${characterSpacing}|${text}`;
  const cached = measureCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let width: number;
  if (characterSpacing === 0) {
    width = ctx.measureText(text).width;
  } else if (supportsCanvasLetterSpacing(ctx)) {
    ctx.save();
    (ctx as CanvasTextContext).letterSpacing = `${characterSpacing}px`;
    width = ctx.measureText(text).width;
    ctx.restore();
  } else {
    const chars = [...text];
    width = 0;
    for (let i = 0; i < chars.length; i++) {
      width += ctx.measureText(chars[i]).width;
      width += pairSpacing(ctx, chars[i], chars[i + 1], characterSpacing);
    }
    width = Math.max(0, width);
  }

  if (measureCache.size >= MEASURE_CACHE_MAX) measureCache.clear();
  measureCache.set(cacheKey, width);
  return width;
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
