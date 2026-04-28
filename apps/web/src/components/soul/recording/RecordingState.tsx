'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Orb } from '@/components/primitives/orb/Orb';
import { roundIconBtn, proceedBtn } from '@/lib/variants';
import type { FeatureKey } from '@/lib/featureGates';
import { useHaptics } from '@/hooks/useHaptics';

const RecordingSettingsSheet = dynamic(
  () => import('./RecordingSettingsSheet').then((m) => ({ default: m.RecordingSettingsSheet })),
  { ssr: false }
);

interface RecordingStateProps {
  audioLevel: number;
  isSpeaking: boolean;
  isPaused: boolean;
  recordingTime: number;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onRestart: () => void;
  onProceed: () => void;
  onCancel: () => void;
  onLocked: (feature: FeatureKey) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingState({
  audioLevel,
  isSpeaking,
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
  const [phase, setPhase] = useState<'recording' | 'stopped'>('recording');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { trigger } = useHaptics();

  const buttonSpring = {
    tap: { scale: 0.95, transition: { duration: 0.1 } },
    hover: { scale: 1.05, transition: { duration: 0.2 } },
  };

  const qualityBadge = phase === 'stopped'
    ? { label: 'Ready to process', tone: 'text-emerald-200 bg-emerald-500/15 border-emerald-300/30' }
    : isPaused
      ? { label: 'Paused', tone: 'text-amber-200 bg-amber-500/15 border-amber-300/30' }
      : audioLevel < 0.08
        ? { label: 'Too quiet', tone: 'text-amber-200 bg-amber-500/15 border-amber-300/30' }
        : isSpeaking
          ? { label: 'Voice detected', tone: 'text-emerald-200 bg-emerald-500/15 border-emerald-300/30' }
          : { label: 'Listening', tone: 'text-sky-200 bg-sky-500/15 border-sky-300/30' };

  // State-first voice phases for clearer motion semantics.
  const orbState =
    phase === 'stopped'
      ? 'thinking'
      : isPaused
        ? 'listening'
        : isSpeaking
          ? 'speaking'
          : 'listening';
  const orbIntensity = phase === 'stopped' ? 0 : isPaused ? 0.25 : audioLevel;

  const handleStop = useCallback(() => {
    trigger('heavy');
    setPhase('stopped');
    onStopRecording();
  }, [onStopRecording, trigger]);

  const handleResume = useCallback(() => {
    trigger('medium');
    setPhase('recording');
    onResumeRecording();
  }, [onResumeRecording, trigger]);

  const handleRestart = useCallback(() => {
    trigger('medium');
    setPhase('recording');
    onRestart();
  }, [onRestart, trigger]);

  const handlePause = useCallback(() => {
    trigger('light');
    onPauseRecording();
  }, [onPauseRecording, trigger]);

  const handleProceed = useCallback(() => {
    trigger('success');
    onProceed();
  }, [onProceed, trigger]);

  const handleCancel = useCallback(() => {
    trigger('medium');
    onCancel();
  }, [onCancel, trigger]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 px-4 pb-4 pt-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Back / cancel — top-left corner, always visible */}
      <div className="absolute left-4 top-4 safe-pt">
        <Button
          type="button"
          variant="ghost"
          onClick={handleCancel}
          aria-label="Cancel recording"
          className={`${roundIconBtn({ intent: 'nav' })} mobile-glass-button text-white/70 hover:bg-white/10 hover:text-white`}
        >
          <Image
            src="/icons/arrow-left.svg"
            width={16}
            height={16}
            alt=""
            aria-hidden="true"
            className="invert"
          />
        </Button>
      </div>

      {/* Center: Orb + Timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Orb state={orbState} intensity={orbIntensity} isSpeaking={isSpeaking} layoutId="orb" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/35">Mic</span>
          <span className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
            <span
              className="block h-full rounded-full bg-sky-300/80 transition-[width] duration-150"
              style={{ width: `${Math.max(8, Math.min(100, Math.round(audioLevel * 120)))}%` }}
            />
          </span>
        </div>

        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${qualityBadge.tone}`}>
          {qualityBadge.label}
        </span>

        <p className="text-white/45 text-sm font-mono tracking-widest mt-4 tabular-nums">
          {phase === 'stopped'
            ? `${formatTime(recordingTime)} recorded`
            : formatTime(recordingTime)}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="mobile-glass w-full max-w-md rounded-[2rem] px-5 pb-6 pt-4 safe-pb">
        {phase === 'recording' ? (
          /* Active recording: Pause · Stop · Settings */
          <div className="flex items-center justify-center gap-8">
            {/* Pause/Play — 48px via CVA */}
            <Button
              type="button"
              variant="ghost"
              className={`${roundIconBtn({ intent: 'pause' })} mobile-glass-button`}
              onClick={isPaused ? handleResume : handlePause}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              <motion.div
                whileTap={buttonSpring.tap}
                whileHover={buttonSpring.hover}
                className="flex items-center justify-center"
              >
                {isPaused ? (
                  <Image
                    src="/icons/play.svg"
                    width={18}
                    height={18}
                    alt=""
                    aria-hidden="true"
                    className="invert"
                  />
                ) : (
                  <Image
                    src="/icons/pause.svg"
                    width={18}
                    height={18}
                    alt=""
                    aria-hidden="true"
                    className="invert"
                  />
                )}
              </motion.div>
            </Button>

            {/* Stop — 64px via CVA */}
            <Button
              type="button"
              variant="ghost"
              className={`${roundIconBtn({ intent: 'stop' })} shadow-[0_20px_40px_rgba(127,29,29,0.28)]`}
              onClick={handleStop}
              aria-label="Stop recording"
            >
              <motion.div
                whileTap={buttonSpring.tap}
                whileHover={buttonSpring.hover}
                className="flex items-center justify-center"
              >
                <div className="w-5 h-5 rounded bg-destructive" />
              </motion.div>
            </Button>

            {/* Settings — 48px via CVA */}
            <Button
              type="button"
              variant="ghost"
              className={`${roundIconBtn({ intent: 'settings' })} mobile-glass-button`}
              onClick={() => {
                trigger('light');
                setSettingsOpen(true);
              }}
              aria-label="Recording settings"
            >
              <motion.div
                whileTap={buttonSpring.tap}
                whileHover={buttonSpring.hover}
                className="flex items-center justify-center"
              >
                <Image
                  src="/icons/settings.svg"
                  width={18}
                  height={18}
                  alt=""
                  aria-hidden="true"
                  className="invert opacity-80"
                />
              </motion.div>
            </Button>
          </div>
        ) : (
          /* Post-stop checkpoint: Proceed CTA + Resume/Restart */
          <div className="flex flex-col items-center gap-2">
            {/* Zero-length guard: disable Proceed if nothing was recorded */}
            <Button
              type="button"
              variant="ghost"
              className={proceedBtn()}
              onClick={handleProceed}
              disabled={recordingTime === 0}
              aria-label="Process recording"
              aria-disabled={recordingTime === 0}
            >
              <motion.div
                whileTap={buttonSpring.tap}
                whileHover={buttonSpring.hover}
                className="flex items-center justify-center"
              >
                {recordingTime === 0 ? 'Recording too short' : 'Process recording'}
              </motion.div>
            </Button>

            {/* 44px touch targets on secondary actions */}
            <div className="mt-1 flex items-center gap-1 text-xs text-white/35">
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-white/35 hover:text-white/80 hover:bg-transparent transition-colors flex items-center gap-1"
                onClick={handleResume}
                aria-label="Resume recording"
              >
                <motion.div
                  whileTap={buttonSpring.tap}
                  whileHover={buttonSpring.hover}
                  className="flex items-center gap-1"
                >
                  <Image
                    src="/icons/play.svg"
                    width={12}
                    height={12}
                    alt=""
                    aria-hidden="true"
                    className="invert"
                  />
                  Resume
                </motion.div>
              </Button>

              <span className="text-white/20">&middot;</span>

              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-white/35 hover:text-white/80 hover:bg-transparent transition-colors flex items-center gap-1"
                onClick={handleRestart}
                aria-label="Restart recording"
              >
                <motion.div
                  whileTap={buttonSpring.tap}
                  whileHover={buttonSpring.hover}
                  className="flex items-center gap-1"
                >
                  <Image
                    src="/icons/restart.svg"
                    width={12}
                    height={12}
                    alt=""
                    aria-hidden="true"
                    className="invert"
                  />
                  Restart
                </motion.div>
              </Button>

              <span className="text-white/20">&middot;</span>

              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-white/35 hover:text-white/80 hover:bg-transparent transition-colors"
                onClick={handleCancel}
                aria-label="Cancel and return to start"
              >
                <motion.div
                  whileTap={buttonSpring.tap}
                  whileHover={buttonSpring.hover}
                >
                  Cancel
                </motion.div>
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
    </motion.div>
  );
}
