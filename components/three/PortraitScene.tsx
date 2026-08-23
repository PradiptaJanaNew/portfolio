"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SYS.OPERATOR — the portrait, resolved in WebGL.
 *
 * A single full-canvas plane running one fragment shader. There is no
 * geometry detail and no lighting pass, so the whole thing costs one
 * textured quad per frame — deliberately cheap, because it shares the GPU
 * with the ambient scene canvas.
 *
 * What the shader does, in order:
 *   1. object-fit: contain — maps canvas UV → image UV so the portrait
 *      never distorts at any viewport aspect (letterboxed area discards).
 *   2. A cursor "lens" that pulls the image very slightly toward the
 *      pointer, giving the plate a sense of depth without a camera move.
 *   3. A SCAN FRONT driven by scroll progress. Above the front the image
 *      is still "unresolved" and renders as an accent-tinted dot matrix
 *      (halftone sized by luminance); below it the real photograph is
 *      resolved. The front itself is a glowing rule.
 *   4. Chromatic aberration that peaks at the scan front, an alpha-derived
 *      rim light, CRT scanlines and film grain.
 *
 * The source texture is a pre-matted cutout (alpha baked at build time —
 * see public/images/pradipta-cut.webp), so the subject floats against the
 * page's starfield with no backing plate.
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

  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uProgress;     // 0..1 scan reveal
  uniform float uCanvasAspect; // canvas w/h
  uniform float uImgAspect;    // image  w/h
  uniform vec2  uMouse;        // -1..1, damped
  uniform vec3  uAccent;
  uniform float uOpacity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // ── 1. object-fit: contain ────────────────────────────────────────
    vec2 uv = vUv;
    if (uCanvasAspect > uImgAspect) {
      uv.x = (uv.x - 0.5) * (uCanvasAspect / uImgAspect) + 0.5;
    } else {
      uv.y = (uv.y - 0.5) * (uImgAspect / uCanvasAspect) + 0.5;
    }
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

    // ── 2. cursor lens ────────────────────────────────────────────────
    vec2 mouseUv = uMouse * 0.5 + 0.5;
    vec2 toMouse = uv - mouseUv;
    uv -= toMouse * smoothstep(0.6, 0.0, length(toMouse)) * 0.014;

    // ── 3. scan front (sweeps head → chest as progress rises) ─────────
    float front = 1.0 - uProgress;
    float resolved = smoothstep(front - 0.02, front + 0.06, uv.y);

    // chromatic aberration, strongest right at the front
    float band = smoothstep(0.16, 0.0, abs(uv.y - front));
    float ca = (0.0016 + band * 0.006);
    vec4 pr = texture2D(uTex, uv + vec2(ca, 0.0));
    vec4 pg = texture2D(uTex, uv);
    vec4 pb = texture2D(uTex, uv - vec2(ca, 0.0));
    vec3 photo = vec3(pr.r, pg.g, pb.b);
    float alpha = pg.a;

    // unresolved: luminance-driven halftone in the accent colour
    float cells = 132.0;
    vec2 grid = vec2(uv.x * uImgAspect, uv.y) * cells;
    vec2 cell = floor(grid);
    vec2 frac = fract(grid) - 0.5;
    vec2 cellUv = (cell + 0.5) / vec2(uImgAspect * cells, cells);
    vec4 cs = texture2D(uTex, cellUv);
    float lum = dot(cs.rgb, vec3(0.299, 0.587, 0.114));
    float radius = mix(0.08, 0.46, lum);
    float dot_ = smoothstep(radius, radius - 0.14, length(frac));
    vec3 matrixCol = uAccent * (0.45 + lum * 0.9);
    float matrixA = cs.a * dot_;

    vec3 col = mix(matrixCol, photo, resolved);
    alpha = mix(matrixA, alpha, resolved);

    // ── 4. rim light from the alpha gradient ──────────────────────────
    float ax = texture2D(uTex, uv + vec2(0.005, 0.0)).a
             - texture2D(uTex, uv - vec2(0.005, 0.0)).a;
    float ay = texture2D(uTex, uv + vec2(0.0, 0.005)).a
             - texture2D(uTex, uv - vec2(0.0, 0.005)).a;
    float edge = clamp(length(vec2(ax, ay)) * 1.7, 0.0, 1.0);
    col += uAccent * edge * 0.5 * resolved;

    // scan-front rule
    float line = smoothstep(0.012, 0.0, abs(uv.y - front))
               * step(0.004, uProgress) * step(uProgress, 0.997);
    col += uAccent * line * 1.7;
    alpha = max(alpha, line * pg.a * 0.85);

    // ── 5. grade + texture ────────────────────────────────────────────
    // Gentle duotone: keep skin readable, push the image toward the
    // section accent so it belongs to the HUD rather than sitting on top.
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, mix(vec3(l) * vec3(0.88, 0.88, 0.96), uAccent * l * 1.2, 0.32), 0.3);

    col *= 0.95 + 0.05 * sin(uv.y * 820.0);                 // CRT scanlines
    col += (hash(uv * 780.0 + fract(uTime * 0.35)) - 0.5) * 0.03; // grain

    gl_FragColor = vec4(col, alpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function PortraitScene({
  texture,
  progressRef,
  accent,
}: {
  texture: THREE.Texture;
  progressRef: MutableRefObject<number>;
  accent: string;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size } = useThree();

  // Damped pointer, so the lens glides instead of snapping.
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const imgAspect = useMemo(() => {
    const img = texture.image as { width?: number; height?: number } | undefined;
    return img?.width && img?.height ? img.width / img.height : 900 / 1352;
  }, [texture]);

  const uniforms = useMemo(
    () => ({
      uTex: { value: texture },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uCanvasAspect: { value: 1 },
      uImgAspect: { value: imgAspect },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAccent: { value: new THREE.Color(accent) },
      uOpacity: { value: 1 },
    }),
    // Built once; every value below is mutated in useFrame / effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    uniforms.uAccent.value.set(accent);
  }, [accent, uniforms]);

  useEffect(() => {
    uniforms.uImgAspect.value = imgAspect;
  }, [imgAspect, uniforms]);

  useFrame((_, dt) => {
    const p = pointer.current;
    // critically-damped-ish follow, frame-rate independent
    const k = 1 - Math.pow(0.001, Math.min(dt, 0.05));
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;

    uniforms.uTime.value += dt;
    uniforms.uMouse.value.set(p.x, p.y);
    uniforms.uCanvasAspect.value = size.width / Math.max(1, size.height);
    // ease the scroll-driven reveal so scrubbing never looks mechanical
    const target = progressRef.current;
    uniforms.uProgress.value += (target - uniforms.uProgress.value) * k * 0.6;
  });

  return (
    <mesh>
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

export default PortraitScene;
