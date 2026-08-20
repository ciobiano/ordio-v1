// apps/web/src/__tests__/capture-phase.test.ts
import { describe, it, expect } from 'vitest';
import { deriveCapturePhase, deriveStatusText, TOO_QUIET_THRESHOLD } from '@/lib/capture/phase';

describe('deriveCapturePhase', () => {
  it('is idle when currentState is idle', () => {
    expect(
      deriveCapturePhase({ currentState: 'idle', recordingSubPhase: 'recording', isPaused: false })
    ).toBe('idle');
  });

  it('is recording when currentState is recording, sub-phase is recording, and not paused', () => {
    expect(
      deriveCapturePhase({ currentState: 'recording', recordingSubPhase: 'recording', isPaused: false })
    ).toBe('recording');
  });

  it('is paused when currentState is recording, sub-phase is recording, and isPaused', () => {
    expect(
      deriveCapturePhase({ currentState: 'recording', recordingSubPhase: 'recording', isPaused: true })
    ).toBe('paused');
  });

  it('is ready when currentState is recording and sub-phase is stopped', () => {
    expect(
      deriveCapturePhase({ currentState: 'recording', recordingSubPhase: 'stopped', isPaused: false })
    ).toBe('ready');
  });

  it('is ready when sub-phase is stopped even if isPaused is stale-true', () => {
    // A recorder can't be "paused" once stopped — a stale isPaused flag must not leak through.
    expect(
      deriveCapturePhase({ currentState: 'recording', recordingSubPhase: 'stopped', isPaused: true })
    ).toBe('ready');
  });

  it('is processing when currentState is processing', () => {
    expect(
      deriveCapturePhase({ currentState: 'processing', recordingSubPhase: 'stopped', isPaused: false })
    ).toBe('processing');
  });
});

describe('deriveStatusText', () => {
  it('shows the static idle prompt in idle phase', () => {
    expect(deriveStatusText({ phase: 'idle', audioLevel: 0, isSpeaking: false })).toEqual({
      kind: 'idle',
    });
  });

  it('shows paused in paused phase regardless of audio level', () => {
    expect(deriveStatusText({ phase: 'paused', audioLevel: 0.5, isSpeaking: true })).toEqual({
      kind: 'paused',
    });
  });

  it('shows ready in ready phase', () => {
    expect(deriveStatusText({ phase: 'ready', audioLevel: 0, isSpeaking: false })).toEqual({
      kind: 'ready',
    });
  });

  it('shows too-quiet when recording and audioLevel is below the threshold', () => {
    expect(
      deriveStatusText({ phase: 'recording', audioLevel: TOO_QUIET_THRESHOLD - 0.01, isSpeaking: false })
    ).toEqual({ kind: 'too-quiet' });
  });

  it('shows too-quiet even if isSpeaking is stale-true but level is below threshold', () => {
    expect(
      deriveStatusText({ phase: 'recording', audioLevel: TOO_QUIET_THRESHOLD - 0.01, isSpeaking: true })
    ).toEqual({ kind: 'too-quiet' });
  });

  it('shows listening when recording, audio level is sufficient, and not speaking', () => {
    expect(
      deriveStatusText({ phase: 'recording', audioLevel: TOO_QUIET_THRESHOLD + 0.1, isSpeaking: false })
    ).toEqual({ kind: 'listening' });
  });

  it('shows voice-detected when recording and isSpeaking', () => {
    expect(
      deriveStatusText({ phase: 'recording', audioLevel: TOO_QUIET_THRESHOLD + 0.1, isSpeaking: true })
    ).toEqual({ kind: 'voice-detected' });
  });

  it('switches back to listening the instant isSpeaking drops, even at the same audio level', () => {
    const speaking = deriveStatusText({ phase: 'recording', audioLevel: 0.5, isSpeaking: true });
    const notSpeaking = deriveStatusText({ phase: 'recording', audioLevel: 0.5, isSpeaking: false });
    expect(speaking.kind).toBe('voice-detected');
    expect(notSpeaking.kind).toBe('listening');
  });
});
