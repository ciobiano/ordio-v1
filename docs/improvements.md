# The Golden Standard: A High-Agency Audio OS

Reviewing both sets of feedback, it's clear that true "High Agency" isn't just about surface-level features; it requires a bulletproof, highly scalable technical foundation that never blocks the user. A fast UI built on top of blocking, heavy hooks will ultimately feel sluggish.

Here is the raised-standard plan that merges **frictionless UX** with **engineering excellence**.

---

## 1. Zero-Friction Capture Loop
To allow users to instantly capture thoughts, the app must never stutter or drop frames.
*   **UX Standard:** Global keyboard commands (`Space` to Push-To-Talk, `Cmd+K` palette) and global window dropzones for files.
*   **Technical Standard:**
    *   **Decouple the Store:** Split the monolithic `store.ts` into atomic domains (`useCaptureStore`, `useProcessingStore`, `useUIStore`). This prevents global re-renders every time the microphone level changes.
    *   **Offload Heavy Computing:** Move media logic (`ffmpegEncoder.ts`, `videoEncoder.ts`, and VAD analysis) entirely out of React hooks and into **Web Workers** or dedicated Service Classes. This ensures the main UI thread handles keypresses and UI states at a locked 60fps without freezing during encoding.

## 2. Non-Blocking, Parallel Processing
The user should be able to queue multiple recordings at once. The moment they hit "stop", they should be able to start speaking again while the app handles the rest.
*   **UX Standard:** Optimistic UI and background task queues. Hide the processing screens; instead, use non-intrusive toast indicators ("Processing 2 items").
*   **Technical Standard:**
    *   **Formal State Machine:** Replace string-based state (`currentState === 'processing'`) with a formal state machine (like **XState**). A state machine eliminates impossible states (e.g., trying to encode while still initializing the mic) and effortlessly handles complex parallel tasks, concurrent processing, and retry flows.
    *   **Recoverable Queue:** Persist the background processing queue offline.

## 3. Bulletproof Resilience & Data Safety
A high-agency app never drops the user's data. If an enhancement API fails, or the canvas crashes, the audio must be safely recoverable.
*   **UX Standard:** The app never crashes. If a visual or AI feature fails, it degrades gracefully—you still get your audio.
*   **Technical Standard:**
    *   **IndexedDB Auto-Save:** The exact millisecond the mic STOPS recording, dump the raw audio `Blob` into an IndexedDB store *before* passing it to enhancement APIs. If the user accidentally closes the tab during processing, it restores instantly on reload.
    *   **Error Boundaries & Typed APIs:** Wrap heavy visual components (Canvas/WebGL) in Error Boundaries. Implement strict request/response Zod schemas for all API calls (like `audioEnhanceApi.ts`) so edge cases emit clean, handleable errors rather than silent failures.
    *   **Consistent Error Handling:** Implement a centralized `AppError` class and toast pattern to intercept all failures cleanly.

## 4. Hyper-Responsive Visuals & Performance
Audio-native apps need to feel tactile and instantly responsive.
*   **UX Standard:** Micro-animations that react instantly to audio spikes, paired with subtle auditory UI sounds (earcons).
*   **Technical Standard:**
    *   **Aggressive Lazy Loading:** Heavy visualizers (`WaveformDisplay`, Canvas, `Three.js` exports) should be code-split using `React.lazy()` / `Suspense`. Only load them precisely when the audio is ready.
    *   **Animation Optimization:** Enforce strict cleanup on `requestAnimationFrame` loops when inactive to save laptop battery and keep device thermals low.

## 5. Engineering Confidence
You cannot ship high-agency features if you're afraid to break the core capture loop.
*   **Technical Standard:** Integrate **Playwright / E2E tests** for the "Golden Path": `Start Recording -> Stop -> Enhance -> Export`. No merged PR should ever be able to accidentally break basic recording capabilities.

---

## Where should we raise the standard first?
> [!IMPORTANT]
> The architectural debt (monolithic store, UI-blocking media processing) natively limits the UX velocity. 
> 
> **Are you open to:**
> 1. Restructuring the State & Media logic first (Splitting the store, formally separating media services)?
> 2. Moving straight to the Non-Blocking Queue (XState or parallel task management) to deliver the "fire and forget" UX?
> 3. Implementing the Resilient Data Safety (IndexedDB autosave) so recordings are bulletproof?
