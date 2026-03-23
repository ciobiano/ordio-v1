'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Orb } from '@/components/primitives/Orb'
import { RecordingSettingsSheet } from '@/components/soul/RecordingSettingsSheet'
import { roundIconBtn, proceedBtn } from '@/lib/variants'
import type { FeatureKey } from '@/lib/featureGates'

interface RecordingStateProps {
  audioLevel: number
  isPaused: boolean
  recordingTime: number
  onPauseRecording: () => void
  onResumeRecording: () => void
  onStopRecording: () => void
  onRestart: () => void
  onProceed: () => void
  onCancel: () => void
  onLocked: (feature: FeatureKey) => void
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordingState({
  audioLevel,
  isPaused,
  recordingTime,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onRestart,
  onProceed,
  onCancel,
  onLocked,
}: RecordingStateProps) {
  const [phase, setPhase] = useState<'recording' | 'stopped'>('recording')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Paused orb stays 'active' at locked 0.7 intensity (not 'dormant' — intensity is ignored in dormant)
  const orbState = phase === 'stopped' ? 'resting' : 'active'
  const orbIntensity = phase === 'stopped' ? 0 : isPaused ? 0.7 : audioLevel

  const handleStop = useCallback(() => {
    setPhase('stopped')
    onStopRecording()
  }, [onStopRecording])

  const handleResume = useCallback(() => {
    setPhase('recording')
    onResumeRecording()
  }, [onResumeRecording])

  const handleRestart = useCallback(() => {
    setPhase('recording')
    onRestart()
  }, [onRestart])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black">
      {/* Back / cancel — top-left corner, always visible */}
      <div className="absolute top-4 left-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          aria-label="Cancel recording"
          className={roundIconBtn({ intent: 'nav' })}
        >
          <Image src="/icons/arrow-left.svg" width={16} height={16} alt="" aria-hidden="true" className="invert" />
        </Button>
      </div>

      {/* Center: Orb + Timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Orb state={orbState} intensity={orbIntensity} />

        <p className="text-muted-foreground text-sm font-mono tracking-widest mt-4 tabular-nums">
          {phase === 'stopped'
            ? `${formatTime(recordingTime)} recorded`
            : formatTime(recordingTime)}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="w-full px-6 pb-10 pt-4">
        {phase === 'recording' ? (
          /* Active recording: Pause · Stop · Settings */
          <div className="flex items-center justify-center gap-8">
            {/* Pause/Play — 48px via CVA */}
            <Button
              type="button"
              variant="ghost"
              className={roundIconBtn({ intent: 'pause' })}
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              {isPaused ? (
                <Image src="/icons/play.svg" width={18} height={18} alt="" aria-hidden="true" className="invert" />
              ) : (
                <Image src="/icons/pause.svg" width={18} height={18} alt="" aria-hidden="true" className="invert" />
              )}
            </Button>

            {/* Stop — 64px via CVA */}
            <Button
              type="button"
              variant="ghost"
              className={roundIconBtn({ intent: 'stop' })}
              onClick={handleStop}
              aria-label="Stop recording"
            >
              <div className="w-5 h-5 rounded bg-destructive" />
            </Button>

            {/* Settings — 48px via CVA */}
            <Button
              type="button"
              variant="ghost"
              className={roundIconBtn({ intent: 'settings' })}
              onClick={() => setSettingsOpen(true)}
              aria-label="Recording settings"
            >
              <Image src="/icons/settings.svg" width={18} height={18} alt="" aria-hidden="true" className="invert opacity-80" />
            </Button>
          </div>
        ) : (
          /* Post-stop checkpoint: Proceed CTA + Resume/Restart */
          <div className="flex flex-col items-center gap-3 ">
            <Button
              type="button"
              variant="ghost"
              className={proceedBtn()}
              onClick={onProceed}
              aria-label="Proceed to editing"
            >
              Proceed
            </Button>

            <div className="flex items-center gap-3 text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto py-0 px-1 text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors flex items-center gap-1"
                onClick={handleResume}
                aria-label="Resume recording"
              >
                <Image src="/icons/play.svg" width={12} height={12} alt="" aria-hidden="true" className="invert" />
                Resume
              </Button>

              <span className="text-muted-foreground">&middot;</span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto py-0 px-1 text-muted-foreground hover:text-muted-foreground hover:bg-transparent transition-colors flex items-center gap-1"
                onClick={handleRestart}
                aria-label="Restart recording"
              >
                <Image src="/icons/restart.svg" width={12} height={12} alt="" aria-hidden="true" className="invert" />
                Restart
              </Button>

              <span className="text-muted-foreground">&middot;</span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto py-0 px-1 text-muted-foreground hover:text-muted-foreground hover:bg-transparent transition-colors"
                onClick={onCancel}
                aria-label="Cancel and return to start"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Settings sheet */}
      <RecordingSettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLocked={onLocked}
      />
    </div>
  )
}
