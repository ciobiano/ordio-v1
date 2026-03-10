"""
Ordio Audio Enhancement Service — Modal deployment
Replaces the Railway-hosted FastAPI service with serverless GPU compute.

Deploy:
  pip install modal
  modal token new
  modal deploy services/audio-enhance/modal_app.py

The printed endpoint URL goes into NEXT_PUBLIC_ENHANCE_URL in Vercel env vars.
"""

import modal

# ── Image ─────────────────────────────────────────────────────────────────────
# Built once and cached. Equivalent to the Dockerfile — no Docker needed.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libsndfile1", "ffmpeg", "git")
    .pip_install(
        "torch==2.5.0",
        "torchaudio==2.5.0",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "deepfilternet==0.5.6",
        "resemble-enhance>=0.0.1",
        "fastapi>=0.115.0",
        "uvicorn[standard]>=0.34.0",
        "python-multipart>=0.0.18",
        "soundfile>=0.12.1",
    )
    # Pre-download DeepFilterNet weights at image build time (baked into image,
    # not re-downloaded on every cold start)
    .run_commands(
        "python -c \"from df.enhance import init_df; init_df()\"",
        gpu="any",
    )
)

# ── Persistent volume ─────────────────────────────────────────────────────────
# Stores Resemble-enhance model weights (~1.5 GB) across container restarts.
# DeepFilterNet is baked into the image above; Resemble-enhance is too large
# for image build time so we cache it here instead.
model_volume = modal.Volume.from_name("ordio-models", create_if_missing=True)
MODEL_DIR = "/models"

# ── App ───────────────────────────────────────────────────────────────────────
app = modal.App("ordio-audio-enhance")


@app.function(
    image=image,
    gpu="A10G",
    volumes={MODEL_DIR: model_volume},
    # Keep container alive 5 min after last request — eliminates cold starts
    # for burst traffic without paying for always-on
    scaledown_window=300,
    # Resemble-enhance on a 2-min clip takes ~15s GPU; 3 min is a safe ceiling
    timeout=180,
    min_containers=0,   # scale to zero when idle ($0 cost)
    max_containers=10,
)
@modal.asgi_app()
def web():
    import os
    
    
    os.environ["TORCH_HOME"] = f"{MODEL_DIR}/torch"
    
    os.environ["XDG_CACHE_HOME"] = MODEL_DIR
    
    os.environ["DF_MODEL_DIR"] = f"{MODEL_DIR}/deepfilter"
   
    # Import the FastAPI app — lifespan() handles model loading on startup
    from main import app as fastapi_app
    return fastapi_app
