"use client";

import { useEffect, useRef } from "react";
import { cursor } from "@/lib/useCursor";
import { useTheme } from "@/lib/useTheme";
import { onFrame } from "@/lib/frameLoop";

/**
 * ParallaxBackdrop — a Firewatch-style layered depth backdrop that sits
 * BEHIND the 3D canvas (the Canvas is transparent, so the character
 * composites over these ridges). Stacked silhouette ridgelines in the
 * site palette drift at different rates on scroll + cursor, giving the
 * scene real depth without any extra WebGL cost.
 *
 * Transform-only (compositor-cheap), paused when the tab is hidden, and
 * fully static under `prefers-reduced-motion`.
 */

type Layer = {
  /** vertical drift per px of scroll */
  sy: number;
  /** horizontal drift per unit of normalized cursor x */
  cx: number;
};

const LAYERS: Layer[] = [
  { sy: 0.015, cx: 6 }, // far glow
  { sy: 0.03, cx: 12 }, // back ridge
  { sy: 0.05, cx: 20 }, // mid ridge
  { sy: 0.08, cx: 32 }, // front ridge
];

export function ParallaxBackdrop() {
  const { theme } = useTheme();
  const day = theme === "day";
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Shared ticker (lib/frameLoop.ts): one rAF, one scrollY read per frame
    // for the whole page. This used to own a second loop whose scrollY read
    // landed between the hero loop's transform writes.
    let lastY = Number.NaN;
    return onFrame(({ scrollY }) => {
      if (scrollY === lastY) return; // nothing moved — skip the writes
      lastY = scrollY;
      for (let i = 0; i < LAYERS.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const l = LAYERS[i];
        el.style.transform = `translate3d(${(cursor.x * l.cx).toFixed(2)}px, ${(-scrollY * l.sy).toFixed(2)}px, 0)`;
      }
    });
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* UNIFIED BACKGROUND. The whole site is ONE colour — the page's own
          var(--bg) (deep navy at night, warm gold by day). We removed the
          banded sky washes + the ridge "layers" entirely (they were what read
          as 3–4 stacked bands below the hero and as the light gradient in day).
          All that's left is a single very soft, slowly-drifting glow for depth;
          the CelestialSky carries the moon/stars/sun over the same flat field,
          so the hero → sections transition is perfectly seamless. */}
      <div
        ref={(n) => { refs.current[0] = n; }}
        className="absolute left-1/2 top-[12%] h-[54vmin] w-[54vmin] -translate-x-1/2 rounded-full will-change-transform"
        style={{
          background: day
            ? "radial-gradient(circle, rgba(255,205,135,0.16), rgba(255,170,90,0.05) 48%, transparent 70%)"
            : "radial-gradient(circle, rgba(120,92,255,0.08), rgba(0,212,255,0.03) 48%, transparent 70%)",
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}

export default ParallaxBackdrop;
