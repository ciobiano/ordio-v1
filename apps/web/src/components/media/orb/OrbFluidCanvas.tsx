'use client';

import { useEffect, useRef } from 'react';

/**
 * Ported from the "Orb shader design system" Claude Design project
 * (physically-inspired curl-noise fluid advection, Canvas2D "software shader").
 * Colors are exact — unchanged from the approved design file (support.js).
 */

type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

interface OrbFluidCanvasProps {
  phase: OrbPhase;
  intensity: number;
  isSpeaking?: boolean;
}

const RES = 150;
const ITERS = 6;
const DT = 0.045;

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function mixRGB(a: number[], b: number[], t: number) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
function hash2(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function fbmLike(x: number, y: number, t: number) {
  let v = 0;
  v += 0.5 * Math.sin(x * 3.1 + y * 2.3 + t * 0.6);
  v += 0.3 * Math.sin(x * 5.4 - y * 3.7 - t * 0.9 + 1.7);
  v += 0.2 * Math.sin(x * y * 9.0 + t * 0.4 + 0.6);
  v += 0.14 * Math.sin(x * 8.5 + y * 6.1 + t * 1.3 + 2.1);
  return v;
}
function fbm01(x: number, y: number, t: number) {
  return fbmLike(x, y, t) * 0.5 + 0.5;
}

// Analytic curl noise — stream function ψ is a small sum of sine waves, so
// its gradient (and the divergence-free curl velocity) is closed-form.
const PSI = [
  { ax: 1.1, ay: 1.7, amp: 1.0, ph: 0.0, sp: 0.55 },
  { ax: -1.9, ay: 1.2, amp: 0.65, ph: 1.7, sp: -0.42 },
  { ax: 2.3, ay: 2.9, amp: 0.42, ph: 4.1, sp: 0.7 },
];
function curl(x: number, y: number, scale: number, t: number, out: number[]) {
  let dx = 0;
  let dy = 0;
  const sx = x * scale;
  const sy = y * scale;
  for (const T of PSI) {
    const c = Math.cos(T.ax * sx + T.ay * sy + T.sp * t + T.ph) * T.amp;
    dx += T.ax * scale * c;
    dy += T.ay * scale * c;
  }
  out[0] = dy;
  out[1] = -dx;
}

const _cn = [0, 0];
function velocity(x: number, y: number, t: number, pulse: number, out: number[]) {
  let vx = 0;
  let vy = 0;
  curl(x, y, 0.55, t, _cn);
  vx += 0.72 * _cn[0];
  vy += 0.72 * _cn[1];
  curl(x, y, 1.7, t * 1.3, _cn);
  vx += 0.26 * _cn[0];
  vy += 0.26 * _cn[1];
  curl(x, y, 5.2, t * 1.8, _cn);
  vx += 0.08 * _cn[0];
  vy += 0.08 * _cn[1];
  const d = Math.sqrt(x * x + y * y) || 0.0001;
  const orbit = Math.exp(-2.5 * d * d);
  vx += 0.18 * (-y / d) * orbit;
  vy += 0.18 * (x / d) * orbit;
  const edgeDamp = smoothstep(0.5, 0.34, d);
  const s = pulse * edgeDamp;
  out[0] = vx * s;
  out[1] = vy * s;
}

// Art-directed 7-stop density→color gradient — exact values from the
// approved design file. Saturation falls as density rises; brightest
// stops are warm (cream/ivory), never pure white.
const GRAD: { p: number; c: number[] }[] = [
  { p: 0.0, c: [30, 120, 238] }, // deepest plume blue (bright azure, not navy)
  { p: 0.2, c: [70, 158, 246] }, // azure
  { p: 0.4, c: [128, 198, 250] }, // sky blue
  { p: 0.6, c: [188, 226, 250] }, // light ice blue
  { p: 0.74, c: [224, 240, 246] }, // pale
  { p: 0.84, c: [244, 246, 232] }, // pale ivory (warming)
  { p: 0.93, c: [253, 250, 230] }, // warm cream
  { p: 1.0, c: [255, 251, 224] }, // soft warm ivory
];
const CYAN = [128, 198, 250]; // aqueous blue-bleed

function gradient(d: number) {
  d = clamp01(d);
  for (let i = 1; i < GRAD.length; i++) {
    if (d <= GRAD[i].p) {
      const a = GRAD[i - 1];
      const b = GRAD[i];
      const f = smoothstep(a.p, b.p, d);
      return mixRGB(a.c, b.c, f);
    }
  }
  return GRAD[GRAD.length - 1].c.slice();
}

function targetIntensityForPhase(phase: OrbPhase) {
  if (phase === 'idle') return 0.08;
  if (phase === 'thinking') return 0.22;
  if (phase === 'listening') return 0.55;
  return 0.85; // speaking
}

// How much faster the smoke's internal clock runs per phase, on top of the
// existing intensity-driven speed. Idle reads 2x faster, speaking 3x faster;
// listening/thinking are untouched (1x) unless asked to tune separately.
function speedMultiplierForPhase(phase: OrbPhase) {
  if (phase === 'idle') return 2;
  if (phase === 'speaking') return 3;
  return 1;
}

export default function OrbFluidCanvas({ phase, intensity, isSpeaking }: OrbFluidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const currentIntensity = useRef(0.15);
  const startRef = useRef(0);
  const phaseRef = useRef(phase);
  const intensityRef = useRef(intensity);
  const isSpeakingRef = useRef(isSpeaking);

  phaseRef.current = phase;
  intensityRef.current = intensity;
  isSpeakingRef.current = isSpeaking;

  const imgDataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    imgDataRef.current = ctx.createImageData(RES, RES);
    startRef.current = performance.now();

    const vel = [0, 0];
    const currentSpeedMul = { current: 1 };

    const paint = (t: number, intensityNow: number) => {
      const imgData = imgDataRef.current;
      if (!imgData) return;
      const data = imgData.data;
      const N = RES;
      const pulse = (0.85 + intensityNow * 0.9) * (1.0 + 0.08 * Math.sin(t * 0.8));

      for (let py = 0; py < N; py++) {
        const y = py / (N - 1) - 0.5;
        for (let px = 0; px < N; px++) {
          const x = px / (N - 1) - 0.5;
          const idx = (py * N + px) * 4;
          const r = Math.sqrt(x * x + y * y);
          const edgeR = 0.49;
          if (r > edgeR) {
            data[idx + 3] = 0;
            continue;
          }
          const feather = smoothstep(edgeR, edgeR - 0.02, r);

          let ax = x;
          let ay = y;
          for (let s = 0; s < ITERS; s++) {
            velocity(ax, ay, t, pulse, vel);
            ax -= vel[0] * DT;
            ay -= vel[1] * DT;
          }

          const w1x = fbmLike(ax * 1.3, ay * 1.3, t * 0.3);
          const w1y = fbmLike(ax * 1.3 + 5.2, ay * 1.3 - 2.7, t * 0.3);
          let wx = ax + 0.18 * w1x;
          let wy = ay + 0.18 * w1y;
          const w2x = fbmLike(wx * 2.0, wy * 2.0, t * 0.4);
          const w2y = fbmLike(wx * 2.0 + 8.5, wy * 2.0 + 1.3, t * 0.4);
          wx += 0.09 * w2x;
          wy += 0.09 * w2y;

          const base = fbm01(wx * 1.05, wy * 1.05, t * 0.2);
          const wisps = fbm01(wx * 2.6, wy * 2.6, t * 0.28);

          const hg = smoothstep(0.78, -0.72, y);
          let dens = hg * 0.68 + 0.05 + (base - 0.5) * 0.3 + (wisps - 0.5) * 0.1;
          dens = clamp01(dens);

          const puff = smoothstep(0.52, 0.82, fbm01(wx * 3.2 + 11.0, wy * 3.2 - 4.0, t * 0.22));
          const puffZone = smoothstep(0.45, -0.55, y) * hg;
          dens = clamp01(dens + puff * puffZone * 0.5);
          dens = smoothstep(0.03, 0.99, dens);

          let color = gradient(dens);

          const dX = fbm01((wx + 0.04) * 1.2, wy * 1.2, t * 0.22) - base;
          const dY = fbm01(wx * 1.2, (wy + 0.04) * 1.2, t * 0.22) - base;
          const nz = -0.6;
          const nl = Math.sqrt(dX * dX + dY * dY + nz * nz) || 1;
          const light = (dX * -0.4 + dY * -0.5 + nz * -0.75) / nl;
          const lightAmt = clamp01(0.5 + light * 0.5);
          color = [
            color[0] * (0.85 + lightAmt * 0.3),
            color[1] * (0.85 + lightAmt * 0.3),
            color[2] * (0.85 + lightAmt * 0.3),
          ];

          const glow = smoothstep(0.8, 1.0, dens);
          color = [color[0] + glow * 8, color[1] + glow * 7, color[2] + glow * 4];

          color = mixRGB(color, CYAN, 0.07 * (1.0 - dens));

          const cn = (hash2(wx * 20.0, wy * 20.0) - 0.5) * 5.0;
          const dither = (hash2(px * 1.7, py * 1.3) - 0.5) * 2.2;
          const lift = intensityNow * 6;
          const edge = smoothstep(0.5, 0.3, r);
          const edgeMul = mix(0.93, 1.0, edge);

          data[idx] = clamp01(((color[0] + lift + dither + cn) / 255) * edgeMul) * 255;
          data[idx + 1] = clamp01(((color[1] + lift + dither + cn) / 255) * edgeMul) * 255;
          data[idx + 2] = clamp01(((color[2] + lift + dither + cn) / 255) * edgeMul) * 255;
          data[idx + 3] = Math.round(feather * 255);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    const loop = (now: number) => {
      const t = (now - startRef.current) / 1000;
      // Blend the real mic-driven intensity with a phase floor so idle/thinking
      // still read as "alive" even at silence.
      const speakingBoost = isSpeakingRef.current ? 0.1 : 0;
      const target =
        Math.max(targetIntensityForPhase(phaseRef.current) * 0.4, intensityRef.current) + speakingBoost;
      currentIntensity.current += (target - currentIntensity.current) * 0.06;
      currentSpeedMul.current +=
        (speedMultiplierForPhase(phaseRef.current) - currentSpeedMul.current) * 0.06;
      paint(t * currentSpeedMul.current * (0.35 + currentIntensity.current * 0.5), currentIntensity.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Glow ring is Orb.tsx's existing .orb-glow-ring wrapper (recolored to
  // lime/cyan in globals.css) — this component only owns the fluid canvas
  // itself, avoiding a duplicate glow layer.
  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={RES}
        height={RES}
        className="absolute inset-0 w-full h-full rounded-full"
        style={{ filter: 'blur(0.4px)' }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '3%',
          mixBlendMode: 'screen',
          background:
            'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.22) 0%, transparent 40%), radial-gradient(circle at 68% 80%, rgba(255,255,255,0.06) 0%, transparent 30%)',
        }}
      />
    </div>
  );
}
