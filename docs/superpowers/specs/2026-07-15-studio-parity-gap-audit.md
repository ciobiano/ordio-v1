# Studio Desktop: Parity Gap Audit

**Date:** 2026-07-15
**Status:** Audit — input to the next studio plan
**Scope:** Everything missing/broken in `/studio` vs. mobile `/create`, with the reason each gap exists and the recommended fix order.

## Root cause summary

The studio shipped as **Slice 1 of 7** from `2026-07-14-studio-desktop-workspace-design.md`. Slices 2–7 (EDL transcript editing, action registry + ⌘K + prompt bar, copilot, export matrix, direct-manipulation captions, clip finder) were deliberately deferred — that explains the empty prompt bar, the 2-item command palette, and the bare timeline.

But Slice 1's own milestone was *"usable studio at feature parity with mobile"*, and that bar was **not met**. Three kinds of gaps exist:

1. **Bugs** in what was built (recording never transcribes, export view is blank, clip switching doesn't rehydrate).
2. **Mobile-parity features silently dropped** from Slice 1 (delete, upload, pause/resume, error handling, enhance tier, upgrade gating, the custom user button).
3. **Deferred slices** (correctly out of scope then, still needed now).

---

## 1. Bugs in the current build (fix first — these make Slice 1 non-functional)

### 1.1 Stop recording never transcribes ⛔
`useStudioFlow.stopRecording` (`apps/web/src/hooks/studio/useStudioFlow.ts:58`) calls `recorder.stopRecording()` and then synchronously reads `recorder.audioBlob`. The blob is only set asynchronously in `MediaRecorder.onstop` (`useAudioRecorder.ts:84`), so it is **always `null`** at that point → `processAudio` is never called → the view sits in `processing` at 0% forever. This is the "whole process doesn't transcribe" complaint.
**Fix:** either await a blob promise from the recorder (add a `stopAndGetBlob(): Promise<Blob>` API), or mirror mobile's `review` state where `handleProceed` runs after the blob lands in state.

### 1.2 Export view renders a blank stage ⛔
`flow.goExport()` sets `view = 'export'`, but `CenterStage` has **no `export` branch** — TopBar's "Export ↗" and the ⌘K "Export all formats" action both lead to an empty center pane with no way back except ‹ Library. The spec's Export state (9:16 · 1:1 · 16:9 matrix) is Slice 5, but even a Slice-1 fallback (reuse mobile's `ExportState` components: `ExportCanvas`, `ExportControls`, `ShareCard`) was never mounted.
**Fix (interim):** mount the existing mobile export components for the loaded session; upgrade to the matrix in Slice 5.

### 1.3 Switching clips doesn't rehydrate
`useSessionHydration` bails when `audioBuffer` is already set in the capture store (`useSessionHydration.ts:42`). Open clip A, then click clip B in the Library → B's `sessionId` is set but A's audio/transcript stay loaded. Also nothing clears the store on `goIdle`.
**Fix:** key hydration on `sessionId` change and reset the capture/processing stores when the session changes or on `goIdle`.

### 1.4 Feature gates are a no-op
`StudioDesk` passes `onLocked={() => {}}` to `RightInspector`. On mobile, locked style options open `UpgradeSheet`. On desktop, clicking a locked control does nothing.
**Fix:** wire `setUpgradeTarget` + mount `UpgradeSheet` (or a desktop-appropriate dialog).

### 1.5 Clip title is hardcoded
TopBar always shows `"Untitled recording"` — `session.name` exists in Convex and is shown in the Library rail, but never fed to the TopBar. No rename either (mobile also lacks rename; Convex has no `renameSession` mutation yet).

### 1.6 Processing errors are unhandled
`useStudioFlow.stopRecording` doesn't try/catch `processAudio`, which throws `AudioProcessingError`. Mobile maps failures to `ProcessingAlertBanner` with stage-specific recovery ("turn enhancement off and retry"). Desktop: unhandled rejection, view stuck.
**Fix:** port `buildProcessingAlert` handling from `useCreateFlow.ts:91`.

---

## 2. Mobile-parity features missing on desktop (Slice 1 debt)

| Feature | Mobile implementation | Desktop status | Fix |
|---|---|---|---|
| **Delete recording** | `CaptureSidebar.tsx` — swipe reveal + `AlertDialog` confirm + `api.sessions.deleteSession` | Absent — Library rows have no delete affordance | Hover-reveal trash icon per row + same confirm dialog + same mutation |
| **File upload / drag-drop** | `UploadActionSheet`, `FileConfirmDialog`, `validateFile` | Absent — idle copy *promises* "drop a file anywhere" but there is no dropzone and no file input | Window-level dropzone (spec: "the whole window is a dropzone in every state") + `FileConfirmDialog` reuse |
| **Pause / resume recording** | `recorder.pauseRecording/resumeRecording` wired in CaptureScreen | Absent — capture view has stop only | Add pause/resume to capture controls; recorder hook already supports it |
| **Review-before-process state** | stop → review (restart / proceed / cancel) | Absent — stop jumps straight to processing | Optional; at minimum fixes bug 1.1 |
| **Audio enhance tier** | `AudioSettings.tsx` — Standard / Clean / HD radio, feature-gated | Absent — inspector idle view shows only a fake mic card | Mount `AudioSettings` in inspector (idle + capture), it's already a self-contained component |
| **Upgrade sheet** | `UpgradeSheet.tsx` on locked features | Absent (see bug 1.4) | Wire it |
| **User button** | `UserAvatarButton.tsx` — custom avatar picker (localStorage), name/email, Manage Account, Sign Out | Stock Clerk `<UserButton>` in TopBar — the user explicitly replaced this pattern long ago on mobile | Replace TopBar's `<UserButton>` with `UserAvatarButton` |
| **Processing failure banner** | `ProcessingAlertBanner` with stage-specific recovery actions | Absent | Port (see bug 1.6) |
| **VAD / speaking indicator** | `useVAD` drives `isSpeaking` | Absent — capture waveform is `sin()` decoration, "Clean signal" label is hardcoded | Wire `useVAD` + real analyser data into the capture waveform and inspector meter |
| **Enhancement failed dialog** | `EnhancementFailedDialog.tsx` | Absent | Include with error-handling port |
| **Recording settings** | `RecordingSettingsSheet` | Absent | Fold into inspector Input section |

## 3. Design-spec features never implemented anywhere (deferred slices — the "misconfigured" surfaces)

| Surface | Current state | Spec home | Notes |
|---|---|---|---|
| **Mic/input device picker** | Inspector shows a static, non-interactive "System default ▾" card | Spec: Idle inspector = "Mic/input settings" | Not implemented on mobile either — needs `navigator.mediaDevices.enumerateDevices()` + `deviceId` constraint in `useAudioRecorder`, with hot-plug (`devicechange`) updates so external mics appear when the system recognizes them |
| **⌘K / "Search actions"** | Palette exists but has exactly 2 actions; TopBar search field is just a trigger | Slice 3 (action registry) | The registry is load-bearing: registry → palette, prompt-bar parser, copilot all consume the same actions. Don't hand-add palette items; build the registry |
| **Prompt bar** | Renders with a permanently `disabled` submit button; not even a real `<input>` | Slice 3 (tier 1) / Slice 4 (LLM) | Same registry dependency |
| **Timeline strip** | Empty gray block + playhead + click-to-seek only | Slice 1 promised "basic timeline strip **with trim**"; waveform/word-markers/heatmap are Slice 2+ | Minimum viable now: render the real waveform from the loaded `AudioBuffer` (sampler exists in `packages/shared`) + port mobile `TrimPanel`'s trim handles |
| **Transcript editing** | Words render with `cursor-pointer` and the label "Click a word to cut it" — clicking does nothing | Slice 2 (EDL) | Either build the EDL cut-list or remove the misleading copy until it lands |
| **Transcript streaming during processing** | Left rail shows Library during processing | Spec: transcript streams into left rail as Whisper returns | Small: `flow.transcript` already updates live |
| **Non-blocking processing** | Processing copy claims "you can keep recording, this won't block you" — false; the view is modal | Spec: background queue + library badge | Copy lies today; fix copy now, queue later |
| **Export matrix** | Nothing (see bug 1.2) | Slice 5 | Interim: reuse mobile ExportState |
| **Background picker** | Placeholder card ("ships once video-backgrounds lands on this branch") | Depends on video-backgrounds branch | Legitimately blocked; leave |
| **IndexedDB crash-safety for recordings** | Not implemented | Spec: Error Handling section | Applies to mobile too |
| **Direct-manipulation captions / clip finder** | Not implemented | Slices 6–7 | Later |

## 4. Recommended fix order

**Phase A — make Slice 1 true (bugs + parity, no new architecture):**
1. Fix stop→transcribe race (1.1) + error handling port (1.6).
2. Mount export view interim using mobile ExportState (1.2).
3. Session switching/rehydration + store reset (1.3).
4. Library delete (Convex mutation already exists).
5. Window dropzone + file upload + FileConfirmDialog.
6. Replace Clerk `UserButton` with `UserAvatarButton`; feed real `session.name` to TopBar.
7. Inspector: mount `AudioSettings` (enhance tier), wire `UpgradeSheet`, pause/resume in capture.
8. Real mic device picker (enumerateDevices + deviceId in `useAudioRecorder`, `devicechange` listener) — benefits mobile too.
9. Timeline: real waveform render + trim handles (TrimPanel port).
10. Remove/soften copy that promises unbuilt behavior ("drop a file anywhere" — until #5 lands, "keep recording won't block you", "Click a word to cut it").

**Phase B — the desktop-defining slices, in spec order:** Slice 2 (EDL + transcript editing) → Slice 3 (action registry + ⌘K + prompt bar tier 1) → Slice 4 (copilot) → Slice 5 (export matrix) → 6/7 on signal.

Phase A has no unresolved design questions — every item reuses an existing mobile component, hook, or Convex mutation. It should be one plan (`superpowers:writing-plans`) executed as a single slice.

---

## Appendix: Claude Design handoff (source of truth for visuals)

`~/Downloads/Ordio Studio Desktop Workspace-handoff.zip` → `project/Ordio Studio.dc.html` (1440×900 mock, read 2026-07-15). Deltas the mock specifies beyond the current build:

- **Top bar:** clip title is *editable inline* (contenteditable); avatar is a branded initials chip, not stock Clerk.
- **Idle inspector (Input):** actual mic device name with dropdown (`MacBook Pro Mic ▾`), **live input level meter** (16 bars, red clip zone), Noise suppression toggle, Auto-transcribe toggle, Sample rate readout.
- **Capture:** live caption stream (word-by-word) under the waveform; left/right rails ghost under blur scrims; inspector shows live meter + "Peak −6 dB · no clipping".
- **Processing (center):** streaming transcript card + `Open in editor` / `Record again` buttons — non-blocking; library rows show a progress ring while transcribing.
- **Library rows:** mini-waveform thumbnails, active row accent border + left bar, meta like `today · 47s`.
- **Transcript pane:** words toggle cut on click — red strikethrough; header shows duration.
- **Edit stage:** caption is directly draggable on the stage with center snap guides (crosshair lines while dragging).
- **Timeline:** ~150-bar real waveform; silence bars dimmed (#2A2E2A), cut ranges red; time ruler (0:00/0:16/0:31/0:47); `− Zoom +` control; draggable playhead with square grab handle.
- **⌘K:** 8 actions with icons + shortcut chips (set caption style, trim silence, ask copilot to remove fillers, export all formats, change background, split at playhead, duplicate clip, new recording); input placeholder "record, drop, or ask anything…".
- **Copilot diff gate:** bottom-center card — summary ("Remove 4 filler words — tightens by 2.3s"), inline strikethrough preview, `Accept cuts` / `Keep as is`.
- **Drop overlay:** full-window dashed lime dropzone, "MP3, WAV, MP4, MOV — we'll transcribe it instantly."
- **Export:** 3-up format matrix with dashed caption safe-areas; render queue rows with per-format progress; Quality/Destination card; `+ Add format`.
- **Brand:** lime `#C6FF3D` + cyan `#6BE0FF` accents on `#0A0B0A`; Clash Grotesk (display) + Satoshi (body).
