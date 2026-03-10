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
