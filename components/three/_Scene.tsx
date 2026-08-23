"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Scene as DeveloperCoreScene } from "./Scene";
import { useDeviceCapabilities } from "@/lib/usePerfTier";
import { onFrame } from "@/lib/frameLoop";

/**
 * Drives the ambient canvas on DEMAND at a capped frame rate.
 *
 * Measured on a 4x-throttled CPU: with this canvas rendering every frame the
 * page cost ~33ms per frame while sitting completely STILL at the top — the
 * budget was gone before any scrolling started, and pausing this one canvas
 * halved it. But the scene is a soft backdrop of drifting dust and a small
 * robot, every property of which is damped; it does not need to redraw as
 * often as the DOM around it does.
 *
 * So the Canvas runs `frameloop="demand"` and this gate calls `invalidate()`
 * on every Nth page frame instead. Every `useFrame` in the scene — including
 * drei's animation mixer — receives a correspondingly larger delta, so motion
 * runs at the same SPEED, just with fewer samples.
 *
 * It counts FRAMES rather than chasing a target fps, and that distinction
 * matters: a wall-clock target of 30fps does nothing once the page is already
 * running at 30fps, which is exactly the situation the gate exists to fix. A
 * fixed 1-in-N skip always sheds work, so the page climbs back toward 60 and
 * the scene settles at 60/N.
 *
 * The gate rides the shared page ticker, which stops itself when the tab is
 * hidden, so a backgrounded tab renders nothing at all.
 */
function DemandDriver({ skip, paused }: { skip: number; paused: boolean }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (paused) return;
    let n = 0;
    return onFrame(() => {
      if (n++ % skip !== 0) return;
      invalidate();
    });
  }, [skip, paused, invalidate]);

  return null;
}

/**
 * The R3F <Canvas/> wrapper. We keep the Canvas-level props here
 * (DPR, gl options, perf hints) and defer the actual scene graph
 * to `./Scene`. This file is dynamic-imported (ssr:false) from
 * SceneContainer, keeping three.js out of the server bundle.
 *
 * Performance knobs applied here:
 *   - `frameloop` is driven by Page Visibility + document focus —
 *     when the tab is hidden (or the window is backgrounded) we flip
 *     the Canvas to `never` so no frames are rendered. On resume we
 *     flip back to `always`. This is the single biggest win for
 *     battery / fps on low-spec laptops, because the scene still
 *     had ~24 active useFrame loops even when invisible.
 *   - DPR cap drops from 1.75 → 1.5 on the `low` tier — fewer
 *     fragments shaded per frame.
 *   - performance.min is lowered so R3F adaptively scales down
 *     faster if fps drops.
 */
export function Scene() {
  const [eventSource, setEventSource] = useState<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  const { tier, gpuTier, isWindows, isLowEnd, webglBudget } = useDeviceCapabilities();
  const hiddenRef = useRef(false);

  const pausedRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setEventSource(document.documentElement);

    // Pause the ambient scene when the page is hidden OR a heavy
    // in-section canvas (the 3D showcase) is on screen — running two
    // WebGL canvases at once is the main source of jank, so we yield the
    // GPU to whichever is in focus.
    const apply = () => {
      setPaused(document.hidden || pausedRef.current);
    };
    const onVis = () => {
      if (document.hidden === hiddenRef.current) return;
      hiddenRef.current = document.hidden;
      apply();
    };
    const onBg = (e: Event) => {
      pausedRef.current = !!(e as CustomEvent<boolean>).detail;
      apply();
    };
    // Race-proof init: the hero may have dispatched bg-pause BEFORE this
    // listener attached (it's the first section, in view at load). It also
    // mirrors the state onto window.__bgPause, so read that now.
    pausedRef.current = !!(window as unknown as { __bgPause?: boolean }).__bgPause;
    apply();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("portfolio:bg-pause", onBg as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("portfolio:bg-pause", onBg as EventListener);
    };
  }, []);

  const isLow = tier === "low" || isLowEnd;
  // Render one page frame in two (→ 30fps on a healthy 60fps page), one in
  // three on a phone, one in four on weak hardware. Everything in the scene is
  // damped, so a lower sample rate reads as slightly softer motion rather than
  // as stutter — and it hands the DOM back most of what this canvas was
  // taking, which matters far more on a phone than the extra samples do.
  const ambientSkip = isLow ? 4 : webglBudget === "reduced" ? 3 : 2;

  // Cross-browser audit (Phase 3): "high-performance" silently
  // downgrades Firefox + Windows + several iOS Safari builds to
  // software rendering on integrated GPUs, then crashes the context
  // when shadow / postprocessing pipelines exceed the SwiftShader /
  // llvmpipe budget. Always use "default" — the browser picks the
  // discrete GPU when it's available anyway, and we avoid the bad
  // path everywhere else. The previous gating on (gpuTier high &&
  // !isWindows) was still hitting Firefox on macOS dual-GPU laptops.
  void gpuTier;
  void isWindows;
  const powerPreference: WebGLPowerPreference = "default";

  return (
    <Canvas
      // DEMAND, not "always": DemandDriver below decides when to render.
      frameloop="demand"
      // PERF (fill rate scales with dpr²): the ambient canvas is a SOFT,
      // out-of-focus backdrop — drifting dust and a robot behind the content
      // — so crispness is imperceptible and dpr is capped well below the
      // rest of the UI. Now pinned at 1.0: pausing this one canvas halved
      // frame times on a throttled CPU, making it the largest single scroll
      // cost on the page, and 1.25 → 1.0 sheds ~36% of the fragments it
      // shades across the particles, the robot and every Bloom FBO pass.
      dpr={[1, 1]}
      camera={{ position: [0, 0, 8], fov: 45 }}
      gl={{
        // NO MSAA. Multisampling costs the whole canvas — every fragment,
        // every frame — while the scene it is smoothing is a handful of
        // point sprites and one small robot. Measured against a 4x-throttled
        // CPU this canvas was the single largest cost on the page even while
        // nothing moved; dropping MSAA is the cheapest way to cut it without
        // touching what the scene actually draws. Slight edge aliasing on the
        // robot is invisible on a deliberately out-of-focus backdrop.
        antialias: false,
        alpha: true,
        powerPreference,
        stencil: false,
        depth: true,
        // Don't refuse to create the context if the browser flags a
        // major perf caveat (software / SwiftShader). We'd rather
        // render slowly via the SVG fallback path's WebGLErrorBoundary
        // catching a real crash than have the canvas silently throw
        // before our boundary even mounts.
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        if (process.env.NODE_ENV !== "production") {
          try {
            const ctx = gl.getContext();
            const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
            if (dbg) {
              // UNMASKED_RENDERER_WEBGL = 0x9246
              const renderer = ctx.getParameter(
                (dbg as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL
              ) as string | undefined;
              if (
                typeof renderer === "string" &&
                /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer)
              ) {
                // eslint-disable-next-line no-console
                console.warn(
                  "[Scene] Software WebGL renderer detected:",
                  renderer
                );
              }
            }
          } catch {
            /* extension probe is best-effort */
          }
        }
      }}
      performance={{ min: 0.35 }}
      eventSource={eventSource ?? undefined}
      eventPrefix="client"
    >
      <DemandDriver skip={ambientSkip} paused={paused} />
      <DeveloperCoreScene perfLow={isLow} />
    </Canvas>
  );
}

export default Scene;
