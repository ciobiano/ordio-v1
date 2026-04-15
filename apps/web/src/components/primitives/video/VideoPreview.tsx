'use client';

import WaveformDisplay from '@/components/primitives/waveform/WaveformDisplay';
import type { WaveformVariant, CanvasLayout, FormatVariant } from '@/stores';

interface VideoPreviewProps {
  format: FormatVariant;
  waveformStyle: WaveformVariant;
  canvasLayout?: CanvasLayout;
}

export default function VideoPreview({ format, waveformStyle, canvasLayout }: VideoPreviewProps) {
  const isVertical = format === 'vertical';

  return (
    <div
      role="img"
      aria-label="Video format preview"
      className={`relative bg-black rounded-xl overflow-hidden border border-white/10 ${
        isVertical ? 'w-56 h-96' : 'w-96 h-56'
      }`}
    >
      <div aria-hidden="true">
        {/* Waveform area */}
        <div
          className={`absolute ${
            isVertical ? 'top-1/3 left-0 right-0' : 'top-1/2 left-0 right-0 -translate-y-1/2'
          } flex justify-center`}
        >
          <WaveformDisplay variant={waveformStyle} level={0.6} isRecording={true} compact={true} />
        </div>

        {/* Caption area */}
        <div
          className={`absolute left-0 right-0 px-4 ${
            canvasLayout === 'flipped' ? 'top-[38%]' : isVertical ? 'bottom-16' : 'bottom-8'
          }`}
        >
          <div>
            <p className={`font-semibold leading-tight ${isVertical ? 'text-sm' : 'text-sm'}`}>
              <span className="bg-black/60 px-2 py-1 rounded text-white">
                &ldquo;Today we&apos;re talking about something really exciting.&rdquo;
              </span>
            </p>
          </div>
        </div>

        {/* Format badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 rounded text-xs text-white/50">
          {isVertical ? '9:16' : '16:9'}
        </div>
      </div>
      {/* end aria-hidden */}
    </div>
  );
}
