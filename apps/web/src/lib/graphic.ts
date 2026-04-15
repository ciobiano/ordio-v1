import type { StyleConfig } from '@Ordio/shared/schemas';
import type { GraphicStyleId } from '@/stores';
import {
  WAVEFORM_CENTER_Y_FLIPPED,
} from '@/lib/waveforms/constants';

const WAVEFORM_CENTER_Y = 0.72;

export function drawGraphic(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  graphicStyle: NonNullable<GraphicStyleId>,
  style: StyleConfig,
  flipped = false
): void {
  const { width, height } = style;
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Fit within 70% width and 30% height, preserving aspect ratio
  const maxW = width * 0.7;
  const maxH = height * 0.3;
  const fitByWidth = maxW / aspectRatio <= maxH;
  const drawW = fitByWidth ? maxW : maxH * aspectRatio;
  const drawH = fitByWidth ? maxW / aspectRatio : maxH;

  // Centre horizontally; vertically centred on the visual zone
  const centerY = flipped ? WAVEFORM_CENTER_Y_FLIPPED : WAVEFORM_CENTER_Y;
  const drawX = (width - drawW) / 2;
  const drawY = height * centerY - drawH / 2;

  if (graphicStyle === 'graphic-frame1') {
    // Tint with creator's accent colour (waveColor) via OffscreenCanvas
    const offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const octx = offscreen.getContext('2d')!;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = style.waveColor;
    octx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
    ctx.drawImage(offscreen, drawX, drawY, drawW, drawH);
  } else {
    // graphic-frame2: draw as-is (white fill in SVG)
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}
