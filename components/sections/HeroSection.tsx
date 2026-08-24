"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { gsap, registerAll, SplitText } from "@/lib/gsap";
import { profile } from "@/content/profile";
import { getSection } from "@/lib/sections";
import { useTheme } from "@/lib/useTheme";
import { buildStarField } from "@/lib/starfield";
import { onFrame } from "@/lib/frameLoop";

// NOTE: the ONE robot now lives in the ambient global scene ([TravelerModel] in
// Scene.tsx) and TRAVELS scroll-driven through all sections. The hero-scoped
// robot canvas was removed so there's a single continuous model (no
// hero-model-fades-then-traveler-appears). HeroRobot*.tsx stay on disk unused.

const HERO = getSection("hero")!;

/** Cells in the scroll-driven SYS.BOOT meter under the identity block. */
const METER_CELLS = 16;

// Floating emoji that orbit the bot on the left cliff (x/y are % of the stage,
// clustered over the robot). `s` size, `d` anim delay, `u` anim duration — all
// bob via the .hero-emoji CSS keyframes; the whole cluster streams down on
// scroll (driven in the rAF loop). DOM (crisp text, zero GPU cost).

const ROLES = [
  "FRONTEND DEVELOPER",
  "FULL-STACK ENGINEER",
  "REACT NATIVE DEVELOPER",
  "CLOUD / DEVOPS ENGINEER",
];

/* ------------------------------------------------------------------ *
 *  HERO INK — one ink set per theme, injected as CSS vars on the
 *  identity block.
 *
 *  The identity sits on PAINTED ARTWORK, not on `--bg`, so the global
 *  tokens don't help here: the pixels behind a given line are whatever
 *  the mountain happens to be. Measured against the real render, the
 *  old single (night-tuned) palette failed everywhere —
 *    night  role  #4f9cff on the blue ridge ........ 2.5:1
 *    day    role  #4f9cff on the orange ridge ...... 1.6:1
 *    day    eyebrow #a9c6ff on the gold sky ........ 1.0:1  (invisible)
 *  — because a cool blue ink lands on a cool blue ridge at night and on
 *  a warm ridge of the SAME luminance in day.
 *
 *  Two fixes together, because either alone is not enough:
 *   1. `scrim*` paints a soft feathered haze under the block (see
 *      `.hero-scrim`) so every line reads against a KNOWN field instead
 *      of whatever the painting puts there. It is a radial, not a box —
 *      it reads as valley haze, and the cliff/hiker/trees stay untouched.
 *   2. Every ink below is then chosen against that scrimmed field and
 *      verified >= 4.5:1 (>= 3:1 for the display wordmark, which is
 *      large text). Day inks go BRIGHTER, not darker — under a scrim the
 *      local field is dark in both themes, so a "light mode = dark ink"
 *      reflex would put it right back at 1.4:1.
 *
 *  `role*` is the three-stop gradient the role line is clipped to. Every
 *  stop is verified on its own: a gradient is only as legible as its
 *  darkest stop, so the ramp stays inside the light end of the hue.
 * ------------------------------------------------------------------ */
type HeroInk = Record<string, string>;

const HERO_INK: Record<"night" | "day", HeroInk> = {
  night: {
    "--hero-eyebrow": "#cfe0ff", //  11.2:1
    "--hero-pip": "#63b0ff",
    "--hero-name-accent": "#ff7a1a", //   5.1:1 (large)
    "--hero-name-light": "#f2f7ff",
    "--hero-label": "rgba(207,224,255,0.74)",
    "--hero-role-a": "#f2f9ff", //  13.1:1
    "--hero-role-b": "#a8dbff",
    "--hero-role-c": "#5fb0ff", //   5.8:1  (darkest stop)
    "--hero-caret": "#8ac8ff",
    "--hero-body": "#e2ecfd",
    "--hero-dim": "rgba(206,222,247,0.88)",
    "--hero-meter": "#7cc0ff",
    "--hero-scrim-top": "rgba(4,8,20,0.30)",
    "--hero-scrim-core": "rgba(4,8,20,0.40)",
    "--hero-scrim-halo": "rgba(4,8,20,0.20)",
    "--hero-shadow":
      "0 1px 2px rgba(0,0,0,0.62), 0 2px 10px rgba(0,0,0,0.45)",
    "--hero-ink-shadow": "0 1px 2px rgba(2,6,16,0.66)",
  },
  day: {
    "--hero-eyebrow": "#ffe6bf", //   5.9:1
    "--hero-pip": "#ffb45c",
    "--hero-name-accent": "#ffa53d", //   3.7:1 (large)
    "--hero-name-light": "#fff6e8",
    "--hero-label": "rgba(255,230,191,0.76)",
    "--hero-role-a": "#fff6e4", //  10.9:1
    "--hero-role-b": "#ffd79a",
    "--hero-role-c": "#ffab52", //   6.5:1  (darkest stop)
    "--hero-caret": "#ffbe72",
    "--hero-body": "#f7e9d4",
    "--hero-dim": "rgba(240,222,196,0.9)",
    "--hero-meter": "#ffc078",
    // Warm-tinted and stronger: the day sky is the brightest surface on
    // the whole site, so a neutral/black haze would read as a grey smudge
    // over golden hour instead of dusk.
    "--hero-scrim-top": "rgba(30,12,2,0.52)",
    "--hero-scrim-core": "rgba(30,12,2,0.52)",
    "--hero-scrim-halo": "rgba(30,12,2,0.28)",
    "--hero-shadow":
      "0 1px 2px rgba(46,18,0,0.72), 0 2px 12px rgba(28,10,0,0.55)",
    "--hero-ink-shadow": "0 1px 2px rgba(40,16,0,0.6)",
  },
};

/* ------------------------------------------------------------------ *
 *  Firewatch parallax — 7 real photographic layers (m7-0 sky/back ..
 *  m7-6 foreground trees/front) + a celestial sky slotted into the
 *  painted sky. Each layer is rendered object-cover and oversized via
 *  the WRAPPER (negative inset, NOT a transform utility) because the
 *  rAF engine below OWNS every layer's inline `transform`.
 *
 *  TRUE Firewatch parallax via CSS STICKY (no GSAP pin): the <section>
 *  is tall (130vh) and the stage is `sticky top-0 h-[100svh]`, so it
 *  stays pinned while the user scrolls through the section. The rAF
 *  loop reads the section's OWN scroll progress and translates each
 *  layer UP by `progress * travel * vh`.
 *
 *  DIRECTION — "drone craning DOWN the mountain, peaks → valley". The
 *  scene SPREADS vertically as you scroll: the far sky + moon lift UP and
 *  out (negative travel) while the near foreground SINKS DOWN (positive),
 *  mid ridges passing through ~zero. The eye is pulled from the departing
 *  peaks down into the opening valley (a top→bottom, looking-DOWN read);
 *  the near foreground sinking keeps the bottom covered (no void), and the
 *  robot rides that same downward motion (HeroRobot). Mouse parallax
 *  (translate X by mouse * depth, near = more) layers on top.
 *
 *  PER-LAYER VERTICAL TRAVEL at progress=1 (NEG = up, POS = down):
 *    far/sky ≈ -0.16  →  near/front ≈ +0.27   (see LAYERS)
 *  data-depth = horizontal mouse factor (far ≈ 4 → near ≈ 44).
 * ------------------------------------------------------------------ */
type Layer = { night: string; day: string; z: number; travel: number; depth: number };

/**
 * Each layer ships as WebP at two widths. The source art is 3200x949 — seven
 * of those as PNG was 2.5MB per theme on the wire and, more importantly,
 * ~12MB of decoded bitmap EACH once rasterised. The 1600w variant covers
 * every 1x display and narrow viewport, which is most visitors, and cuts both
 * the transfer and the raster area by 4x.
 */
function srcSetFor(base: string): string {
  return `${base}-1600.webp${V} 1600w, ${base}.webp${V} 3200w`;
}

// 7 merged layers (recolor/dissolve/wordmark BAKED in), each with NIGHT (cool)
// + DAY (warm) variants that crossfade with the theme.
//
// PARALLAX DIRECTION — "drone craning DOWN the mountain, peaks → valley"
// (the user wants the gaze to sweep TOP→BOTTOM, not bottom→top).
// The trick: the scene SPREADS vertically as you scroll. The far sky + peaks
// lift UP and out of frame (negative travel) while the near foreground SINKS
// DOWN (positive travel); the mid ridges pass through ~zero. So your eye is
// pulled from the departing peaks down into the opening valley — a descending,
// looking-DOWN read. The near foreground still sinks (covers the bottom → no
// void), and the robot rides that same downward motion (see HeroRobot).
//   `travel` = vh the layer moves on full scroll; NEGATIVE = UP (far/sky),
//              POSITIVE = DOWN (near/front). `depth` = mouse-parallax px.
// ?v cache-buster: day PNGs were re-baked under the same filename.
const V = "?v=12";
// `night` / `day` are BASE paths — the extension and width are appended by
// srcSetFor() so the two variants can never drift apart.
const LAYERS: Layer[] = [
  { night: "/images/parallax/m7-0", day: "/images/parallax/m7-day0", z: 0, travel: -0.16, depth: 4 },
  { night: "/images/parallax/m7-1", day: "/images/parallax/m7-day1", z: 1, travel: -0.09, depth: 8 },
  { night: "/images/parallax/m7-2", day: "/images/parallax/m7-day2", z: 2, travel: -0.02, depth: 13 },
  { night: "/images/parallax/m7-3", day: "/images/parallax/m7-day3", z: 3, travel: 0.06, depth: 19 },
  { night: "/images/parallax/m7-4", day: "/images/parallax/m7-day4", z: 4, travel: 0.13, depth: 26 },
  { night: "/images/parallax/m7-5", day: "/images/parallax/m7-day5", z: 5, travel: 0.2, depth: 34 },
  { night: "/images/parallax/m7-6", day: "/images/parallax/m7-day6", z: 6, travel: 0.27, depth: 44 },
];

// ----- celestial sky (lives INSIDE the hero, in the painted sky) ------------
// Stars sit in the UPPER sky only — the mountain ridges are in front and
// would occlude anything lower, so we never draw a star "inside" a mountain.
// The field is PAINTED onto three elements (see lib/starfield.ts) instead of
// one animated span per star: 38 always-running compositor animations here,
// plus 66 more in CelestialSky, dominated the site's per-frame budget.
const STAR_GROUPS = buildStarField(20260605, { count: 44, groups: 3, spread: 52 });
const SHOOTERS = [
  { top: "9%", left: "8%", delay: "2.5s", every: "14s" },
  { top: "16%", left: "52%", delay: "9s", every: "19s" },
];
const CLOUDS = [
  { top: "13%", w: 42, dur: "95s", delay: "-12s", o: 0.5 },
  { top: "26%", w: 58, dur: "135s", delay: "-64s", o: 0.34 },
  { top: "8%", w: 30, dur: "78s", delay: "-40s", o: 0.42 },
];

/**
 * Hero / SYS.BOOT — a true Firewatch-style 2.5D parallax built from the
 * 9 real photographic PNG layers, recolored to the site's cool blue-hour
 * palette. CSS sticky pins the stage through a tall section; one rAF loop
 * reads the section's own scroll progress + pointer and writes each
 * layer's inline transform (nearer = travels further up). Native scroll
 * only — nothing hijacks the scrollbar. Reduced motion freezes the static
 * first frame (no rAF).
 */
export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);
  const meterPctRef = useRef<HTMLSpanElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const day = theme === "day";

  // Theme swap is hidden by the ThemeTransitionOverlay's instant opaque cover
  // (a layout-effect cover painted in the SAME frame as the swap), so the hero
  // just swaps each layer's <img src> directly — no per-layer cross-dissolve
  // (that used to linger into the reveal as a double-image). Both sets are
  // preloaded below so the swap paints from cache under the cover.

  // Preload the OTHER theme's set so the day/night toggle swaps with no
  // flash. Deferred to idle: this used to fire on mount and decode fourteen
  // 3200px images while the hero was still painting and the visitor was
  // already scrolling — exactly when the main thread is busiest. Only the
  // inactive set is fetched; the active one is already in the DOM.
  useEffect(() => {
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 2000);
    const cancel =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const handle = idle(() => {
      // Match what the browser would pick from the srcset, so the preload
      // populates the same cache entry the swap will ask for.
      const wide = window.innerWidth * (window.devicePixelRatio || 1) > 1600;
      for (const l of LAYERS) {
        const img = new Image();
        img.src = `${day ? l.night : l.day}${wide ? "" : "-1600"}.webp${V}`;
      }
    });
    return () => cancel(handle as number);
  }, [day]);

  // Parallax engine. Transform-only, all-browser: each layer wrapper gets one
  // translate3d combining the scroll-linked vertical travel and the pointer
  // drift. Layout (the hero's offsetTop/height) is cached and refreshed on
  // resize, never read inside the frame.
  //
  // The loop itself now runs on the SHARED page ticker (lib/frameLoop): the
  // hero, the ridge backdrop and the celestial sky each used to own a
  // separate rAF that read `window.scrollY` between the others' transform
  // writes, so a single frame could trigger several style recalcs. One
  // ticker reads once, then everyone writes.
  //
  // It also early-outs when neither the scroll position nor the damped
  // pointer has moved, so an idle hero costs nothing at all. Reduced motion
  // never subscribes — the static first frame is the whole effect.
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const identity = identityRef.current;
    const meter = meterRef.current;
    const meterPct = meterPctRef.current;
    const light = lightRef.current;
    if (!section || !stage) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const layers = Array.from(stage.querySelectorAll<HTMLElement>(".hero-layer")).map(
      (el) => ({
        el,
        travel: parseFloat(el.dataset.travel || "0"),
        depth: parseFloat(el.dataset.depth || "0"),
      })
    );

    let heroTop = 0;
    let heroH = 0;
    const measure = () => {
      heroTop = section.offsetTop;
      heroH = section.offsetHeight;
    };
    measure();
    window.addEventListener("resize", measure);

    let visible = true;
    let lastPct = -1;
    let lastProgress = Number.NaN;
    let lastPx = Number.NaN;
    let lastPy = Number.NaN;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        // Free the seven full-screen layer textures whenever the hero is off
        // screen. `will-change` pins them in GPU memory for the whole session
        // otherwise, which is ~85MB of raster the rest of the page never uses.
        const hint = visible ? "transform" : "auto";
        for (const l of layers) l.el.style.willChange = hint;
      },
      { threshold: 0 }
    );
    io.observe(section);

    const unsubscribe = onFrame(({ scrollY, vh, px, py }) => {
      if (!visible) return;

      const denom = Math.max(heroH - vh, 1);
      const progress = Math.min(Math.max((scrollY - heroTop) / denom, 0), 1);

      // Nothing moved — skip every write this frame.
      if (progress === lastProgress && px === lastPx && py === lastPy) return;
      lastProgress = progress;
      lastPx = px;
      lastPy = py;

      for (const { el, travel, depth } of layers) {
        const x = px * depth * -1;
        // +travel = DOWN (the foreground sinks past the descending drone).
        const y = progress * travel * vh + py * depth * -0.5;
        // TRANSLATE ONLY — the cheapest composite. A per-frame scale forced
        // re-rasterisation of these very large layers and flickered.
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }

      if (identity) {
        // The identity block RECEDES ON Z as the drone cranes down — it
        // pitches back and falls away into the valley instead of merely
        // fading. The sticky stage carries the `.stage-3d` perspective; the
        // layer wrappers all sit at z:0 so they are unaffected by it.
        identity.style.opacity = String(Math.max(1 - progress * 1.5, 0));
        identity.style.transform =
          `translate3d(0, ${(-progress * vh * 0.1).toFixed(2)}px, ${(-progress * 620).toFixed(1)}px) ` +
          `rotateX(${(progress * 16).toFixed(2)}deg)`;
      }

      // Scroll IS the boot: the meter under the identity fills as the hero
      // hands off to SYS.SHELL below it. Rebuilt once per whole percent.
      const pct = Math.min(100, Math.round(progress * 100));
      if (pct !== lastPct) {
        lastPct = pct;
        const filled = Math.round((pct / 100) * METER_CELLS);
        if (meter) {
          meter.textContent = "█".repeat(filled) + "░".repeat(METER_CELLS - filled);
        }
        if (meterPct) meterPct.textContent = `${String(pct).padStart(3, " ")}%`;
      }

      // Pointer light rakes across the ridges, a beat behind the cursor.
      if (light) {
        light.style.transform = `translate3d(${(px * 46).toFixed(1)}px, ${(py * 30).toFixed(1)}px, 0)`;
      }
    });

    return () => {
      io.disconnect();
      unsubscribe();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Intro + role text cycler.
  useEffect(() => {
    let cancelled = false;
    let ctx: ReturnType<typeof gsap.context> | null = null;
    let cycle: gsap.core.Timeline | null = null;
    let split: InstanceType<typeof SplitText> | null = null;

    const boot = async () => {
      await registerAll();
      if (cancelled || !stageRef.current) return;
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      ctx = gsap.context(() => {
        if (!reduced) {
          const tl = gsap.timeline({ delay: 0.18 });

          // The wordmark boots in per CHARACTER, each glyph hinging up out
          // of its line mask through real 3D (transformPerspective on the
          // chars themselves, so this works regardless of what the parallax
          // stage does with its own transforms).
          const nameEl = nameRef.current;
          if (nameEl) {
            split = new SplitText(nameEl, { type: "chars" });
            gsap.set(split.chars, { transformOrigin: "50% 90% -30px" });
            tl.from(
              split.chars,
              {
                yPercent: 128,
                rotateX: -94,
                opacity: 0,
                transformPerspective: 900,
                duration: 1.0,
                ease: "power4.out",
                stagger: 0.028,
              },
              0
            );
          }

          tl.from(
            "[data-hero]",
            { opacity: 0, y: 28, duration: 0.85, ease: "power3.out", stagger: 0.09 },
            0.28
          );
        }

        const roleEl = roleRef.current;
        if (roleEl && !reduced) {
          cycle = gsap.timeline({ repeat: -1, delay: 1 });
          ROLES.forEach((role) => {
            cycle!
              .to(roleEl, { duration: 0.5, text: role, ease: "none" })
              .to(roleEl, { duration: 1.6, text: role })
              .to(roleEl, { duration: 0.3, text: "", ease: "none" });
          });
        } else if (roleEl) {
          roleEl.textContent = ROLES[0];
        }
      }, identityRef.current ?? undefined);
    };
    void boot();
    return () => {
      cancelled = true;
      cycle?.kill();
      ctx?.revert();
      split?.revert();
    };
  }, []);

  return (
    /* 200vh gives the sticky stage a full 100vh of travel. At the old 130vh
       the drone descent — and the SYS.BOOT meter riding it — was over in
       ~260px of scroll, which read as a jump rather than a crane. */
    <section
      id="hero"
      ref={sectionRef}
      aria-labelledby="hero-name"
      className="hero-band relative w-full min-h-[200vh] bg-bg"
    >
      <style jsx>{`
        /* 200vh of drone descent is a desktop luxury. On a phone the identity
           has fully faded by ~65% of it, so the last stretch is a screen of
           parallax with nothing to read. 150vh keeps the crane, drops the
           dead scroll. */
        @media (max-width: 767px) {
          .hero-band {
            min-height: 150vh;
          }
        }

        /* ---- legibility haze under the identity -------------------------
           Three stacked radials, not one box:
             top   sits over the eyebrow + wordmark. The painted sky is at
                   its BRIGHTEST there and darkens downhill, so the haze is
                   shaped inversely to the artwork instead of uniformly: it
                   pays for contrast exactly where the sky costs it, and
                   never re-darkens the forest, which already reads at 10:1.
                   Without it the day eyebrow measured 2.5:1.
             core  holds the role line and tagline.
             halo  contributes almost no opacity; its whole job is to
                   stretch the falloff far enough that the edge never bands
                   into a visible oval.
           Every one is elliptical and narrower than the stage, so the
           cliff, the hiker and the ridge keep their bright sky and the
           result reads as haze in the valley, not a panel. Sized in % of
           the identity block, so it tracks the type at every viewport
           instead of needing its own breakpoints. */
        .hero-scrim {
          position: absolute;
          inset: -14%;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(
              60% 32% at 50% 33%,
              var(--hero-scrim-top),
              transparent 76%
            ),
            radial-gradient(
              54% 42% at 50% 52%,
              var(--hero-scrim-core),
              transparent 72%
            ),
            radial-gradient(
              92% 74% at 50% 48%,
              var(--hero-scrim-halo),
              transparent 78%
            );
        }

        /* ---- the role line ----------------------------------------------
           Clipped to a three-stop gradient in the CURRENT theme's hue: cool
           and bright at night, warm and bright in day. GSAP's TextPlugin
           rewrites this node's text on every cycle, so inline-block keeps
           the gradient box hugging whatever word is currently typed —
           otherwise the ramp is measured against a stale width and the
           short roles come out flat.

           The drop is a filter, NOT a text-shadow: with the fill
           transparent for the clip, a text-shadow paints a solid opaque
           silhouette THROUGH the glyphs. drop-shadow follows the clipped
           pixels, so the gradient keeps its dark edge. */
        .hero-role {
          display: inline-block;
          background-image: linear-gradient(
            96deg,
            var(--hero-role-a) 0%,
            var(--hero-role-b) 52%,
            var(--hero-role-c) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
        }

        /* Forced-colors (Windows High Contrast) throws away the background
           image, which would leave a transparent fill and no role at all. */
        @media (forced-colors: active) {
          .hero-role {
            color: CanvasText;
            -webkit-text-fill-color: CanvasText;
            filter: none;
          }
          .hero-scrim {
            display: none;
          }
        }
      `}</style>

      {/* Sticky stage — CSS-pinned in the viewport while the tall section
          scrolls through it (NO GSAP pin). overflow-hidden lives HERE so
          the parallax never exposes an edge; the section above stays a
          normal block so `sticky` has room to travel.

          NOTE: deliberately NO `transform` here. A transform (translateZ(0))
          would make this sticky stage a STACKING CONTEXT, which would force
          ALL hero layers above/below the fixed ambient canvas as one block.
          Without it (sticky+overflow alone are NOT stacking contexts), each
          .hero-layer's z-index resolves in the ROOT context, so the fixed
          robot canvas (z-10) can slot BETWEEN the back layers (sky/ridges,
          z<10) and the FRONT foreground layers (trees, z>10) — the trees then
          occlude the robot's feet for true diorama depth. */}
      <div
        className="stage-3d sticky top-0 h-[100svh] w-full overflow-hidden"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div ref={stageRef} className="absolute inset-0" aria-hidden>
          {LAYERS.map((layer) => (
            /* WRAPPER owns the parallax transform (rAF writes translate3d).
               ONLY the active theme's image is rendered (not both stacked) —
               stacking 2 variants × 7 layers = 14 full-screen retina textures,
               which thrashed GPU memory and flickered badly. One plain image
               per layer = the cheapest, smoothest composite. The inactive set
               is preloaded (effect below) so the toggle swap is instant. */
            <div
              key={layer.z}
              data-travel={layer.travel}
              data-depth={layer.depth}
              className="hero-layer absolute -inset-[8%]"
              style={{
                // Sky stays z0; the celestial layer slots in at z1; the mid
                // ridges (z2..4) sit just under the robot canvas (z-10). The
                // two FRONT foreground layers (z5 = ridge+hiker, z6 = near
                // trees) jump ABOVE the canvas (→ 12, 13) so they occlude the
                // robot's feet — the robot is composited BETWEEN the mid
                // ridges and the foreground, like a figure standing in the
                // valley. (vignette 16 / melt 17 / identity 20 sit on top.)
                zIndex:
                  layer.z <= 4
                    ? layer.z === 0
                      ? 0
                      : layer.z + 1
                    : layer.z + 7,
                willChange: "transform",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${day ? layer.day : layer.night}.webp${V}`}
                srcSet={srcSetFor(day ? layer.day : layer.night)}
                // The wrapper is `-inset-[8%]`, so each layer draws at 116%
                // of the viewport width.
                sizes="116vw"
                alt=""
                aria-hidden
                draggable={false}
                decoding="async"
                loading={layer.z <= 1 ? "eager" : "lazy"}
                fetchPriority={layer.z === 0 ? "high" : "auto"}
                className="absolute inset-0 h-full w-full select-none object-cover"
              />
            </div>
          ))}

          {/* ===================== CELESTIAL SKY =====================
              Sits at z1 — in front of the painted sky (z0), behind every
              mountain ridge (z2..7), so the ridges crop it like a real
              horizon. It's a `.hero-layer`, so the same rAF gives it a slow
              parallax (data-travel below the sky's so the moon lingers; tiny
              data-depth so it reads as very distant). Night ↔ day cross-fade
              on opacity. */}
          <div
            data-travel={-0.13}
            data-depth={3}
            className="hero-layer pointer-events-none absolute -inset-[8%]"
            style={{ zIndex: 1, willChange: "transform" }}
            aria-hidden
          >
            {/* ---------- NIGHT: glow + stars + shooting stars + moon ---------- */}
            <div
              className="sky-plane absolute inset-0"
              data-active={!day}
              style={{ opacity: day ? 0 : 1 }}
            >
              {/* Deepen the upper sky toward true NIGHT. The painted "night"
                  layer is really a bright blue-hour blue, so white stars wash
                  out against it. This deep-navy zenith → transparent-by-horizon
                  gradient turns the open sky to night (stars + moon glow pop),
                  while leaving the lower painting (mountains/lake) untouched. */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(6,10,28,0.80) 0%, rgba(8,13,32,0.58) 24%, rgba(10,16,38,0.28) 44%, rgba(10,16,38,0) 60%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(44% 40% at 71% 15%, rgba(150,180,255,0.26), transparent 60%)",
                }}
              />
              {STAR_GROUPS.map((g, i) => (
                <span key={i} className="sky-field-group">
                  {g.stars.map((st, j) => (
                    <span
                      key={j}
                      className={st.twinkle ? "sky-star sky-star-twinkle" : "sky-star"}
                      style={{
                        left: `${st.x}%`,
                        top: `${st.y}%`,
                        width: `${st.size}px`,
                        height: `${st.size}px`,
                        background: st.color,
                        boxShadow: st.glow,
                        animationDuration: `${st.dur}s`,
                        animationDelay: `${st.delay}s`,
                      }}
                    />
                  ))}
                </span>
              ))}
              {SHOOTERS.map((sh, i) => (
                <span
                  key={i}
                  className="sky-shooter"
                  style={{
                    top: sh.top,
                    left: sh.left,
                    animationDelay: sh.delay,
                    // @ts-expect-error custom prop
                    "--shoot-every": sh.every,
                  }}
                />
              ))}
              <div className="absolute" style={{ top: "11%", left: "71%" }}>
                <div className="sky-moon-disc" />
              </div>
            </div>

            {/* ---------- DAY: warm glow + drifting clouds + sun ---------- */}
            <div
              className="sky-plane absolute inset-0"
              data-active={day}
              style={{ opacity: day ? 1 : 0 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(48% 44% at 70% 14%, rgba(255,216,140,0.42), transparent 58%)",
                }}
              />
              {CLOUDS.map((c, i) => (
                <span
                  key={i}
                  className="sky-cloud"
                  style={{
                    top: c.top,
                    width: `${c.w}vmin`,
                    height: `${c.w * 0.34}vmin`,
                    opacity: c.o,
                    animationDuration: c.dur,
                    animationDelay: c.delay,
                  }}
                />
              ))}
              <div className="sky-sun absolute" style={{ top: "9%", left: "71%" }}>
                <div className="sky-sun-rays" />
                <div className="sky-sun-disc" />
              </div>
            </div>
          </div>

          {/* Atmospheric haze — a soft glow band at the mid-horizon that makes
              the distant peaks RECEDE into air (the depth cue that sells the
              Firewatch diorama). zIndex 4 = in front of the far mountains
              (z0..4), behind the now-dark foreground (z5..7). Parallaxes
              gently; theme-tinted (warm day / cool night). */}
          <div
            data-travel={-0.04}
            data-depth={9}
            className="hero-layer pointer-events-none absolute -inset-[8%]"
            style={{ zIndex: 4, willChange: "transform" }}
            aria-hidden
          >
            <div
              className="absolute inset-0"
              style={{
                background: day
                  ? "linear-gradient(180deg, transparent 24%, rgba(255,198,122,0.32) 45%, rgba(255,168,88,0.11) 58%, transparent 72%)"
                  : "linear-gradient(180deg, transparent 27%, rgba(151,181,236,0.20) 46%, rgba(120,150,210,0.08) 59%, transparent 74%)",
              }}
            />
          </div>

          {/* Pointer light — a soft raking glow that follows the cursor a beat
              behind (the rAF loop writes its transform). Screen-blended so it
              lifts the ridges rather than washing them. */}
          <div
            ref={lightRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[15] will-change-transform"
            style={{
              // Kept deliberately dim. `screen` blends against every ridge
              // layer below, so anything above ~0.08 lifts the whole
              // blue-hour scene and kills the mood the parallax is built on.
              background: day
                ? "radial-gradient(28% 24% at 50% 40%, rgba(255,206,140,0.085), transparent 72%)"
                : "radial-gradient(28% 24% at 50% 40%, rgba(120,180,255,0.075), transparent 72%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Soft vignette — depth + text legibility. Theme-aware: a cool dark
              edge at night, a far gentler warm edge by day (a heavy dark
              vignette over the bright day sky reads as muddy). */}
          <div
            className="pointer-events-none absolute inset-0 z-[16]"
            style={{
              background: day
                ? "radial-gradient(130% 110% at 50% 26%, transparent 64%, rgba(40,30,10,0.22) 100%)"
                : "radial-gradient(130% 110% at 50% 28%, transparent 58%, rgba(5,8,18,0.42) 100%)",
            }}
          />
          {/* Bottom hand-off — a TALL, gentle melt of the lower scene into the
              page bg so the hero doesn't read as "the image just ends": the
              foreground/forest dissolves into var(--bg), and the next section
              emerges from that same clean field (seamless blend). Theme-aware. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[17] h-[46%]"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--bg) 32%, transparent) 44%, color-mix(in srgb, var(--bg) 78%, transparent) 74%, var(--bg) 100%)",
            }}
          />
        </div>

        {/* Identity — floats above every photo layer (z-20). Its fade /
            lift / scale on scroll is driven by the rAF loop (inline
            transform + opacity), so no transform utility classes here. */}
        <div
          ref={identityRef}
          className="hero-identity layer-3d absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center will-change-transform"
          style={HERO_INK[day ? "day" : "night"] as CSSProperties}
        >
          {/* Legibility haze. Lives INSIDE the identity so it inherits the
              block's scroll fade + recede for free (the rAF loop writes
              opacity/transform on this element) — a scrim mounted outside
              would linger as a dark blot after the text had gone. It is the
              first child and every text line lives in `.hero-ident-inner`
              (position:relative), so paint order alone puts the haze
              underneath: no negative z-index, which `preserve-3d` on
              `.layer-3d` sorts unreliably. */}
          <div aria-hidden className="hero-scrim" />

          <div className="hero-ident-inner relative flex flex-col items-center">
          <span
            data-hero
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.32em]"
            style={{
              color: "var(--hero-eyebrow)",
              textShadow: "var(--hero-ink-shadow)",
            }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--hero-pip)",
                boxShadow: "0 0 10px var(--hero-pip)",
              }}
            />
            {HERO.eyebrow}
          </span>

          {/* The wordmark is animated per CHARACTER (see the intro timeline),
              so the two lines carry `line-mask` — the clip the glyphs hinge
              up out of — instead of `data-hero`, which drives the simpler
              rise used by everything else in the block. */}
          <h1
            ref={nameRef}
            id="hero-name"
            className="mt-5 font-display leading-[0.86] tracking-[-0.04em]"
            style={{
              fontWeight: 800,
              // Crisp legibility on BOTH the dark night sky and the bright day
              // sky — a tight dark edge + a small soft drop (NOT a 50px blur,
              // which showed as an ugly dark blob over the bright day scene).
              // Warmer and heavier in day, where the sky it has to cut through
              // is the brightest surface on the site.
              textShadow: "var(--hero-shadow)",
            }}
          >
            <span
              className="line-mask block text-[clamp(3rem,12vw,8rem)]"
              style={{ color: "var(--hero-name-accent)" }}
            >
              PRADIPTA
            </span>
            <span
              className="line-mask block text-[clamp(3rem,12vw,8rem)]"
              style={{ color: "var(--hero-name-light)" }}
            >
              JANA
            </span>
          </h1>

          <p
            data-hero
            className="mt-6 font-mono text-sm uppercase tracking-[0.28em]"
            style={{ color: "var(--hero-dim)" }}
          >
            {/* Was `opacity-50` on top of an already-dim ink, which put the
                label under 2:1 in both themes. It is a label, not decoration:
                dim it with its own token, once. */}
            <span style={{ color: "var(--hero-label)" }}>role:: </span>
            <span ref={roleRef} className="hero-role" />
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse align-middle"
              style={{ background: "var(--hero-caret)" }}
            />
          </p>

          <p
            data-hero
            className="mt-6 max-w-xl text-base leading-relaxed md:text-lg"
            style={{
              color: "var(--hero-body)",
              textShadow: "var(--hero-ink-shadow)",
            }}
          >
            {profile.tagline}
          </p>

          {/* Scroll IS the boot. The meter below fills as the hero recedes,
              then hands the sequence to SYS.SHELL's scroll-typed cold boot —
              so the whole opening reads as one continuous power-on. */}
          <div
            data-hero
            className="mt-12 flex flex-col items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]"
            style={{ color: "var(--hero-dim)" }}
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-block h-8 w-[1px] animate-pulse"
                style={{ background: "var(--hero-caret)" }}
              />
              scroll to boot
            </span>
            <span className="flex items-center gap-2.5 tabular-nums">
              <span style={{ color: "var(--hero-meter)" }}>sys.boot</span>
              <span
                ref={meterRef}
                aria-hidden
                className="tracking-[0.08em]"
                style={{ color: "var(--hero-meter)" }}
              >
                {"░".repeat(METER_CELLS)}
              </span>
              <span ref={meterPctRef}>{"  0%"}</span>
            </span>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
