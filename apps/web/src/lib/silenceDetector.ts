export interface SilentRegion {
  id: string
  start: number
  end: number
  duration: number
}

interface DetectOptions {
  rmsThreshold?: number
  minSilenceDuration?: number
  windowSize?: number
}

/**
 * Scans an AudioBuffer for silent regions using RMS energy analysis.
 * Pure function — no side effects. Runs in ~10-50ms for typical recordings.
 *
 * Auto-calibrates the noise floor from the quietest window in the buffer,
 * making it robust to recordings that start mid-speech (e.g. after a trim commit).
 */
export function detectSilentRegions(
  buffer: AudioBuffer,
  options: DetectOptions = {}
): SilentRegion[] {
  const { rmsThreshold = 0.015, minSilenceDuration = 0.3, windowSize = 2048 } = options

  const samples = buffer.getChannelData(0)
  const { sampleRate } = buffer

  // First pass: compute per-window RMS and find the minimum across the buffer.
  // Using the minimum (quietest window) as the noise floor is robust to trimming —
  // calibrating from the first 500ms breaks after commits that remove the lead-in.
  const windowRms: number[] = []
  for (let i = 0; i < samples.length; i += windowSize) {
    const windowEnd = Math.min(i + windowSize, samples.length)
    const w = samples.subarray(i, windowEnd)
    let sum = 0
    for (let j = 0; j < w.length; j++) sum += w[j] * w[j]
    windowRms.push(Math.sqrt(sum / w.length))
  }
  const minRMS = windowRms.length > 0 ? Math.min(...windowRms) : 0
  const threshold = Math.max(rmsThreshold, minRMS * 3)

  const regions: SilentRegion[] = []
  let silenceStart: number | null = null
  let regionIndex = 0

  for (let i = 0; i < samples.length; i += windowSize) {
    const rms = windowRms[Math.floor(i / windowSize)]

    if (rms < threshold) {
      if (silenceStart === null) silenceStart = i
    } else if (silenceStart !== null) {
      const startSec = silenceStart / sampleRate
      const endSec = i / sampleRate
      if (endSec - startSec >= minSilenceDuration) {
        regions.push({
          id: `silence-${regionIndex++}`,
          start: startSec,
          end: endSec,
          duration: endSec - startSec,
        })
      }
      silenceStart = null
    }
  }

  // Handle silence that runs to the end of the buffer
  if (silenceStart !== null) {
    const startSec = silenceStart / sampleRate
    const endSec = samples.length / sampleRate
    if (endSec - startSec >= minSilenceDuration) {
      regions.push({
        id: `silence-${regionIndex}`,
        start: startSec,
        end: endSec,
        duration: endSec - startSec,
      })
    }
  }

  return regions
}
