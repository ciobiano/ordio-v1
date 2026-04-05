'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'

type OrbState = 'dormant' | 'active' | 'resting'

interface OrbMeshProps {
  state: OrbState
  intensity: number
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
`

const VERTEX_SHADER = SNOISE_GLSL + /* glsl */ `
uniform float uTime;
uniform float uAudioLevel;
uniform float uEnergy;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  float activity = mix(0.30, 1.0, uEnergy);
  float audioPush = uAudioLevel * 0.18;

  vec3 warp = vec3(
    snoise(position * 1.0 + uTime * (0.10 + uEnergy * 0.03)),
    snoise(position * 1.0 + uTime * (0.10 + uEnergy * 0.03) + vec3(3.1, 1.7, 5.4)),
    snoise(position * 1.0 + uTime * (0.10 + uEnergy * 0.03) + vec3(7.2, 2.9, 1.3))
  );

  float n = snoise((position + warp * 0.26) * (1.18 + uEnergy * 0.10) + uTime * 0.05);

  vec3 displaced = position + normal * n * (0.022 + audioPush) * activity;
  displaced *= 1.0 + n * 0.010 * uEnergy;

  vObjPos = displaced;
  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);

  csm_Position = displaced;
}
`

const FRAGMENT_SHADER = SNOISE_GLSL + /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uAudioLevel;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  float drift = 0.028 + uEnergy * 0.06;

  vec3 warp = vec3(
    snoise(vObjPos * 0.78 + uTime * drift),
    snoise(vObjPos * 0.78 + uTime * drift + vec3(2.7, 6.1, 1.4)),
    snoise(vObjPos * 0.78 + uTime * drift + vec3(7.3, 2.5, 4.8))
  );

  float cloud = snoise((vObjPos + warp * 0.40) * (0.92 + uEnergy * 0.10) + uTime * drift * 0.75) * 0.5 + 0.5;
  
  vec3 lightDir = normalize(vec3(-0.4, 0.4, 1.0));
  float lighting = dot(normalize(vNormalW), lightDir) * 0.5 + 0.5;
  
  float adjustedCloud = cloud * mix(0.4, 1.6, lighting) + lighting * 0.3;
  
  vec3 colorDark   = vec3(0.00, 0.12, 0.45);  
  vec3 colorMid    = vec3(0.00, 0.40, 1.00);  
  vec3 colorLight  = vec3(0.40, 0.80, 1.00);  
  vec3 colorWhite  = vec3(1.00, 1.00, 1.00);  

  vec3 color = mix(colorDark, colorMid, smoothstep(0.0, 0.4, adjustedCloud));
  color = mix(color, colorLight, smoothstep(0.4, 0.7, adjustedCloud));
  color = mix(color, colorWhite, smoothstep(0.8, 1.0, adjustedCloud));

  // Additional subtle darkening on the edges that are facing away from camera
  float facing = dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0));
  float vignette = smoothstep(-0.2, 0.6, facing);
  color = mix(colorDark * 0.3, color, vignette);
  
  // Outer rim light
  float fresnel = pow(1.0 - max(facing, 0.0), 3.0);
  color += fresnel * colorMid * 0.5 * uEnergy;

  float pulse = 0.5 + 0.5 * sin(uTime * (1.2 + uEnergy * 0.8) + uAudioLevel * 2.2);
  color += pulse * 0.04 * uEnergy;

  // Render as emissive since we manage our own shading for the cloud volume
  csm_DiffuseColor = vec4(0.0, 0.0, 0.0, 1.0);
  csm_Emissive = color;
}
`

export function OrbMesh({ state, intensity }: OrbMeshProps) {
  const smoothedLevel = useRef(0)

  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 6)
    const merged = mergeVertices(geo)
    merged.computeVertexNormals()
    merged.center()
    return merged
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioLevel: { value: 0 },
      uEnergy: { value: 0 },
    }),
    [],
  )

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
    })
  }, [uniforms])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    const target = state === 'active' ? intensity : 0
    smoothedLevel.current += (target - smoothedLevel.current) * 0.1

    const energyTarget = state === 'active' ? 1 : 0
    uniforms.uEnergy.value += (energyTarget - uniforms.uEnergy.value) * 0.05

    uniforms.uTime.value += delta
    uniforms.uAudioLevel.value = smoothedLevel.current
  })

  return <mesh geometry={geometry} material={material} scale={1.15} />
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
  )
}