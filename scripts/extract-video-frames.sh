#!/usr/bin/env bash
# Extract representative still frames from a video for visual review (e.g.
# feeding reference clips to an LLM that can only see images, not motion).
#
# Scene-detection is the primary strategy — it grabs a frame on every real
# cut or on-screen text change, which is where the visual information
# actually lives. It fails in two predictable ways, both handled below:
#   - too static (quote videos, single unbroken shot): falls back to
#     evenly-spaced sampling so we still get *some* coverage.
#   - too busy (fast-cut edits): thins the scene-detected set down to
#     max_frames evenly across the sequence, instead of returning hundreds.
set -euo pipefail

usage() {
  echo "Usage: $0 <video> <outdir> [scene_threshold=0.3] [min_frames=4] [max_frames=12]" >&2
  exit 1
}

[ $# -ge 2 ] || usage

VIDEO="$1"
OUTDIR="$2"
THRESHOLD="${3:-0.3}"
MIN_FRAMES="${4:-4}"
MAX_FRAMES="${5:-12}"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found on PATH" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found on PATH" >&2; exit 1; }
[ -f "$VIDEO" ] || { echo "No such file: $VIDEO" >&2; exit 1; }

mkdir -p "$OUTDIR"
rm -f "$OUTDIR"/frame_*.jpg

DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO")

# Pass 1: scene-change detection. -pix_fmt yuvj420p works around an ffmpeg
# mjpeg-encoder bug where select's output range metadata makes it refuse to
# open the encoder ("Non full-range YUV is non-standard") on some sources.
ffmpeg -y -v error -i "$VIDEO" \
  -vf "select='gt(scene,${THRESHOLD})'" -vsync vfr -pix_fmt yuvj420p -q:v 3 \
  "$OUTDIR/frame_%03d.jpg"

COUNT=$(find "$OUTDIR" -name 'frame_*.jpg' | wc -l | tr -d ' ')

if [ "$COUNT" -lt "$MIN_FRAMES" ]; then
  echo "Only $COUNT scene changes detected — falling back to evenly-spaced sampling" >&2
  rm -f "$OUTDIR"/frame_*.jpg
  INTERVAL=$(awk -v d="$DURATION" -v n="$MIN_FRAMES" 'BEGIN { printf "%.3f", d / n }')
  ffmpeg -y -v error -i "$VIDEO" -vf "fps=1/${INTERVAL}" -pix_fmt yuvj420p -q:v 3 "$OUTDIR/frame_%03d.jpg"
elif [ "$COUNT" -gt "$MAX_FRAMES" ]; then
  echo "$COUNT scene changes detected — thinning to $MAX_FRAMES" >&2
  STEP=$(( (COUNT + MAX_FRAMES - 1) / MAX_FRAMES ))
  i=0
  for f in "$OUTDIR"/frame_*.jpg; do
    if [ $(( i % STEP )) -ne 0 ]; then
      rm -f "$f"
    fi
    i=$((i + 1))
  done
fi

FINAL_COUNT=$(find "$OUTDIR" -name 'frame_*.jpg' | wc -l | tr -d ' ')
echo "Extracted $FINAL_COUNT frames to $OUTDIR"
