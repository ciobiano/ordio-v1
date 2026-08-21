'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Word } from '@Ordio/shared/schemas'
import {
  keptSampleRanges,
  shiftTranscript,
  sliceChannels,
  type TrimPlan,
} from '@/lib/audio/trimGeometry'

interface TrimState {
  startTime: number
  endTime: number
  deletedWordIndices: Set<number>
}

interface SilenceRange {
  start: number
  end: number
}

export interface UseAudioTrimmerReturn {
  trimState: TrimState
  setStartTime: (t: number) => void
  setEndTime: (t: number) => void
  toggleWordDeletion: (index: number) => void
  toggleSilenceRange: (id: string, range: SilenceRange) => void
  deletedSilenceRanges: Map<string, SilenceRange>
  clearDeletions: () => void
  resetAll: (newDuration: number) => void
  getTrimmedAudio: (audioBuffer: AudioBuffer, transcript: Word[]) => Float32Array[]
  getTrimmedTranscript: (transcript: Word[]) => Word[]
  hasChanges: boolean
  isEmpty: boolean
}

export function useAudioTrimmer(duration: number): UseAudioTrimmerReturn {
  const [startTime, setStartTimeRaw] = useState(0)
  const [endTime, setEndTimeRaw] = useState(duration)
  const [deletedWordIndices, setDeletedWordIndices] = useState<Set<number>>(() => new Set())
  const [deletedSilenceRanges, setDeletedSilenceRanges] = useState<Map<string, SilenceRange>>(
    () => new Map()
  )

  // When duration loads (starts at 0, then becomes the real value), sync endTime.
  // Only updates endTime if it hasn't been manually moved away from 0.
  useEffect(() => {
    if (duration > 0) {
      setEndTimeRaw((prev) => (prev === 0 ? duration : Math.min(prev, duration)))
    }
  }, [duration])

  const setStartTime = useCallback(
    (t: number) => setStartTimeRaw(Math.max(0, Math.min(t, duration))),
    [duration]
  )

  const setEndTime = useCallback(
    (t: number) => setEndTimeRaw(Math.max(0, Math.min(t, duration))),
    [duration]
  )

  const toggleWordDeletion = useCallback((index: number) => {
    setDeletedWordIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const toggleSilenceRange = useCallback((id: string, range: SilenceRange) => {
    setDeletedSilenceRanges((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, range)
      return next
    })
  }, [])

  const clearDeletions = useCallback(() => {
    setDeletedWordIndices(new Set())
    setDeletedSilenceRanges(new Map())
  }, [])

  // Called after committing cuts to a new buffer — resets all state to the new full duration
  const resetAll = useCallback((newDuration: number) => {
    setStartTimeRaw(0)
    setEndTimeRaw(newDuration)
    setDeletedWordIndices(new Set())
    setDeletedSilenceRanges(new Map())
  }, [])

  const planFor = useCallback(
    (transcript: Word[]): TrimPlan => ({
      startTime,
      endTime,
      deletedRanges: [
        ...transcript
          .map((w, i) => ({ start: w.start, end: w.end, index: i }))
          .filter((w) => deletedWordIndices.has(w.index))
          .map(({ start, end }) => ({ start, end })),
        ...Array.from(deletedSilenceRanges.values()).map((r) => ({ start: r.start, end: r.end })),
      ],
    }),
    [startTime, endTime, deletedWordIndices, deletedSilenceRanges]
  )

  const getTrimmedTranscript = useCallback(
    (transcript: Word[]): Word[] => shiftTranscript(planFor(transcript), transcript),
    [planFor]
  )

  const getTrimmedAudio = useCallback(
    (audioBuffer: AudioBuffer, transcript: Word[]): Float32Array[] =>
      sliceChannels(
        audioBuffer,
        keptSampleRanges(planFor(transcript), audioBuffer.sampleRate)
      ),
    [planFor]
  )

  const trimState: TrimState = useMemo(
    () => ({ startTime, endTime, deletedWordIndices }),
    [startTime, endTime, deletedWordIndices]
  )

  const hasChanges =
    startTime > 0 ||
    endTime < duration ||
    deletedWordIndices.size > 0 ||
    deletedSilenceRanges.size > 0
  const isEmpty = startTime >= endTime

  return {
    trimState,
    setStartTime,
    setEndTime,
    toggleWordDeletion,
    toggleSilenceRange,
    deletedSilenceRanges,
    clearDeletions,
    resetAll,
    getTrimmedAudio,
    getTrimmedTranscript,
    hasChanges,
    isEmpty,
  }
}
