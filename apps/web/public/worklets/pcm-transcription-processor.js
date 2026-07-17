// AudioWorkletProcessor: mono Float32 @ context rate → Int16 PCM @ 24kHz.
// Runs on the audio rendering thread; posts ~100ms ArrayBuffer frames to the
// main thread, which base64s them onto the Realtime WebSocket. Plain JS file
// because worklets load by URL, outside the Next.js bundle.

const TARGET_RATE = 24000;
const FRAME_SAMPLES = 2400; // 100ms at 24kHz

class PcmTranscriptionProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.readPos = 0;
    this.carry = new Float32Array(0);
    this.out = new Int16Array(FRAME_SAMPLES);
    this.outPos = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;

    // Concatenate leftover input with the new block so interpolation can
    // read across block boundaries.
    const input = new Float32Array(this.carry.length + channel.length);
    input.set(this.carry, 0);
    input.set(channel, this.carry.length);

    let pos = this.readPos;
    while (pos + 1 < input.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const sample = input[i] * (1 - frac) + input[i + 1] * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.out[this.outPos++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.outPos === FRAME_SAMPLES) {
        const frame = this.out.slice(0, FRAME_SAMPLES);
        this.port.postMessage(frame.buffer, [frame.buffer]);
        this.outPos = 0;
      }
      pos += this.ratio;
    }

    // Keep the tail the interpolator hasn't fully consumed.
    const keepFrom = Math.floor(pos);
    this.carry = input.slice(keepFrom);
    this.readPos = pos - keepFrom;
    return true;
  }
}

registerProcessor('pcm-transcription-processor', PcmTranscriptionProcessor);
