"use client";

import { Suspense, type MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { ShellScene } from "./ShellScene";

/**
 * The SYS.SHELL band's own transparent canvas.
 *
 * Mirrors PortraitCanvas: the Canvas lives in its own file so editing the
 * shader hot-reloads inside the live canvas instead of recreating it, and
 * `frameloop:'never'` parks the GPU whenever the band is off-screen — the
 * ambient scene canvas is always running, so every secondary canvas has to
 * yield when it isn't visible.
 */
export function ShellCanvas({
  active,
  progressRef,
}: {
  active: boolean;
  progressRef: MutableRefObject<number>;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      orthographic
      camera={{ position: [0, 0, 5], zoom: 1 }}
      // A soft floor-and-rain backdrop has no fine detail to lose, and this
      // is a FULL-VIEWPORT surface — at 1.5 it was rendering 2160x1315, more
      // fragments per frame than the ambient scene itself. 1.25 is the
      // compromise: on a 2x display the compositor still upscales, so the
      // shader keeps every edge soft (see ShellScene) rather than relying on
      // resolution to hide blockiness.
      dpr={[1, 1.25]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "default",
        stencil: false,
        depth: false,
      }}
      performance={{ min: 0.5 }}
      style={{ pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <ShellScene progressRef={progressRef} />
      </Suspense>
    </Canvas>
  );
}

export default ShellCanvas;
