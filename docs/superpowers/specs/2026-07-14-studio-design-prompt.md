# Claude Design Prompt — Ordio Studio (Desktop Workspace)

> Paste-ready brief for claude.ai/design. Derived from
> `docs/superpowers/specs/2026-07-14-studio-desktop-workspace-design.md`.
> Edit to taste before prompting.

---

Design **Ordio Studio** — the desktop workspace of Ordio, an app that turns voice recordings into shareable caption-styled videos ("Wrapped for your voice"). This is the pro desk counterpart to a playful mobile app: one clip at a time, deep editing, everything visible at once.

## Brand & aesthetic

- **Energy:** bold consumer, expressive creator-social — Spotify Wrapped / Splice / TikTok Studio, NOT enterprise-minimal, NOT Linear/Notion restraint. But this is a *desk*, so the boldness lives in the accents, type, and motion — the working surfaces stay deep and calm so the video content is hero.
- **Palette (Acid):** base ink `#0A0B0A`, surfaces stepping up to `#26282B`. Signature accent: electric lime `#C6FF3D` (always ink text on lime fills). Signal gradient lime→cyan `#C6FF3D → #6BE0FF` reserved for live-audio states and the record orb only. No purple gradients, no glow soup.
- **Type:** Clash Grotesk (display, 600/700) + Satoshi (body/UI, 500/700/900). Big expressive display type for empty states and celebratory moments; dense confident UI type for panels.
- **Shape & motion:** chunky radius (24–30px cards), tactile spring motion. Panes never appear/disappear — their *contents* morph and ghost.

## The frame (constant across all states)

A persistent three-pane workspace, desktop 1440×900:

- **Top bar:** clip title (editable inline), ⌘K hint chip, lime Export button, account avatar.
- **Left rail (280px):** morphs between two identities — the **clip library** (list of recordings with duration, waveform thumbnail, processing badges) and the **transcript editor** (the loaded clip's words, editable like a doc, with a compact "‹ Library" header).
- **Center stage:** the video preview canvas (vertical 9:16 video floating on the dark stage), with a **✦ prompt bar** docked beneath it — a single input that reads "record, drop, or ask anything…". This prompt bar is the signature element: it is both command palette and AI copilot.
- **Right inspector (320px):** stacked sections — Caption Style, Background, Audio — always visible, morphing per state. Not modals.
- **Bottom timeline strip (full width, 96px):** zoomable waveform in lime on ink, word markers, silence regions shown as dim heat bands, trim handles, playhead.

## The five states to design (same frame, morphing contents)

1. **Idle** — left rail shows library; stage shows a large record orb (lime→cyan gradient, breathing) above the prompt bar; inspector shows mic/input settings; timeline ghosted. Display-type headline over the stage: "What are we making today?"
2. **Capture** — stage becomes a live waveform reacting to voice with live captions appearing word by word; timer; rails ghost out. Record orb becomes a stop control.
3. **Processing** — the new clip appears in the library with a progress ring; the transcript **streams into** the left rail word by word as transcription returns; user can already record again. Non-blocking, no full-screen spinner ever.
4. **Edit** — the full desk: transcript left (some words shown struck-through in red-dim = cut ranges), video preview center, prompt bar showing a typed command ("remove all the ums"), inspector right, timeline strip fully active.
5. **Export** — stage morphs into a **format matrix**: 9:16, 1:1, 16:9 previews side by side, each with correct caption safe-areas; inspector becomes a render queue with per-format progress bars; transcript dims.

## Two hero moments (design these as dedicated screens)

- **⌘K overlay:** command palette floating over a dimmed desk — fuzzy-matched actions ("Set caption style → Karaoke", "Trim silence", "Export all formats") with keyboard hints.
- **Copilot diff gate:** the AI proposed cuts — transcript words highlighted for deletion, a floating accept/reject card ("Cut 4 filler words · 2.3s shorter") with lime Accept. AI never applies silently; this review moment should feel satisfying, not modal-heavy.

## Interactions worth showing

- Captions are draggable directly on the video preview (show snap guides).
- Deleting transcript text visually strikes it and shades the matching region on the timeline waveform.
- Whole window is a drop target — show the drop state (lime dashed border, "drop audio or video").

Make it feel like the love child of Spotify Wrapped's confidence and a pro tool's density. Screenshottable, kinetic, but the video always wins the eye.
