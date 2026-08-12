# Transcription eval — first run

**2026-08-11 · `whisper-1` · 20 samples · 15.4 min audio · $0.09**
**Corrected 2026-08-12** — both of our own long-form references were wrong. See
Finding 1.

```
split                  words   sub   del   ins     WER  accuracy
────────────────────────────────────────────────────────────────
clean (8)                660    21    19     1  0.0621     93.8%
other (8)                674    23     2     1  0.0386     96.1%
ralph-quiet (3) *        579    54    23    15  0.1589     84.1%
ralph-unscripted (1)      75     8    13     1  0.2933     70.7%
────────────────────────────────────────────────────────────────
OVERALL         *       1988   106    57    18  0.0910     90.9%
```

`*` contains references corrected by inference rather than checked against the
audio. These rows moved on 2026-08-12 when take1's reference was cut from 210
words to 177 and take2's from 228 to 200; they previously read 0.2391 and
0.1181. The LibriSpeech rows are untouched and are the original run's.

`clean` and `other` are LibriSpeech test-clean and test-other, eight speakers
each, gender-balanced, longest utterance per speaker. `ralph-*` are our own
recordings.

Normalisation lowercases and strips punctuation but does **not** expand
contractions or numerals, so these figures are pessimistic against published
LibriSpeech results. See `src/wer.ts`.

---

## Finding 1 — both of our own references were over-copied, and a smaller real drop sits underneath

**The headline was mostly our error. What survives is one tenth the size and
still worth fixing.**

`ralph-quiet` scored 23.9% WER against LibriSpeech clean's 6.2%, which read as
an accent effect until the error breakdown contradicted it: 84 deletions
against 54 substitutions. Mishearing an accent produces *substitutions*.
Deletions mean the reference and the output disagree about whether words exist
at all — and a deletion is scored from the reference's point of view, which
quietly assumes the reference is right.

It was not. Both long-form references were transcribed from the page past the
point where reading stopped: take2 by 28 words, take1 by 33.

| sample | reference as written | corrected | WER before | WER after |
|---|---|---|---|---|
| take1 | 210 | **177** | 0.3429 | 0.2203 |
| take2 | 228 | **200** | 0.2412 | 0.1350 |
| take3 | 202 | 202 | 0.1287 | — |

`ralph-quiet` moves 0.2391 -> 0.1589 and OVERALL 0.1181 -> 0.0910. Of the 84
deletions that started this, 61 were ours.

### How the cut points were established

take2 by arithmetic. Loudness-normalised voiced time — duration minus detected
pauses — is 113.3s for take3, 109.4s for take1, 107.6s for take2. take3 was not
short, so it calibrates the rate: 202 reference words over 113.3 voiced seconds
is 1.78 words per voiced second, or 1.90 using its 215-word transcript. take2's
107.6 voiced seconds hold 192-204 words against a claimed 228, and cutting the
final two sentences lands it at 200 — removing 28 deletions and no
substitutions, the signature of text never spoken rather than text misheard.

take1 by direct observation, which is stronger. Three separate sub-30-second
passes over its closing audio — a 35s tail cut, that same tail normalised from
-45 dB to -24 dB, and chunk 6 of a six-way split — all stop at the same garbled
rendering of *"odoriferous woods"* (*"a other furious good"*, *"any other
fierce food"*, *"a other previous good"*), and none reaches *"and our salt of
wood ashes."* Had those 33 words been read aloud they would appear in a
25-second single-window transcription of exactly that audio. Both references
are marked `inferred` rather than `verified`: a listen-through would settle
them, and an argument is not a listen-through.

### The real bug, at its actual size

Against the corrected 177-word reference the full-file pass still shows **12
deletions**, and splitting the same audio into six sub-30s chunks takes that to
**2**. Those ~10 words exist in the audio and do not survive a single long-form
request. The clearest instance: the 35-second tail returns *"This article they
batter with us for a other furious good"* — mangled but unmistakably the
reference's *"These articles they barter with us for odoriferous woods"* — and
those words appear nowhere in the full-file transcript, which stops at *"only
brooks and springs."* Identical audio, returned inside a short request and
dropped inside a long one.

So it is real, reproducible, and about 6% of the transcript rather than the
20% first claimed. It still fails silently: `/api/transcribe` calls the same
model, the route succeeds, credits settle, captions render, and the end of the
recording is quietly absent.

**It is deterministic.** take1 and take2 reproduced to four decimal places
across runs six hours apart.

### Two mechanisms proposed and killed

**Duration is not it.** The isolated clip is 35 seconds — nowhere near any
length limit — and drops its ending too. The original "141s fine, 140s and 131s
cut" theory was fitting a line to one real case and one artefact.

**Loudness is not it, and this one was tested properly.** The obvious
hypothesis was that trailing speech goes missing once it falls below the level
of the rest of the take: take1's last 25 seconds sit 7.4 dB under its own mean,
against -1.6 dB on take2 and +0.9 dB on take3, so the only recording with a
quiet tail was the only one that lost words. A clean correlation across three
samples with a one-filter fix attached, and wrong. Re-encoding through
`loudnorm=I=-16:TP=-1.5:LRA=11` lifts the trailing audio from -45 dB to -24 dB
without altering a word or a timing, and the normalised file returns **167
words against the original's 169**, stopping at the same sentence. Twenty
decibels, no change.

### What survives, and why chunking is not the fix

The only manipulation that moves the output is **isolation**. Identical audio at
identical level: present in a 35-second request, absent in a 140-second one.
Nothing about the signal differs, only what surrounds it. That points at the
**long-form decoding path**, which above 30 seconds stitches a sequence of
windows rather than reading the file in one pass. Finding 1b is the same
subsystem from another angle — take3's repetition loops are the other known
long-form pathology. One file loops, another stops early, both are >30s.

Chunking therefore looked like the fix. It is not. Six chunks cut at pauses,
all under 30 seconds, scored against the corrected reference:

```
full-file (long-form)    WER 0.2203   sub 23   del 12   ins  4
chunked (6 x <30s)       WER 0.2825   sub 35   del  2   ins 13
```

Deletions all but vanish, and the seams cost more than the recovery saves: 12
extra substitutions and 9 extra insertions where the cuts fall. Whisper decodes
using preceding context, and every cut throws that context away —
`"also markets"` becomes `"Aso market"`, `"We call them"` dangles at the end of
one chunk while `"Oyebe"` opens the next, and chunk 3 loops on its own seam.
Naive chunking trades one error class for a larger one. A real fix needs
overlapping windows and stitching, which is what the long-form path already
attempts.

**Open:** whether production parameters make it worse — the route requests
`timestamp_granularities: ['word','segment']` and this harness does not — and
whether overlap-and-stitch beats both. Neither reference has been verified by
listening.

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

## Finding 2 — accent effect is real but ~2x

With both references corrected there are three comparable long-form samples of
this speaker rather than one:

```
clean (LibriSpeech, 8 speakers)   6.21% WER
ralph-equiano-take2              13.50% WER
ralph-equiano-take3              12.87% WER
ralph-equiano-take1              22.03% WER   (still carries the 12-word drop)
```

Same task — reading printed prose aloud in a quiet room. take2 and take3 agree
to within 0.6 points at roughly double the benchmark. take1 sits well above
both, and Finding 1 accounts for it: 12 of its errors are content the long-form
path dropped rather than anything about the speaker.

Still **preliminary**: one speaker, and Finding 1b puts ±6 points of
run-to-run noise on each of these numbers, which is wider than the agreement
between take2 and take3. Samples landing together is encouraging and is not a
result.

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
- **Both long-form references of our own speaker are `inferred`, not verified.**
  take1 and take2 were cut by argument — voiced time for one, three agreeing
  sub-30s transcriptions for the other — not by playing the files back. The
  arguments are good and they are still arguments; a listen-through would settle
  both. Marked in the manifest and in the table so the assumption travels with
  the number.
- **Writing your own references is where the errors were.** Sixteen LibriSpeech
  references, none wrong in this way. Four of ours, and the two long ones were
  both over-copied in the same direction — transcribed from the page past where
  reading stopped. The failure mode is specific to hand-built datasets and it
  biases every number pessimistically, which is the direction that flatters a
  finding.
- **The LibriSpeech rows predate transcript-saving.** Only the four `ralph-*`
  hypotheses are on disk, so `--rescore` covers those and the sixteen benchmark
  rows above are carried from the original run.
- **WER ignores word timings**, which Ordio's captions depend on entirely. A
  transcript can score 0.0 with every word offset by 400ms. Separate eval, not
  yet built.
