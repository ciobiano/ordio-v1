'use client';

/**
 * The canvas. Everything the inspector changes lands here live.
 *
 * This is a DOM preview, not the export renderer — `lib/frameRenderer.ts`
 * still owns the pixels that ship. Keeping them separate is deliberate: the
 * preview can use real fonts and CSS text-wrap, which is what makes the
 * caption line-breaking legible while you edit it.
 */

import { useMemo } from 'react';
import type { Word } from '@Ordio/shared';
import { buildSegmentsForMode } from '@Ordio/engine/captions/breaks';
import type { DeskState } from '@/lib/desktop/deskState';
import { FONTS, RATIO, SAFE } from '@/lib/desktop/deskCatalog';
import { useDeskFonts } from '@/lib/desktop/useDeskFonts';

interface PlayerStageProps {
  state: DeskState;
  words: Word[];
  activeWordIndex: number;
  onShowCaptions: () => void;
}

const BAR_COUNT = 40;

export function PlayerStage({
  state,
  words,
  activeWordIndex,
  onShowCaptions,
}: PlayerStageProps) {
  useDeskFonts([state.font]);

  const [rw, rh] = RATIO[state.format];
  const safe = SAFE[state.safe];
  const fontFamily =
    FONTS.find((f) => f.name === state.font)?.family ?? 'sans-serif';

  /* The engine owns break logic — `punct` there is punctuation *and* weighted
     speech pauses, and `random` is seeded from the transcript so it never
     reflows under the user. Segments carry indices, so the active-word lookup
     below is an index compare rather than an identity search. */
  const lines = useMemo(
    () =>
      buildSegmentsForMode(words, {
        mode: state.breakMode,
        quantity: state.breakQty,
        holdSeconds: state.breakSecs,
      }).map((segment) => ({
        words: words.slice(segment.startIndex, segment.endIndex),
        startIndex: segment.startIndex,
      })),
    [words, state.breakMode, state.breakQty, state.breakSecs]
  );

  /** Deterministic bar heights — a preview, not an analyser read. */
  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        const wave = Math.sin(i * 0.7) * 0.5 + Math.sin(i * 1.9) * 0.3;
        return 24 + Math.abs(wave) * 76;
      }),
    []
  );

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div
          className="relative flex-none overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
          style={{
            aspectRatio: `${rw} / ${rh}`,
            height: 'min(100%, 640px)',
            background: state.bgColor,
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_100%,rgba(6,6,6,0.5),rgba(6,6,6,0)_62%)]" />

          {!state.capHidden && lines.length > 0 && (
            <div
              className="pointer-events-none absolute inset-0 flex justify-center p-[9%]"
              style={{
                alignItems:
                  state.vAlign === 'top'
                    ? 'flex-start'
                    : state.vAlign === 'bottom'
                      ? 'flex-end'
                      : 'center',
              }}
            >
              <div
                className="w-full rounded-xl font-bold [text-wrap:pretty]"
                style={{
                  fontFamily,
                  fontSize: `${state.fontSize / 8}cqw`,
                  lineHeight: state.lineHeight,
                  letterSpacing: `${state.charSpacing}em`,
                  textAlign: state.align,
                  textTransform: state.capCase === 'none' ? 'none' : state.capCase,
                  color: state.textColor,
                  background: state.capBgOn ? state.captionBg : 'transparent',
                  padding: state.capBgOn ? '0.3em 0.5em' : undefined,
                  WebkitTextStroke: state.strokeW
                    ? `${state.strokeW}px ${state.strokeColor}`
                    : undefined,
                  /* Halo in the text's own colour — a glow that introduces a
                     second hue reads as a drop shadow, not as light. */
                  textShadow: state.glow
                    ? `0 0 ${state.glow * 0.5}em ${state.textColor}`
                    : undefined,
                }}
              >
                {lines.map((line, li) => (
                  <div key={li} className="block">
                    {line.words.map((word, wi) => {
                      const flat = line.startIndex + wi;
                      const isActive = flat === activeWordIndex;
                      return (
                        <span
                          key={`${li}-${wi}`}
                          className="rounded-xl"
                          style={{
                            color: isActive ? state.activeWordColor : undefined,
                            background:
                              isActive && state.activeBgOn
                                ? state.activeWordBg
                                : undefined,
                            padding: isActive && state.activeBgOn ? '0.06em 0.22em' : undefined,
                          }}
                        >
                          {wi === 0 ? '' : ' '}
                          {word.text}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.visual === 'bars' && (
            <div className="pointer-events-none absolute right-[9%] bottom-[7%] left-[9%] flex h-[34px] items-center gap-1">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full"
                  style={{ background: state.waveColor, height: `${h}%` }}
                />
              ))}
            </div>
          )}

          {state.visual === 'orb' && (
            <div
              className="pointer-events-none absolute bottom-[9%] left-1/2 size-[72px] -translate-x-1/2 rounded-full opacity-90"
              style={{ background: state.waveColor }}
            />
          )}

          {state.visual === 'baseline' && (
            <div
              className="pointer-events-none absolute right-[9%] bottom-[9%] left-[9%] h-1 rounded-full"
              style={{ background: state.waveColor }}
            />
          )}

          {state.safeShow && state.safe !== 'none' && (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute right-[4%] left-[4%] rounded-xl border border-dashed border-[rgba(255,255,234,0.5)]"
                style={{ top: safe.top, bottom: safe.bottom }}
              />
              <div
                className="absolute inset-x-0 top-0 bg-[rgba(255,0,102,0.14)]"
                style={{ height: safe.top }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-[rgba(255,0,102,0.14)]"
                style={{ height: safe.bottom }}
              />
              <span className="ord-mono absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-xl bg-[rgba(6,6,6,0.7)] px-2 py-1 ord-type-micro text-[var(--ord-paper)]">
                {safe.label}
              </span>
            </div>
          )}

          <div className="ord-mono pointer-events-none absolute top-2 right-2 rounded-xl bg-[rgba(6,6,6,0.66)] px-2 py-1 ord-type-micro text-[var(--ord-paper)]">
            {rw}:{rh}
          </div>

          {state.capHidden && (
            <button
              type="button"
              onClick={onShowCaptions}
              className="absolute right-2 bottom-2 cursor-pointer rounded-xl border-0 bg-[var(--ord-acid)] px-3 py-2 ord-type-footnote font-bold text-[var(--ord-ink)]"
            >
              Show captions
            </button>
          )}
        </div>
    </div>
  );
}
