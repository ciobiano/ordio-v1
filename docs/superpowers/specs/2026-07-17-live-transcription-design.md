# Live Recording Transcription — Design Spec

**Date:** 2026-07-17
**Status:** Approved direction, pending final review
**Owner route:** `/create` (mobile capture flow)

## 1. Goal

Show live captions while the user records, replacing the nothing-at-all that exists today (the old Web Speech layer was removed; the recording screen currently shows only waveform bars). The live captions are **disposable feedback UI** — the authoritative word-timestamped transcript still comes from the existing post-recording Whisper pass (`/api/transcribe`), which this feature must not touch.

## 2. Constraints

- **Vendor: OpenAI only.** ~$4.72 of existing API credit; no second-vendor signup. Minimize per-recording cost.
- **Mobile Safari + Chrome** are the priority platforms (iOS first).
- **No long-lived stateful server.** Stateless Next.js API routes only; the browser talks to OpenAI directly.
- Recordings are 30s–5min voice memos. Free-tier users exist, so cost per recording must be near-noise and abuse must be capped.

## 3. Model decision

**Primary: `gpt-4o-mini-transcribe` (latest snapshot, currently `-2025-12-15`) via an OpenAI Realtime transcription session.**

| Option | Live cost / 3-min | Why / why not |
|---|---|---|
| **gpt-4o-mini-transcribe** | **~$0.009** | Cheapest OpenAI streaming path. Dec-2025 snapshot claims ~90% fewer hallucinations than Whisper v2 in noisy audio with silence gaps — exactly voice-memo conditions. |
| gpt-realtime-whisper | ~$0.051 | Docs' official "live audio streams" recommendation; purpose-built for low latency. 5.7x cost. **Designated fallback if mini's caption latency disappoints in QA — a config-level model swap.** |
| gpt-4o-transcribe | ~$0.018 | Accuracy overkill for disposable captions. |
| AssemblyAI et al. | ~$0.0075 | Cheapest overall but requires a second vendor account — rejected by constraint, not by merit. Interface keeps the door open. |

All-in cost per 3-min recording ≈ **$0.027** (live ~$0.009 + existing whisper-1 final ~$0.018) → current credit covers **~175 recordings**.

GPT-Live (July 2026) is a speech-to-speech conversational family; not applicable to captions.

## 4. Architecture

Two consumers of one mic `MediaStream`; the existing path is untouched.

```
getUserMedia (48kHz)
 ├─ MediaRecorder (existing, useAudioRecorder.ts) ──► webm blob ──► /api/transcribe (whisper-1)  [UNCHANGED]
 └─ AudioWorklet (new) ─ downsample 48k→16k, Float32→Int16 PCM
      └─ VAD gate (reuse useVAD signal) ─ drop silent frames
           └─ WebSocket ──► OpenAI Realtime transcription session
                 ├─ partial events ──► interim caption (muted style)
                 └─ final events  ──► committed caption line
```

### 4.1 Token flow
- New route `POST /api/realtime/transcription-token` (Clerk-gated, stateless):
  server calls OpenAI with the secret key, creates an ephemeral client token for a
  transcription-only Realtime session, returns it. Secret never reaches the browser.
- Tokens are short-lived; on WS disconnect, re-mint and reconnect. The live layer is
  disposable, so a brief caption gap during reconnect is acceptable — no buffering/replay.

### 4.2 Client pieces (new)
| Piece | Responsibility |
|---|---|
| `LiveTranscriber` interface | `start(stream)`, `stop()`, `onPartial(cb)`, `onFinal(cb)`, `onError(cb)`. Vendor-agnostic seam. |
| `OpenAILiveTranscriber` | Implements the interface: token fetch → WS session config → PCM streaming → event mapping. |
| `pcmWorklet.ts` (AudioWorkletProcessor) | 48k→16k downsample + Int16 conversion, posts frames to the transcriber. |
| `useLiveTranscription` hook | React glue: owns transcriber lifecycle tied to recording phase, exposes `{ interimText, committedLines, liveError }`. |
| Caption strip UI in `CaptureScreen` | Renders interim (muted) + committed lines above the dock during `recording` phase. |

### 4.3 Cost guardrails
- **VAD-gated frames:** reuse the existing `useVAD` signal; stop sending PCM during silence (Realtime bills on audio input).
- **Hard session cap:** auto-close the WS at 6 minutes; token route enforces per-user rate limits (N tokens/hour) and Clerk auth.
- **Open late, close early:** socket opens on record-start, closes immediately on stop/pause-into-stop. Never idle-hold.
- Pause during recording → stop sending frames (keep socket if pause < ~20s, else close and re-mint on resume).

### 4.4 State exits (per project design rule)
Every failure lands somewhere safe, and recording NEVER blocks on the live layer:
- Token mint fails → captions silently absent, toast once ("Live captions unavailable"), recording proceeds.
- WS drops mid-recording → one silent reconnect attempt; if that fails, degrade to no-captions. Recording proceeds.
- Worklet unsupported (ancient browser) → feature-detect, skip live layer entirely.
- User cancels recording → transcriber `stop()` in the same teardown as `resetRecording`.

## 5. Non-goals (this iteration)

- No change to the final `/api/transcribe` whisper-1 pass (a Groq/gpt-4o-mini-transcribe A/B for the final pass is a separate future evaluation).
- No Web Speech fallback tier in v1 — the failure mode is "no captions," which is today's status quo. Can add `WebSpeechLiveTranscriber` behind the interface later if demand exists.
- No persistence of live captions; they are discarded when the final transcript arrives.
- No diarization, no translation.

## 6. Testing

- Unit: PCM downsample math; `LiveTranscriber` event mapping (mock WS); token route auth + rate-limit branches (mock OpenAI).
- Integration: `useLiveTranscription` lifecycle across phase transitions (idle→recording→paused→ready), including error branches above.
- Manual QA on real iOS Safari: latency feel, VAD gating doesn't clip word onsets (lead-in buffer of ~300ms before gate opens), screen-lock behavior.

## 7. Risks

- **Realtime session config drift** — OpenAI's transcription-session API surface is newer than whisper-1; pin to documented session params and verify against current docs at implementation time.
- **VAD gating clipping first syllables** — mitigate with a short pre-roll buffer flushed when speech starts.
- **iOS screen lock** drops the WS — acceptable; MediaRecorder has the same constraint and the final pass recovers everything.
- **Token route abuse** — mitigated by Clerk gate + rate limit + session cap (see 4.3).

## 8. Implementation phases

1. **MVP:** token route → worklet → `OpenAILiveTranscriber` → caption strip in `CaptureScreen`. No VAD gating yet (correctness first).
2. **Guardrails:** VAD gating + pre-roll, rate limiting, session caps, reconnect-once.
3. **Polish/defer:** latency QA vs `gpt-realtime-whisper` swap decision; caption animation; strip the leftover debug fetch in `useTranscription.ts:30-49` while in the area.

## Sources

- OpenAI Dec-2025 audio snapshots (hallucination improvements, pricing unchanged): https://developers.openai.com/blog/updates-audio-models
- OpenAI speech-to-text guide (current model lineup + realtime guidance): https://developers.openai.com/api/docs/guides/speech-to-text
- OpenAI May-2026 realtime audio models incl. gpt-realtime-whisper $0.017/min: https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/
- GPT-Live launch (context; not applicable to captions): https://techcrunch.com/2026/07/08/openai-releases-new-voice-models-for-more-natural-live-conversations/
- Comparative streaming STT research (AssemblyAI/Deepgram/Groq/on-device), 2026-07-17 agent run — retained for the vendor-swap seam rationale.
