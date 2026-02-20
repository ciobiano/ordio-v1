'use client';

import { useState, useRef, useCallback } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import type { Word } from '@Ordio/shared/schemas';

const chip = cva(
  'inline-flex items-center rounded-md text-sm border transition-all duration-100 cursor-pointer select-none',
  {
    variants: {
      active: {
        true: 'bg-blue-500/20 border-blue-500/40 text-white px-2 py-0.5',
        false:
          'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] px-2 py-0.5',
      },
    },
    defaultVariants: { active: false },
  }
);

interface CaptionEditorProps {
  currentTime: number;
}

export default function CaptionEditor({ currentTime }: CaptionEditorProps) {
  const transcript = useStore((s) => s.transcript);
  const setTranscript = useStore((s) => s.setTranscript);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = useCallback(
    (word: Word) => currentTime >= word.start && currentTime < word.end,
    [currentTime]
  );

  const handleChipClick = useCallback(
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
    }
    setEditingIndex(null);
  }, [editingIndex, editValue, transcript, setTranscript]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setEditingIndex(null);
    },
    [commitEdit]
  );

  if (transcript.length === 0) {
    return (
      <div
        className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.06]
                   px-4 py-5 flex items-center justify-center min-h-[4.5rem]"
        aria-label="Caption editor — empty"
      >
        <p className="text-white/25 text-sm">No transcript yet</p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-4"
      aria-label="Caption editor"
    >
      <p className="text-white/20 text-[0.625rem] uppercase tracking-[0.18em] mb-3">
        Transcript — click any word to edit
      </p>
      <div className="flex flex-wrap gap-1.5" role="list">
        {transcript.map((word, i) => {
          const active = isActive(word);

          if (editingIndex === i) {
            return (
              <input
                key={i}
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                aria-label={`Edit word: ${word.text}`}
                className="px-2 py-0.5 rounded-md text-sm border
                           bg-blue-500/20 border-blue-500/60 text-white
                           outline-none min-w-[2rem] max-w-[12rem]"
                style={{ width: `${Math.max(editValue.length, 3) * 0.6 + 1}rem` }}
                autoFocus
              />
            );
          }

          return (
            <button
              key={i}
              onClick={() => handleChipClick(i)}
              aria-label={`Word: ${word.text} at ${word.start.toFixed(1)}s${active ? ' (active)' : ''} — click to edit`}
              className={cn(chip({ active }))}
            >
              {word.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
