'use client'

import { Canvas } from '@react-three/fiber'
import { OrbMesh } from './OrbMesh'

interface OrbCanvasProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
}

export function OrbCanvas({ state, intensity }: OrbCanvasProps) {
  return (
    <Canvas
      className="absolute inset-0"
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 2.8], fov: 38 }}
      dpr={[1, 1.5]}
    >
      {/* Ambient only — directional lights would create competing highlights
          that fight the noise-driven cloud texture in the fragment shader. */}
      <ambientLight intensity={1.0} />
      <OrbMesh state={state} intensity={intensity} />
    </Canvas>
  )
}
