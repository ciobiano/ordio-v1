/**
 * The sidebar reveal (CaptureScreen's foreground page sliding right to
 * expose CaptureSidebar behind it) has always animated by a percentage of
 * the container width ('74%'), which auto-scales across device sizes.
 * framer-motion's drag constraints require a pixel value, so this converts
 * a measured container width into that same percentage in pixels.
 */
export const SIDEBAR_REVEAL_RATIO = 0.74;

export function computeSidebarRevealPx(containerWidthPx: number): number {
  return Math.round(containerWidthPx * SIDEBAR_REVEAL_RATIO);
}
