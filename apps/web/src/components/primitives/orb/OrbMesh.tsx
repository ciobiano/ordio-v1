'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';

type OrbState = 'dormant' | 'active' | 'resting';

interface OrbMeshProps {
  state: OrbState;
  intensity: number;
  isSpeaking?: boolean;
}

const SNOISE_GLSL = /* glsl */ `
vec3 mod289_3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute4(vec4 x){return mod289_4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt4(vec4 r){return 1.79284291400159-0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., .5, 1., 2.);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1. - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289_3(i);

  vec4 p = permute4(permute4(permute4(
    i.z + vec4(0., i1.z, i2.z, 1.))
    + i.y + vec4(0., i1.y, i2.y, 1.))
    + i.x + vec4(0., i1.x, i2.x, 1.));

  float n_ = .142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49. * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7. * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1. - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2. + 1.;
  vec4 s1 = floor(b1) * 2. + 1.;
  vec4 sh = -step(h, vec4(0.));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  m = m * m;

  return 42. * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const VERTEX_SHADER =
  SNOISE_GLSL +
  /* glsl */ `
uniform float uTime;
uniform float uAudioLevel;
uniform float uEnergy;
uniform float uIsSpeaking;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  float activity = mix(0.30, 1.0, uEnergy);
  float audioPush = uAudioLevel * 0.27;
  
  // Speaking boost — more aggressive displacement when actively speaking
  float speakingBoost = uIsSpeaking * 0.12;
  
  // Slower base speed with subtle energy modulation for meditative flow
  float baseSpeed = 0.06 + uEnergy * 0.02 + uIsSpeaking * 0.025;
  
  // Warp influence increases with speaking
  vec3 warp = vec3(
    snoise(position * 1.0 + uTime * baseSpeed),
    snoise(position * 1.0 + uTime * baseSpeed + vec3(3.1, 1.7, 5.4)),
    snoise(position * 1.0 + uTime * baseSpeed + vec3(7.2, 2.9, 1.3))
  );

  // Asymmetrical offset + reduced warp coupling for organic movement
  float n = snoise((position + warp * 0.18 + vec3(0.37, 0.71, 0.19)) * (1.18 + uEnergy * 0.08 + uIsSpeaking * 0.06) + uTime * 0.04);

  // Gentler displacement maintaining clear spherical form, boosted by speaking
  vec3 displaced = position + normal * n * (0.016 + audioPush) * activity * (1.0 + speakingBoost);
  displaced *= 1.0 + n * 0.008 * (uEnergy + uIsSpeaking * 0.06);

  vObjPos = displaced;
  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);

  csm_Position = displaced;
}
`;

const FRAGMENT_SHADER =
  SNOISE_GLSL +
  /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uAudioLevel;
uniform float uIsSpeaking;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormalW;

// Hash-based film grain — screen-space, changes every frame
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  // Calm cloud motion to match the reference orb style.
  float windSpeed = 0.017 + uEnergy * 0.012 + uIsSpeaking * 0.01;
  vec2 windDir = normalize(vec2(0.82, 0.22));
  float turbulence = 0.22 + uEnergy * 0.12 + uIsSpeaking * 0.08;
  
  // ---- Layer 1: Fast-moving base cloud layer ----
  vec2 windOffset1 = windDir * uTime * windSpeed * 1.4;
  float cloudLayer1 = snoise(
    vec3(vObjPos.xy * 0.58 + windOffset1, vObjPos.z * 0.45 + uTime * 0.012)
  ) * 0.5 + 0.5;
  
  // ---- Layer 2: Aggressive turbulent eddies ----
  vec2 windOffset2 = windDir * uTime * windSpeed * 2.1 + vec2(uTime * 0.065);
  float cloudLayer2 = snoise(
    vec3(vObjPos.xy * 0.95 + windOffset2, vObjPos.z * 0.7)
    + vec3(snoise(vObjPos * 0.38 + uTime * 0.032)) * turbulence
  ) * 0.5 + 0.5;
  
  // ---- Layer 3: Rapid cirrus streaks ----
  vec2 windOffset3 = windDir * uTime * windSpeed * 2.9;
  float cloudLayer3 = snoise(
    vec3(vObjPos.xy * 1.45 + windOffset3, vObjPos.z * 1.0 + uTime * 0.016)
  ) * 0.5 + 0.5;
  
  // Composite with emphasis on mid-layer turbulence
  float cloud = cloudLayer1 * 0.48 + cloudLayer2 * 0.37 + cloudLayer3 * 0.15;
  
  vec3 lightDir = normalize(vec3(-0.4, 0.4, 1.0));
  float lighting = dot(normalize(vNormalW), lightDir) * 0.5 + 0.5;
  
  // Lighting modulates cloud density (brighter areas = thicker clouds)
  float adjustedCloud = cloud * mix(0.6, 1.35, lighting) + lighting * 0.22;

  // ---- WINDY WEATHER FORMATION MAPPING ----
  
  // Altitude factor: how high up on the orb (0=bottom, 1=top)
  float altitude = vObjPos.y * 0.5 + 0.5;
  
  // Wind exposure: dot product with wind direction reveals windward vs leeward sides
  // Windward = facing the wind (gets more cloud buildup), Leeward = sheltered
  float windExposure = dot(normalize(vObjPos.xz), normalize(windDir)) * 0.5 + 0.5;
  
  // Cloud thickness: denser areas = darker (like real storm clouds)
  float cloudDensity = adjustedCloud;
  
  // ---- METEOROLOGICAL COLOR ZONES ----
  
  // 🌧️ STORM BASE (Navy) — Dense cloud bottoms, heavy precipitation zones
  // Forms at low altitude + high density + windward compression
  vec3 colorStormBase = vec3(0.02, 0.08, 0.32);
  float stormFactor = (1.0 - altitude) * cloudDensity * (0.6 + windExposure * 0.4);
  stormFactor = smoothstep(0.25, 0.75, stormFactor);
  
  // ☁️ MAIN CLOUD BODY (Azure) — Stratocumulus layer, bulk of the formation
  // Mid-altitude + medium density, stretched by wind shear
  vec3 colorCloudBody = vec3(0.16, 0.62, 0.96);
  float cloudBodyFactor = mix(altitude, 1.0 - abs(altitude - 0.45) * 2.2, 0.55);
  cloudBodyFactor *= smoothstep(0.2, 0.8, cloudDensity);
  cloudBodyFactor *= (0.7 + windExposure * 0.3);  // Slightly more on windward side
  
  // ☀️ SUNLIT CLOUD TOPS (White) — Cumulus peaks catching light
  // Upper-mid altitude + lower density (thinner = brighter) + leeward spread
  vec3 colorSunlit = vec3(0.96, 0.98, 1.00);
  float sunlitFactor = altitude * (1.0 - cloudDensity * 0.5) * (1.1 - windExposure * 0.3);
  sunlitFactor = pow(sunlitFactor, 0.85);  // Broaden the zone slightly
  sunlitFactor = smoothstep(0.18, 0.58, sunlitFactor);
  
  // 💨 CIRRUS WISPS (Sky-Cyan) — High-altitude ice crystals swept by jet stream
  // High altitude + very low density + stretched in wind direction
  vec3 colorCirrus = vec3(0.66, 0.86, 1.00);
  float cirrusFactor = pow(altitude, 1.4) * (1.0 - cloudDensity * 0.7);
  cirrusFactor *= (0.4 + windExposure * 0.6);  // Strongly biased toward wind direction!
  cirrusFactor = smoothstep(0.22, 0.72, cirrusFactor);
  
  // ---- COMPOSITE WEATHER FORMATION ----
  // Layer from bottom (storm) to top (cirrus), with proper blending
  vec3 color = mix(colorStormBase, colorCloudBody, stormFactor);
  color = mix(color, colorSunlit, sunlitFactor);
  color = mix(color, colorCirrus, cirrusFactor);

  // Edge darkening / vignette
  float facing = dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0));
  float vignette = smoothstep(-0.2, 0.6, facing);
  color = mix(colorStormBase * 0.25, color, vignette);
  
  // Outer rim — enhanced cyan-azure glow, intensifies when speaking
  float fresnel = pow(1.0 - max(facing, 0.0), 2.9);
  color += fresnel * vec3(0.52, 0.82, 1.00) * 0.32 * (0.45 + uEnergy * 0.35 + uIsSpeaking * 0.25);

  // Subtle pulse shimmer — slower frequency for meditative quality
  float pulse = 0.5 + 0.5 * sin(uTime * (0.62 + uEnergy * 0.3) + uAudioLevel * 1.2);
  color += pulse * 0.02 * uEnergy;

  // ---- Film grain / organic noise ----
  // Screen-space grain: use gl_FragCoord + animated time seed
  vec2 grainUV = gl_FragCoord.xy + vec2(uTime * 97.3, uTime * 53.7);
  float grain = hash(grainUV) * 2.0 - 1.0;  // [-1, 1]
  float grainStrength = 0.014;
  color += grain * grainStrength;

  // Render as emissive since we manage our own shading for the cloud volume
  csm_DiffuseColor = vec4(0.0, 0.0, 0.0, 1.0);
  csm_Emissive = color;
}
`;

export function OrbMesh({ state, intensity, isSpeaking }: OrbMeshProps) {
  const smoothedLevel = useRef(0);
  const smoothedSpeaking = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 6);
    const merged = mergeVertices(geo);
    merged.computeVertexNormals();
    merged.center();
    return merged;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioLevel: { value: 0 },
      uEnergy: { value: 0 },
      uIsSpeaking: { value: 0 },
    }),
    []
  );

  const material = useMemo(() => {
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      metalness: 0,
      roughness: 1,
      clearcoat: 0.08,
      clearcoatRoughness: 0.25,
      transmission: 0,
      ior: 1.1,
      envMapIntensity: 0,
      color: new THREE.Color(0xffffff),
      toneMapped: false,
    });
  }, [uniforms]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    const target = state === 'active' ? intensity : 0;
    // Smoother audio level response for graceful reactivity
    smoothedLevel.current += (target - smoothedLevel.current) * 0.08;

    const energyTarget = state === 'active' ? 1 : 0;
    // Gentler energy transitions for meditative state changes
    uniforms.uEnergy.value += (energyTarget - uniforms.uEnergy.value) * 0.03;

    // Smooth speaking state transition (~200ms for responsive but not jarring feel)
    const speakingTarget = isSpeaking ? 1 : 0;
    smoothedSpeaking.current += (speakingTarget - smoothedSpeaking.current) * 0.12;
    uniforms.uIsSpeaking.value = smoothedSpeaking.current;

    uniforms.uTime.value += delta;
    uniforms.uAudioLevel.value = smoothedLevel.current;
  });

  return <mesh geometry={geometry} material={material} scale={1.15} />;
}

export default function OrbScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#000000']} />

      <ambientLight intensity={0.4} color="#ffffff" />

      <directionalLight position={[-2, 2, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[3, -1, -3]} intensity={0.5} color="#0055ff" />

      <OrbMesh state="active" intensity={0.7} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#000000" roughness={1} metalness={0} />
      </mesh>
    </Canvas>
  );
}
