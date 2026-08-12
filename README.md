# Ordio

**Turn a recording into a video people will actually watch.**

Audio does not travel on social platforms. Video does, and most of it is watched on mute, which makes the captions the product rather than a decoration on it. Ordio takes a voice recording, or the audio track of a clip you already have, and returns a captioned video timed word by word.

Live at **[ordio.space](https://ordio.space)**.

## Why another one of these

Captioning tools often use marketing buzzwords to describe how well they capture your voice. No one shares specific numbers. This is important because professional narrators in the US and UK set the standards, and many of us don’t sound like them.

We’re measuring accuracy here, specifically on accented speech, and including imperfect parts.

```
split                  words   sub   del   ins     WER  accuracy
clean (8)                660    21    19     1  0.0621     93.8%
other (8)                674    23     2     1  0.0386     96.1%
africa-quiet (3)          579    54    23    15  0.1589     84.1%
OVERALL                 1988   106    57    18  0.0910     90.9%
```

The first run surfaced a silent truncation on long-form audio, a wrong reference inside LibriSpeech itself, and two wrong references of my own. Method and findings: **[You can't unit-test a speech model](https://ordio.space/writing/you-cant-unit-test-a-speech-model)**. Harness and dataset: [PR #20](https://github.com/ciobiano/ordio-v1/pull/20).

## Pipeline

```text
capture ──► decode ──► [enhance] ──► transcribe ──► render ──► encode
 mic or      Web        Modal GPU     Whisper       canvas     WebCodecs
 file        Audio      (optional)    word-level    per frame  → MP4
             API                      timestamps
```

Everything from `render` onward executes in the browser. `renderFrame()` is a pure function of `(waveform, words, style, t)`, which is what makes the preview and the exported file identical by construction rather than by two implementations agreeing.

Encoding is WebCodecs with an ffmpeg.wasm fallback for Safari, selected at runtime by feature detection rather than user-agent.

## Transcription

Two passes, for two different reasons.

**Live captions** stream from the Realtime API (`gpt-4o-mini-transcribe`) during capture. These are disposable UI feedback and are never persisted.

**The authoritative pass** sends the finished recording to Whisper with `timestamp_granularities: ['word', 'segment']`. Word-level timestamps are the load-bearing output: the caption renderer keys every animation off them, so a transcript that is textually perfect and 400ms out of sync is a broken result.

Whisper is not deterministic and has no single correct output, so it cannot be covered by the repo's exact-answer tests. `packages/evals` scores it as word error rate against hand-written references instead. The dataset is 16 LibriSpeech samples plus four own-voice recordings, because a benchmark-only dataset measures one narrow slice of the input distribution.

Known gap: WER measures text, not timing. A transcript can score 0.0 with every word offset. That eval is not built.

## Input handling

Fourteen audio formats plus `mp4`, `mov`, `mkv`, and `webm`. Video containers have their audio track demuxed before decode. Validation is MIME-first with an extension fallback, since browsers report `audio/mp4`, `audio/x-m4b`, or nothing at all for the same file depending on platform.

## Stack

Next.js 15, React 19, TypeScript. Convex for backend and storage, Clerk for auth, Zustand for client state. Turborepo and pnpm workspaces. Optional audio enhancement runs MossFormer2 on Modal GPUs.

```text
apps/
  web/           # Product UI: capture, transcription, caption editing, export
packages/
  convex/        # Convex functions and schema
  engine/        # Rendering, encoding, media pipeline
  shared/        # Zod schemas, credit arithmetic, cross-package types
  evals/         # Transcription eval harness (PR #20)
services/
  audio-enhance/ # Python GPU service, MossFormer2
```

## Running locally

Requires Node 18+ and pnpm 8+.

> If `pnpm` fails with `No such built-in module: node:sqlite`, your pnpm is newer than your Node. Use the pinned `pnpm@8.10.0` from `packageManager`, or move to Node 22+.

```bash
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with Clerk keys, `NEXT_PUBLIC_CONVEX_URL`, and `OPENAI_API_KEY`. Clerk **production** keys are domain-locked to `ordio.space` and fail on localhost with an origin error, so use development keys.

Backend and app run in separate terminals:

```bash
pnpm --filter @Ordio/convex dev
```

```bash
pnpm --filter web dev
```

## Commands

```bash
pnpm build
pnpm test
pnpm type-check
pnpm lint
pnpm format
```

The eval needs `OPENAI_API_KEY` exported in the shell and makes paid API calls:

```bash
pnpm --filter @Ordio/evals eval
pnpm --filter @Ordio/evals eval --rescore   # score saved transcripts, no API calls
```

`--rescore` exists because Whisper returns different text between runs. Re-running the eval after editing a reference confounds "the reference changed" with "the model drifted", so a reference edit has to be measured against held transcripts.

## Notes

- Keep `main` green: `lint`, `type-check`, and tests before merge.
- Validate Convex changes against a local `convex dev` before pushing.
- Deploy order is load-bearing: **Convex before Vercel**, or the web app calls functions that do not exist yet.
- `NEXT_PUBLIC_*` values are inlined at build time. Changing one requires a cache-free redeploy.
- Never commit secrets. Rotate anything exposed immediately.

## License

MIT. See [LICENSE](./LICENSE).
