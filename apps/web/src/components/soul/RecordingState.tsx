'use client'

import { useState, useCallback } from 'react'
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
      {/* Center: Orb + Timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Orb state={orbState} intensity={orbIntensity} />

        <p className="text-[--secondary] text-sm font-mono tracking-widest mt-4">
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
            <button
              type="button"
              className={roundIconBtn({ intent: 'pause' })}
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              {isPaused ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <polygon points="5,3 15,9 5,15" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <rect x="4" y="3" width="3.5" height="12" rx="1" />
                  <rect x="10.5" y="3" width="3.5" height="12" rx="1" />
                </svg>
              )}
            </button>

            {/* Stop — 64px via CVA */}
            <button
              type="button"
              className={roundIconBtn({ intent: 'stop' })}
              onClick={handleStop}
              aria-label="Stop recording"
            >
              {/* Red rounded square — Tailwind classes only, no inline styles */}
              <div className="w-5 h-5 rounded bg-destructive" />
            </button>

            {/* Settings — 48px via CVA */}
            <button
              type="button"
              className={roundIconBtn({ intent: 'settings' })}
              onClick={() => setSettingsOpen(true)}
              aria-label="Recording settings"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="9" r="2.5" />
                <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.1 3.1l1.4 1.4M13.5 13.5l1.4 1.4M3.1 14.9l1.4-1.4M13.5 4.5l1.4-1.4" />
              </svg>
            </button>
          </div>
        ) : (
          /* Post-stop checkpoint: Proceed CTA + Resume/Restart */
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              className={proceedBtn()}
              onClick={onProceed}
              aria-label="Proceed to editing"
            >
              Proceed
            </button>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                className="text-[--secondary] hover:text-[--primary] transition-colors flex items-center gap-1"
                onClick={handleResume}
                aria-label="Resume recording"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <polygon points="2,1 10,6 2,11" />
                </svg>
                Resume
              </button>

              <span className="text-[--tertiary]">&middot;</span>

              <button
                type="button"
                className="text-[--tertiary] hover:text-[--secondary] transition-colors flex items-center gap-1"
                onClick={handleRestart}
                aria-label="Restart recording"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 6a5 5 0 1 1 1.5 3.5" strokeLinecap="round" />
                  <polyline points="1,3 1,6.5 4,6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Restart
              </button>
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
