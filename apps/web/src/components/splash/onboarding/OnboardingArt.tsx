import Image from 'next/image';
import { cn } from '@/lib/utils';
import { OrdioMark } from '@/components/ui/OrdioMark';

/**
 * The three onboarding illustrations, each drawn on a fixed 390×440 stage.
 *
 * Fixed rather than fluid because they are compositions — tilted cards that
 * overlap by exact amounts — and a fluid layout would pull them apart at one
 * width or pile them up at another. The caller scales the whole stage to fit
 * (see useStageScale), so a 652px Galaxy A20 gets the same picture, smaller.
 */
export const STAGE_W = 390;
export const STAGE_H = 440;

const PHOTOS = {
  cafe: '/backgrounds/cafe-thumb.jpg',
  friends: '/backgrounds/friends-thumb.jpg',
  podcast: '/backgrounds/podcast-thumb.jpg',
} as const;

function Glow({ top, strength = 16 }: { top: number; strength?: 16 | 20 }) {
  return (
    <div
      aria-hidden="true"
      className="absolute left-1/2 h-75 w-95 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        top,
        background: `radial-gradient(closest-side, color-mix(in srgb, var(--acid-accent) ${strength}%, transparent), transparent)`,
      }}
    />
  );
}

interface LookCardProps {
  name: string;
  photo: keyof typeof PHOTOS;
  className: string;
  /** Card tint and ink, as utility classes. */
  tone: string;
  big?: boolean;
  children: React.ReactNode;
}

function LookCard({ name, photo, className, tone, big = false, children }: LookCardProps) {
  return (
    <div
      className={cn(
        'absolute flex flex-col shadow-[0_24px_50px_rgb(0_0_0/0.55),inset_0_0_0_1.5px_rgb(255_255_255/0.3)]',
        big ? 'w-49 gap-2.25 rounded-[24px] p-2.75' : 'w-44.5 gap-2 rounded-[22px] p-2.5',
        tone,
        className
      )}
    >
      <div className="flex flex-col px-1 pt-0.5 leading-[0.95]">
        <span className={cn('font-extrabold tracking-tight', big ? 'text-[22px]' : 'text-[19px]')}>{name}</span>
        <span className={cn('font-acid-serif italic', big ? 'text-2xl' : 'text-[21px]')}>Look</span>
      </div>
      <div
        className={cn(
          'relative overflow-hidden border-3 border-white/92',
          big ? 'h-44 rounded-[15px]' : 'h-37.5 rounded-[14px]'
        )}
      >
        <Image src={PHOTOS[photo]} alt="" fill sizes="200px" className="object-cover" />
        {children}
      </div>
    </div>
  );
}

/** Slide 1 — three caption looks fanned out like cards in a hand. */
export function LooksStack() {
  return (
    <>
      <Glow top={210} />
      <LookCard name="Street" photo="friends" tone="bg-acid-look-street text-white" className="left-5.5 top-37.5 -rotate-13">
        <div className="absolute inset-x-0 bottom-3.5 flex justify-center gap-1 font-acid-caption-street text-xs font-bold uppercase">
          <span className="text-acid-accent">say</span>
          <span className="rounded-[3px] bg-acid-error px-1 text-white">it</span>
        </div>
      </LookCard>
      <LookCard name="Cinema" photo="podcast" tone="bg-acid-look-cinema text-[#1a1206]" className="left-49 top-14.5 rotate-11">
        <div className="absolute inset-x-0 bottom-3 text-center font-acid-serif text-lg text-white italic [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
          once, clearly
        </div>
      </LookCard>
      <LookCard
        name="Hype"
        photo="cafe"
        big
        tone="bg-acid-accent text-acid-on-accent shadow-[0_34px_70px_rgb(0_0_0/0.65),inset_0_0_0_1.5px_rgb(255_255_255/0.45)]"
        className="left-25 top-28 -rotate-3"
      >
        <div className="absolute inset-0 bg-acid-bg-base/18" />
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.25 font-acid-caption-bold text-[15px] font-extrabold text-white uppercase [text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">
          <span>ship</span>
          <span className="rounded-[5px] bg-acid-bg-base px-1.5 py-px text-acid-accent [text-shadow:none]">it</span>
        </div>
      </LookCard>
    </>
  );
}

const WAVE = [10, 18, 30, 14, 26, 8, 22, 34, 48, 40, 28, 16, 24, 12, 30, 20, 8, 18];
const LIT = new Set([7, 8, 9, 10]);

function SideWord({ children, side }: { children: string; side: 'left' | 'right' }) {
  return (
    <div
      className={cn(
        'absolute flex h-21 items-center rounded-[22px] bg-acid-tile px-5.5 font-acid-caption-bold text-3xl font-extrabold text-acid-text-1/50 uppercase',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_6px_0_var(--acid-tile-lip)]',
        side === 'left' ? '-left-11.5 top-44 -rotate-8' : '-right-14.5 top-46.5 rotate-8'
      )}
    >
      {children}
    </div>
  );
}

/** Slide 2 — one word lit at the moment it is spoken, with its timestamp. */
export function WordShowcase() {
  return (
    <>
      <Glow top={220} strength={20} />
      <SideWord side="left">feels</SideWord>
      <SideWord side="right">because</SideWord>
      <div className="absolute top-26 left-1/2 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-acid-text-1/14 bg-acid-text-1/8 px-3 font-acid-mono text-[13px] whitespace-nowrap text-acid-text-2">
        <span className="h-1.5 w-1.5 rounded-full bg-acid-accent" />
        00:16.24 → 00:16.71
      </div>
      <div
        className={cn(
          'absolute top-40 left-1/2 flex h-33 -translate-x-1/2 -rotate-3 items-center rounded-[34px] px-8.5',
          'bg-[linear-gradient(180deg,#d8ff6e_0%,var(--acid-accent)_45%,#a9e020_100%)]',
          'shadow-[inset_0_2px_0_rgb(255_255_255/0.7),inset_0_-3px_0_rgb(0_0_0/0.12),0_10px_0_var(--acid-accent-lip),0_40px_80px_color-mix(in_srgb,var(--acid-accent)_25%,transparent)]',
          'font-acid-caption-bold text-6xl font-extrabold tracking-tight text-acid-on-accent uppercase'
        )}
      >
        ready
      </div>
      <div aria-hidden="true" className="absolute top-86.5 right-10 left-10 flex h-12.5 items-center gap-0.75">
        {WAVE.map((h, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-sm', LIT.has(i) ? 'bg-acid-accent' : 'bg-acid-text-1/20')}
            style={{ height: h }}
          />
        ))}
      </div>
    </>
  );
}

function Bubble({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={cn('absolute flex items-center justify-center overflow-hidden rounded-full', className)}>
      {children}
    </div>
  );
}

/** The Ordio mark on a paper app tile. Shared with the sign-up screens. */
export function MarkTile({ className, markWidth }: { className?: string; markWidth: number }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-[linear-gradient(160deg,#ffffff_0%,#edeee6_60%,#dcddd3_100%)]',
        'shadow-[inset_0_2px_0_#ffffff,inset_0_-3px_0_rgb(0_0_0/0.08),0_16px_40px_rgb(0_0_0/0.6)]',
        className
      )}
    >
      <OrdioMark motion="still" size={markWidth} className="text-acid-on-accent" />
    </div>
  );
}

/** Slide 3 — the mark on a pillar, the places a video goes orbiting it. */
export function Destinations() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute top-37.5 left-1/2 h-75 w-32 -translate-x-1/2 rounded-t-[30px] bg-[linear-gradient(180deg,#34362f_0%,#1b1c18_55%,transparent_100%)]"
      />
      <MarkTile markWidth={88} className="absolute top-35 left-1/2 h-29 w-29 -translate-x-1/2 rounded-[30px]" />
      <Bubble className="top-7.5 left-17.5 h-22 w-22 border-3 border-[#1b1c18] shadow-[0_16px_40px_rgb(0_0_0/0.5)]">
        <Image src={PHOTOS.cafe} alt="" fill sizes="88px" className="object-cover" />
      </Bubble>
      <Bubble className="top-30 right-5.5 h-18.5 w-18.5 border-3 border-[#1b1c18] shadow-[0_16px_40px_rgb(0_0_0/0.5)]">
        <Image src={PHOTOS.friends} alt="" fill sizes="74px" className="object-cover" />
      </Bubble>
      <Bubble className="top-50 left-8.5 h-18 w-18 bg-acid-accent font-acid-mono text-[17px] font-medium text-acid-on-accent shadow-[0_5px_0_var(--acid-accent-lip),0_16px_40px_rgb(0_0_0/0.5)]">
        9:16
      </Bubble>
      <Bubble className="top-72.5 right-21.5 h-14.5 w-14.5 border-3 border-[#1b1c18] opacity-80">
        <Image src={PHOTOS.podcast} alt="" fill sizes="58px" className="object-cover" />
      </Bubble>
      <Bubble className="top-9 right-7.5 h-14 w-14 bg-acid-tile font-acid-mono text-sm text-acid-text-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
        1:1
      </Bubble>
      <Bubble className="top-82.5 left-27.5 h-12.5 w-12.5 bg-acid-tile font-acid-mono text-[13px] text-acid-text-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
        4:5
      </Bubble>
    </>
  );
}

export const ONBOARDING_ART = [LooksStack, WordShowcase, Destinations] as const;
