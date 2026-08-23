"use client";

import { Suspense, useEffect, useState, type MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { PortraitScene } from "./PortraitScene";

const PORTRAIT_SRC = "/images/pradipta-cut.webp";

/**
 * The portrait's own transparent R3F canvas — kept in its own file (the
 * Canvas, not the scene) so editing the shader hot-reloads inside the live
 * canvas rather than recreating it, which would blank it to black.
 *
 *   active=false → frameloop:'never', so the GPU is idle whenever the
 *                  section is off-screen (the ambient scene canvas is
 *                  always running, so this one must yield).
 *   alpha:true   → composites over the starfield; no opaque plate.
 */
export function PortraitCanvas({
  active,
  progressRef,
  accent,
}: {
  active: boolean;
  progressRef: MutableRefObject<number>;
  accent: string;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      PORTRAIT_SRC,
      (t) => {
        if (disposed) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        // The cutout has hard transparent margins; clamping stops the
        // halftone's neighbour taps from wrapping colour across the edge.
        t.wrapS = THREE.ClampToEdgeWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        setTexture(t);
      },
      undefined,
      () => {
        /* Leave `texture` null — PortraitSection keeps its <img> fallback. */
      }
    );
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      orthographic
      camera={{ position: [0, 0, 5], zoom: 1 }}
      // PERF: one textured quad — a modest DPR cap and no MSAA keep the
      // second canvas nearly free next to the ambient scene.
      dpr={[1, 1.25]}
      gl={{ antialias: false, alpha: true, powerPreference: "default", stencil: false, depth: false }}
      performance={{ min: 0.5 }}
      style={{ pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <PortraitScene texture={texture} progressRef={progressRef} accent={accent} />
      </Suspense>
    </Canvas>
  );
}

export default PortraitCanvas;
