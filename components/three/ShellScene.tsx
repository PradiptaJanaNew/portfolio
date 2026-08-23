"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SYS.SHELL backdrop — one full-canvas fragment shader standing in for the
 * machine the console is talking to.
 *
 * Three things are layered into a single pass so the whole band costs one
 * textured quad per frame (it shares the GPU with the ambient scene canvas
 * and must stay nearly free):
 *
 *   1. A perspective HEX/CIRCUIT FLOOR receding to a horizon, its cells
 *      lighting up in a travelling wave. This is the "surface" the
 *      terminal sits on.
 *   2. DATA RAIN — columns of falling glyph-ish dashes, density and speed
 *      driven by the section's own scroll progress, so scrolling literally
 *      spins the machine up.
 *   3. A boot BLOOM that rises from the horizon as `uProgress` climbs,
 *      tinted with the console's cyan.
 *
 * Everything fades to fully transparent at the edges so the band melts into
 * the page's starfield rather than sitting on it as a plate.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uProgress;   // 0..1 section scroll
  uniform float uVelocity;   // damped |scroll velocity|
  uniform float uAspect;
  uniform vec3  uAccent;     // cyan
  uniform vec3  uWarm;       // amber
  uniform float uOpacity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  /**
   * One antialiased grid line per axis, at a CONSTANT screen-space width.
   * fwidth() gives the per-pixel rate of change of the plane coordinate, so
   * dividing by it keeps far-away cells a hairline instead of collapsing
   * into a solid slab (which is exactly what a fixed smoothstep does once
   * the perspective divide compresses hundreds of cells into one pixel).
   */
  float gridLine(float coord, float width) {
    float d = abs(fract(coord) - 0.5);
    float w = fwidth(coord) * width;
    float line = 1.0 - smoothstep(0.5 - w, 0.5, d);
    // Once cells compress past a pixel the "line" would smear into a solid
    // slab. Fade it out instead, the way a real perspective grid dissolves
    // toward its horizon.
    return line * (1.0 - smoothstep(0.16, 0.42, w));
  }

  void main() {
    vec2 uv = vUv;
    vec3 col = vec3(0.0);
    float alpha = 0.0;

    // ── 1. hairline floor receding to a horizon ──────────────────────
    float horizon = 0.46;
    if (uv.y < horizon) {
      float depth = horizon - uv.y;
      float z = 0.09 / max(depth, 0.006);
      float travel = uTime * (0.5 + uVelocity * 2.2);
      vec2 plane = vec2((uv.x - 0.5) * uAspect * z * 1.6, z + travel);

      // Slightly wider than a hairline: the canvas is upscaled from a low
      // dpr, so a 1-device-pixel line lands on screen as a hard 2px stair.
      float gx = gridLine(plane.x, 2.6);
      float gy = gridLine(plane.y, 2.6);
      float grid = max(gx, gy * 0.85);

      // a pulse of light sweeping away down the floor
      float pulse = smoothstep(0.86, 1.0, sin(plane.y * 0.5 - uTime * 0.9) * 0.5 + 0.5);

      // near-field and far-field fades keep the floor a band, not a slab
      float fade = smoothstep(0.0, 0.11, depth) * smoothstep(0.46, 0.09, depth);
      float floorA = grid * fade * (0.22 + pulse * 0.40);

      col += mix(uAccent, uWarm, pulse * 0.30) * floorA * 1.5;
      alpha += floorA;
    }

    // ── 2. data rain ─────────────────────────────────────────────────
    //
    // EVERY EDGE HERE IS SOFT, deliberately. This canvas runs at dpr 1 (a
    // full-viewport backdrop is not worth retina fill rate) and is then
    // upscaled by the compositor, so anything with a hard edge arrives on
    // screen as visible blocks. The first version drew each column as a
    // rectangle exactly 1/96 of the viewport wide with no horizontal
    // falloff at all — at 1680px that is a 17px hard-edged slab, which read
    // as pixel mush. Wide smoothsteps cost nothing and upscale invisibly.
    float cols = 120.0;
    float colX = uv.x * cols;
    float cx = floor(colX);
    // Soft vertical band per stream, instead of a hard-edged column.
    float colProfile = smoothstep(0.5, 0.22, abs(fract(colX) - 0.5));
    float colSeed = hash(vec2(cx, 3.7));
    float speed = 0.18 + colSeed * 0.42 + uVelocity * 0.7;
    // Fewer, longer cells (30 → 16) so each streak is a gradient rather
    // than a short block.
    float y = fract(uv.y * 16.0 + uTime * speed + colSeed * 40.0);
    // A comet: a soft tail ramping up to a brighter head, then nothing.
    // Keeping the lit part to roughly half the cell stops every column
    // reading as one continuous bar of light.
    float d = y - 0.55;
    float dash = smoothstep(-0.45, -0.02, d) * smoothstep(0.05, 0.0, d);
    float head = smoothstep(-0.08, 0.0, d) * smoothstep(0.05, 0.0, d);
    // NOTE: 'active' is a reserved word in GLSL ES — do not rename back.
    float streamOn = step(0.55, colSeed) * mix(0.25, 1.0, uProgress);
    // Rain lives in the SIDE gutters. The console owns the middle third of
    // the band, and rain behind it only fought the type.
    float gutter = smoothstep(0.30, 0.13, uv.x) + smoothstep(0.70, 0.87, uv.x);
    float rainFade = clamp(gutter, 0.0, 1.0)
                   * smoothstep(1.0, 0.55, uv.y)
                   * smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
    float rainA = (dash * 0.045 + head * 0.17) * streamOn * colProfile * rainFade;
    col += uAccent * rainA * 1.4;
    alpha += rainA;

    // ── 3. boot bloom off the horizon ────────────────────────────────
    float glow = smoothstep(0.30, 0.0, abs(uv.y - horizon))
               * smoothstep(0.0, 0.5, uProgress);
    col += mix(uAccent, uWarm, 0.16) * glow * 0.11;
    alpha += glow * 0.085;

    // ── 4. edge melt so the band never reads as a plate ──────────────
    float vign = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x)
               * smoothstep(0.0, 0.06, uv.y) * smoothstep(1.0, 0.94, uv.y);
    alpha *= vign * uOpacity;

    // grain keeps the flat gradients from banding on 8-bit displays
    col += (hash(uv * 900.0 + uTime) - 0.5) * 0.015;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

export function ShellScene({
  progressRef,
  accent = "#00d4ff",
  warm = "#ff8a3c",
}: {
  progressRef: MutableRefObject<number>;
  accent?: string;
  warm?: string;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  // Damped copies so a flung scroll accelerates the rain smoothly instead
  // of snapping. Kept in a ref — never React state — so no frame re-renders.
  const damped = useRef({ progress: 0, velocity: 0, lastProgress: 0 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uVelocity: { value: 0 },
      uAspect: { value: 1 },
      uAccent: { value: new THREE.Color(accent) },
      uWarm: { value: new THREE.Color(warm) },
      uOpacity: { value: 1 },
    }),
    [accent, warm]
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const d = Math.min(delta, 0.05);
    const s = damped.current;

    const target = progressRef.current;
    // instantaneous progress delta → velocity, then exponential decay
    const dp = Math.abs(target - s.lastProgress) / Math.max(d, 0.001);
    s.lastProgress = target;
    s.velocity += (Math.min(dp * 0.35, 1.2) - s.velocity) * Math.min(d * 5, 1);
    s.progress += (target - s.progress) * Math.min(d * 4, 1);

    mat.uniforms.uTime.value += d;
    mat.uniforms.uProgress.value = s.progress;
    mat.uniforms.uVelocity.value = s.velocity;
    mat.uniforms.uAspect.value = size.width / Math.max(size.height, 1);
  });

  return (
    <mesh frustumCulled={false}>
      {/* R3F's orthographic frustum is measured in PIXELS, so the plane has
          to be built at viewport size — a unit quad would render two pixels
          wide in the middle of the canvas. */}
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default ShellScene;
