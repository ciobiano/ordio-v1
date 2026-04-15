export function drawWatermark(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = '400 14px "Geist", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('Ordio by Kaine Studio', 16, 16);
  ctx.restore();
}
