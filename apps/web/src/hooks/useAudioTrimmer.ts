'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Word } from '@Ordio/shared/schemas'

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

  const getTrimmedTranscript = useCallback(
    (transcript: Word[]): Word[] => {
      const kept = transcript.filter(
        (w, i) =>
          !deletedWordIndices.has(i) &&
          w.end > startTime &&
          w.start < endTime
      )

      // All time ranges removed before each word: deleted words + silence ranges
      const deletedWordRanges = transcript
        .map((w, i) => ({ ...w, index: i }))
        .filter((w) => deletedWordIndices.has(w.index))
        .sort((a, b) => a.start - b.start)

      const silenceRanges = Array.from(deletedSilenceRanges.values())
        .sort((a, b) => a.start - b.start)

      return kept.map((word) => {
        const wordDeletedBefore = deletedWordRanges
          .filter((d) => d.end <= word.start)
          .reduce((sum, d) => sum + (d.end - d.start), 0)

        const silenceDeletedBefore = silenceRanges
          .filter((r) => r.end <= word.start)
          .reduce((sum, r) => sum + (r.end - r.start), 0)

        const headTrim = startTime

        return {
          ...word,
          start: word.start - headTrim - wordDeletedBefore - silenceDeletedBefore,
          end: word.end - headTrim - wordDeletedBefore - silenceDeletedBefore,
        }
      })
    },
    [startTime, endTime, deletedWordIndices, deletedSilenceRanges]
  )

  const getTrimmedAudio = useCallback(
    (audioBuffer: AudioBuffer, transcript: Word[]): Float32Array[] => {
      const { sampleRate, numberOfChannels } = audioBuffer
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)

      // Merge word-based and silence-based deleted ranges
      const wordDeletedRanges = transcript
        .map((w, i) => ({ ...w, index: i }))
        .filter((w) => deletedWordIndices.has(w.index))
        .map((w) => ({
          start: Math.floor(w.start * sampleRate),
          end: Math.floor(w.end * sampleRate),
        }))

      const silenceDeletedRanges = Array.from(deletedSilenceRanges.values()).map((r) => ({
        start: Math.floor(r.start * sampleRate),
        end: Math.floor(r.end * sampleRate),
      }))

      const allDeletedRanges = [...wordDeletedRanges, ...silenceDeletedRanges].sort(
        (a, b) => a.start - b.start
      )

      const keptRanges: Array<{ start: number; end: number }> = []
      let cursor = startSample
      for (const del of allDeletedRanges) {
        if (del.end <= startSample || del.start >= endSample) continue
        const delStart = Math.max(del.start, startSample)
        const delEnd = Math.min(del.end, endSample)
        if (cursor < delStart) {
          keptRanges.push({ start: cursor, end: delStart })
        }
        // Never move cursor backward (handles overlapping ranges)
        cursor = Math.max(cursor, delEnd)
      }
      if (cursor < endSample) {
        keptRanges.push({ start: cursor, end: endSample })
      }

      const totalSamples = keptRanges.reduce((sum, r) => sum + (r.end - r.start), 0)
      const channels: Float32Array[] = []
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const source = audioBuffer.getChannelData(ch)
        const output = new Float32Array(totalSamples)
        let offset = 0
        for (const range of keptRanges) {
          const segment = source.subarray(range.start, range.end)
          output.set(segment, offset)
          offset += segment.length
        }
        channels.push(output)
      }
      return channels
    },
    [startTime, endTime, deletedWordIndices, deletedSilenceRanges]
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
