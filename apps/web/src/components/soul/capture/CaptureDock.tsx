'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { proceedBtn, roundIconBtn } from '@/lib/variants';
import type { CapturePhase } from './types';

interface CaptureDockProps {
  phase: CapturePhase;
  recordingTime: number;
  onOpenSettings: () => void;
  onGoReady: () => void;
  onProcess: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onCancel: () => void;
}

const buttonSpring = {
  tap: { scale: 0.95, transition: { duration: 0.1 } },
  hover: { scale: 1.05, transition: { duration: 0.2 } },
};

export function CaptureDock({
  phase,
  recordingTime,
  onOpenSettings,
  onGoReady,
  onProcess,
  onPause,
  onResume,
  onRestart,
  onCancel,
}: CaptureDockProps) {
  if (phase === 'idle' || phase === 'processing') return null;

  return (
    <div className="absolute left-0 right-0 bottom-0 px-4 pb-6 safe-pb flex justify-center">
      <div className="mobile-glass w-full max-w-md rounded-[2rem] px-5 pb-6 pt-4">
        {phase === 'recording' || phase === 'paused' ? (
          <div className="flex items-center justify-center gap-8">
            <Button
              type="button"
              variant="ghost"
              className={`${roundIconBtn({ intent: 'pause' })} mobile-glass-button`}
              onClick={phase === 'paused' ? onResume : onPause}
              aria-label={phase === 'paused' ? 'Resume recording' : 'Pause recording'}
            >
              <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center justify-center">
                {phase === 'paused' ? (
                  <Image src="/icons/play.svg" width={18} height={18} alt="" aria-hidden="true" className="invert" />
                ) : (
                  <Image src="/icons/pause.svg" width={18} height={18} alt="" aria-hidden="true" className="invert" />
                )}
              </motion.div>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className={`${roundIconBtn({ intent: 'stop' })} shadow-[0_20px_40px_rgba(127,29,29,0.28)]`}
              onClick={onGoReady}
              aria-label="Stop recording"
            >
              <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center justify-center">
                <div className="w-5 h-5 rounded bg-destructive" />
              </motion.div>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className={`${roundIconBtn({ intent: 'settings' })} mobile-glass-button`}
              onClick={onOpenSettings}
              aria-label="Recording settings"
            >
              <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center justify-center">
                <Image src="/icons/settings.svg" width={18} height={18} alt="" aria-hidden="true" className="invert opacity-80" />
              </motion.div>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className={proceedBtn()}
              onClick={onProcess}
              disabled={recordingTime === 0}
              aria-label="Process recording"
              aria-disabled={recordingTime === 0}
            >
              <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center justify-center">
                {recordingTime === 0 ? 'Recording too short' : 'Process recording'}
              </motion.div>
            </Button>

            <div className="mt-1 flex items-center gap-1 text-xs text-white/35">
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-white/35 hover:text-white/80 hover:bg-transparent transition-colors flex items-center gap-1"
                onClick={onResume}
                aria-label="Resume recording"
              >
                <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center gap-1">
                  <Image src="/icons/play.svg" width={12} height={12} alt="" aria-hidden="true" className="invert" />
                  Resume
                </motion.div>
              </Button>

              <span className="text-white/20">&middot;</span>

              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-white/35 hover:text-white/80 hover:bg-transparent transition-colors flex items-center gap-1"
                onClick={onRestart}
                aria-label="Restart recording"
              >
                <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center gap-1">
                  <Image src="/icons/restart.svg" width={12} height={12} alt="" aria-hidden="true" className="invert" />
                  Restart
                </motion.div>
              </Button>

              <span className="text-white/20">&middot;</span>

              <Button
                type="button"
                variant="ghost"
                className="h-10 px-3 text-white/35 hover:text-white/80 hover:bg-transparent transition-colors"
                onClick={onCancel}
                aria-label="Cancel and return to start"
              >
                <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover}>
                  Cancel
                </motion.div>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
