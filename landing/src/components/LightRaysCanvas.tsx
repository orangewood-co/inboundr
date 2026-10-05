import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import type { ShaderMaterial } from "three"

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;

  const int RAY_COUNT = 26;

  const vec3 BASE = vec3(0.024, 0.035, 0.024);
  const vec3 LIME = vec3(0.72, 0.93, 0.34);
  const vec3 GREEN = vec3(0.243, 0.812, 0.557);
  const vec3 AQUA = vec3(0.42, 0.90, 0.86);
  const vec3 BLUE = vec3(0.62, 0.83, 1.00);
  const vec3 GOLD = vec3(0.937, 0.773, 0.329);
  const vec3 CORE = vec3(0.878, 0.968, 0.898);

  // Fan spans this angular slice, measured from the off-screen origin. The
  // window is aimed so the full palette lands on screen rather than below it,
  // and opens wide enough that the shallow rays climb into the top-right.
  const float ANG_MIN = -0.81;
  const float ANG_SPAN = 1.08;

  float hash11(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  // Hue ramps left to right across the viewport: warm lime, through the brand
  // green, into cool aqua and blue. Each ray therefore cools along its length.
  vec3 fanPalette(float t) {
    vec3 c = mix(LIME, GREEN, smoothstep(0.0, 0.38, t));
    c = mix(c, AQUA, smoothstep(0.34, 0.72, t));
    return mix(c, BLUE, smoothstep(0.70, 1.0, t));
  }

  void main() {
    // On portrait viewports the fan is pulled down so it never crosses the copy.
    float narrow = 1.0 - smoothstep(0.6, 1.1, uAspect);

    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec2 origin = vec2(mix(-0.45, -0.70, narrow) * uAspect, mix(0.80, 0.46, narrow));
    vec2 d = p - origin;
    float r = length(d);

    // Rays leave the origin steep and flatten as they travel, so each one bows.
    float ang = atan(d.y, d.x) + 0.26 * (1.0 - exp(-r * 0.85));
    float fanT = (ang - ANG_MIN) / ANG_SPAN;

    float atten = smoothstep(0.15, 0.75, r) * exp(-max(r - 2.1, 0.0) * 0.5);
    // Streaks gather intensity along their length, hottest at the far ends.
    float reach = mix(0.5, 1.1, smoothstep(0.35, 1.9, r));
    // ...and only the cool right-hand ends bleach out to white.
    float hot = smoothstep(0.8, 2.2, r) * smoothstep(0.40, 1.0, vUv.x);

    vec3 tint = mix(fanPalette(clamp(vUv.x * 1.05, 0.0, 1.0)), vec3(1.0), hot * 0.4);

    vec3 col = vec3(0.0);

    for (int i = 0; i < RAY_COUNT; i++) {
      float fi = float(i);
      float s1 = hash11(fi + 1.0);
      float s2 = hash11(fi + 11.3);
      float s3 = hash11(fi + 27.7);

      float pos = (fi + 0.5) / float(RAY_COUNT)
        + (s1 - 0.5) * 0.050
        + 0.010 * sin(uTime * (0.10 + 0.09 * s2) + s1 * 6.283);

      float width = mix(0.0012, 0.009, s2 * s2);
      float q = min(abs(fanT - pos) / width, 16.0);

      float core = exp(-q * q);
      float bloom = exp(-q * q / 8.0) * 0.20;
      float halo = exp(-q * q / 45.0) * 0.06;
      float wash = exp(-q * q / 240.0) * 0.025;

      float bright = mix(0.10, 1.25, s3) * (0.80 + 0.20 * sin(uTime * 0.25 + s2 * 6.283)) * reach;

      col += (core * (CORE * 0.55 + tint * 1.0) + (bloom + halo + wash) * tint * 1.15) * bright;
    }

    col *= atten;

    // Push the hue ramp back after all the overlapping glow washes it out.
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.3);

    // Global exposure: the rays are a backdrop for the product shot, so the
    // cores should land as saturated lines rather than blown-out white.
    col *= 0.55;

    col += GREEN * 0.035 * exp(-length(p - vec2(0.18 * uAspect, -0.05)) * 2.2);
    col += GOLD * 0.018 * exp(-length(p - vec2(0.85 * uAspect, 0.02)) * 2.6);

    // The copy sits top-left and the product shot bottom-right, so the mask
    // runs on a diagonal: the left edge goes dark early, the right edge stays
    // lit almost to the top so the streaks sweep up behind the screenshot.
    // Portrait layouts stack instead, so the mask flattens back to horizontal.
    float slope = mix(0.5, 0.0, narrow);
    float maskStart = mix(0.22, 0.30, narrow);
    float maskEnd = mix(0.58, 0.72, narrow);
    col *= mix(0.03, 1.0, 1.0 - smoothstep(maskStart, maskEnd, vUv.y - slope * vUv.x));

    // The streaks that climb past the screenshot should read as fine lines,
    // not a second light source. Ray cores sit far above 1.0 before clipping,
    // so the exposure has to drop hard for them to stop bleaching to white.
    col *= mix(1.0, 0.06, smoothstep(0.3, 0.85, vUv.y));

    // Soft scrim under the copy column so the subtitle and CTAs stay legible;
    // it runs tall so the rays only reach full strength below the buttons.
    vec2 scrim = (vUv - vec2(mix(0.25, 0.5, narrow), mix(0.5, 0.62, narrow)))
      / vec2(mix(0.36, 0.80, narrow), mix(0.5, 0.30, narrow));
    col *= 1.0 - 0.88 * exp(-dot(scrim, scrim) * 1.6);

    float dither = (hash11(vUv.x * 371.0 + vUv.y * 913.0) - 0.5) * 0.008;

    gl_FragColor = vec4(BASE + col + dither, 1.0);
  }
`

function Rays({ animate }: { animate: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const invalidate = useThree((state) => state.invalidate)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
    }),
    []
  )

  useEffect(() => {
    if (!material.current) return
    material.current.uniforms.uAspect.value = width / Math.max(height, 1)
    invalidate()
  }, [width, height, invalidate])

  useFrame((state) => {
    if (!animate || !material.current) return
    material.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

interface LightRaysCanvasProps {
  animate: boolean
  paused: boolean
}

export default function LightRaysCanvas({ animate, paused }: LightRaysCanvasProps) {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={!animate ? "demand" : paused ? "never" : "always"}
      gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
      className="!absolute inset-0"
    >
      <Rays animate={animate} />
    </Canvas>
  )
}
