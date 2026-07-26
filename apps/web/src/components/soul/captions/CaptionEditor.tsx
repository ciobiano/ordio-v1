'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProcessingStore, useUIStore } from '@/stores';
import { getCaptionStylePreset } from '@Ordio/engine';
import type { UseAudioTrimmerReturn } from '@/hooks/audio/useAudioTrimmer';
import { CaptionEditorHeader } from './editor/CaptionEditorHeader';
import { CaptionEditorRow } from './editor/CaptionEditorRow';
import { useCaptionEditorShortcuts } from './editor/useCaptionEditorShortcuts';

interface CaptionEditorProps {
  currentTime: number;
  onSeek?: (time: number) => void;
  isTranscribing?: boolean;
  trimmer?: UseAudioTrimmerReturn;
}

export default function CaptionEditor({ currentTime, onSeek, isTranscribing }: CaptionEditorProps) {
  const transcript = useProcessingStore((state) => state.transcript);
  const captionGroups = useProcessingStore((state) => state.captionGroups);
  const selectedGroupIndices = useProcessingStore((state) => state.selectedGroupIndices);
  const captionUndoStack = useProcessingStore((state) => state.captionUndoStack);
  const captionRedoStack = useProcessingStore((state) => state.captionRedoStack);
  const splitAtWord = useProcessingStore((state) => state.splitAtWord);
  const splitAtTime = useProcessingStore((state) => state.splitAtTime);
  const mergeUpAtCursor = useProcessingStore((state) => state.mergeUpAtCursor);
  const mergeDownAtCursor = useProcessingStore((state) => state.mergeDownAtCursor);
  const selectGroup = useProcessingStore((state) => state.selectGroup);
  const clearSelection = useProcessingStore((state) => state.clearSelection);
  const undoCaptions = useProcessingStore((state) => state.undoCaptions);
  const redoCaptions = useProcessingStore((state) => state.redoCaptions);
  const toggleAccentWord = useProcessingStore((state) => state.toggleAccentWord);
  const captionStyleId = useUIStore((state) => state.style.captionStyleId);
  const supportsAccent = getCaptionStylePreset(captionStyleId).fontTreatment === 'accent-swap';

  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const groupRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const selectedGroupIdx = selectedGroupIndices.length > 0
    ? selectedGroupIndices[selectedGroupIndices.length - 1]
    : null;

  const canUndo = captionUndoStack.length > 0;
  const canRedo = captionRedoStack.length > 0;
  const canSplit = selectedGroupIdx !== null && captionGroups[selectedGroupIdx]?.wordIndices.length >= 2;
  const canMergeUp = selectedGroupIdx !== null && selectedGroupIdx > 0;
  const canMergeDown = selectedGroupIdx !== null && selectedGroupIdx < captionGroups.length - 1;

  useCaptionEditorShortcuts({ clearSelection, undoCaptions, redoCaptions });

  useEffect(() => {
    const activeIndex = captionGroups.findIndex(
      (group) => currentTime >= group.start && currentTime < group.end
    );
    if (activeIndex < 0) return;
    groupRefs.current.get(activeIndex)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [captionGroups, currentTime]);

  useEffect(() => {
    setCursorPosition(null);
  }, [selectedGroupIdx]);

  const setGroupRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) {
      groupRefs.current.set(idx, el);
      return;
    }
    groupRefs.current.delete(idx);
  }, []);

  const handleSplit = useCallback(() => {
    if (selectedGroupIdx === null) return;
    if (cursorPosition !== null) {
      splitAtWord(selectedGroupIdx, cursorPosition);
      setCursorPosition(null);
      return;
    }
    splitAtTime(selectedGroupIdx, currentTime);
  }, [currentTime, cursorPosition, selectedGroupIdx, splitAtTime, splitAtWord]);

  const handleMergeUp = useCallback(() => {
    if (selectedGroupIdx === null || selectedGroupIdx <= 0) return;
    mergeUpAtCursor(selectedGroupIdx, cursorPosition);
    setCursorPosition(null);
  }, [cursorPosition, mergeUpAtCursor, selectedGroupIdx]);

  const handleMergeDown = useCallback(() => {
    if (selectedGroupIdx === null || selectedGroupIdx >= captionGroups.length - 1) return;
    mergeDownAtCursor(selectedGroupIdx, cursorPosition);
    setCursorPosition(null);
  }, [captionGroups.length, cursorPosition, mergeDownAtCursor, selectedGroupIdx]);

  const handleSelectGroup = useCallback((groupIndex: number, startTime: number) => {
    selectGroup(groupIndex, false);
    onSeek?.(startTime);
  }, [onSeek, selectGroup]);

  const rows = useMemo(() => captionGroups.map((group, groupIndex) => {
    const isActive = currentTime >= group.start && currentTime < group.end;
    const isSelected = selectedGroupIdx === groupIndex;

    return (
      <CaptionEditorRow
        key={groupIndex}
        group={group}
        groupIndex={groupIndex}
        isActive={isActive}
        isSelected={isSelected}
        transcript={transcript}
        cursorPosition={cursorPosition}
        supportsAccent={supportsAccent}
        onSelect={handleSelectGroup}
        onToggleCursor={(positionInGroup) => {
          setCursorPosition((prev) => (prev === positionInGroup ? null : positionInGroup));
        }}
        onToggleAccent={(positionInGroup) => toggleAccentWord(groupIndex, positionInGroup)}
        setGroupRef={setGroupRef}
      />
    );
  }), [captionGroups, currentTime, cursorPosition, handleSelectGroup, selectedGroupIdx, setGroupRef, supportsAccent, toggleAccentWord, transcript]);

  if (isTranscribing) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-sm text-muted-foreground">Transcribing audio…</p>
        <p className="text-xs text-muted-foreground/60">This may take a moment</p>
      </div>
    );
  }

  if (!transcript || transcript.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-sm text-muted-foreground">No captions available</p>
        <p className="text-xs text-muted-foreground/60">
          Check microphone permissions or try again
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Caption editor"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <CaptionEditorHeader
        canUndo={canUndo}
        canRedo={canRedo}
        selectedGroupIdx={selectedGroupIdx}
        cursorPosition={cursorPosition}
        canSplit={canSplit}
        canMergeUp={canMergeUp}
        canMergeDown={canMergeDown}
        onUndo={undoCaptions}
        onRedo={redoCaptions}
        onSplit={handleSplit}
        onMergeUp={handleMergeUp}
        onMergeDown={handleMergeDown}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col py-1" role="list">
          {rows}
        </div>
      </div>
    </div>
  );
}

