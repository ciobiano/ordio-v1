import type { LiveFinalEvent, LivePartialEvent, LiveTranscriber } from './types';

const REALTIME_WS_URL = 'wss://api.openai.com/v1/realtime';
const WORKLET_URL = '/worklets/pcm-transcription-processor.js';
const WORKLET_NAME = 'pcm-transcription-processor';
// Spec guardrail: never idle-hold a session past the longest expected memo.
const MAX_SESSION_MS = 6 * 60 * 1000;

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

/**
 * Streams mic audio to an OpenAI Realtime transcription session.
 * Flow: mint ephemeral token (Clerk-gated route) → WebSocket to OpenAI →
 * AudioWorklet feeds 24kHz PCM16 frames → delta/completed events map to
 * onPartial/onFinal. All failures emit onError and self-teardown; the
 * recording pipeline is never blocked.
 */
export class OpenAILiveTranscriber implements LiveTranscriber {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
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

    const tokenRes = await fetch('/api/realtime/transcription-token', { method: 'POST' });
    if (!tokenRes.ok) {
      throw new Error('Live captions unavailable');
    }
    const { token } = (await tokenRes.json()) as { token: string };

    if (this.stopped) return;

    await this.openSocket(token);
    if (this.stopped) {
      this.teardown();
      return;
    }

    await this.startAudioGraph(stream);

    this.sessionTimer = setTimeout(() => {
      this.errorCb?.('Live caption session limit reached');
      this.stop();
    }, MAX_SESSION_MS);
  }

  stop(): void {
    this.stopped = true;
    this.teardown();
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
        // Phase 2 adds one silent reconnect; v1 just goes quiet (status quo UX).
        if (!this.stopped) this.errorCb?.('Live captions disconnected');
      };
      ws.onmessage = (msg) => this.handleEvent(msg);
    });
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
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: pcmFrameToBase64(msg.data),
        })
      );
    };

    sourceNode.connect(workletNode);
  }

  private teardown(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
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
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
