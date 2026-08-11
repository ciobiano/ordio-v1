# Transcription eval — first run

**2026-08-11 · `whisper-1` · 20 samples · 2,049 reference words · 15.4 min audio · $0.09**

```
split                  words   sub   del   ins     WER  accuracy
────────────────────────────────────────────────────────────────
clean (8)                660    21    19     1  0.0621     93.8%
other (8)                674    23     2     1  0.0386     96.1%
ralph-quiet (3)          640    54    84    15  0.2391     76.1%
ralph-unscripted (1)      75     8    13     1  0.2933     70.7%
────────────────────────────────────────────────────────────────
OVERALL                 2049   106   118    18  0.1181     88.2%
```

`clean` and `other` are LibriSpeech test-clean and test-other, eight speakers
each, gender-balanced, longest utterance per speaker. `ralph-*` are our own
recordings.

Normalisation lowercases and strips punctuation but does **not** expand
contractions or numerals, so these figures are pessimistic against published
LibriSpeech results. See `src/wer.ts`.

---

## Finding 1 — Whisper silently truncates long-form audio

**The headline number was wrong, and finding out why is the result.**

`ralph-quiet` scored 23.9% WER, roughly 4x worse than LibriSpeech clean. That
looked like an accent effect. It was not. The error breakdown gave it away:
84 deletions against 54 substitutions. Mishearing an accent produces
*substitutions*; deletions mean content went missing.

Word counts confirmed it:

| sample | reference | Whisper | ratio | WER |
|---|---|---|---|---|
| take1 | 210 | **169** | 0.80 | 0.3429 |
| take2 | 228 | **197** | 0.86 | 0.2412 |
| take3 | 202 | 215 | 1.06 | 0.1287 |

Two of three recordings came back short. Reading the transcripts showed where:

- **take1** reference ends *"…before they are suffered to pass."*
  Whisper ends *"…only brooks and springs."*
- **take2** reference ends *"…in support of this assertion."*
  Whisper ends *"…added to their comeliness."*

Both stop early, mid-passage. No error, no warning, HTTP 200.

**Why this matters for the product.** `/api/transcribe` calls the same model.
A user records two minutes, and the transcript silently omits the last fifth of
it — the route succeeds, credits settle, captions render, and the end of their
recording is gone. They have no way to know.

It is not simple duration: take3 at 141s was fine while take1 at 140s and take2
at 131s were cut. Something about the audio itself — trailing silence, a fade,
the m4a encoding — which makes it intermittent, and intermittent silent data
loss is the hardest kind to catch from user reports.

**Open:** is it deterministic per file, and is it worse under the production
parameters? The route requests `timestamp_granularities: ['word','segment']`;
this harness does not.

## Finding 2 — accent effect is real but ~2x, not 4x

Take3 is the only untruncated long-form sample of this speaker:

```
clean (LibriSpeech, 8 speakers)   6.21% WER
ralph-equiano-take3              12.87% WER
```

Same task — reading printed prose aloud in a quiet room — and roughly double
the error rate. **n=1**, so preliminary. Worth more samples before it is
claimed as a result.

## Finding 3 — one LibriSpeech reference is wrong, not the model

`908-157963-0007` scored 20.8% WER, far worse than any other clean sample. It
is William Blake's *The Book of Thel*, and the reference preserves his 1789
spelling: `LILLY`, `ANSWERD`, `WATRY`, `NEW BORN`. Whisper heard correctly and
wrote modern English — *lily, answered, watery, newborn* — and every one scored
as an error. `NEW BORN` → `newborn` costs two, being a length mismatch.

That one sample moved the clean split from 4.29% to 6.21%, a 1.9-point swing.
It is kept rather than removed: a benchmark disagreeing with reality is worth
recording, and quietly dropping inconvenient samples is how eval suites start
lying.

---

## Caveats

- **`ralph-unscripted` has a weak reference.** It was produced by dictation and
  verified by the speaker reading along to the audio, not written independently.
  Verification-by-reading systematically misses errors you do not expect, so
  that row is biased optimistic. Its 29.3% WER is inflated by truncation in the
  other direction, so treat the number as uninformative pending a hand-written
  reference.
- **n is small.** Eight speakers per LibriSpeech split, three of our own. Enough
  to surface a truncation bug; not enough to publish an accent figure.
- **WER ignores word timings**, which Ordio's captions depend on entirely. A
  transcript can score 0.0 with every word offset by 400ms. Separate eval, not
  yet built.
