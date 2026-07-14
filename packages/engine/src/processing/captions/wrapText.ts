import { measureTextWidth } from '@/lib/video/textLayout';

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  characterSpacing = 0
): string[] {
  const words = text.split(' ');
  if (words.length <= 1) return words;

  const n = words.length;
  const startsWithWeakWord = (line: string) => /^(and|or|but|to|of|the|a|an)\b/i.test(line);
  const cache = new Map<string, number>();
  const lineText = (i: number, j: number): string => words.slice(i, j).join(' ');
  const lineWidth = (i: number, j: number): number => {
    const key = `${i}:${j}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const width = measureTextWidth(ctx, lineText(i, j), characterSpacing);
    cache.set(key, width);
    return width;
  };

  const dp = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const nextBreak = new Array<number>(n + 1).fill(-1);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j <= n; j++) {
      const width = lineWidth(i, j);
      if (width > maxWidth) break;

      let cost = Math.pow((maxWidth - width) / Math.max(1, maxWidth), 2);
      const wordsInLine = j - i;

      if (wordsInLine === 1 && n > 2) cost += 10;
      if (startsWithWeakWord(lineText(i, j))) cost += 2;
      if (j !== n) cost += 0.15;

      const total = cost + dp[j];
      if (total < dp[i]) {
        dp[i] = total;
        nextBreak[i] = j;
      }
    }
  }

  if (nextBreak[0] === -1) return [text];

  const lines: string[] = [];
  let i = 0;
  while (i < n && nextBreak[i] > i) {
    const j = nextBreak[i];
    lines.push(lineText(i, j));
    i = j;
  }

  return lines.length > 0 ? lines : [text];
}
