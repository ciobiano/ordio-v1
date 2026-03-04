'use client';

import { useRef, useEffect } from 'react';
import { roundIconBtn } from '@/lib/variants';
import type { WaveformVariant, CaptionVariant } from '@/lib/store';

interface RecordingStateProps {
  onStopRecording: () => void;
  audioLevel: number;
  captionStyle: CaptionVariant;
  waveformStyle: WaveformVariant;
  isSpeaking?: boolean;
}

/**
 * Smooth flowing waveform canvas that responds to audio level.
 * Fills a horizontal band with an organic, mirrored wave shape.
 */
function FlowingWaveform({ level }: { level: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const smoothLevelRef = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      timeRef.current += 0.016; // ~60fps
      const t = timeRef.current;

      // Smooth the audio level for fluid motion
      smoothLevelRef.current += (level - smoothLevelRef.current) * 0.12;
      const smoothLevel = smoothLevelRef.current;

      const w = canvas.width;
      const h = canvas.height;
      const centerY = h / 2;
      const maxAmp = h * 0.4;

      ctx.clearRect(0, 0, w, h);

      // Number of sample points across width
      const points = 80;

      // Build top curve
      ctx.beginPath();
      ctx.moveTo(0, centerY);

      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const norm = i / points;

        // Multiple sine waves layered for organic feel
        const wave1 = Math.sin(norm * Math.PI * 4 + t * 3.0) * 0.5;
        const wave2 = Math.sin(norm * Math.PI * 6 + t * 1.8) * 0.3;
        const wave3 = Math.sin(norm * Math.PI * 10 + t * 4.5) * 0.2;

        // Envelope — taper at edges so wave fades near screen borders
        const envelope = Math.sin(norm * Math.PI);

        const combined = (wave1 + wave2 + wave3) * envelope;
        const amp = (0.05 + smoothLevel * 0.95) * combined * maxAmp;

        const y = centerY - Math.abs(amp);

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevX = ((i - 1) / points) * w;
          const cpx = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpx, y, x, y);
        }
      }

      // Close across to right, then mirror bottom
      ctx.lineTo(w, centerY);

      for (let i = points; i >= 0; i--) {
        const x = (i / points) * w;
        const norm = i / points;

        const wave1 = Math.sin(norm * Math.PI * 4 + t * 3.0) * 0.5;
        const wave2 = Math.sin(norm * Math.PI * 6 + t * 1.8) * 0.3;
        const wave3 = Math.sin(norm * Math.PI * 10 + t * 4.5) * 0.2;
        const envelope = Math.sin(norm * Math.PI);

        const combined = (wave1 + wave2 + wave3) * envelope;
        const amp = (0.05 + smoothLevel * 0.95) * combined * maxAmp;

        const y = centerY + Math.abs(amp);

        if (i === points) {
          ctx.lineTo(x, y);
        } else {
          const nextX = ((i + 1) / points) * w;
          const cpx = (nextX + x) / 2;
          ctx.quadraticCurveTo(cpx, y, x, y);
        }
      }

      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [level]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      className="w-full h-12 sm:h-16"
      aria-hidden="true"
    />
  );
}

export default function RecordingState({
  onStopRecording,
  audioLevel,
  captionStyle,
  waveformStyle,
  isSpeaking = false,
}: RecordingStateProps) {
  return (
    <div
      className="fixed inset-0 bg-black flex flex-col animate-fadeIn"
      role="region"
      aria-label="Recording in progress"
    >
      {/* Spacer — pushes controls to bottom */}
      <div className="flex-1" />

      {/* Bottom area — flowing waveform + stop button */}
      <div className="fixed bottom-0 inset-x-0 flex flex-col items-center gap-4 pb-8 safe-pb pt-4 bg-gradient-to-t from-black via-black/90 to-transparent">
        {/* Flowing waveform — responds to voice */}
        <div className="w-full px-4 sm:px-8">
          <FlowingWaveform level={audioLevel} />
        </div>

        <button
          onClick={onStopRecording}
          aria-label="Stop recording"
          className={roundIconBtn({ intent: 'stop' })}
        >
          <span className="sr-only">Stop recording</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-[4px] bg-[#e11d48]" aria-hidden="true" />
          </div>
        </button>

        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <div
            className={`w-1.5 h-1.5 rounded-full bg-[#e11d48] transition-all duration-150 ${
              isSpeaking ? 'scale-150 opacity-100' : 'animate-pulse opacity-70'
            }`}
            aria-hidden="true"
          />
          <span className="text-white/60 text-[0.625rem] tracking-[0.2em] uppercase">
            {isSpeaking ? 'speaking' : 'listening'}
          </span>
        </div>
      </div>
    </div>
  );
}
