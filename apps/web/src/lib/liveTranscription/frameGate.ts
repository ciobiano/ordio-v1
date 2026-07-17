// Energy-based frame gate for the live transcription stream.
// Realtime bills on audio input, so silent frames are money: the gate only
// lets frames through while speech is (recently) present. Pure functions —
// the transcriber threads state through each call, tests hit it directly.
//
// Deliberate deviation from the spec's "reuse useVAD": Silero VAD runs its
// own mic capture at React-state cadence for UI feedback; frame-accurate
// gating has to see the actual PCM frames, so a self-contained RMS gate
// lives here instead.

export interface FrameGateConfig {
  /** RMS (0..1) at or above which the gate opens. Speech is typically 0.02–0.2. */
  openRms: number;
  /** Frames the gate stays open after the last loud frame (bridges word gaps). */
  hangoverFrames: number;
  /** Quiet frames retained and flushed when the gate opens (protects word onsets). */
  preRollFrames: number;
}

// 100ms frames: 3 = 300ms pre-roll (spec 6), 8 = 800ms hangover.
export const DEFAULT_GATE_CONFIG: FrameGateConfig = {
  openRms: 0.015,
  hangoverFrames: 8,
  preRollFrames: 3,
};

export interface FrameGateState {
  open: boolean;
  /** Open frames remaining after the last frame that met openRms. */
  hangoverRemaining: number;
  /** Most recent quiet frames, oldest first, capped at preRollFrames. */
  preRoll: Int16Array[];
}

export const INITIAL_GATE_STATE: FrameGateState = {
  open: false,
  hangoverRemaining: 0,
  preRoll: [],
};

export function frameRms(frame: Int16Array): number {
  if (frame.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i++) {
    const normalized = frame[i] / 0x8000;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / frame.length);
}

export interface FrameGateResult {
  state: FrameGateState;
  /** Frames to put on the wire, in order. Empty while gated. */
  framesToSend: Int16Array[];
}

export function processFrame(
  state: FrameGateState,
  frame: Int16Array,
  config: FrameGateConfig = DEFAULT_GATE_CONFIG
): FrameGateResult {
  const loud = frameRms(frame) >= config.openRms;

  if (loud) {
    // (Re)open: flush any buffered pre-roll ahead of this frame so the
    // utterance keeps its onset, then reset the hangover window.
    return {
      state: { open: true, hangoverRemaining: config.hangoverFrames, preRoll: [] },
      framesToSend: [...state.preRoll, frame],
    };
  }

  if (state.open && state.hangoverRemaining > 0) {
    // Quiet but inside the hangover: keep streaming so brief word gaps
    // don't fragment the vendor's utterance segmentation.
    return {
      state: { ...state, hangoverRemaining: state.hangoverRemaining - 1 },
      framesToSend: [frame],
    };
  }

  // Gate closed: retain the frame as pre-roll for the next onset.
  return {
    state: {
      open: false,
      hangoverRemaining: 0,
      preRoll: [...state.preRoll, frame].slice(-config.preRollFrames),
    },
    framesToSend: [],
  };
}
