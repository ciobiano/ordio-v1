import type { GraphicStyleId } from '@/stores';

const cache = new Map<string, HTMLImageElement>();

export async function loadGraphic(id: NonNullable<GraphicStyleId>): Promise<HTMLImageElement> {
  if (cache.has(id)) return cache.get(id)!;

  const src = id === 'graphic-frame1'
    ? '/graphic-styles/frame1.svg'
    : '/graphic-styles/frame2.svg';

  const img = new Image();
  img.src = src;

  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error(`Failed to load graphic: ${id}`));
  });

  cache.set(id, img);
  return img;
}

export function getGraphic(id: NonNullable<GraphicStyleId>): HTMLImageElement | null {
  return cache.get(id) ?? null;
}
