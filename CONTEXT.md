# Ordio

Ordio turns a voice recording into a shareable captioned video. A person records or
uploads audio, Ordio transcribes it, styles the captions and waveform, and encodes an
MP4. It is a free portfolio project — it takes no money.

## Language

### The work being made

**Session**:
One unit of work: a single Recording together with its Transcript, Style and Background.
The thing a person opens, edits and exports.
_Avoid_: project, video, document, file

**Recording**:
The captured audio of a Session, whether spoken into the microphone or uploaded.
_Avoid_: audio, take, clip

**Draft**:
An unfinished Recording held on the person's own device so a crash or closed tab does not
lose it. A Draft is not yet a Session.
_Avoid_: autosave, backup, cache

**Episode**:
An uploaded long-form Recording that is too long to publish whole, and is mined for Clips
instead of being used as-is.
_Avoid_: podcast, long audio, source

**Clip**:
A short excerpt proposed from an Episode, offered to the person as a candidate Session.
_Avoid_: segment, highlight, snippet, cut

### The words on screen

**Word**:
The smallest unit of a Transcript: one piece of text with a start time and an end time.
_Avoid_: token, segment

**Transcript**:
The full ordered list of Words for a Recording.
_Avoid_: text, captions, subtitles

**Caption**:
Transcript text as it is drawn on the video. A Caption is what the viewer sees; a
Transcript is what Ordio knows.
_Avoid_: subtitle, overlay, text layer

### How it looks

**Style**:
The complete visual configuration of a Session — caption appearance, waveform, colours,
layout, motion.
_Avoid_: theme, config, settings, preset

**Look**:
One complete Style proposed by the Director. Looks are offered three at a time and are
accepted or rejected whole.
_Avoid_: preset, template, variant

**Director**:
The feature that proposes Looks for a Session by reading its Transcript.
_Avoid_: AI stylist, auto-style, magic

**Background**:
The image or looping video drawn behind the waveform and Captions.
_Avoid_: wallpaper, backdrop

**Waveform**:
The moving visualisation of the Recording's audio drawn on the video.
_Avoid_: visualizer, spectrum, audio graph

### What things cost

**Credit**:
The unit of transcription spend. Credits are a ceiling that stops runaway cost, not a
price — nothing in Ordio is for sale.
_Avoid_: token, balance, currency, payment

**Enhance**:
Optional cleanup of a Recording's audio before transcription.
_Avoid_: denoise, master, process

**Export**:
Encoding a finished Session into an MP4 file.
_Avoid_: render, download, publish, save

### How the code is arranged

**Mobile** and **Desktop**:
The two separate implementations of Ordio's interface. They serve the same Sessions and
share the same Style system, but share no components. See ADR 0001 for why.
_Avoid_: soul, desk, studio, phone, workspace

**Media component**:
A heavyweight component specific to Ordio — canvas, WebGL, waveform drawing.
_Avoid_: primitive

**UI component**:
A generic interface atom with no knowledge of Ordio — buttons, sheets, sliders.
_Avoid_: primitive, atom
