'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Word } from '@Ordio/shared/schemas'

interface TrimState {
  startTime: number
  endTime: number
  deletedWordIndices: Set<number>
}

export interface UseAudioTrimmerReturn {
  trimState: TrimState
  setStartTime: (t: number) => void
  setEndTime: (t: number) => void
  toggleWordDeletion: (index: number) => void
  clearDeletions: () => void
  getTrimmedAudio: (audioBuffer: AudioBuffer, transcript: Word[]) => Float32Array[]
  getTrimmedTranscript: (transcript: Word[]) => Word[]
  hasChanges: boolean
  isEmpty: boolean
}

export function useAudioTrimmer(duration: number): UseAudioTrimmerReturn {
  const [startTime, setStartTimeRaw] = useState(0)
  const [endTime, setEndTimeRaw] = useState(duration)
  const [deletedWordIndices, setDeletedWordIndices] = useState<Set<number>>(
    () => new Set()
  )

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
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const clearDeletions = useCallback(() => {
    setDeletedWordIndices(new Set())
  }, [])

  const getTrimmedTranscript = useCallback(
    (transcript: Word[]): Word[] => {
      const kept = transcript.filter(
        (w, i) =>
          !deletedWordIndices.has(i) &&
          w.end > startTime &&
          w.start < endTime
      )

      const deletedRanges = transcript
        .map((w, i) => ({ ...w, index: i }))
        .filter((w) => deletedWordIndices.has(w.index))
        .sort((a, b) => a.start - b.start)

      return kept.map((word) => {
        const deletedBefore = deletedRanges
          .filter((d) => d.end <= word.start)
          .reduce((sum, d) => sum + (d.end - d.start), 0)

        const headTrim = startTime

        return {
          ...word,
          start: word.start - headTrim - deletedBefore,
          end: word.end - headTrim - deletedBefore,
        }
      })
    },
    [startTime, endTime, deletedWordIndices]
  )

  const getTrimmedAudio = useCallback(
    (audioBuffer: AudioBuffer, transcript: Word[]): Float32Array[] => {
      const { sampleRate, numberOfChannels } = audioBuffer
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)

      const deletedSampleRanges = transcript
        .map((w, i) => ({ ...w, index: i }))
        .filter((w) => deletedWordIndices.has(w.index))
        .sort((a, b) => a.start - b.start)
        .map((w) => ({
          start: Math.floor(w.start * sampleRate),
          end: Math.floor(w.end * sampleRate),
        }))

      const keptRanges: Array<{ start: number; end: number }> = []
      let cursor = startSample
      for (const del of deletedSampleRanges) {
        if (del.end <= startSample || del.start >= endSample) continue
        const delStart = Math.max(del.start, startSample)
        const delEnd = Math.min(del.end, endSample)
        if (cursor < delStart) {
          keptRanges.push({ start: cursor, end: delStart })
        }
        cursor = delEnd
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
    [startTime, endTime, deletedWordIndices]
  )

  const trimState: TrimState = useMemo(
    () => ({ startTime, endTime, deletedWordIndices }),
    [startTime, endTime, deletedWordIndices]
  )

  const hasChanges = startTime > 0 || endTime < duration || deletedWordIndices.size > 0
  const isEmpty = startTime >= endTime

  return {
    trimState,
    setStartTime,
    setEndTime,
    toggleWordDeletion,
    clearDeletions,
    getTrimmedAudio,
    getTrimmedTranscript,
    hasChanges,
    isEmpty,
  }
}
