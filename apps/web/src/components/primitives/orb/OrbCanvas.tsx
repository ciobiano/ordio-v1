'use client';

import { Canvas } from '@react-three/fiber';
import { OrbMesh } from './OrbMesh';
import { isWebGLAvailable } from '@/lib/webgl-detect';

interface OrbCanvasProps {
  state: 'dormant' | 'active' | 'resting';
  intensity: number;
  isSpeaking?: boolean;
}

// ---------------------------------------------------------------------------
// CSS-only fallback — rendered when WebGL is unavailable (sandboxed browser,
// software rendering disabled, etc.).
// ---------------------------------------------------------------------------
function OrbFallback({ state, intensity, isSpeaking }: OrbCanvasProps) {
  const isActive = state === 'active';
  const isDormant = state === 'dormant';

  const innerOpacity = 0.55 + intensity * 0.3;
  const outerOpacity = 0.12 + intensity * 0.18;
  const speakingExtra = isSpeaking ? 0.2 : 0;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 rounded-full overflow-hidden"
      style={{
        background: [
          `radial-gradient(ellipse 80% 70% at 40% 65%, rgba(0,5,97,${innerOpacity}) 0%, transparent 65%)`,
          `radial-gradient(ellipse 65% 55% at 50% 45%, rgba(0,97,253,${innerOpacity - 0.1}) 0%, transparent 60%)`,
          `radial-gradient(ellipse 50% 40% at 55% 30%, rgba(240,250,255,${0.35 + intensity * 0.2}) 0%, transparent 55%)`,
          `radial-gradient(ellipse 70% 30% at 60% 20%, rgba(97,194,255,${0.25 + intensity * 0.15}) 0%, transparent 50%)`,
          `radial-gradient(ellipse 100% 100% at 50% 50%, rgba(0,20,120,1) 30%, rgba(0,40,180,0.85) 55%, rgba(97,194,255,${outerOpacity + speakingExtra}) 75%, transparent 100%)`,
        ].join(', '),
        animation: isDormant
          ? 'orb-fallback-breathe 8s ease-in-out infinite'
          : isActive
            ? `orb-fallback-pulse ${Math.max(0.6, 1.2 - intensity * 0.4)}s ease-in-out infinite`
            : undefined,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main export.
// isWebGLAvailable() is called synchronously — safe because this module is
// only ever loaded via dynamic(..., { ssr: false }), guaranteeing document
// exists at render time. No useState/useEffect round-trip needed.
// ---------------------------------------------------------------------------
export default function OrbCanvas({ state, intensity, isSpeaking }: OrbCanvasProps) {
  if (!isWebGLAvailable()) {
    return <OrbFallback state={state} intensity={intensity} isSpeaking={isSpeaking} />;
  }

  return (
    <Canvas
      className="absolute inset-0"
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 3.0], fov: 38 }}
      dpr={[1, 1.5]}
    >
      {/* Ambient only — directional lights would create competing highlights
          that fight the noise-driven cloud texture in the fragment shader. */}
      <ambientLight intensity={1.0} />
      <OrbMesh state={state} intensity={intensity} isSpeaking={isSpeaking} />
    </Canvas>
  );
}
