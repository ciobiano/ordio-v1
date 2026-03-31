'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'

interface OrbMeshProps {
  state: 'dormant' | 'active' | 'resting'
  intensity: number
}

// Shared simplex noise macro — inlined into both shaders so each stage
// can independently sample the cloud field at different scales/offsets.
const SNOISE_GLSL = /* glsl */ `
vec3 mod289_3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289_4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute4(vec4 x){return mod289_4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt4(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289_3(i);
  vec4 p=permute4(permute4(permute4(
    i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))
    +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt4(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`

// Domain-warped vertex displacement: f(p + f(p)) — Inigo Quilez.
// Passes object-space position to fragment so the cloud texture
// is anchored to surface geometry, not screen space.
const VERTEX_SHADER = SNOISE_GLSL + /* glsl */ `
uniform float uTime;
uniform float uAudioLevel;
varying vec3 vObjPos;
varying vec3 vWorldNormal;

void main() {
  vObjPos      = position;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

  // Domain warp: displace the noise sampling coordinates before final sample
  vec3 warp = vec3(
    snoise(position * 1.1 + uTime * 0.18),
    snoise(position * 1.1 + uTime * 0.18 + vec3(3.7, 1.2, 5.1)),
    snoise(position * 1.1 + uTime * 0.18 + vec3(8.3, 4.5, 2.8))
  );

  float n = snoise((position + warp * 0.42) * 1.5 + uTime * 0.14);

  // dormant: subtle organic breathe — active voice: dramatic cloud bulge
  float magnitude = 0.06 + uAudioLevel * 0.20;

  csm_Position = position + normal * n * magnitude;
}
`

// Fragment cloud texture — domain-warped noise for coherent weather systems.
// The trick: warp the sampling coordinates first (like the vertex shader does),
// then sample the final cloud value at the warped position. This makes cloud
// masses large and connected rather than scattered speckles.
const FRAGMENT_SHADER = SNOISE_GLSL + /* glsl */ `
uniform float uTime;
varying vec3 vObjPos;
varying vec3 vWorldNormal;

void main() {
  // Domain warp at large scale — creates the sweeping continental cloud systems
  vec3 warp = vec3(
    snoise(vObjPos * 0.7 + uTime * 0.05),
    snoise(vObjPos * 0.7 + uTime * 0.05 + vec3(5.2, 1.3, 2.8)),
    snoise(vObjPos * 0.7 + uTime * 0.05 + vec3(3.1, 7.4, 4.6))
  );

  // Single cloud signal at warped position — large, coherent masses
  float cloud = snoise((vObjPos + warp * 0.55) * 0.9 + uTime * 0.04) * 0.5 + 0.5;

  // Broad smoothstep — soft cloud edges, no sharp blobs
  cloud = smoothstep(0.28, 0.78, cloud);

  // Deep ocean → bright ocean → cloud white
  vec3 deep  = vec3(0.06, 0.16, 0.62);
  vec3 mid   = vec3(0.22, 0.55, 0.95);
  vec3 white = vec3(0.90, 0.96, 1.00);

  vec3 color = mix(deep,  mid,   smoothstep(0.0, 0.48, cloud));
       color = mix(color, white, smoothstep(0.40, 1.00, cloud));

  // Spherical limb darkening — edges go deep blue so it reads as a globe, not a disc
  float facing = dot(normalize(vWorldNormal), vec3(0.0, 0.0, 1.0));
  float vignette = smoothstep(-0.1, 0.60, facing);
  color = mix(color * 0.22, color, vignette);

  csm_DiffuseColor = vec4(color, 1.0);
}
`

export function OrbMesh({ state, intensity }: OrbMeshProps) {
  const smoothedLevel = useRef(0)

  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 8)
    return mergeVertices(geo)
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime:      { value: 0 },
      uAudioLevel: { value: 0 },
    }),
    [],
  )

  const material = useMemo(
    () =>
      new CustomShaderMaterial({
        baseMaterial:   THREE.MeshPhysicalMaterial,
        vertexShader:   VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms,
        metalness:       0.0,
        roughness:       1.0,   // fully diffuse — PBR doesn't fight the fragment colour
        iridescence:     0.0,
        color:           new THREE.Color(0xffffff),
        envMapIntensity: 0.0,
        silent:          true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((_, delta) => {
    const target = state === 'active' ? intensity : 0
    smoothedLevel.current += (target - smoothedLevel.current) * 0.12

    uniforms.uTime.value      += delta
    uniforms.uAudioLevel.value = smoothedLevel.current
  })

  return <mesh geometry={geometry} material={material} />
}
