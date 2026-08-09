# The golden dataset

Audio plus the transcript it *should* produce. This directory is the eval —
everything in `../src` is just arithmetic over it.

Audio files are **not committed**. They are large, and the LibriSpeech ones are
reproducible from a public download. Reference transcripts *are* committed:
they're small, and they're the part with judgement in them.

## Where the samples come from

**LibriSpeech** ([openslr.org/12](https://www.openslr.org/12)) is the standard
ASR benchmark — public domain LibriVox audiobook recordings paired with their
Project Gutenberg text. Two test splits matter here:

| Download | What it is | Size |
|---|---|---|
| `test-clean.tar.gz` | Studio-quality read speech | ~346 MB |
| `test-other.tar.gz` | Accented, noisy, harder audio | ~328 MB |

Using these means the numbers are comparable to published results, and it
takes the transcript-writing cost to zero. Take ~8 from each — the point is a
credible spread, not statistical power.

Audio arrives as `.flac` with transcripts in `*.trans.txt`, one utterance per
line prefixed by its id.

## Your own samples matter more than the benchmark

LibriSpeech is read speech by American and European volunteers. Ordio's users
are podcasters, and its most defensible finding is how the model handles
**Nigerian and other African accents** — which LibriSpeech contains almost none
of, and which nobody else is measuring.

Record 3–5 of your own. Read the same passage each time so the reference is
written once:

- a quiet room, your natural speaking voice
- a noisy one — café, fan, traffic
- fast, the way people actually talk when unscripted
- a second speaker if you can get one

For public-domain reading material, **Olaudah Equiano's *The Interesting
Narrative*** (1789) is on Project Gutenberg — Igbo, born in what is now
southeastern Nigeria, and a first-person account that carries a room.

Transcribe these by hand. It is slow and it is the whole point: a reference
produced by a model is not a reference, it is a copy of the thing you are
trying to measure.

## The manifest

`manifest.json`, an array of samples. Paths are relative to this directory.

```json
[
  {
    "id": "librispeech-1089-134686",
    "audio": "audio/1089-134686-0000.flac",
    "reference": "reference/1089-134686-0000.txt",
    "split": "clean",
    "note": "LibriSpeech test-clean"
  },
  {
    "id": "ralph-quiet-room",
    "audio": "audio/ralph-quiet.m4a",
    "reference": "reference/equiano-passage.txt",
    "split": "nigerian",
    "note": "Equiano ch.2, quiet room, natural pace"
  }
]
```

`split` is free-form and becomes a row in the report, so name them for the
question you want answered — `clean`, `other`, `nigerian`, `noisy`, `podcast`.

## Running it

```bash
export OPENAI_API_KEY="sk-..."
pnpm --filter @Ordio/evals eval
```

Write the report to a file with `--out report.txt`. Costs about **$0.006 per
audio minute**; sixteen samples of ~30s each is roughly $0.05.
