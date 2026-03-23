'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import type { Word } from '@Ordio/shared/schemas';
import type { UseAudioTrimmerReturn } from '@/hooks/useAudioTrimmer';

const WORDS_PER_PHRASE = 6;

const chip = cva(
  'inline-flex items-center rounded-md text-sm border transition-all duration-100 cursor-pointer select-none outline-none min-h-[44px]',
  {
    variants: {
      active: {
        true:  'bg-accent border-border text-foreground px-2.5 py-1',
        false: 'bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.08] px-2.5 py-1',
      },
      focused: {
        true:  'ring-1 ring-white/40',
        false: '',
      },
    },
    defaultVariants: { active: false, focused: false },
  }
);

interface CaptionEditorProps {
  currentTime: number;
  onSeek?: (time: number) => void;
  isTranscribing?: boolean;
  trimmer?: UseAudioTrimmerReturn;
}

export default function CaptionEditor({ currentTime, onSeek, isTranscribing, trimmer }: CaptionEditorProps) {
  const transcript = useStore((s) => s.transcript);
  const setTranscript = useStore((s) => s.setTranscript);
  const transcriptionSource = useStore((s) => s.transcriptionSource);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = useCallback(
    (word: Word) => currentTime >= word.start && currentTime < word.end,
    [currentTime]
  );

  // Auto-scroll active word into view during playback
  useEffect(() => {
    if (editingIndex !== null) return;
    const activeIdx = transcript.findIndex((w) => currentTime >= w.start && currentTime < w.end);
    if (activeIdx < 0) return;
    const el = chipRefs.current.get(activeIdx);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentTime, transcript, editingIndex]);

  const handleChipClick = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      onSeek?.(transcript[index].start);
    },
    [transcript, onSeek]
  );

  const handleChipDoubleClick = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setEditValue(transcript[index].text);
      setTimeout(() => inputRef.current?.select(), 0);
    },
    [transcript]
  );

  const commitEdit = useCallback(() => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      const updated: Word[] = transcript.map((w, i) =>
        i === editingIndex ? { ...w, text: trimmed } : w
      );
      setTranscript(updated);
    } else {
      const updated = transcript.filter((_, i) => i !== editingIndex);
      setTranscript(updated);
    }
    setEditingIndex(null);
  }, [editingIndex, editValue, transcript, setTranscript]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setEditingIndex(null);
    },
    [commitEdit]
  );

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingIndex !== null) return;
      if (transcript.length === 0) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = focusedIndex === null ? 0 : Math.min(focusedIndex + 1, transcript.length - 1);
        setFocusedIndex(next);
        chipRefs.current.get(next)?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = focusedIndex === null ? 0 : Math.max(focusedIndex - 1, 0);
        setFocusedIndex(prev);
        chipRefs.current.get(prev)?.focus();
      } else if (e.key === 'Enter' && focusedIndex !== null) {
        e.preventDefault();
        handleChipDoubleClick(focusedIndex);
      }
    },
    [editingIndex, focusedIndex, transcript.length, handleChipDoubleClick]
  );

  const setChipRef = useCallback((index: number, el: HTMLButtonElement | null) => {
    if (el) chipRefs.current.set(index, el);
    else chipRefs.current.delete(index);
  }, []);

  if (isTranscribing) {
    return (
      <div className="py-6 text-center">
        <p className="text-muted-foreground text-sm">Transcribing...</p>
      </div>
    );
  }

  if (!transcript || transcript.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-muted-foreground text-sm">No captions available</p>
        <p className="text-muted-foreground text-xs mt-1">
          Check microphone permissions or try again
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Caption editor"
      onKeyDown={handleContainerKeyDown}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-xs uppercase tracking-[0.18em]">
          Transcript — click to seek, double-click to edit
        </p>
        {transcriptionSource && (
          <span
            className={cn(
              'text-xs uppercase tracking-[0.15em] px-1.5 py-0.5 rounded font-medium',
              transcriptionSource === 'whisper'
                ? 'bg-[--accent-green]/15 text-[--accent-green]/80'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {transcriptionSource === 'whisper' ? 'OpenAI Whisper' : 'Web Speech'}
          </span>
        )}
      </div>

      <ul className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto list-none p-0 m-0">
        {transcript.map((word, i) => {
          const active = isActive(word);
          const isFocused = focusedIndex === i;
          const isTabStop = isFocused || (focusedIndex === null && i === 0);
          const showSeparator = i > 0 && i % WORDS_PER_PHRASE === 0;

          if (editingIndex === i) {
            return (
              <li key={i} className="inline-flex items-center">
                {showSeparator && (
                  <span className="w-px h-5 bg-accent mx-1 shrink-0" aria-hidden="true" />
                )}
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  aria-label={`Edit word: ${word.text}`}
                  className="px-2 py-0.5 rounded-md text-sm border
                             bg-accent border-border text-white
                             outline-none min-w-8 max-w-48"
                  style={{ width: `${Math.max(editValue.length, 3) * 0.6 + 1}rem` }}
                  autoFocus
                />
              </li>
            );
          }

          const isDeleted = trimmer?.trimState.deletedWordIndices.has(i) ?? false;

          return (
            <li key={i} className="inline-flex items-center">
              {showSeparator && (
                <span className="w-px h-5 bg-accent mx-1 shrink-0" aria-hidden="true" />
              )}
              <button
                ref={(el) => setChipRef(i, el)}
                tabIndex={isTabStop ? 0 : -1}
                onClick={() => handleChipClick(i)}
                onDoubleClick={() => handleChipDoubleClick(i)}
                onFocus={() => setFocusedIndex(i)}
                aria-label={`Word: ${word.text} at ${word.start.toFixed(1)}s${active ? ' (active)' : ''}${isDeleted ? ' (deleted)' : ''}`}
                className={cn(
                  isDeleted
                    ? 'inline-flex items-center rounded-md text-sm border transition-all duration-100 cursor-pointer select-none outline-none min-h-11 px-2.5 py-1 bg-destructive/12 border-destructive/30 text-destructive line-through opacity-50'
                    : chip({ active, focused: isFocused })
                )}
              >
                {word.text}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
