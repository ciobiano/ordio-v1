'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { captionRow, formatTimestamp } from './shared';

type TranscriptWord = { text: string };
type CaptionGroup = {
  start: number;
  end: number;
  text: string;
  wordIndices: number[];
  accentWordIndices?: number[];
};

type CaptionEditorRowProps = {
  group: CaptionGroup;
  groupIndex: number;
  isActive: boolean;
  isSelected: boolean;
  transcript: TranscriptWord[];
  cursorPosition: number | null;
  /** Whether the active caption style honors accent words (word-pop, big-statement, script-accent) — hides the toggle affordance for styles that ignore it. */
  supportsAccent: boolean;
  onSelect: (groupIndex: number, startTime: number) => void;
  onToggleCursor: (positionInGroup: number) => void;
  onToggleAccent: (positionInGroup: number) => void;
  setGroupRef: (idx: number, el: HTMLDivElement | null) => void;
};

export function CaptionEditorRow({
  group,
  groupIndex,
  isActive,
  isSelected,
  transcript,
  cursorPosition,
  supportsAccent,
  onSelect,
  onToggleCursor,
  onToggleAccent,
  setGroupRef,
}: CaptionEditorRowProps) {
  const rowState = isActive ? 'active' : isSelected ? 'selected' : 'idle';

  return (
    <div role="listitem">
      <div
        ref={(el) => setGroupRef(groupIndex, el)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(groupIndex, group.start);
          }
        }}
        onClick={() => onSelect(groupIndex, group.start)}
        aria-label={`Caption at ${formatTimestamp(group.start)}: ${group.text}`}
        aria-pressed={isSelected}
        className={captionRow({ state: rowState })}
      >
        <div className="flex items-center gap-1.5 shrink-0 self-start pt-0.5">
          <HugeiconsIcon
            icon={PlayIcon}
            size={11}
            className={cn('transition-colors', isActive ? 'text-primary' : 'text-muted-foreground/40')}
            aria-hidden="true"
          />
          <span className="text-xs tabular-nums text-muted-foreground font-mono w-10">
            {formatTimestamp(group.start)}
          </span>
        </div>

        <span className="flex-1 text-sm leading-relaxed">
          {isSelected ? (
            <span className="flex flex-wrap items-baseline gap-x-0 gap-y-1">
              {group.wordIndices.map((wordIndex, positionInGroup) => {
                const word = transcript[wordIndex];
                if (!word) return null;
                const isCursorHere = cursorPosition === positionInGroup;
                const isAccented = group.accentWordIndices?.includes(positionInGroup) ?? false;

                return (
                  <span key={wordIndex} className="inline-flex items-baseline">
                    {positionInGroup > 0 && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleCursor(positionInGroup);
                        }}
                        aria-label={`Place split cursor before ${word.text}`}
                        className="inline-flex items-center justify-center w-4 h-5 cursor-text select-none outline-none group/cursor"
                      >
                        {isCursorHere ? (
                          <span
                            className="inline-block w-0.5 h-4 rounded-full bg-primary animate-caret-blink"
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className="inline-block w-0.5 h-3 rounded-full bg-transparent group-hover/cursor:bg-white/20 transition-colors"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    )}

                    {supportsAccent ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleAccent(positionInGroup);
                        }}
                        aria-pressed={isAccented}
                        aria-label={`${isAccented ? 'Remove' : 'Mark'} accent on "${word.text}"`}
                        className={cn(
                          'rounded-md px-0.5 text-sm transition-colors',
                          isAccented
                            ? 'bg-primary/20 text-primary'
                            : isCursorHere
                              ? 'text-foreground'
                              : 'text-foreground/80'
                        )}
                      >
                        {word.text}
                      </button>
                    ) : (
                      <span className={cn('text-sm', isCursorHere ? 'text-foreground' : 'text-foreground/80')}>
                        {word.text}
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
          ) : (
            group.text
          )}
        </span>
      </div>
    </div>
  );
}

