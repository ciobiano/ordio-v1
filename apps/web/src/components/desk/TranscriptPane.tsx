'use client';

/**
 * Transcript — the left column's second state, reached by choosing a clip.
 *
 * The selected row expands into per-word chips: click a word to emphasise it,
 * click the caret between two words to place the split cursor.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { chip, iconButton, listRow, wordChip } from '@/lib/desk/deskVariants';
import type { DeskLine } from '@/lib/desk/deskState';
import { SearchGlyph } from './DeskIcons';

interface TranscriptPaneProps {
  lines: DeskLine[];
  selRow: number;
  cursor: number | null;
  accents: number[];
  t: number;
  findOpen: boolean;
  findText: string;
  replaceWith: string;
  copied: boolean;
  onSelectRow: (row: number) => void;
  onSetCursor: (index: number | null) => void;
  onToggleAccent: (flatIndex: number) => void;
  onToggleFind: () => void;
  onFindText: (value: string) => void;
  onReplaceWith: (value: string) => void;
  onReplaceAll: () => void;
  onAutoHighlight: () => void;
  onSplit: () => void;
  onMerge: (direction: 'up' | 'down') => void;
  onCopy: () => void;
}

function timeLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TranscriptPane(props: TranscriptPaneProps) {
  const { lines, selRow, cursor, accents, t, findText } = props;

  /** Running offset so a row's local word index maps to a document-wide one. */
  const rowOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const line of lines) {
      offsets.push(running);
      running += line.words.length;
    }
    return offsets;
  }, [lines]);

  const totalWords = rowOffsets.length > 0
    ? rowOffsets[rowOffsets.length - 1] + lines[lines.length - 1].words.length
    : 0;

  const findCount = useMemo(() => {
    const needle = findText.trim().toLowerCase();
    if (!needle) return 0;
    return lines.reduce(
      (sum, l) => sum + l.words.filter((w) => w.text.toLowerCase() === needle).length,
      0
    );
  }, [lines, findText]);

  const rowSelected = lines[selRow];
  const canSplit = cursor !== null && rowSelected
    ? cursor > 0 && cursor < rowSelected.words.length
    : false;

  return (
    <>
      <div className="flex flex-none items-center justify-between gap-2.5 px-4 pt-3.5 pb-2.5">
        <span className="ord-eyebrow">Transcript</span>
        <span className="flex gap-1">
          <button
            type="button"
            title="Find and replace · ⌘F"
            onClick={props.onToggleFind}
            className={iconButton({
              tone: props.findOpen ? 'active' : 'outline',
              size: 'sm',
            })}
          >
            <SearchGlyph size={14} />
          </button>
          <button
            type="button"
            title="Auto-highlight the strong words"
            onClick={props.onAutoHighlight}
            className={chip({ size: 'sm' })}
          >
            Auto-highlight
          </button>
        </span>
      </div>

      {props.findOpen && (
        <div className="flex flex-none flex-col gap-[7px] px-4 pb-3">
          <div className="flex gap-[7px]">
            <input
              type="text"
              value={findText}
              onChange={(e) => props.onFindText(e.target.value)}
              placeholder="Find a word"
              className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--ord-paper)]/6 px-2.5 ord-type-caption text-[var(--ord-paper)] outline-none"
            />
            <input
              type="text"
              value={props.replaceWith}
              onChange={(e) => props.onReplaceWith(e.target.value)}
              placeholder="Replace with"
              className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--ord-paper)]/6 px-2.5 ord-type-caption text-[var(--ord-paper)] outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={props.onReplaceAll}
              className="h-[30px] cursor-pointer rounded-lg border-0 bg-[var(--ord-paper)] px-3 ord-type-footnote font-bold text-[var(--ord-ink)]"
            >
              Replace all
            </button>
            <span className="ord-mono">
              {findCount} {findCount === 1 ? 'match' : 'matches'}
            </span>
          </div>
        </div>
      )}

      <div className="grid flex-none grid-cols-3 gap-1.5 px-4 pb-3">
        <button
          type="button"
          onClick={props.onSplit}
          disabled={!canSplit}
          title="Split at cursor · S"
          className={cn(chip({ size: 'md' }), 'justify-center disabled:opacity-40')}
        >
          Split
        </button>
        <button
          type="button"
          onClick={() => props.onMerge('up')}
          disabled={selRow === 0}
          className={cn(chip({ size: 'md' }), 'justify-center disabled:opacity-40')}
        >
          Merge ↑
        </button>
        <button
          type="button"
          onClick={() => props.onMerge('down')}
          disabled={selRow >= lines.length - 1}
          className={cn(chip({ size: 'md' }), 'justify-center disabled:opacity-40')}
        >
          Merge ↓
        </button>
      </div>

      <div
        data-scroll
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4"
      >
        {lines.map((line, row) => {
          const isSelected = row === selRow;
          const offset = rowOffsets[row];

          return (
            <div
              key={`${line.start}-${row}`}
              onClick={() => props.onSelectRow(row)}
              className={listRow({ selected: isSelected })}
            >
              <span className="ord-mono w-[30px] flex-none pt-[3px]">
                {timeLabel(line.start)}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                {isSelected ? (
                  <span className="flex flex-wrap items-center gap-px">
                    {line.words.map((word, i) => {
                      const flat = offset + i;
                      const isActive = t >= word.start && t < word.end;
                      const isAccent = accents.includes(flat);

                      return (
                        <span key={`${word.start}-${i}`} className="flex items-center">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onSetCursor(cursor === i ? null : i);
                            }}
                            className="flex h-[22px] w-2 cursor-pointer items-center justify-center"
                          >
                            <span
                              className={cn(
                                'h-4 w-0.5 rounded-sm',
                                cursor === i
                                  ? 'bg-[var(--ord-acid)]'
                                  : 'bg-transparent'
                              )}
                            />
                          </span>
                          <span
                            title="Click to emphasise"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onToggleAccent(flat);
                            }}
                            className={wordChip({
                              state: isActive ? 'active' : isAccent ? 'accent' : 'idle',
                            })}
                          >
                            {word.text}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span className="font-[family-name:var(--font-display)] ord-type-label leading-[1.45] text-[var(--text-body)]">
                    {line.words.map((w) => w.text).join(' ')}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-none items-center justify-between border-t border-[var(--border-hairline)] px-4 pt-2.5 pb-3">
        <span className="ord-mono">{totalWords} words</span>
        <button type="button" onClick={props.onCopy} className={chip({ size: 'sm' })}>
          {props.copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </>
  );
}
