# Product Requirements (Core Features & Metrics)

## Primary User Story
"As a content creator who can't afford Headliner or Descript, I want to record audio with animated waveforms and captions, then export as video, so that I can post audiograms directly to Instagram/TikTok without paying $10-20/month."

## Target User: The Independent Creator
- Podcasters, musicians, coaches, educators
- Publishes 3-10 social clips per week
- Budget-conscious (<$50/month total tool spend)
- Mobile-first content creation
- Nigerian/African creators are a key segment (accent support matters)

## Must-Have Features (P0 — MVP)

### 1. Audio Input
- Record via microphone (MediaRecorder API)
- Upload file (MP3, WAV, M4A, up to 50MB)
- Drag-and-drop support
- Client-side validation (format, size)
- Visual feedback during recording (waveform animates live)
- Max recording length: 5 minutes

### 2. Waveform Visualization
- Canvas-based animated bars (default style, locked for MVP)
- 48 bars minimum, responsive to audio frequency data
- 25-30fps desktop, ≥20fps mobile
- Smooth animation during playback
- Idle state shows subtle static bars
- Colors respect dark/light theme
- Technical: Web Audio API → AnalyserNode → getByteFrequencyData()

### 3. Post-Recording Transcription
- Triggered after recording stops or file upload completes
- Web Speech API (Chrome) with fallback messaging for Safari
- Word-level timestamps extracted
- Editable transcript (click to edit any word)
- ≥70% accuracy for standard English
- Live transcription during recording is OUT OF SCOPE for MVP

### 4. Caption Display
- Position: Bottom of canvas (locked for MVP)
- Captions render on Canvas (not DOM overlay)
- Word-by-word highlight during playback
- Semi-transparent background for readability
- Max 2 lines visible at once, auto-scroll
- Font: System UI or bundled Inter

### 5. Video Export (Client-Side)
- canvas.captureStream() + MediaRecorder captures video
- Format: WebM (Chrome/Edge), MP4 fallback for Safari
- Audio track merged correctly (no drift over 5 minutes)
- Export progress indicator
- Download triggers automatically on completion
- Resolution: 1080x1920 (9:16 portrait) default

### 6. Dark/Light Theme
- Default: Dark mode
- Toggle switch in header
- All UI elements respect theme
- Canvas waveform colors adapt
- Persists to localStorage

## Nice-to-Have (P1 — Post-MVP)
- Server-side export (FFmpeg render for iOS Safari users)
- Multiple waveform styles (line, circle, mirrored bars)
- Caption position options (top, center, custom Y)
- Aspect ratio presets (1:1 Instagram, 16:9 YouTube)
- Brand colors (custom waveform/background colors)
- Batch export (process multiple clips)

## Out of Scope (Won't Have)
- Server-side rendering for MVP
- User accounts or authentication
- Real-time collaborative editing
- Full DAW features (multi-track, EQ, compression)
- Live transcription during recording

## Success Metrics

### Technical Validation
- **≥25fps** canvas rendering on desktop, ≥20fps on mobile
- **<2s** time to first waveform from audio load
- **<3 minutes** export time for 1-minute clip
- **<500KB** gzipped bundle size
- **No A/V drift** over 5-minute recordings

### User Activation
- **10 users** complete full record → export flow at launch
- **<5% crash/error rate**
- **<3 minutes** total flow time (record → preview → export)
- **4/5 satisfaction** rating from feedback form

### Cost Efficiency
- **$0** for client-side path
- **<$10/month** for server fallback tier (P1)

## Constraints
- **Budget:** $0 hosting for client path
- **Timeline:** 8 weeks (6 dev + 2 testing)
- **Resources:** Solo developer + AI assistance
- **Technical:** Next.js 14 App Router, client-side first architecture
- **Browser Support:** Chrome 90+ (full), Edge 90+ (full), Firefox 90+ (WebM only), Safari 15+ (partial — no video export)

## Competitive Positioning

| Feature | Headliner | Wavve | ordio |
|---------|-----------|-------|-------|
| **Price** | $20-100/mo | $30+/mo | **Free** |
| **Client-side render** | No | No | **Yes** |
| **Mobile workflow** | Limited | No | **Yes** |
| **Preview = Export** | No | No | **Yes** |
| **Inline caption edit** | Limited | Limited | **Yes** |
| **Open source** | No | No | **Planned** |
