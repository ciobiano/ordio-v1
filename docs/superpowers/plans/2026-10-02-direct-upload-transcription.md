# Direct-to-storage transcription, and Episodes kept for 7 days

**Status:** built on `claude/direct-upload-transcription` (2026-10-03). PR #35 (MP3
fallback) was closed in favour of this. **Built with WAV, not FLAC:** see
"Why WAV, not FLAC" below.

## Why

`/api/transcribe` receives audio in its request body, and Vercel refuses any body
over 4.5MB (`413 FUNCTION_PAYLOAD_TOO_LARGE`) before the route runs. The limit is
infrastructure-level; Vercel's own guidance is to upload to storage and keep
functions as "a lightweight API layer, not a media server".

Today the limit costs us twice:

- **Episodes** fail outright where Opus can't be encoded (PR #35 patches this by
  shrinking chunks to MP3).
- **Recordings** are squeezed to fit 4MB before transcription. Long ones drop to
  8kHz WAV (`pickWhisperWavSampleRate`), which costs Whisper accuracy, and the
  same recording is uploaded a second time, in full, to Convex for the Session.

Convex upload URLs have no size limit (2-minute timeout per upload), and Ordio
already uses them. The only cap left is OpenAI's 25MB per file.

## Decisions (agreed 2026-10-02)

- **Approach:** browser → Convex storage → `/api/transcribe` gets an ID, fetches
  the file server-to-server, sends it to OpenAI.
- **Episodes are kept for 7 days:** the transcribed audio chunks, the merged
  transcript, and the Clip suggestions. Not the original file.
- **Retention follows the existing pattern:** an `expiresAt` per row, swept by the
  hourly cron in `crons.ts`, as Sessions are today.
- **Nothing lowers transcription quality to fit a size limit.** See below.

## Quality rule

Whisper resamples all audio to 16kHz and works from that (Whisper paper, §2.2).
So **16kHz mono is lossless for Whisper**; anything above it is discarded by the
model, and anything below it removes speech it would have used. Under 8kHz, every
sound above 4kHz is gone, which is where "s", "f" and "th" live.

Every place that lowers quality today exists only to fit the 4.5MB Vercel limit,
and all of them go:

| Today | When | Replaced by |
|---|---|---|
| WAV squeezed to 12kHz | recordings needing conversion, past ~2:11 | always 16kHz |
| WAV squeezed to 8kHz | the same, past ~2:55; also when ffmpeg fails | always 16kHz |
| MP3 at whatever bitrate fits 4MB | recordings over 4MB (~37kbps for 15 min) | the original file, untouched |
| Opus at ~38kbps | Episode chunks | 16kHz WAV |
| MP3 at 32kbps (PR #35) | Episode chunks without Opus | 16kHz WAV |

**Recordings** (≤15 min; longer ones route to Episodes):

1. Send the original file untouched when Whisper accepts its type and it is ≤25MB.
   This is the common case, with no re-encoding at all.
2. Otherwise 16kHz mono WAV, which is lossless and fits 25MB up to ~13.6 min.
3. A recording that needs converting and is longer than that fails with
   `AUDIO_TOO_LARGE_TO_TRANSCRIBE`, which says to trim it or save it as MP3/M4A.
   Before this change, the same failure came at ~4.4 min.

**Episodes:** the one place where lossless costs something real.

| Chunk format | 90-min Episode | Free 1GB holds (7 days) |
|---|---|---|
| 16kHz WAV (lossless) | ~173MB | ~5 Episodes |
| 16kHz FLAC via ffmpeg (lossless) | ~90MB (est.) | ~11 |
| Opus 64kbps | ~43MB | ~23 |
| Opus ~38kbps (today) | ~26MB | ~40 |

All of these are also uploaded from the person's phone, nine chunks per 90 minutes.

**Decided 2026-10-02: Episodes are lossless too.** No measurement was run to
show lossy is safe, so it isn't used:

1. **16kHz mono WAV:** 19.2MB per 10-min chunk, 22MB with the 90s tail absorbed,
   still under OpenAI's 25MB. No encoder needed, so it works in every browser,
   old Safari included.
2. Never Opus or MP3 for transcription. The Opus path and `audioCodecSupport.ts`
   are gone; PR #35's MP3 path never landed.

### Why WAV, not FLAC

FLAC was the plan, at roughly half the size. It has no working encoder in Ordio:

- **WebCodecs can't encode FLAC** in any browser.
- **ffmpeg.wasm can never load in Ordio.** `@ffmpeg/ffmpeg` is 0.12, but the
  core copied to `public/ffmpeg` comes from `@ffmpeg/core-st` 0.11. The 0.12
  worker calls `ffmpeg.setLogger()` right after creating the core, and the 0.11
  core has no `setLogger`, `exec` or `reset` (checked by instantiating it in Node,
  2026-10-02). So `load()` always throws. This is also why recordings over 4MB
  always fell back to the 8kHz WAV. It almost certainly breaks the Safari
  video-export fallback (`packages/engine/src/video/ffmpegEncoder.ts`) too;
  that is a separate fix.
- **`@mediabunny/flac-encoder`** starts at mediabunny 1.36; Ordio is on 1.34.5,
  and encoders ship in lockstep. Bumping mediabunny touches video export.

FLAC can be added later as a size optimisation, once either dependency is
sorted, without changing anything else here.

**Update 2026-10-03: the ffmpeg side is fixed** on `claude/jolly-turing-692942`,
which pairs the wrapper with `@ffmpeg/core` 0.12.9 (the core `@ffmpeg/ffmpeg`
0.12.15 was built against). Once that lands, FLAC via ffmpeg becomes possible:
against that branch's production build in Chromium, `load()` succeeds and
`-ac 1 -ar 16000 -c:a flac` exits 0 with a valid `fLaC` stream. The cost is
the 32MB core, downloaded before the first encode.

**Risk: slow uplinks.** Convex upload URLs time out after 2 minutes. A 19MB WAV
chunk needs an uplink of at least ~1.3Mbps to get in under that. Below that the chunk fails, retries once, and the
run ends as a partial (kept 7 days, so it resumes later rather than starting over).
Shorter chunks would avoid the timeout, but 5-minute chunks make a 90-minute
Episode 18 requests against `/api/transcribe`'s 15/hour. Fixing that means
metering the limit by audio minutes instead of requests. Decide at implementation,
after measuring a real chunk upload on a throttled connection.

## Design

### Convex

New tables in `schema.ts`:

```ts
episodes: {
  userId,                       // identity.tokenIdentifier, as sessions
  fingerprint,                  // name + size + lastModified of the dropped file
  durationSec,
  candidates?: ClipCandidate[], // set once Clips are found
  expiresAt, createdAt,
}  // by_user_fingerprint, by_expires_at

episodeChunks: {
  episodeId, userId,
  startSec, durationSec,
  storageId,                    // the uploaded chunk
  words?: Word[],               // set once transcribed (~85KB per 10-min chunk)
}  // by_episode, by_storage_id

uploads: {                      // ownership for one-off recording uploads
  userId, storageId, expiresAt,
}  // by_storage_id, by_expires_at
```

Words live on chunk rows, not the episode row: a 90-minute transcript is ~600KB
and Convex documents cap at 1MB.

Functions:

- `episodes.findOrCreate({ fingerprint, durationSec })`: returns the live Episode
  for this file with its transcribed chunks and candidates, or a new one.
- `episodes.addChunk({ episodeId, startSec, durationSec, storageId })`: ownership-checked.
- `episodes.saveCandidates({ episodeId, candidates })`
- `uploads.claim({ storageId })`: first claimer owns it. Storage IDs are unguessable,
  so in practice that is the uploader.
- `transcription.authorize({ storageId })`: a query run with the caller's token.
  Returns `storage.getUrl` only when the caller owns the file through
  `episodeChunks` or `uploads`, otherwise null.
- `transcription.saveWords({ storageId, words })`: called by the route after
  transcribing an Episode chunk.
- `episodes.cleanupExpired` (internal) in the hourly cron: deletes chunk files,
  chunk rows, and the episode. `uploads.cleanupExpired` likewise. Both follow
  `sessions.cleanupExpired`: per-row try/catch, a failure never stops the run.

### `/api/transcribe`

- Body becomes JSON `{ storageId, durationSec }`. Multipart was accepted for one
  deploy so a stale tab mid-session didn't break, and removed on 2026-10-03.
- After auth and the rate limit: `authorize` → 404 if not the caller's →
  `fetch(url)` with a 25MB cap read from `content-length` → OpenAI as today.
- The credit hold/settle, `NOT_RETRYABLE` codes and error catalog are unchanged.
- Episode chunks: the route saves the words through `saveWords`, so a transcript
  survives even if the tab closes before the response arrives.

### Episodes (`useEpisodeIngestion`)

1. On drop: `findOrCreate` by fingerprint.
2. **Already finished:** load the words and candidates and go straight to `picking`.
   No upload, no transcription, no credits.
3. **Partly done**, or new: ingest as today. For each chunk, skip it when a saved
   chunk starts within 0.5s of it (pause-aligned cuts are deterministic for the
   same file). Otherwise upload → `addChunk` → transcribe by `storageId`.
4. After Clip finding: `saveCandidates`.
5. Each chunk's audio stays in storage for 7 days.
   - The Clip itself is still cut from the original file, which the person has
     just dropped again. Chunk audio is 16kHz mono and too poor to publish.

### Recordings (`useAudioProcessing`)

- Upload once to Convex, as it already does for the Session, and `uploads.claim` it.
- Transcribe by that `storageId` when the file is ≤25MB and a Whisper-supported type.
- Otherwise upload a 16kHz mono WAV copy and transcribe that.
- Delete `pickWhisperWavSampleRate`, `targetMp3BitrateKbps`, the 4MB
  `WHISPER_SIZE_LIMIT`, and the 8kHz fallback WAV.
- The `uploads` row for a recording expires after 1 hour, but the sweep must not
  delete storage a Session points to. That needs a `by_storage_id` index on
  `sessions`, or no storage delete for rows with `purpose: 'recording'`; decide at
  implementation.

## Costs

- **Storage:** a 90-minute Episode is ~173MB as WAV chunks, so Convex's free 1GB
  holds ~5 live Episodes, then $0.033/GB: about 0.6¢ per Episode-week.
- **Egress:** every transcription reads its file once from Convex. The free 1GB/month
  is ~5 Episodes' worth of WAV, then $0.132/GB: about 2.3¢ per Episode.
- Requests to `/api/transcribe` and credit spend are unchanged.

## Deploy order

**Convex first, then Vercel**, as with credits: the route calls
`transcription.authorize` and fails without it.

## Tests

- **Convex:** ownership (another user's `storageId` → null), expiry sweeps,
  `findOrCreate` returns only live, owned Episodes.
- **Route:** JSON body, 404 on a foreign ID, 25MB cap, multipart still accepted.
- **Hook:** a finished Episode skips straight to `picking`; a partial skips its
  saved chunks; nothing is charged twice.
- Full suite once at the end.

## Open questions

- A "recent Episodes" list. Out of scope, because a Clip needs the original file;
  revisit if the original is ever stored.
