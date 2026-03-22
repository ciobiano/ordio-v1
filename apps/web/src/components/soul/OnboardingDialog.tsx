'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/useOnboarding';

/* ── Slide data ───────────────────────────────────────────── */
const SLIDES = [
  {
    title: 'Your voice, ready to share',
    body: 'Record or upload audio. Ordio turns it into a polished, captioned video.',
  },
  {
    title: 'Tap the orb to begin',
    body: 'Speak naturally. Or upload an MP3, WAV, or M4A — up to 50 MB.',
  },
  {
    title: 'Captions, automatically',
    body: 'AI transcribes every word and syncs captions to your audio. No editing required.',
  },
  {
    title: 'Not just a waveform',
    body: 'Swap styles in the export screen — graphic frames, bars, circle, spectrogram.',
  },
];

/* ── Hidden SVG gradient defs ─────────────────────────────── */
// Defined once; all icon paths, fills, and strokes reference url(#grad-sN)
function GradientDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute overflow-hidden">
      <defs>
        <linearGradient id="grad-s1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ff6b6b" />
          <stop offset="50%"  stopColor="#ff9a3c" />
          <stop offset="100%" stopColor="#ffd166" />
        </linearGradient>
        <linearGradient id="grad-s2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00e5c0" />
          <stop offset="50%"  stopColor="#00aaff" />
          <stop offset="100%" stopColor="#6e56cf" />
        </linearGradient>
        <linearGradient id="grad-s3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#b58aff" />
          <stop offset="50%"  stopColor="#e056a8" />
          <stop offset="100%" stopColor="#ff6b6b" />
        </linearGradient>
        <linearGradient id="grad-s4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ff9a3c" />
          <stop offset="50%"  stopColor="#e056a8" />
          <stop offset="100%" stopColor="#6e56cf" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Ambient glow ─────────────────────────────────────────── */
// ob-glow: opacity + blur | ob-glow-sN: gradient background (both in globals.css)
function AmbientGlow({ step }: { step: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute top-0 left-0 right-0 h-28 rounded-t-[20px] pointer-events-none',
        'ob-glow',
        `ob-glow-s${step + 1}`,
      )}
    />
  );
}

/* ── Icon ring ────────────────────────────────────────────── */
// SVG presentation attributes (stroke, fill) are not React style props
// ob-icon-ring provides box-shadow via CSS class
function IconRing({ step }: { step: number }) {
  const gradRef = `url(#grad-s${step + 1})`;

  const icons = [
    // Microphone
    <path
      key="mic"
      d="M12 2a4 4 0 014 4v6a4 4 0 01-8 0V6a4 4 0 014-4zm0 16a8 8 0 008-8h-2a6 6 0 01-12 0H4a8 8 0 008 8zm0 0v3m-4 0h8"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />,
    // Circle / target
    <g key="target">
      <circle cx="12" cy="12" r="9" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="4" strokeWidth="1.5" fill="none" />
    </g>,
    // Speech bubble
    <path
      key="bubble"
      d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 3V6z"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />,
    // Pencil / edit
    <path
      key="pencil"
      d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />,
  ];

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative bg-background ob-icon-ring"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <g stroke={gradRef}>{icons[step]}</g>
      </svg>
    </motion.div>
  );
}

/* ── Slide visuals ────────────────────────────────────────── */

// Slide 1: animated waveform bars
// @keyframes obWaveBar and nth-child stagger delays live in globals.css
function WaveformVisual() {
  const barHeights = [40, 70, 55, 90, 65, 80, 45, 75, 60, 85, 50, 70];
  return (
    <div className="flex items-end justify-center my-4" aria-hidden="true">
      <svg width="140" height="24" viewBox="0 0 140 24">
        {barHeights.map((h, i) => {
          const barH = (h / 100) * 24;
          return (
            <rect
              key={i}
              x={i * 11 + 3}
              y={24 - barH}
              width="3.5"
              height={barH}
              rx="2"
              fill="url(#grad-s1)"
              className="ob-wave-bar"
            />
          );
        })}
      </svg>
    </div>
  );
}

// Slide 2: mini orb with pulsing gradient ring
// ob-grad-border-s2: gradient border via padding-box/border-box (globals.css)
// ob-fill-s2: gradient background (globals.css)
function OrbVisual() {
  return (
    <div className="flex items-center justify-center my-4" aria-hidden="true">
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        className="relative flex items-center justify-center w-[54px] h-[54px]"
      >
        <div className="absolute inset-0 rounded-full ob-grad-border-s2" />
        <div className="rounded-full w-[34px] h-[34px] opacity-25 ob-fill-s2" />
      </motion.div>
    </div>
  );
}

// Slide 3: caption pill with gradient border
// ob-grad-border-s3: gradient border via padding-box/border-box (globals.css)
function CaptionVisual() {
  return (
    <div className="my-4 w-full" aria-hidden="true">
      <div className="rounded-full px-3 py-2 text-[length:var(--text-caption)] text-secondary ob-grad-border-s3">
        &ldquo;AI transcribes every word...&rdquo;
      </div>
    </div>
  );
}

// Slide 4: 2×2 style tiles — each tile icon uses its own gradient from GradientDefs
const STYLE_TILES = [
  { label: 'Bars',     gradId: 'grad-s1' },
  { label: 'Circle',   gradId: 'grad-s2' },
  { label: 'Frame',    gradId: 'grad-s3' },
  { label: 'Spectrum', gradId: 'grad-s4' },
];

function StyleTilesVisual() {
  return (
    <div className="grid grid-cols-2 gap-[5px] my-4 w-full" aria-hidden="true">
      {STYLE_TILES.map(({ label, gradId }) => (
        <div
          key={label}
          className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 bg-surface"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="3" strokeWidth="1.5" stroke={`url(#${gradId})`} />
          </svg>
          <span className="text-[length:var(--text-footnote)] text-tertiary tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  );
}

function SlideVisual({ step }: { step: number }) {
  if (step === 0) return <WaveformVisual />;
  if (step === 1) return <OrbVisual />;
  if (step === 2) return <CaptionVisual />;
  return <StyleTilesVisual />;
}

/* ── Progress dots ────────────────────────────────────────── */
// Active dot: ob-fill-sN (gradient) + w-3 pill shape
// Inactive dot: bg-tertiary + w-1.5 circle
// Note: --tertiary (rgba(250,248,245,0.3)) is used over shadcn's --muted since it's
// the project's own semantic "muted" token on dark backgrounds
function DotProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-[6px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-[2px] transition-all duration-200',
            i === step
              ? cn('w-3', `ob-fill-s${step + 1}`)
              : 'w-1.5 bg-tertiary',
          )}
        />
      ))}
    </div>
  );
}

/* ── Circle button ────────────────────────────────────────── */
// bg-btn-circle-bg: CSS token exposed via @theme inline in globals.css
function CircleButton({ isDone, onClick }: { isDone: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={isDone ? 'Get started' : 'Next'}
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-btn-circle-bg"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--btn-circle-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDone ? <path d="M5 12l5 5L20 7" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

/* ── Slide footer (named component per spec) ─────────────── */
function SlideFooter({
  step,
  total,
  onNext,
  onDismiss,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const isDone = step === total - 1;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <DotProgress step={step} total={total} />
        <CircleButton isDone={isDone} onClick={isDone ? onDismiss : onNext} />
      </div>
      {step === 0 && (
        <button
          onClick={onDismiss}
          className="mt-3 text-center text-[length:var(--text-caption)] text-tertiary hover:text-secondary transition-colors w-full"
        >
          Skip intro
        </button>
      )}
    </div>
  );
}

/* ── Single slide ─────────────────────────────────────────── */
function OnboardingSlide({
  step,
  total,
  onNext,
  onDismiss,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const slide = SLIDES[step];

  return (
    <motion.div
      key={step}
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -32, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex flex-col"
    >
      <AmbientGlow step={step} />

      <IconRing step={step} />

      <DialogTitle className="text-[length:var(--text-h5)] font-semibold text-primary leading-[var(--leading-heading)] mb-2">
        {slide.title}
      </DialogTitle>

      <DialogDescription className="text-[length:var(--text-body-sm)] text-secondary leading-[var(--leading-body)] mb-1">
        {slide.body}
      </DialogDescription>

      <SlideVisual step={step} />

      <SlideFooter step={step} total={total} onNext={onNext} onDismiss={onDismiss} />
    </motion.div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function OnboardingDialog() {
  const { open, step, next, dismiss } = useOnboarding();

  return (
    <>
      <GradientDefs />

      {/* onOpenChange is intentionally a no-op — prevents backdrop click and Escape
          from closing the dialog. Dismiss is only via our × button, skip, or done. */}
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          className="relative overflow-hidden !p-[24px_20px_18px] !rounded-[20px] max-w-[340px] w-[calc(100vw-32px)] ob-dialog-border"
        >
          {/* × dismiss button — visible on all slides; always-available exit */}
          <button
            onClick={dismiss}
            aria-label="Close onboarding"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-tertiary hover:text-secondary transition-colors z-10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <AnimatePresence mode="wait">
            <OnboardingSlide
              key={step}
              step={step}
              total={SLIDES.length}
              onNext={next}
              onDismiss={dismiss}
            />
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
