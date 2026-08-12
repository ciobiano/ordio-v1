# Transcription eval — first run

**2026-08-11 · `whisper-1` · 20 samples · 15.4 min audio · $0.09**
**Corrected 2026-08-12** — one of our own references was wrong. See Finding 1.

```
split                  words   sub   del   ins     WER  accuracy
────────────────────────────────────────────────────────────────
clean (8)                660    21    19     1  0.0621     93.8%
other (8)                674    23     2     1  0.0386     96.1%
ralph-quiet (3)          612    54    56    15  0.2043     79.6%
ralph-unscripted (1)      75     8    13     1  0.2933     70.7%
────────────────────────────────────────────────────────────────
OVERALL                 2021   106    90    18  0.1059     89.4%
```

The `ralph-quiet` and overall rows moved on 2026-08-12 when `take2`'s reference
was cut from 228 words to 200. They previously read 0.2391 and 0.1181. The
LibriSpeech rows are untouched and are the original run's.

`clean` and `other` are LibriSpeech test-clean and test-other, eight speakers
each, gender-balanced, longest utterance per speaker. `ralph-*` are our own
recordings.

Normalisation lowercases and strips punctuation but does **not** expand
contractions or numerals, so these figures are pessimistic against published
LibriSpeech results. See `src/wer.ts`.

---

## Finding 1 — Whisper drops trailing speech once it goes quiet

**Two things were wrong here, and only one of them was the model.**

`ralph-quiet` scored 23.9% WER, roughly 4x worse than LibriSpeech clean. That
looked like an accent effect. The error breakdown said otherwise: 84 deletions
against 54 substitutions. Mishearing an accent produces *substitutions*;
deletions mean the reference and the output disagree about whether words exist
at all.

Word counts, as first read:

| sample | reference | Whisper | ratio | WER |
|---|---|---|---|---|
| take1 | 210 | **169** | 0.80 | 0.3429 |
| take2 | 228 | **197** | 0.86 | 0.2412 |
| take3 | 202 | 215 | 1.06 | 0.1287 |

Two of three came back short, both stopping mid-passage with no error and an
HTTP 200, so this was written up as the model truncating both. That was half
right.

**take2 was our error, not the model's.** A deletion is scored from the
reference's point of view, which quietly assumes the reference is correct.
Going back to the audio breaks the tie. Loudness-normalised voiced time —
duration minus detected pauses — is 113.3s for take3, 109.4s for take1 and
107.6s for take2. Take3 is the sample that was not short, so it calibrates the
rate: 202 reference words over 113.3 voiced seconds is 1.78 words per voiced
second, or 1.90 using its 215-word transcript. Applied to take2, its 107.6
voiced seconds hold 192–204 words. The reference claimed 228. The last two
sentences were copied from the page and never read aloud.

Cutting them takes the reference to 200 words and the score from 0.2412 to
0.1350, and it removes 28 deletions and no substitutions — the signature of
text that was never spoken rather than text the model misheard. take2 now sits
at 13.50% against take3's 12.87%: two untruncated samples of one speaker
agreeing, which is what a correct reference should look like.

**take1 is a real drop.** Its reference (210) is close to what voiced time
predicts (195–208); the 169 transcribed words are not.

**It is deterministic.** take1 and take2 were transcribed twice, six hours
apart, and reproduced to four decimal places (0.3429 and 0.2412). Whatever
causes the drop is a property of the request, not sampling noise.

**Confirmed by isolation, 2026-08-12.** take1's final 35 seconds, cut out and
sent on their own, come back as:

> They generally bring us firearms, powder, hats, beads, and dried fish. The
> last we esteemed a great rarity, as our waters were only brooks and springs.
> **This article they batter with us for a other furious good.**

That last sentence is the reference's *"These articles they barter with us for
odoriferous woods"*, mangled but unmistakably present — and it does not appear
anywhere in the full-file transcript, which stops at *"only brooks and
springs."* **The audio contained speech that the full-file pass dropped.** The
words were there; the model returned 200 OK without them.

### Two mechanisms proposed and killed

**Duration is not it.** The isolated clip is 35 seconds — nowhere near any
plausible length limit — and it truncates too, never reaching *"and our salt of
wood ashes."* A 35-second file and a 140-second file both losing their endings
cannot be explained by how long they are. The original "141s fine, 140s and
131s cut" theory was fitting a line to one real case and one artefact.

**Loudness is not it either, and this one we tested properly.** The obvious
hypothesis was that trailing speech goes missing once it drops below the level
of the rest of the take: take1's last 25 seconds sit 7.4 dB under its own mean,
against −1.6 dB on take2 and +0.9 dB on take3, so the only recording with a
quiet tail was the only one that lost words. A tidy correlation across three
samples, and wrong. Re-encoding through `loudnorm=I=-16:TP=-1.5:LRA=11` lifts
the trailing audio from −45 dB to −24 dB without altering a word or a timing,
and the normalised file returns **167 words against the original's 169**,
stopping at the same sentence. Twenty decibels changed nothing. Level is not
the trigger, and the three-sample correlation was a coincidence sitting on n=3.

### What survives

The one manipulation that *does* change the output is **isolation**. Identical
audio, identical level: inside the 140-second file those words are absent, and
inside a 35-second file they are present. Nothing about the signal differs — only
what surrounds it. That points away from the audio entirely and at the
**long-form decoding path**, which for anything over 30 seconds stitches
together a sequence of windows rather than reading the file in one pass.
Changing the file's length changes the window boundaries, and the output
changes with them.

Finding 1b is the same subsystem seen from another angle: take3's repetition
loops are the other well-known long-form decoding pathology. One file loops,
another stops early, and both are >30s. That is a more coherent account than
anything about the audio.

**Why this matters for the product.** `/api/transcribe` calls the same model on
recordings that are routinely over 30 seconds. A user records two minutes, the
transcript silently omits the last stretch, the route succeeds, credits settle,
captions render, and they have no way to know.

**Open.** The remaining ~30 words appear in no transcription at any level, so
they were either dropped by the same mechanism on the shorter file or never
read aloud; take1's reference may be over-copied like take2's, by less. The
finding above does not depend on it, resting on words that were *recovered*
rather than words that were not. Also open: whether production parameters make
it worse — the route requests `timestamp_granularities: ['word','segment']` and
this harness does not — and whether chunking the audio ourselves into <30s
segments avoids the long-form path altogether. That is the next thing to try,
and unlike the loudness fix it is a real change to `/api/transcribe` rather than
one filter.

## Finding 1b — the same audio does not score the same twice

take3 was transcribed twice and returned materially different text: 0.1287 on
the first run, 0.1931 on the second. The second contains two repetition loops
— *"it is therefore even new it is therefore even new"* and *"on all grounds of
festival on all grounds festival"* — which took insertions from 7 to 17.

Same file, same model, same parameters. **A single-sample WER carries at least
±6 points of run-to-run noise**, which is larger than most regressions anyone
would want to detect. Per-sample numbers here should be read as one draw, not a
measurement, and a real regression signal needs repeat runs or many more
samples. It also means a reference edit must be compared against *held*
transcripts — hence `--rescore`, which scores what is already on disk rather
than paying for a fresh, differently-wrong run.

## Finding 2 — accent effect is real but ~2x, and now n=2

With take2's reference corrected, there are two untruncated long-form samples
of this speaker rather than one:

```
clean (LibriSpeech, 8 speakers)   6.21% WER
ralph-equiano-take2              13.50% WER
ralph-equiano-take3              12.87% WER
```

Same task — reading printed prose aloud in a quiet room — and roughly double
the error rate, from two samples that agree with each other to within 0.6
points. Still **preliminary**: n=2, one speaker, and Finding 1b puts ±6 points
of run-to-run noise on each of these numbers, which is wider than the agreement
between them. Two samples landing together is encouraging and is not a result.

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
- **`take2`'s reference is `inferred`, not verified.** It was cut by argument
  from voiced time, not by playing the file back. The argument is good and it is
  still an argument; a listen-through would settle it. Marked in the manifest so
  the assumption travels with the number.
- **The LibriSpeech rows predate transcript-saving.** Only the four `ralph-*`
  hypotheses are on disk, so `--rescore` covers those and the sixteen benchmark
  rows above are carried from the original run.
- **WER ignores word timings**, which Ordio's captions depend on entirely. A
  transcript can score 0.0 with every word offset by 400ms. Separate eval, not
  yet built.
