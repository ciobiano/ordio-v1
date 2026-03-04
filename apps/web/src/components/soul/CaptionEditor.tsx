'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { panelCard } from '@/lib/variants';
import { useStore } from '@/lib/store';
import type { Word } from '@Ordio/shared/schemas';

const WORDS_PER_PHRASE = 6;

const chip = cva(
  'inline-flex items-center rounded-md text-sm border transition-all duration-100 cursor-pointer select-none outline-none min-h-[44px]',
  {
    variants: {
      active: {
        true: 'bg-blue-500/20 border-blue-500/40 text-white px-2.5 py-1',
        false:
          'bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.08] px-2.5 py-1',
      },
      focused: {
        true: 'ring-1 ring-blue-400/60',
        false: '',
      },
    },
    defaultVariants: { active: false, focused: false },
  }
);

interface CaptionEditorProps {
  currentTime: number;
  onSeek?: (time: number) => void;
}

export default function CaptionEditor({ currentTime, onSeek }: CaptionEditorProps) {
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
    if (editingIndex !== null) return; // don't scroll while editing
    const activeIdx = transcript.findIndex(
      (w) => currentTime >= w.start && currentTime < w.end
    );
    if (activeIdx < 0) return;
    const el = chipRefs.current.get(activeIdx);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentTime, transcript, editingIndex]);

  // Single click → seek
  const handleChipClick = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      onSeek?.(transcript[index].start);
    },
    [transcript, onSeek]
  );

  // Double click → edit
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
      // Update word text
      const updated: Word[] = transcript.map((w, i) =>
        i === editingIndex ? { ...w, text: trimmed } : w
      );
      setTranscript(updated);
    } else {
      // Delete word (empty text)
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

  // Keyboard navigation on the container
  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingIndex !== null) return; // don't navigate while editing
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
    if (el) {
      chipRefs.current.set(index, el);
    } else {
      chipRefs.current.delete(index);
    }
  }, []);

  if (transcript.length === 0) {
    return (
      <div
        role="region"
        className={cn(panelCard, 'w-full px-4 py-5 flex items-center justify-center min-h-[4.5rem]')}
        aria-label="Caption editor — empty"
      >
        <p className="text-white/50 text-sm">No transcript yet</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      className={cn(panelCard, 'w-full px-4 py-4')}
      aria-label="Caption editor"
      onKeyDown={handleContainerKeyDown}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-[0.625rem] uppercase tracking-[0.18em]">
          Transcript — click to seek, double-click to edit
        </p>
        {transcriptionSource && (
          <span
            className={cn(
              'text-[0.5625rem] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded font-medium',
              transcriptionSource === 'whisper'
                ? 'bg-green-500/15 text-green-400/80'
                : 'bg-yellow-500/15 text-yellow-400/80'
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
                  <span className="w-px h-5 bg-white/[0.12] mx-1 shrink-0" aria-hidden="true" />
                )}
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  aria-label={`Edit word: ${word.text}`}
                  className="px-2 py-0.5 rounded-md text-sm border
                             bg-blue-500/20 border-blue-500/60 text-white
                             outline-none min-w-[2rem] max-w-[12rem]"
                  style={{ width: `${Math.max(editValue.length, 3) * 0.6 + 1}rem` }}
                  autoFocus
                />
              </li>
            );
          }

          return (
            <li key={i} className="inline-flex items-center">
              {showSeparator && (
                <span className="w-px h-5 bg-white/[0.12] mx-1 shrink-0" aria-hidden="true" />
              )}
              <button
                ref={(el) => setChipRef(i, el)}
                tabIndex={isTabStop ? 0 : -1}
                onClick={() => handleChipClick(i)}
                onDoubleClick={() => handleChipDoubleClick(i)}
                onFocus={() => setFocusedIndex(i)}
                aria-label={`Word: ${word.text} at ${word.start.toFixed(1)}s${active ? ' (active)' : ''}`}
                className={cn(chip({ active, focused: isFocused }))}
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
