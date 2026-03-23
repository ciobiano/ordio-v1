# ClearerVoice-Studio Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace DeepFilterNet3 + Resemble-enhance with ClearerVoice-Studio (MossFormer2) for better speech quality, fewer artifacts, and a simpler single-library dependency.

**Architecture:** Two FastAPI endpoints (`/enhance/clean`, `/enhance/hd`) keep the same API contract — only the model internals change. `MossFormer2_SE_48K` handles noise removal for both tiers; the HD tier adds a `MossFormer2_SR_48K` super-resolution pass. The post-processing chain (pedalboard + pyloudnorm) remains unchanged. Modal image builder caches model weights in a persistent Volume at `/models`.

**Tech Stack:** Python 3.11, FastAPI, `clearvoice>=0.1.2` (pip), Modal A10G GPU, `pedalboard>=0.9.0`, `pyloudnorm>=0.1.0`

---

## Why ClearerVoice-Studio

| Model | PESQ ↑ | SI-SDR ↑ | MCD ↓ | Artifacts |
|-------|--------|----------|-------|-----------|
| DeepFilterNet3 | 3.03 | 15.71 | 1.77 | Metallic, clips plosives |
| Resemble-enhance | 2.84 | 12.42 | 1.54 | Echo, warbling (generative) |
| **MossFormer2_SE_48K** | **3.15** | **19.36** | **0.53** | None reported |

MCD 0.53 vs 1.77 = 3× less spectral distortion. MossFormer2 is Transformer-based with better temporal modeling — it does not mask plosives. Single `pip install clearvoice` replaces both existing libraries.

---

## Files Touched

- Modify: `services/audio-enhance/main.py`
- Modify: `services/audio-enhance/modal_app.py`
- No frontend changes — API contract unchanged

---

## Task 1: Update Modal Image — Remove Old Deps, Add clearvoice

**File:** `services/audio-enhance/modal_app.py`

**Step 1: Replace pip dependencies**

Remove `deepfilternet`, `resemble-enhance`. Add `clearvoice`. The image builder is layered — changing this pip layer invalidates the model pre-download steps below it too.

```python
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libsndfile1", "ffmpeg")      # git and git-lfs no longer needed
    .pip_install(
        "torch==2.5.0",
        "torchaudio==2.5.0",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "clearvoice>=0.1.2",
        "fastapi>=0.115.0",
        "uvicorn[standard]>=0.34.0",
        "python-multipart>=0.0.18",
        "soundfile>=0.12.1",
        "pedalboard>=0.9.0",
        "pyloudnorm>=0.1.0",
    )
    # Pre-download MossFormer2 weights at image build time
    # Both SE and SR models — downloads from ModelScope/HuggingFace
    .run_commands(
        "MODELSCOPE_CACHE=/models python -c \""
        "from clearvoice import ClearVoice; "
        "ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K']); "
        "ClearVoice(task='speech_super_resolution', model_names=['MossFormer2_SR_48K'])"
        "\""
    )
    .add_local_file(
        Path(__file__).parent / "main.py",
        remote_path="/root/main.py",
    )
)
```

**Step 2: Update env vars in `web()` function**

Replace DeepFilterNet-specific env vars with ModelScope cache path:

```python
@modal.asgi_app()
def web():
    import os
    os.environ["MODELSCOPE_CACHE"] = MODEL_DIR
    os.environ["TORCH_HOME"] = f"{MODEL_DIR}/torch"

    from main import app as fastapi_app
    return fastapi_app
```

**Step 3: Verify syntax**

```bash
cd /Users/bg_ralph/Documents/webapps/ordio-v1
python -c "import ast; ast.parse(open('services/audio-enhance/modal_app.py').read()); print('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add services/audio-enhance/modal_app.py
git commit -m "chore(audio-enhance): migrate Modal image from DeepFilterNet+Resemble to clearvoice"
```

---

## Task 2: Rewrite main.py with ClearerVoice

**File:** `services/audio-enhance/main.py`

**Step 1: Write the new main.py**

```python
import io
import logging
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import soundfile as sf

logger = logging.getLogger("audio-enhance")

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

# Global model refs — loaded once at startup
_cv_se = None   # speech enhancement (both tiers)
_cv_sr = None   # super-resolution (HD tier only)


def _post_process(audio_np: np.ndarray, sr: int, target_lufs: float = -14.0) -> np.ndarray:
    """Compression, presence boost, loudness normalization for social media (-14 LUFS)."""
    import pedalboard
    from pedalboard import (
        Compressor, Gain, HighpassFilter, HighShelfFilter,
        Limiter, NoiseGate, PeakFilter,
    )
    import pyloudnorm

    if audio_np.ndim == 1:
        audio_np = audio_np[np.newaxis, :]  # pedalboard expects (channels, samples)

    board = pedalboard.Pedalboard([
        HighpassFilter(cutoff_frequency_hz=80),
        NoiseGate(threshold_db=-40, ratio=2.0, release_ms=200),
        Compressor(threshold_db=-18, ratio=2.5, attack_ms=10, release_ms=150),
        PeakFilter(cutoff_frequency_hz=3000, gain_db=2.0, q=0.7),
        HighShelfFilter(cutoff_frequency_hz=8000, gain_db=1.5),
        Gain(gain_db=3.0),
        Limiter(threshold_db=-1.5, release_ms=100),
    ])

    processed = board(audio_np.astype(np.float32), sr)

    meter = pyloudnorm.Meter(sr)
    current_lufs = meter.integrated_loudness(processed.T)
    if not np.isinf(current_lufs):
        processed = pyloudnorm.normalize.loudness(processed.T, current_lufs, target_lufs).T

    return processed.squeeze()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cv_se, _cv_sr
    from clearvoice import ClearVoice
    _cv_se = ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K'])
    _cv_sr = ClearVoice(task='speech_super_resolution', model_names=['MossFormer2_SR_48K'])
    logger.info("ClearerVoice MossFormer2 SE + SR loaded")
    yield


app = FastAPI(title="Ordio Audio Enhance", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ordio.app",
        "https://*.vercel.app",
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/enhance/clean")
async def enhance_clean(file: UploadFile = File(...)):
    """MossFormer2_SE_48K — fast speech enhancement (~2-5s for 1min audio)."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")
    try:
        audio_np, sr = sf.read(io.BytesIO(raw))
        if audio_np.ndim == 2:
            audio_np = audio_np.mean(axis=1)  # stereo → mono
        enhanced_np = _cv_se(input_path=None, audio_np=audio_np, sr=sr, online_write=False)
        final = _post_process(enhanced_np, sr)
        buf = io.BytesIO()
        sf.write(buf, final, sr, format="WAV")
        buf.seek(0)
        return StreamingResponse(buf, media_type="audio/wav",
                                 headers={"Content-Disposition": "attachment; filename=enhanced.wav"})
    except Exception as e:
        logger.exception("Clean enhance failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/enhance/hd")
async def enhance_hd(file: UploadFile = File(...)):
    """MossFormer2_SE_48K + SR_48K — enhancement + super-resolution (~10-15s for 1min audio)."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")
    try:
        audio_np, sr = sf.read(io.BytesIO(raw))
        if audio_np.ndim == 2:
            audio_np = audio_np.mean(axis=1)  # stereo → mono
        enhanced_np = _cv_se(input_path=None, audio_np=audio_np, sr=sr, online_write=False)
        sr_np = _cv_sr(input_path=None, audio_np=enhanced_np, sr=sr, online_write=False)
        final = _post_process(sr_np, sr)
        buf = io.BytesIO()
        sf.write(buf, final, sr, format="WAV")
        buf.seek(0)
        return StreamingResponse(buf, media_type="audio/wav",
                                 headers={"Content-Disposition": "attachment; filename=enhanced.wav"})
    except Exception as e:
        logger.exception("HD enhance failed")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 2: Verify syntax**

```bash
python -c "import ast; ast.parse(open('services/audio-enhance/main.py').read()); print('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add services/audio-enhance/main.py
git commit -m "feat(audio-enhance): replace DeepFilterNet+Resemble with MossFormer2 via clearvoice"
```

---

## Task 3: Deploy and Smoke-Test

**Step 1: Deploy to Modal**

```bash
modal deploy services/audio-enhance/modal_app.py
```

Expected: build log showing `clearvoice` pip install + MossFormer2 model download, then a printed endpoint URL like:
```
https://ciobiano--ordio-audio-enhance-web.modal.run
```

Note: first deploy after this change will rebuild the pip layer and re-download models (~5-10 min). Subsequent deploys are ~30s.

**Step 2: Smoke-test health endpoint**

```bash
curl https://ciobiano--ordio-audio-enhance-web.modal.run/health
```

Expected: `{"status":"ok"}`

**Step 3: Smoke-test clean tier**

Record or use any WAV/MP3 file. Replace `sample.wav` with your file:

```bash
curl -X POST https://ciobiano--ordio-audio-enhance-web.modal.run/enhance/clean \
  -F "file=@sample.wav" \
  --output clean_out.wav
```

Expected: `clean_out.wav` written with no errors. Open and listen for:
- No metallic artifacts
- Plosives (p, t, k) preserved
- Background noise reduced

**Step 4: Smoke-test HD tier**

```bash
curl -X POST https://ciobiano--ordio-audio-enhance-web.modal.run/enhance/hd \
  -F "file=@sample.wav" \
  --output hd_out.wav
```

Expected: `hd_out.wav` with noticeably crisper audio than clean_out.wav, no echo.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-10-clearvoice-migration.md
git commit -m "docs: add clearvoice migration plan"
```

---

## Rollback Plan

If ClearerVoice-Studio produces worse results than expected:

```bash
git revert HEAD~2  # reverts modal_app.py and main.py changes
modal deploy services/audio-enhance/modal_app.py
```

The previous DeepFilterNet + Resemble-enhance image layers are cached in Modal — rollback deploy will be fast.

---

## Open Questions to Validate During Testing

1. Does `ClearVoice(task=..., model_names=[...])` work as a global singleton (called multiple times per request)? If it's not thread-safe, wrap in an `asyncio.Lock`.
2. What sample rate does `MossFormer2_SR_48K` output? Confirm it's 48kHz.
3. Does `online_write=False` return a numpy array directly, or a dict? Check the return type on first run.
4. Model download size on first build — confirm it fits within Modal's 10GB image size limit.
