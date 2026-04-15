"""
Ordio Audio Enhancement Service — Modal deployment
Replaces the Railway-hosted FastAPI service with serverless GPU compute.

Deploy:
  pip install modal
  modal token new
  # Recommended: HF read token (higher rate limits, faster model cache fetches).
  #   https://huggingface.co/settings/tokens → create "Read" token
  #   modal secret create ordio-hf-token HF_TOKEN=hf_xxxxxxxx
  modal deploy services/audio-enhance/modal_app.py

The printed endpoint URL goes into NEXT_PUBLIC_ENHANCE_URL in Vercel env vars.

If Modal logs show "unauthenticated requests to the HF Hub", create the secret above
and redeploy — otherwise downloads can be throttled and enhancement may time out.
"""

from pathlib import Path
import modal

# Injected at image build + runtime so huggingface_hub / ClearVoice use a token when present.
# Create once: `modal secret create ordio-hf-token HF_TOKEN=hf_...`
HF_HUB_SECRET = modal.Secret.from_name("huggingface-secret", required_keys=["HF_TOKEN"])

# ── Image ─────────────────────────────────────────────────────────────────────
# Built once and cached. Equivalent to the Dockerfile — no Docker needed.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libsndfile1", "ffmpeg")
    .pip_install(
        "torch==2.5.0",
        "torchaudio==2.5.0",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "clearvoice>=0.1.2",
        "librosa>=0.10.0",
        "fastapi>=0.115.0",
        "uvicorn[standard]>=0.34.0",
        "python-multipart>=0.0.18",
        "soundfile>=0.12.1",
        "pedalboard>=0.9.0",
        "pyloudnorm>=0.1.0",
    )
    .run_commands(
        'MODELSCOPE_CACHE=/models python -c "'
        "from clearvoice import ClearVoice; "
        "ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K'])"
        '"',
        secrets=[HF_HUB_SECRET],
    )
    .add_local_file(
        Path(__file__).parent / "main.py",
        remote_path="/root/main.py",
    )
)

# ── Persistent volume ─────────────────────────────────────────────────────────
# Stores ClearerVoice-Studio (MossFormer2) model weights across container restarts.
model_volume = modal.Volume.from_name("ordio-models", create_if_missing=True)
MODEL_DIR = "/models"

# ── App ───────────────────────────────────────────────────────────────────────
app = modal.App("ordio-audio-enhance")


@app.function(
    image=image,
    gpu="A10G",
    volumes={MODEL_DIR: model_volume},
    secrets=[HF_HUB_SECRET],
    # Keep container alive 5 min after last request — eliminates cold starts
    # for burst traffic without paying for always-on
    scaledown_window=300,
    # MossFormer2 on a 2-min clip takes ~15s GPU; 3 min is a safe ceiling
    timeout=180,
    min_containers=0,  # scale to zero when idle ($0 cost)
    max_containers=10,
)
@modal.asgi_app()
def web():
    import os

    os.environ["MODELSCOPE_CACHE"] = MODEL_DIR
    os.environ["TORCH_HOME"] = f"{MODEL_DIR}/torch"
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

    from main import app as fastapi_app

    return fastapi_app
