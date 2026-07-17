import { describe, it, expect } from 'vitest';
import {
  frameRms,
  processFrame,
  INITIAL_GATE_STATE,
  type FrameGateConfig,
  type FrameGateState,
} from '@/lib/liveTranscription/frameGate';

const CONFIG: FrameGateConfig = { openRms: 0.015, hangoverFrames: 2, preRollFrames: 3 };

function loudFrame(amplitude = 0.2): Int16Array {
  return new Int16Array(100).fill(Math.round(amplitude * 0x7fff));
}

function quietFrame(): Int16Array {
  return new Int16Array(100); // digital silence
}

function run(frames: Int16Array[], startState: FrameGateState = INITIAL_GATE_STATE) {
  const sent: Int16Array[][] = [];
  const state = frames.reduce((s, f) => {
    const result = processFrame(s, f, CONFIG);
    sent.push(result.framesToSend);
    return result.state;
  }, startState);
  return { state, sent };
}

describe('frameRms', () => {
  it('is 0 for silence and ~amplitude for a constant frame', () => {
    expect(frameRms(quietFrame())).toBe(0);
    expect(frameRms(loudFrame(0.2))).toBeCloseTo(0.2, 2);
  });
});

describe('processFrame', () => {
  it('stays closed and sends nothing during silence', () => {
    const { state, sent } = run([quietFrame(), quietFrame(), quietFrame()]);
    expect(state.open).toBe(false);
    expect(sent.flat()).toHaveLength(0);
  });

  it('flushes pre-roll ahead of the frame that opens the gate', () => {
    const { sent } = run([quietFrame(), quietFrame(), loudFrame()]);
    // Third result carries: 2 buffered quiet frames + the loud frame.
    expect(sent[2]).toHaveLength(3);
  });

  it('caps pre-roll at preRollFrames, keeping the newest', () => {
    const quiet = Array.from({ length: 6 }, () => quietFrame());
    const { state } = run(quiet);
    expect(state.preRoll).toHaveLength(CONFIG.preRollFrames);
  });

  it('keeps streaming quiet frames through the hangover window', () => {
    const { sent, state } = run([loudFrame(), quietFrame(), quietFrame()]);
    expect(sent[1]).toHaveLength(1);
    expect(sent[2]).toHaveLength(1);
    expect(state.hangoverRemaining).toBe(0);
  });

  it('closes after the hangover is exhausted and gates further silence', () => {
    const { sent, state } = run([loudFrame(), quietFrame(), quietFrame(), quietFrame()]);
    expect(sent[3]).toHaveLength(0);
    expect(state.open).toBe(false);
  });

  it('a loud frame mid-hangover resets the window instead of counting down', () => {
    const { state } = run([loudFrame(), quietFrame(), loudFrame()]);
    expect(state.hangoverRemaining).toBe(CONFIG.hangoverFrames);
  });

  it('does not mutate the input state object', () => {
    const before = { ...INITIAL_GATE_STATE, preRoll: [...INITIAL_GATE_STATE.preRoll] };
    processFrame(INITIAL_GATE_STATE, loudFrame(), CONFIG);
    expect(INITIAL_GATE_STATE).toEqual(before);
  });
});
