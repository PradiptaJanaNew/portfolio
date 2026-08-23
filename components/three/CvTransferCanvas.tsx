"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SYS.TRANSFER — the document materialising out of a particle field.
 *
 * ~18k GPU points in ONE draw call. Every particle carries:
 *   position  — a scattered start point in a shell around the page
 *   aTarget   — its resting place inside a document silhouette
 *   aDelay    — a stagger so the page assembles in a cascade, not at once
 *
 * The silhouette is built to actually READ as a CV: a page border, banded
 * "text lines" of varying length with paragraph gaps, and a portrait block
 * in the top-left. All the motion is in the vertex shader, so the CPU cost
 * per frame is a single uniform write.
 */

const COUNT = 18000;
const PAGE_W = 3.05;
const PAGE_H = 4.31; // ~1:1.414, A4

const VERT = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aDelay;
  attribute float aSize;
  uniform float uProgress;
  uniform float uTime;
  varying float vLock;

  void main() {
    float t = clamp((uProgress - aDelay) / max(1.0 - aDelay, 0.0001), 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 3.0);           // ease-out cubic

    vec3 pos = mix(position, aTarget, e);

    // Residual turbulence that dies off as the particle locks into place.
    float turb = 1.0 - e;
    pos.x += sin(uTime * 1.7 + aDelay * 31.0) * 0.22 * turb;
    pos.y += cos(uTime * 1.4 + aDelay * 23.0) * 0.22 * turb;
    pos.z += sin(uTime * 2.1 + aDelay * 17.0) * 0.30 * turb;

    vLock = e;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (95.0 / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform float uFade;
  varying float vLock;

  void main() {
    // soft round sprite
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.1, r);

    vec3 col = mix(uFrom, uTo, vLock);
    // Additive blending stacks 18k sprites, so per-particle alpha has to stay
    // LOW or the page reads as a solid white slab instead of a particle field.
    gl_FragColor = vec4(col, a * mix(0.07, 0.34, vLock) * uFade);
  }
`;

function buildAttributes() {
  const start = new Float32Array(COUNT * 3);
  const target = new Float32Array(COUNT * 3);
  const delay = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);

  const halfW = PAGE_W / 2;
  const halfH = PAGE_H / 2;

  // Text-line bands: [yTop, lineWidthFraction]. Gaps between groups read
  // as paragraph breaks; short lines read as paragraph ends.
  const lines: Array<{ y: number; w: number; indent: number }> = [];
  let y = halfH - 1.42; // below the header block
  const push = (w: number, indent = 0) => {
    lines.push({ y, w, indent });
    y -= 0.108;
  };
  for (let block = 0; block < 5; block++) {
    const rows = 3 + ((block * 2) % 3);
    for (let r = 0; r < rows; r++) push(r === rows - 1 ? 0.42 + (block % 3) * 0.16 : 0.9);
    y -= 0.11; // paragraph gap
  }

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;

    // ── start: a scattered shell around the page ──────────────────────
    const theta = Math.random() * Math.PI * 2;
    const radius = 3.2 + Math.random() * 4.4;
    start[i3] = Math.cos(theta) * radius;
    start[i3 + 1] = (Math.random() - 0.5) * 9.5;
    start[i3 + 2] = (Math.random() - 0.5) * 7 - 1.5;

    // ── target: somewhere on the document ─────────────────────────────
    const roll = Math.random();
    let tx: number;
    let ty: number;

    if (roll < 0.16) {
      // page border
      const edge = Math.floor(Math.random() * 4);
      const u = Math.random();
      if (edge === 0) { tx = -halfW + u * PAGE_W; ty = halfH; }
      else if (edge === 1) { tx = -halfW + u * PAGE_W; ty = -halfH; }
      else if (edge === 2) { tx = -halfW; ty = -halfH + u * PAGE_H; }
      else { tx = halfW; ty = -halfH + u * PAGE_H; }
      tx += (Math.random() - 0.5) * 0.018;
      ty += (Math.random() - 0.5) * 0.018;
    } else if (roll < 0.29) {
      // portrait block, top-left
      tx = -halfW + 0.24 + Math.random() * 0.62;
      ty = halfH - 0.26 - Math.random() * 0.78;
    } else if (roll < 0.38) {
      // name / title rules, top-right of the portrait block
      const row = Math.floor(Math.random() * 3);
      tx = -halfW + 1.02 + Math.random() * (row === 0 ? 1.55 : row === 1 ? 1.15 : 0.8);
      ty = halfH - 0.36 - row * 0.2;
    } else {
      // body text lines
      const ln = lines[Math.floor(Math.random() * lines.length)];
      tx = -halfW + 0.24 + ln.indent + Math.random() * (PAGE_W - 0.48) * ln.w;
      ty = ln.y + (Math.random() - 0.5) * 0.035;
    }

    target[i3] = tx;
    target[i3 + 1] = ty;
    target[i3 + 2] = (Math.random() - 0.5) * 0.05;

    // Cascade top→bottom so the page "prints" downward.
    const norm = (halfH - ty) / PAGE_H;
    delay[i] = Math.min(0.72, Math.max(0, norm * 0.55 + Math.random() * 0.2));
    size[i] = 1.1 + Math.random() * 1.7;
  }

  return { start, target, delay, size };
}

function Field({
  progressRef,
  fadeRef,
  accent,
}: {
  progressRef: MutableRefObject<number>;
  fadeRef: MutableRefObject<number>;
  accent: string;
}) {
  const attrs = useMemo(buildAttributes, []);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Points>(null);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uFrom: { value: new THREE.Color("#00d4ff") },
      uTo: { value: new THREE.Color(accent) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uProgress.value = progressRef.current;
    uniforms.uFade.value = fadeRef.current;
    if (groupRef.current) {
      // A slow settle rotation: the page turns to face the viewer as it locks.
      const p = progressRef.current;
      groupRef.current.rotation.y = (1 - p) * 0.55;
      groupRef.current.rotation.x = (1 - p) * -0.22;
    }
  });

  return (
    <points ref={groupRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attrs.start, 3]} />
        <bufferAttribute attach="attributes-aTarget" args={[attrs.target, 3]} />
        <bufferAttribute attach="attributes-aDelay" args={[attrs.delay, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attrs.size, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function CvTransferCanvas({
  progressRef,
  fadeRef,
  accent = "#ff8a3c",
}: {
  progressRef: MutableRefObject<number>;
  fadeRef: MutableRefObject<number>;
  accent?: string;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10.6], fov: 46 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: "default", stencil: false, depth: false }}
      style={{ pointerEvents: "none" }}
    >
      <Field progressRef={progressRef} fadeRef={fadeRef} accent={accent} />
    </Canvas>
  );
}

export default CvTransferCanvas;
