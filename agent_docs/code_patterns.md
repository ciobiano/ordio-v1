# Code Patterns & Architecture

## Core Architectural Principles

### 1. Client-Side First
Everything runs in the browser for MVP. No server dependencies. $0 hosting cost.

**DO:**
- Use browser APIs directly (Web Audio, Canvas, MediaRecorder, Web Speech)
- Use `AudioContext.currentTime` as single source of truth for timing
- Keep all processing client-side
- Detect browser capabilities and degrade gracefully

**DON'T:**
- Rely on server-side processing for MVP features
- Use `Date.now()` for audio timing (use AudioContext clock)
- Assume all browsers support all features (check capabilities)

### 2. Audio Recording
```typescript
// hooks/useAudioRecorder.ts
export const useAudioRecorder = (): [AudioRecorderState, AudioRecorderActions] => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
  };

  // ... pause, resume, reset
};
```

### 3. Waveform Visualization
```typescript
// components/WaveformVisualizer.tsx
const WaveformVisualizer: React.FC<WaveformProps> = ({
  audioContext,
  analyser,
  isActive,
  theme,
  barCount = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const colors = {
    dark: { bars: '#6366f1', background: '#14141f' },
    light: { bars: '#4f46e5', background: '#f0f0f5' },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      analyser.getByteFrequencyData(frequencyData);
      drawBars(ctx, frequencyData, {
        barCount,
        width: canvas.width,
        height: canvas.height,
        color: colors[theme].bars,
        backgroundColor: colors[theme].background,
      });
      animationRef.current = requestAnimationFrame(render);
    };

    if (isActive) render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isActive, theme, barCount]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};
```

### 4. Bar Drawing Utility
```typescript
// lib/canvas.ts
export const drawBars = (
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  options: {
    barCount: number;
    width: number;
    height: number;
    color: string;
    backgroundColor: string;
  }
) => {
  const { barCount, width, height, color, backgroundColor } = options;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const barWidth = (width / barCount) * 0.7;
  const gap = (width / barCount) * 0.3;
  const maxBarHeight = height * 0.8;

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor((i / barCount) * frequencyData.length);
    const value = frequencyData[dataIndex] || 0;
    const barHeight = Math.max(4, (value / 255) * maxBarHeight);

    const x = i * (barWidth + gap) + gap / 2;
    const y = (height - barHeight) / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 3);
    ctx.fill();
  }
};
```

### 5. Caption Rendering
```typescript
// lib/canvas.ts
export const renderCaptions = (
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: 'dark' | 'light',
  dimensions: { width: number; height: number }
) => {
  const { width, height } = dimensions;
  const captionHeight = 80;
  const captionY = height - captionHeight;

  // Semi-transparent background
  ctx.fillStyle = theme === 'dark'
    ? 'rgba(0, 0, 0, 0.75)'
    : 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, captionY, width, captionHeight);

  // Text
  ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#1a1a2e';
  ctx.font = '18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, captionY + captionHeight / 2);
};
```

### 6. Video Export
```typescript
// hooks/useVideoExporter.ts
export const useVideoExporter = () => {
  const exportVideo = async (options: ExportOptions): Promise<string> => {
    const { canvas, audioBlob, duration, fps = 25 } = options;

    // 1. Setup canvas stream
    const canvasStream = canvas.captureStream(fps);

    // 2. Create audio stream
    const audioContext = new AudioContext();
    const audioElement = new Audio(URL.createObjectURL(audioBlob));
    const audioSource = audioContext.createMediaElementSource(audioElement);
    const destination = audioContext.createMediaStreamDestination();
    audioSource.connect(destination);

    // 3. Combine streams
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    // 4. Record
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp9',
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        resolve(url);
      };

      recorder.start();
      audioElement.play();

      audioElement.onended = () => recorder.stop();
    });
  };

  return { exportVideo };
};
```

### 7. Capability Detection
```typescript
// hooks/useCapabilities.ts
export const useCapabilities = (): Capabilities => {
  return useMemo(() => {
    const warnings: string[] = [];

    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const canRecordVideo = hasMediaRecorder &&
      (MediaRecorder.isTypeSupported('video/webm') ||
       MediaRecorder.isTypeSupported('video/mp4'));
    const canRecordAudio = hasMediaRecorder;
    const canTranscribe = 'webkitSpeechRecognition' in window ||
                          'SpeechRecognition' in window;

    if (!canRecordVideo) {
      warnings.push('Video export requires Chrome, Edge, or Firefox.');
    }
    if (!canTranscribe) {
      warnings.push('Automatic transcription not available in this browser.');
    }

    return {
      canRecordAudio,
      canExportVideo: canRecordVideo,
      canTranscribe,
      recommendedPath: canRecordVideo ? 'client' : 'server',
      warnings,
    };
  }, []);
};
```

### 8. Performance Optimization
```typescript
// lib/canvas.ts

// Pre-calculate bar positions to avoid per-frame math
export const precomputeBarLayout = (
  width: number,
  barCount: number
): { x: number; barWidth: number }[] => {
  const barWidth = (width / barCount) * 0.7;
  const gap = (width / barCount) * 0.3;

  return Array.from({ length: barCount }, (_, i) => ({
    x: i * (barWidth + gap) + gap / 2,
    barWidth,
  }));
};

// Throttle rendering on low-end devices
export const createThrottledRenderer = (
  targetFPS: number,
  renderFn: () => void
): (() => void) => {
  const frameInterval = 1000 / targetFPS;
  let lastFrameTime = 0;

  return () => {
    const now = performance.now();
    if (now - lastFrameTime >= frameInterval) {
      renderFn();
      lastFrameTime = now;
    }
  };
};
```

### 9. Memory Management
```typescript
// Cleanup on unmount
useEffect(() => {
  return () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (audioContext.state !== 'closed') audioContext.close();
    stream?.getTracks().forEach(track => track.stop());
  };
}, []);
```

---

## State Management (Zustand)

**Simple store, no middleware:**
```typescript
// stores/useAppStore.ts
import { create } from 'zustand';

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  audioBlob: null,
  setAudio: (blob, buffer) => set({
    audioBlob: blob,
    audioBuffer: buffer,
    audioDuration: buffer.duration,
  }),

  // Use selector pattern in components to prevent re-renders
}));

// Usage in components
function WaveformCanvas() {
  const audioBuffer = useAppStore((state) => state.audioBuffer);
  const currentTime = useAppStore((state) => state.playbackTime);
}
```

---

## Client Components Directive
**ALWAYS** add `"use client";` to the top of any component that uses React Hooks or browser APIs.

```typescript
"use client"; // MUST BE THE FIRST LINE

import { useState } from "react";

export default function MyComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

---

## Anti-Patterns (DO NOT USE)

### ❌ Using `any` type
```typescript
// BAD
function processData(data: any) { return data.value; }

// GOOD
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data shape');
}
```

### ❌ Using Date.now() for audio timing
```typescript
// BAD — will drift
const currentTime = Date.now() - startTime;

// GOOD — AudioContext is the single source of truth
const currentTime = audioContext.currentTime;
```

### ❌ Swallowing errors
```typescript
// BAD
try { await exportVideo(); } catch (error) { console.log('Error'); }

// GOOD
try {
  await exportVideo();
} catch (error) {
  if (error instanceof ExportError) {
    toast.error(`Export failed: ${error.message}`);
  } else {
    throw error;
  }
}
```
