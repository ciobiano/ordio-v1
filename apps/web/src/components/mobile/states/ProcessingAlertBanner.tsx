'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ProcessingAlertState } from '@/hooks/recording/useCreateFlow';

interface ProcessingAlertBannerProps {
  alert: ProcessingAlertState | null;
  onDisableEnhancement: () => void;
  onDismiss: () => void;
}

/**
 * HIG-style alert overlay for processing failures.
 * Renders as a fixed banner at the top of the viewport —
 * doesn't destroy page context.
 */
export function ProcessingAlertBanner({
  alert,
  onDisableEnhancement,
  onDismiss,
}: ProcessingAlertBannerProps) {
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          className="fixed top-4 left-1/2 z-50 w-[min(92vw,42rem)] -translate-x-1/2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Alert
            variant="destructive"
            className="border border-red-400/40 bg-red-950/90 text-red-50 shadow-lg backdrop-blur-sm"
          >
            <AlertTitle className="text-red-50">{alert.title}</AlertTitle>
            <AlertDescription className="text-red-100/90 leading-relaxed">
              {alert.detail}
            </AlertDescription>
            <div className="col-start-2 mt-3 flex flex-wrap justify-end gap-2">
              {alert.stage === 'enhancement' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onDisableEnhancement}
                  className="border-red-300/40 bg-transparent text-red-50 hover:bg-red-900/60 hover:text-white"
                >
                  Turn enhancement off
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-red-100 hover:bg-red-900/60 hover:text-white"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
