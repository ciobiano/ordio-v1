// Vendor-agnostic seam for live (during-recording) transcription.
// The live layer is disposable UI feedback — the authoritative transcript
// always comes from the post-recording /api/transcribe pass. Implementations
// must therefore fail sideways (emit onError, go silent), never block recording.

export interface LivePartialEvent {
  /** Vendor's utterance/item id — deltas for one utterance share an id. */
  itemId: string;
  /** Incremental text fragment for the in-progress utterance. */
  delta: string;
}

export interface LiveFinalEvent {
  itemId: string;
  /** Complete text of the finished utterance (replaces its accumulated deltas). */
  text: string;
}

export interface LiveTranscriber {
  /** Begin streaming from the given mic stream. Resolves once connected. */
  start(stream: MediaStream): Promise<void>;
  /** Tear down socket + audio graph. Safe to call repeatedly. */
  stop(): void;
  onPartial(cb: (event: LivePartialEvent) => void): void;
  onFinal(cb: (event: LiveFinalEvent) => void): void;
  onError(cb: (message: string) => void): void;
}
