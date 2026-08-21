'use client';

/**
 * Keep the shared style in step with the desk.
 *
 * The desk grew its own style model — `DeskState` — and its own renderer, a
 * hand-written DOM preview. `useUIStore.style` is what the real engine reads,
 * and the desk wrote into it exactly once: at the moment you pressed Export.
 *
 * So the canvas you were looking at and the file you got were two different
 * renderers, fed from two different models, at two different times. They
 * disagreed about which captions are on screen, about animation, and about
 * anything else either side implemented alone — and nothing could catch it,
 * because each was internally consistent.
 *
 * Projecting continuously collapses that. `DeskState` stays the desk's edit
 * model, with its own undo and its own desk-only fields, but it is no longer a
 * second source of truth about what the frame looks like: every change lands
 * in the store the engine reads, immediately. Preview and export are then the
 * same renderer reading the same values, which is the only arrangement in
 * which they cannot drift.
 */

import { useEffect } from 'react';
import { useUIStore, useProcessingStore } from '@/stores';
import type { DeskState } from './deskState';
import { deskStyleConfig } from './deskStyleConfig';

export function useDeskStyleSync(state: DeskState): void {
  const setStyle = useUIStore((s) => s.setStyle);
  const setFormat = useUIStore((s) => s.setFormat);

  useEffect(() => {
    setStyle(deskStyleConfig(state));
  }, [state, setStyle]);

  /* Format lives outside `style` because the canvas is sized from it rather
     than painted with it, so it has to be pushed separately. */
  useEffect(() => {
    setFormat(state.format);
  }, [state.format, setFormat]);

  /**
   * Line breaks, which decide how the transcript is cut into captions.
   *
   * These live outside `style` too, in their own store slice, and the caption
   * groups have to be rebuilt when they change — setting them is not enough on
   * its own. The desk's Breaks controls wrote to desk state and stopped there,
   * so the canvas segmented by whatever the phone had last been set to. It
   * only became visible once the desk started drawing with the real renderer.
   */
  useEffect(() => {
    const options = {
      mode: state.breakMode,
      quantity: state.breakQty,
      holdSeconds: state.breakSecs,
    };
    useUIStore.getState().setBreaks(options);
    useProcessingStore.getState().resegmentCaptions(options, 'all');
  }, [state.breakMode, state.breakQty, state.breakSecs]);
}
