'use client';

import OrbFluidCanvas from './OrbFluidCanvas';

interface OrbCanvasProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  intensity: number;
  isSpeaking?: boolean;
}

export default function OrbCanvas({ state, intensity, isSpeaking }: OrbCanvasProps) {
  return <OrbFluidCanvas phase={state} intensity={intensity} isSpeaking={isSpeaking} />;
}
