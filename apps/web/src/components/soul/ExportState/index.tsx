'use client'

import { useState, useCallback } from 'react'
import { useAudioTrimmer } from '@/hooks/useAudioTrimmer'
import { useStore, getCanvasDimensions } from '@/lib/store'
import { ExportHeader } from './ExportHeader'
import { ExportCanvas } from './ExportCanvas'
import { ExportControls } from './ExportControls'
import { ExportFooter } from './ExportFooter'
import { DiscardDialog } from './DiscardDialog'
import type { UsePlaybackReturn } from '@/hooks/usePlayback'
import type { WaveformVariant, CaptionVariant, FormatVariant, GraphicStyleId } from '@/lib/store'
import type { FeatureKey } from '@/lib/featureGates'

interface UseVideoExporterShape {
  isExporting: boolean
  exportProgress: number
  exportedUrl: string | null
  exportMimeType: string | null
  error: string | null
  startExport: (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, showWatermark?: boolean) => Promise<void>
  cancelExport: () => void
}

interface ExportStateProps {
  playback: UsePlaybackReturn
  exporter: UseVideoExporterShape
  format: FormatVariant
  waveformStyle: WaveformVariant
  captionStyle: CaptionVariant
  graphicStyle?: GraphicStyleId
  showWatermark?: boolean
  onExportStart: () => Promise<boolean>
  onDownload: () => void
  onReset: () => void
  onLocked: (feature: FeatureKey) => void
}

function buildAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
  })
  channels.forEach((ch, i) =>
    buf.copyToChannel(new Float32Array(ch.buffer as ArrayBuffer, ch.byteOffset, ch.length), i)
  )
  return buf
}

export default function ExportState({
  playback,
  exporter,
  format,
  waveformStyle,
  captionStyle,
  graphicStyle,
  showWatermark = false,
  onExportStart,
  onDownload,
  onReset,
  onLocked,
}: ExportStateProps) {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const { audioBuffer, transcript } = useStore()
  const trimmer = useAudioTrimmer(playback.duration)

  const handleExport = useCallback(async () => {
    if (!audioBuffer || !transcript) return

    const allowed = await onExportStart()
    if (!allowed) return

    const trimmedChannels = trimmer.getTrimmedAudio(audioBuffer, transcript)
    const trimmedBuffer = buildAudioBuffer(trimmedChannels, audioBuffer.sampleRate)
    const trimmedTranscript = trimmer.getTrimmedTranscript(transcript)

    const { width, height } = getCanvasDimensions(format)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
    }

    const store = useStore.getState()
    const originalTranscript = store.transcript
    useStore.setState({ transcript: trimmedTranscript })

    try {
      await exporter.startExport(canvas, trimmedBuffer, showWatermark)
    } finally {
      useStore.setState({ transcript: originalTranscript })
    }
  }, [audioBuffer, transcript, trimmer, format, exporter, showWatermark, onExportStart])

  const exportDisabled = exporter.isExporting || trimmer.isEmpty

  return (
    <div className="flex flex-col w-full min-h-dvh animate-fadeIn">
      <ExportHeader
        exportedUrl={exporter.exportedUrl}
        exportDisabled={exportDisabled}
        onBack={() => setShowDiscardDialog(true)}
        onExport={handleExport}
        onDownload={onDownload}
      />

      <div className="flex flex-col md:flex-row md:gap-6 md:px-6 md:pb-4 flex-1 md:items-start">
        <ExportCanvas
          playback={playback}
          format={format}
          waveformStyle={waveformStyle}
          captionStyle={captionStyle}
          graphicStyle={graphicStyle}
          showWatermark={showWatermark}
        />

        <ExportControls
          playback={playback}
          trimmer={trimmer}
          audioBuffer={audioBuffer}
          transcript={transcript ?? []}
          onLocked={onLocked}
        />
      </div>

      <ExportFooter
        trimIsEmpty={trimmer.isEmpty}
        exporter={exporter}
        onDownload={onDownload}
      />

      <DiscardDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={onReset}
      />
    </div>
  )
}
