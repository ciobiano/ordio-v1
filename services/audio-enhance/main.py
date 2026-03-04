import io
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import soundfile as sf
import torch
import torchaudio

logger = logging.getLogger("audio-enhance")

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

# Global model refs — loaded once at startup
_df_model = None
_df_state = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _df_model, _df_state
    # Load DeepFilterNet at startup
    from df.enhance import init_df
    _df_model, _df_state, _ = init_df()
    logger.info("DeepFilterNet3 loaded")
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
    """DeepFilterNet3 — fast noise removal (~2-5s for 1min audio)."""
    from df.enhance import enhance, load_audio, save_audio
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")
    try:
        audio, sr = load_audio(io.BytesIO(raw), sr=48000)
        enhanced = enhance(_df_model, _df_state, audio)
        buf = io.BytesIO()
        save_audio(buf, enhanced, sr, output_format="wav")
        buf.seek(0)
        return StreamingResponse(buf, media_type="audio/wav",
                                 headers={"Content-Disposition": "attachment; filename=enhanced.wav"})
    except Exception as e:
        logger.exception("Clean enhance failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/enhance/hd")
async def enhance_hd(file: UploadFile = File(...)):
    """Resemble-enhance — denoise + super-resolution (~10-20s for 1min audio)."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit.")
    try:
        buf_in = io.BytesIO(raw)
        audio, sr = torchaudio.load(buf_in)
        audio = audio.mean(dim=0)  # mono

        # Resemble-enhance: denoise then enhance
        from resemble_enhance.enhancer.inference import denoise, enhance as res_enhance
        device = "cuda" if torch.cuda.is_available() else "cpu"
        denoised = denoise(audio, sr, device)
        enhanced, new_sr = res_enhance(denoised, sr, device, nfe=32)

        buf_out = io.BytesIO()
        sf.write(buf_out, enhanced.cpu().numpy(), new_sr, format="WAV")
        buf_out.seek(0)
        return StreamingResponse(buf_out, media_type="audio/wav",
                                 headers={"Content-Disposition": "attachment; filename=enhanced.wav"})
    except Exception as e:
        logger.exception("HD enhance failed")
        raise HTTPException(status_code=500, detail=str(e))
