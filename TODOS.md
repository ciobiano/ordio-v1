# TODOs

Deferred items surfaced during plan review. Each entry: what, why, pros/cons, context, dependencies.

---

## iOS native voice-note import

**What:** Build an Apple Shortcuts integration (or equivalent) so iOS gets a share-sheet-like path into Ordio, since the PWA Web Share Target API has no iOS Safari implementation (WebKit bug #194593, open since 2019).

**Why:** iOS is likely the majority platform for Ordio's target users. The P0 wedge (voice-note import) ships Android-only via `share_target`; iOS falls back to the existing upload flow with onboarding copy. That's a real gap in reaching the audience the positioning research (WhatsApp voice notes, 84% Gen Z) was built around.

**Pros:** Closes the platform gap; gets closer to "native share" feel on iOS; strengthens the core positioning bet.

**Cons:** 2-3 day build; still requires a manual one-time Shortcut install (not truly zero-friction); one more platform-specific artifact to maintain.

**Context:** Rejected for P0/P1 in the eng review (2026-07-05) on cost/friction grounds. `apps/web/src/app/manifest.ts` will have `share_target` added for Android only in this phase.

**Depends on / blocked by:** Should follow the wedge-measurement TODO below — build this once data shows the wedge is working and iOS absence is the binding constraint, not before.

---

## Audio-hash Whisper transcription cache

**What:** A Convex table/index keyed by audio content hash, so re-processing the same audio (re-edits, retries, re-opens) skips re-transcription.

**Why:** The v1 spec (§2.5) calls for this as a cost control, but the eng review didn't design the hash function or cache table shape — left as an implementation detail.

**Pros:** Meaningful Whisper cost reduction on any repeat-processing path (retries, session re-opens, future retake-by-phrase in P6).

**Cons:** None significant — small, self-contained addition.

**Context:** Surfaced during the P0/P1 eng review (2026-07-05). Low architectural risk; safe to design at implementation time.

**Depends on / blocked by:** None.

---

## Growth-loop measurement for the voice-note wedge

**What:** Instrument voice-note-import share of sessions (already a spec §12 success metric), specifically segmented as Android-share-target-driven imports vs. iOS/manual upload-fallback imports.

**Why:** The outside-voice review pass flagged that the wedge likely reaches a small slice of users at launch (PWA install friction generally + Android-only share_target). We won't know if that's true, or how much, without measuring it directly rather than inferring from the aggregate "voice-note-import share" metric alone.

**Pros:** Turns a strategic guess into a data-backed decision; directly informs whether the iOS-Shortcuts TODO above is worth building.

**Cons:** Requires adding platform/entry-point segmentation to analytics that might otherwise just track aggregate session source.

**Context:** Surfaced during the P0/P1 eng review (2026-07-05), from the outside-voice pass.

**Depends on / blocked by:** Blocks the iOS native import TODO — that decision should wait on this data.

---

## Real-time live captioning during recording

**What:** Replace the mocked live-caption cycling in the Unified Capture screen's `useMockLiveCaption` hook with a real streaming transcript — either Web Speech API interim results while `isSpeaking` is true, or streaming Whisper if Web Speech accuracy/browser coverage proves insufficient.

**Why:** The Unified Capture screen design (`docs/superpowers/specs/2026-07-07-unified-capture-screen-design.md`) calls for a live word-by-word caption while voice is detected during recording, matching the original Claude Design mockup. The mockup's caption was faked with canned phrases since it's a prototype; today's app has no live/streaming transcription source (`useTranscription.transcribeAudio` only runs once, post-recording, via batch Whisper). Per user direction, the mock ships now so the UI/animation exists, with real data wired in later.

**Pros:** Closes the gap between the shipped UI and the original design intent; gives users real-time feedback that their words are being captured correctly (catches misheard words before processing).

**Cons:** Web Speech API has inconsistent browser support (no Safari on iOS as of last check) and no server-side control over accuracy; streaming Whisper needs a websocket/chunked-upload pipeline that doesn't exist yet — either path is a real build, not a quick swap.

**Context:** Deferred during Unified Capture screen implementation (2026-07-07). The mock is isolated behind a single hook (`useMockLiveCaption(isSpeaking)` in `apps/web/src/components/soul/capture/`) specifically so this replacement only touches that one file, not the phase/status wiring around it.

**Depends on / blocked by:** None — can be picked up independently once a transcription approach is chosen.
