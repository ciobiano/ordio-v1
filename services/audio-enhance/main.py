import io
import logging
import subprocess
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


TARGET_SR = 48000


def _load_audio(raw_bytes: bytes) -> tuple[np.ndarray, int]:
    """Load audio as 48kHz mono float32, converting via ffmpeg if libsndfile can't handle it."""
    try:
        audio_np, sr = sf.read(io.BytesIO(raw_bytes))
    except Exception:
        # ffmpeg converts any format (WebM, MP3, etc.) to 48kHz mono WAV
        result = subprocess.run(
            ["ffmpeg", "-i", "pipe:0", "-ar", str(TARGET_SR), "-ac", "1", "-f", "wav", "pipe:1"],
            input=raw_bytes, capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode()}")
        audio_np, sr = sf.read(io.BytesIO(result.stdout))
    if audio_np.ndim == 2:
        audio_np = audio_np.mean(axis=1)
    # Resample to 48kHz if needed (MossFormer2 requires 48kHz input)
    if sr != TARGET_SR:
        import librosa
        audio_np = librosa.resample(audio_np, orig_sr=sr, target_sr=TARGET_SR)
        sr = TARGET_SR
    # ClearVoice expects [batch, length] float32
    audio_np = np.reshape(audio_np, [1, audio_np.shape[0]]).astype(np.float32)
    return audio_np, sr


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
        audio_np, sr = _load_audio(raw)
        enhanced = _cv_se(audio_np, False)
        final = _post_process(enhanced[0, :], sr)
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
        audio_np, sr = _load_audio(raw)
        enhanced = _cv_se(audio_np, False)
        upsampled = _cv_sr(enhanced, False)
        final = _post_process(upsampled[0, :], sr)
        buf = io.BytesIO()
        sf.write(buf, final, sr, format="WAV")
        buf.seek(0)
        return StreamingResponse(buf, media_type="audio/wav",
                                 headers={"Content-Disposition": "attachment; filename=enhanced.wav"})
    except Exception as e:
        logger.exception("HD enhance failed")
        raise HTTPException(status_code=500, detail=str(e))
