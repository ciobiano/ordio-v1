'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { proceedBtn, roundIconBtn } from '@/lib/variants';
import type { RecordingPhase } from './types';

type RecordingBottomBarProps = {
  phase: RecordingPhase;
  isPaused: boolean;
  recordingTime: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRestart: () => void;
  onProceed: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
};

const buttonSpring = {
  tap: { scale: 0.95, transition: { duration: 0.1 } },
  hover: { scale: 1.05, transition: { duration: 0.2 } },
};

export function RecordingBottomBar({
  phase,
  isPaused,
  recordingTime,
  onPause,
  onResume,
  onStop,
  onRestart,
  onProceed,
  onCancel,
  onOpenSettings,
}: RecordingBottomBarProps) {
  return (
    <div className="mobile-glass w-full max-w-md rounded-[2rem] px-5 pb-6 pt-4 safe-pb">
      {phase === 'recording' ? (
        <div className="flex items-center justify-center gap-8">
          <Button
            type="button"
            variant="ghost"
            className={`${roundIconBtn({ intent: 'pause' })} mobile-glass-button`}
            onClick={isPaused ? onResume : onPause}
            aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
          >
            <motion.div whileTap={buttonSpring.tap} whileHover={buttonSpring.hover} className="flex items-center justify-center">
              {isPaused ? (
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
            onClick={onStop}
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
            onClick={onProceed}
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
  );
}

