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
TARGET_SR = 48000

# Single SE model serves both tiers — ~10GB, leaves 14GB headroom on A10G
_cv_se = None


def _load_audio(raw_bytes: bytes) -> tuple[np.ndarray, int]:
    """Load audio as 48kHz mono float32, converting via ffmpeg if libsndfile can't handle it."""
    try:
        audio_np, sr = sf.read(io.BytesIO(raw_bytes))
    except Exception:
        # ffmpeg handles WebM, MP3, and any other format the browser sends
        result = subprocess.run(
            ["ffmpeg", "-i", "pipe:0", "-ar", str(TARGET_SR), "-ac", "1", "-f", "wav", "pipe:1"],
            input=raw_bytes, capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode()}")
        audio_np, sr = sf.read(io.BytesIO(result.stdout))
    if audio_np.ndim == 2:
        audio_np = audio_np.mean(axis=1)
    if sr != TARGET_SR:
        import librosa
        audio_np = librosa.resample(audio_np, orig_sr=sr, target_sr=TARGET_SR)
        sr = TARGET_SR
    # ClearVoice expects [batch, length] float32
    return np.reshape(audio_np, [1, audio_np.shape[0]]).astype(np.float32), sr


def _post_process_clean(audio_np: np.ndarray, sr: int) -> np.ndarray:
    """Clean tier: noise removal + light mastering. Warm, natural sound."""
    import pedalboard
    from pedalboard import Compressor, HighpassFilter, HighShelfFilter, Limiter, NoiseGate, PeakFilter
    import pyloudnorm

    if audio_np.ndim == 1:
        audio_np = audio_np[np.newaxis, :]

    board = pedalboard.Pedalboard([
        HighpassFilter(cutoff_frequency_hz=80),
        NoiseGate(threshold_db=-42, ratio=1.5, release_ms=250),
        Compressor(threshold_db=-20, ratio=2.0, attack_ms=15, release_ms=200),
        PeakFilter(cutoff_frequency_hz=3000, gain_db=1.5, q=0.7),
        PeakFilter(cutoff_frequency_hz=5000, gain_db=1.5, q=0.7),
        HighShelfFilter(cutoff_frequency_hz=10000, gain_db=2),
        Limiter(threshold_db=-1.0, release_ms=150),
    ])

    processed = board(audio_np.astype(np.float32), sr)
    meter = pyloudnorm.Meter(sr)
    lufs = meter.integrated_loudness(processed.T)
    if not np.isinf(lufs):
        processed = pyloudnorm.normalize.loudness(processed.T, lufs, -14.0).T
    return processed.squeeze()


def _post_process_hd(audio_np: np.ndarray, sr: int) -> np.ndarray:
    """HD tier: transparent mastering — slow attack preserves transients, gentle ratio stays smooth."""
    import pedalboard
    from pedalboard import Compressor, Gain, HighpassFilter, HighShelfFilter, Limiter, NoiseGate, PeakFilter
    import pyloudnorm

    if audio_np.ndim == 1:
        audio_np = audio_np[np.newaxis, :]

    board = pedalboard.Pedalboard([
        HighpassFilter(cutoff_frequency_hz=85),
        NoiseGate(threshold_db=-42, ratio=2.0, release_ms=250),
        Compressor(threshold_db=-20, ratio=3.0, attack_ms=15, release_ms=200),
        PeakFilter(cutoff_frequency_hz=2500, gain_db=1.5, q=0.7),
        HighShelfFilter(cutoff_frequency_hz=8000, gain_db=1.0),
        Gain(gain_db=2.0),       # compensates compressor gain reduction, drives limiter harder
        Limiter(threshold_db=-2.0, release_ms=150),
    ])

    processed = board(audio_np.astype(np.float32), sr)
    meter = pyloudnorm.Meter(sr)
    lufs = meter.integrated_loudness(processed.T)
    if not np.isinf(lufs):
        processed = pyloudnorm.normalize.loudness(processed.T, lufs, -14.0).T
    return processed.squeeze()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cv_se
    from clearvoice import ClearVoice
    _cv_se = ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K'])
    logger.info("ClearerVoice MossFormer2_SE_48K loaded (~10GB, 14GB headroom on A10G)")
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


def _run_enhance(raw: bytes, post_fn) -> StreamingResponse:
    """Shared SE pipeline used by both tiers."""
    audio_np, sr = _load_audio(raw)
    enhanced = _cv_se(audio_np, False)
    final = post_fn(enhanced[0, :], sr)
    buf = io.BytesIO()
    sf.write(buf, final, sr, format="WAV")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav",
                             headers={"Content-Disposition": "attachment; filename=enhanced.wav"})


@app.post("/enhance/clean")
async def enhance_clean(file: UploadFile = File(...)):
    """MossFormer2_SE_48K + light mastering. Natural, noise-free voice."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")
    try:
        return _run_enhance(raw, _post_process_clean)
    except Exception as e:
        logger.exception("Clean enhance failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/enhance/hd")
async def enhance_hd(file: UploadFile = File(...)):
    """MossFormer2_SE_48K + broadcast mastering. Radio-ready, polished voice."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")
    try:
        return _run_enhance(raw, _post_process_hd)
    except Exception as e:
        logger.exception("HD enhance failed")
        raise HTTPException(status_code=500, detail=str(e))
