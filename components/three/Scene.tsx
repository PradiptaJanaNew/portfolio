"use client";

import { Suspense } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useDeviceCapabilities } from "@/lib/usePerfTier";
import { CameraController } from "./CameraController";
import { Lights } from "./Lights";
import { ParticleField } from "./ParticleField";
import { TravelerModel } from "./TravelerModel";

/**
 * Ambient global scene: a camera rig, a light pair and a drifting
 * particle field. The 3D "hero" objects now live per-section (the
 * orbiting-cards hero, the Universe-in-Numbers orb, etc.) — this global
 * layer is just star-dust depth behind the content. The camera still
 * drifts per section so the dust parallaxes as you scroll.
 *
 * A single, gentle Bloom pass is added ONLY on confirmed-high desktops.
 */
export function Scene({ perfLow = false }: { perfLow?: boolean }) {
  const { tier, gpuTier, isLowEnd, isWindows } = useDeviceCapabilities();
  // POST IS OFF.
  //
  // An EffectComposer renders the scene into an FBO, runs the bright-pass and
  // the mip blur chain, then composites — every frame, forever, behind every
  // section. Profiling showed this canvas alone was costing the page half its
  // frame budget while sitting completely still, and the composer is the most
  // expensive thing in it by a wide margin.
  //
  // What it bought was a soft rim glow on a backdrop that is deliberately out
  // of focus. The lights in <Lights/> already give the robot its cool/violet
  // rim; the difference is not worth a permanent full-screen pass.
  //
  // The gating below is kept (unused) so re-enabling stays a one-line change
  // if this ever moves to a WebGPU pipeline where post is close to free.
  const canAffordPost =
    !perfLow && !isLowEnd && tier === "high" && gpuTier === "high" && !isWindows;
  const enablePost = false && canAffordPost;

  return (
    <Suspense fallback={null}>
      <CameraController />
      <Lights />
      <ParticleField />
      {/* The ONE robot travels through the lower sections here (scroll-driven
          via samplePose), then hands off from the hero's own [HeroRobot] (which
          dives away at the hero's end). HeroRobot CLONES the GLB, so the two
          instances never fight over the shared scene. */}
      <TravelerModel />
      {enablePost && (
        // PERF: an EffectComposer adds a per-frame FBO scene-render plus
        // mip blur passes + a composite, every frame the canvas runs.
        // `mipmapBlur` is already the cheap path; we trim the rest so only
        // the brightest core/rim texels bloom:
        //   - luminanceThreshold 0.85 → 0.90: fewer texels enter the bloom
        //     buffer, so the bright-pass + blur touch a smaller masked area.
        //   - intensity 0.32 → 0.28 and radius 0.45 → 0.40: a tighter,
        //     shorter blur kernel = fewer mip taps per frame.
        //   - resolutionScale 0.5: the bloom FBO/blur runs at half the
        //     canvas resolution (the glow is low-frequency, so a half-res
        //     bloom is visually indistinguishable but ~4× cheaper to blur).
        // Net: the rim still glows; the per-frame post cost drops sharply.
        <EffectComposer
          enableNormalPass={false}
          resolutionScale={0.5}
          multisampling={0}
        >
          <Bloom
            mipmapBlur
            intensity={0.28}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.12}
            radius={0.4}
          />
        </EffectComposer>
      )}
    </Suspense>
  );
}

export default Scene;
