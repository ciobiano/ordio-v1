# Ordio

Turns anything with speech in it into a caption-styled video. Record in the browser or drop in an audio file or a video clip; Ordio transcribes with word-level timings and renders animated captions over a background you choose.

**Live at [ordio.space](https://ordio.space).** Free, no billing.

### Writeup

**[You can't unit-test a speech model](https://ordio.space/writing/you-cant-unit-test-a-speech-model)** — building an evaluation harness for the transcription pipeline, and what it found: a real data-loss bug on long audio, a wrong reference inside a public benchmark, and two wrong references of my own.

The short version: this repo has 700 passing tests and not one of them could tell whether the speech model was any good. Exact-answer tests can't score a model that returns *approximately* the right thing. The harness that can is in [PR #20](https://github.com/ciobiano/ordio-v1/pull/20), along with a 20-sample golden dataset and the findings written up in full.

---

## How it works

Audio in, captioned video out, with the expensive parts kept off the server.

- **Transcription runs twice.** Live captions stream from OpenAI's Realtime API while you record, as disposable feedback. When you stop, the recording goes to Whisper for the authoritative pass, because the captions need word-level timestamps.
- **Rendering and encoding happen in the browser.** Frame rendering is a pure function; encoding is WebCodecs, with an ffmpeg.wasm fallback for Safari. Export costs nothing per use, which is what makes the product free.
- **Credits are a spend cap, not a price.** The API calls are the only per-use cost, so they are metered. A one-time welcome grant is the only way credits enter an account, which bounds lifetime cost per user structurally rather than by trust.

Accepted input: fourteen audio formats plus `mp4`, `mov`, `mkv`, and `webm`, with the audio track extracted from video automatically.

## Stack

Next.js 15 and React 19 on TypeScript, Convex for backend and storage, Clerk for auth, Zustand for client state, Turborepo and pnpm workspaces. Transcription is OpenAI Whisper; optional audio enhancement runs on Modal GPUs.

## Layout

```text
apps/
  web/           # Product UI — recording, transcription, caption editing, export
packages/
  convex/        # Convex functions and schema
  engine/        # Rendering, encoding, media pipeline
  shared/        # Zod schemas, credit arithmetic, types shared across packages
  evals/         # Transcription eval harness — see PR #20
services/
  audio-enhance/ # Python GPU service for optional audio cleanup
```

## Running locally

Requires Node 18+ and pnpm 8+.

> If `pnpm` fails with `No such built-in module: node:sqlite`, your pnpm is newer than your Node. Either use the pinned `pnpm@8.10.0` from `packageManager`, or move to Node 22+.

```bash
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with your Clerk keys, `NEXT_PUBLIC_CONVEX_URL`, and `OPENAI_API_KEY`. Clerk **production** keys only work on `ordio.space`, so use development keys locally or auth will fail with an origin error.

Run the backend and the app in separate terminals:

```bash
pnpm --filter @Ordio/convex dev
```

```bash
pnpm --filter web dev
```

`pnpm dev` starts every workspace process at once if you prefer.

## Commands

```bash
pnpm build        # all packages
pnpm test         # full suite
pnpm type-check
pnpm lint
pnpm format
```

Run the transcription eval (needs `OPENAI_API_KEY` exported in your shell, and it spends money):

```bash
pnpm --filter @Ordio/evals eval
```

Add `--rescore` to re-score the transcripts already on disk instead of calling the API. That is free, and more importantly deterministic — the model returns different text between runs, so a fresh run confounds "my reference changed" with "the model drifted."

## Notes

- Keep `main` green: `lint`, `type-check`, and tests before merge.
- Validate Convex changes against a local `convex dev` before pushing.
- Deploy order is load-bearing: **Convex before Vercel**, or the web app calls functions that do not exist yet.
- Never commit secrets. Rotate anything exposed immediately.

## License

MIT. See [LICENSE](./LICENSE).
