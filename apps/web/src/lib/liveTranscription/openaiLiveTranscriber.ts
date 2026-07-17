import {
  DEFAULT_GATE_CONFIG,
  INITIAL_GATE_STATE,
  processFrame,
  type FrameGateState,
} from './frameGate';
import type { LiveFinalEvent, LivePartialEvent, LiveTranscriber } from './types';

const REALTIME_WS_URL = 'wss://api.openai.com/v1/realtime';
const WORKLET_URL = '/worklets/pcm-transcription-processor.js';
const WORKLET_NAME = 'pcm-transcription-processor';
// Spec guardrail: never idle-hold a session past the longest expected memo.
// Absolute deadline — reconnects do not extend it.
const MAX_SESSION_MS = 6 * 60 * 1000;
// A pause shorter than this keeps the socket warm; longer tears it down and
// resume re-mints (sockets are cheap to reopen, idle sessions bill nothing
// but hold vendor-side resources).
const SUSPEND_SOCKET_GRACE_MS = 20 * 1000;

interface RealtimeEvent {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
}

function pcmFrameToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked to stay under argument-count limits for large frames.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function mintToken(): Promise<string> {
  const res = await fetch('/api/realtime/transcription-token', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Live captions unavailable');
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

/**
 * Streams mic audio to an OpenAI Realtime transcription session.
 * Flow: mint ephemeral token (Clerk-gated route) → WebSocket to OpenAI →
 * AudioWorklet feeds 24kHz PCM16 frames → an RMS frame gate drops silence
 * (with pre-roll) → delta/completed events map to onPartial/onFinal.
 *
 * Resilience: one silent re-mint+reconnect on unexpected socket loss;
 * suspend/resume for recording pause (short pauses keep the socket, long
 * ones reconnect on resume). All failures emit onError and self-teardown —
 * the recording pipeline is never blocked.
 */
export class OpenAILiveTranscriber implements LiveTranscriber {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionDeadline = 0;
  private gateState: FrameGateState = INITIAL_GATE_STATE;
  private suspended = false;
  private reconnectUsed = false;
  private stopped = false;

  private partialCb: ((event: LivePartialEvent) => void) | null = null;
  private finalCb: ((event: LiveFinalEvent) => void) | null = null;
  private errorCb: ((message: string) => void) | null = null;

  onPartial(cb: (event: LivePartialEvent) => void): void {
    this.partialCb = cb;
  }

  onFinal(cb: (event: LiveFinalEvent) => void): void {
    this.finalCb = cb;
  }

  onError(cb: (message: string) => void): void {
    this.errorCb = cb;
  }

  async start(stream: MediaStream): Promise<void> {
    this.stopped = false;
    this.suspended = false;
    this.reconnectUsed = false;
    this.gateState = INITIAL_GATE_STATE;
    this.sessionDeadline = Date.now() + MAX_SESSION_MS;

    const token = await mintToken();
    if (this.stopped) return;

    await this.openSocket(token);
    if (this.stopped) {
      this.teardown();
      return;
    }

    await this.startAudioGraph(stream);
    this.armSessionTimer();
  }

  stop(): void {
    this.stopped = true;
    this.teardown();
  }

  /**
   * Recording paused/resumed. While suspended no frames are sent (captions
   * for un-recorded speech would be wrong, and silence still bills). A short
   * pause keeps the socket warm; past the grace window it closes, and resume
   * silently reconnects.
   */
  setSuspended(suspended: boolean): void {
    if (this.stopped || this.suspended === suspended) return;
    this.suspended = suspended;

    if (suspended) {
      this.gateState = INITIAL_GATE_STATE;
      this.suspendTimer = setTimeout(() => {
        this.closeSocketOnly();
      }, SUSPEND_SOCKET_GRACE_MS);
      return;
    }

    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      void this.reconnect('resume');
    }
  }

  private armSessionTimer(): void {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    const remaining = this.sessionDeadline - Date.now();
    this.sessionTimer = setTimeout(() => {
      this.errorCb?.('Live caption session limit reached');
      this.stop();
    }, Math.max(remaining, 0));
  }

  private openSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Browsers can't set Authorization headers on WebSockets; the Realtime
      // API accepts the (short-lived, single-session) secret via subprotocol.
      const ws = new WebSocket(REALTIME_WS_URL, ['realtime', `openai-insecure-api-key.${token}`]);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Live captions connection failed'));
      ws.onclose = () => {
        if (this.stopped || this.suspended) return;
        void this.reconnect('drop');
      };
      ws.onmessage = (msg) => this.handleEvent(msg);
    });
  }

  /** One silent recovery per session; a second loss degrades to no-captions. */
  private async reconnect(reason: 'drop' | 'resume'): Promise<void> {
    if (this.stopped) return;
    if (reason === 'drop') {
      if (this.reconnectUsed) {
        this.errorCb?.('Live captions disconnected');
        return;
      }
      this.reconnectUsed = true;
    }
    if (Date.now() >= this.sessionDeadline) return;

    try {
      const token = await mintToken();
      if (this.stopped) return;
      this.closeSocketOnly();
      await this.openSocket(token);
      this.gateState = INITIAL_GATE_STATE;
    } catch {
      this.errorCb?.('Live captions disconnected');
    }
  }

  private handleEvent(msg: MessageEvent): void {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(msg.data as string) as RealtimeEvent;
    } catch {
      return;
    }

    if (event.type === 'conversation.item.input_audio_transcription.delta' && event.delta) {
      this.partialCb?.({ itemId: event.item_id ?? '', delta: event.delta });
      return;
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      this.finalCb?.({ itemId: event.item_id ?? '', text: event.transcript ?? '' });
      return;
    }
    if (event.type === 'error') {
      this.errorCb?.(event.error?.message ?? 'Live transcription error');
    }
  }

  private async startAudioGraph(stream: MediaStream): Promise<void> {
    const audioContext = new AudioContext();
    this.audioContext = audioContext;
    await audioContext.audioWorklet.addModule(WORKLET_URL);

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
    });
    this.sourceNode = sourceNode;
    this.workletNode = workletNode;

    workletNode.port.onmessage = (msg: MessageEvent<ArrayBuffer>) => {
      if (this.suspended) return;
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      const { state, framesToSend } = processFrame(
        this.gateState,
        new Int16Array(msg.data),
        DEFAULT_GATE_CONFIG
      );
      this.gateState = state;

      for (const frame of framesToSend) {
        this.ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: pcmFrameToBase64(frame.buffer as ArrayBuffer),
          })
        );
      }
    };

    sourceNode.connect(workletNode);
  }

  private closeSocketOnly(): void {
    if (!this.ws) return;
    this.ws.onclose = null;
    this.ws.onerror = null;
    this.ws.onmessage = null;
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    this.ws = null;
  }

  private teardown(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }
    this.audioContext = null;
    this.closeSocketOnly();
  }
}
