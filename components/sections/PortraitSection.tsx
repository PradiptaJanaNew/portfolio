"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, registerAll, ScrollTrigger } from "@/lib/gsap";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { CvOverlay, type CvMode } from "@/components/ui/CvOverlay";
import { profile } from "@/content/profile";
import { useDeviceCapabilities } from "@/lib/usePerfTier";
import { sceneStore } from "@/lib/sceneStore";

const PortraitCanvas = dynamic(
  () => import("@/components/three/PortraitCanvas").then((m) => m.PortraitCanvas),
  { ssr: false, loading: () => null }
);

// Theme-aware semantic tokens (flip with data-theme via globals.css).
const INK = "var(--ink)";
const STEEL = "var(--ink-faint)";
// Ledger keys sit where the ambient robot drifts past, so they use the
// BRIGHTER dim token rather than the faintest one — they need headroom.
const LABEL = "var(--ink-dim)";
const LINE = "var(--line)";
const LINE_STRONG = "var(--line-strong)";
const SURFACE = "var(--surface)";
// Accents read on BOTH themes — static.
const AMBER = "#ff7a1a";
const AMBER_HI = "#ff8a3c";
const CYAN = "#00d4ff";
const GREEN = "#39ffa5";

const LEDGER: ReadonlyArray<[string, string]> = [
  ["ROLE", profile.role],
  ["BASE", "Sonarpur · Kolkata · IN"],
  ["EDU", "BCA · George Group of Colleges"],
];

/**
 * SYS.OPERATOR — the portrait, resolved in WebGL, next to the dossier.
 *
 * The left plate runs a shader that scan-resolves a matted photograph out
 * of an accent-tinted halftone as the section scrolls past (see
 * PortraitScene). The right column carries the identity ledger and the two
 * CV actions, which open the full-screen CvOverlay.
 *
 * This section replaced the emoji-converge beat, whose glyphs landed on top
 * of the headline words and left the sentence unreadable.
 *
 * Degradation: low-tier / mobile / reduced-motion never mounts the canvas
 * and shows the same portrait as a plain <img>, so the section always has
 * its subject.
 */
export function PortraitSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  const progressRef = useRef(0);
  const [active, setActive] = useState(false);
  const [cvMode, setCvMode] = useState<CvMode | null>(null);

  const { canRunWebGL, webglBudget } = useDeviceCapabilities();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The portrait resolve is the signature beat of this section, so a capable
  // phone keeps it — it is a single textured quad. Only genuinely weak devices
  // fall back to the plain <img>.
  const canUseGl = canRunWebGL && !reduced;

  const closeCv = useCallback(() => setCvMode(null), []);

  // Only render frames while the plate is actually on screen.
  //
  // On a phone we additionally hand the ambient scene's GPU slot over while
  // the plate is up (the `portfolio:bg-pause` contract SYS.RENDER already
  // uses). A phone should be asked for ONE canvas at a time; two full-viewport
  // WebGL surfaces plus seven parallax layers is what makes a mobile browser
  // stutter. Desktop keeps both running.
  const yieldsAmbient = webglBudget === "reduced";
  useEffect(() => {
    const el = plateRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        setActive(e.isIntersecting);
        if (yieldsAmbient) {
          (window as unknown as { __bgPause?: boolean }).__bgPause = e.isIntersecting;
          window.dispatchEvent(
            new CustomEvent("portfolio:bg-pause", { detail: e.isIntersecting })
          );
        }
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (yieldsAmbient) {
        (window as unknown as { __bgPause?: boolean }).__bgPause = false;
        window.dispatchEvent(
          new CustomEvent("portfolio:bg-pause", { detail: false })
        );
      }
    };
  }, [yieldsAmbient]);

  // Scroll → shader scan progress (+ the numeric readout beside the plate).
  useEffect(() => {
    let cancelled = false;
    let ctx: ReturnType<typeof gsap.context> | null = null;

    const boot = async () => {
      await registerAll();
      if (cancelled || !rootRef.current) return;

      if (reduced) {
        progressRef.current = 1;
        if (readoutRef.current) readoutRef.current.textContent = "100";
        gsap.set("[data-reveal]", { opacity: 1, y: 0 });
        gsap.set("[data-head-line]", { opacity: 1, rotateX: 0, y: 0 });
        gsap.set("[data-ledger-row]", { opacity: 1, x: 0 });
        gsap.set("[data-row-scan]", { scaleX: 0 });
        return;
      }

      ctx = gsap.context(() => {
        gsap.from("[data-reveal]", {
          opacity: 0,
          y: 28,
          duration: 0.85,
          stagger: 0.09,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current!, start: "top 74%", once: true },
        });

        // "Identity / confirmed." hinges in line by line through real 3D,
        // each line pivoting up from behind its own mask.
        gsap.from("[data-head-line]", {
          rotateX: -78,
          yPercent: 55,
          opacity: 0,
          transformPerspective: 800,
          transformOrigin: "50% 100%",
          duration: 1.0,
          stagger: 0.13,
          ease: "power4.out",
          scrollTrigger: { trigger: sectionRef.current!, start: "top 66%", once: true },
        });

        // Ledger rows populate one at a time, each with a bright bar that
        // scans across it — the dossier filling itself in.
        gsap.utils.toArray<HTMLElement>("[data-ledger-row]").forEach((row, i) => {
          const tl = gsap.timeline({
            scrollTrigger: { trigger: sectionRef.current!, start: "top 58%", once: true },
            delay: i * 0.12,
          });
          tl.from(row, { opacity: 0, x: 24, duration: 0.5, ease: "power3.out" }).fromTo(
            row.querySelector("[data-row-scan]"),
            { scaleX: 0, transformOrigin: "left center", opacity: 1 },
            { scaleX: 1, transformOrigin: "left center", duration: 0.34, ease: "power2.in" },
            0
          ).to(
            row.querySelector("[data-row-scan]"),
            { scaleX: 0, transformOrigin: "right center", duration: 0.34, ease: "power2.out" },
            0.34
          );
        });

        // The plate is CSS-sticky through a tall band, so the scan front is
        // driven by the SECTION's progress. (It used to trigger off the
        // plate itself, which stops moving the moment the stage sticks.)
        let last = -1;
        ScrollTrigger.create({
          trigger: sectionRef.current!,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
          onUpdate: (self) => {
            progressRef.current = self.progress;
            const q = Math.round(self.progress * 100);
            if (q !== last && readoutRef.current) {
              last = q;
              readoutRef.current.textContent = String(q);
            }
          },
        });

        // Keep the ambient robot off the dossier column while the band is
        // held — it crossed the "confirmed." headline at pose 02→03.
        ScrollTrigger.create({
          trigger: sectionRef.current!,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const k = Math.sin(Math.PI * self.progress);
            sceneStore.travelerOffset.x = k * 3.2;
            sceneStore.travelerOffset.y = k * -3.6;
          },
        });
      }, rootRef.current);
    };

    void boot();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced]);

  return (
    <>
      {/* A TALL band with a CSS-sticky stage (the same no-GSAP-pin pattern
          SYS.METRICS and SYS.SHELL use). The shader scan used to race past
          in whatever scroll the section happened to occupy; holding the
          plate gives the resolve a controlled 120vh to complete in. */}
      <section
        id="operator"
        ref={sectionRef}
        aria-labelledby="operator-title"
        className="operator-band pin-band relative w-full min-h-[220vh]"
      >
      <div className="pin-stage sticky top-0 flex h-[100svh] w-full items-center overflow-hidden px-[clamp(16px,5vw,96px)] py-[clamp(32px,5vh,96px)]">
        {/* local atmosphere */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div
            className="absolute left-[8%] top-[12%] h-[46vh] w-[46vh] rounded-full opacity-[0.11] blur-[130px]"
            style={{ background: AMBER }}
          />
          <div
            className="absolute right-[10%] bottom-[10%] h-[32vh] w-[32vh] rounded-full opacity-[0.07] blur-[120px]"
            style={{ background: CYAN }}
          />
          <div className="grid-bg absolute inset-0 opacity-[0.16]" />
        </div>

        <div ref={rootRef} className="relative mx-auto w-full max-w-6xl" style={{ color: INK }}>
          {/* kicker */}
          <div
            data-reveal
            className="flex items-center justify-between border-t pt-3 font-mono text-[11px] uppercase tracking-[0.3em]"
            style={{ borderColor: LINE_STRONG, color: STEEL }}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: AMBER, boxShadow: `0 0 8px ${AMBER}` }}
              />
              SYS.OPERATOR · IDENTITY
            </span>
            <span className="hidden sm:block" style={{ color: AMBER }}>
              REF · PKJ-CV
            </span>
          </div>

          <div className="mt-10 grid items-center gap-10 md:mt-14 md:grid-cols-[0.86fr_1fr] md:gap-16">
            {/* ── Left: the WebGL plate ─────────────────────────────── */}
            <div data-reveal className="relative mx-auto w-full max-w-[440px]">
              <div
                ref={plateRef}
                className="crop-frame relative aspect-[3/4] w-full overflow-hidden"
                style={{ border: `1px solid ${LINE_STRONG}`, background: SURFACE }}
              >
                {canUseGl ? (
                  <PortraitCanvas
                    active={active}
                    progressRef={progressRef}
                    accent={AMBER_HI}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/images/pradipta-cut.webp"
                    alt={`${profile.name}, ${profile.role}`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    width={900}
                    height={1352}
                  />
                )}

                {/* HUD overlay on the plate */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 font-mono text-[9px] uppercase tracking-[0.24em]"
                  style={{ color: STEEL }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: AMBER }}>FIG.02 — OPERATOR</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-1 w-1 rounded-full"
                        style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }}
                      />
                      LOCK
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span>900 × 1352</span>
                    <span style={{ color: AMBER }}>
                      SCAN <span ref={readoutRef}>0</span>%
                    </span>
                  </div>
                </div>
              </div>

              {/* caption rule */}
              <div
                className="mt-3 flex items-center justify-between border-t pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.26em]"
                style={{ borderColor: LINE, color: STEEL }}
              >
                <span>{profile.name}</span>
                <span>KOLKATA · IN</span>
              </div>
            </div>

            {/* ── Right: dossier + CV actions ───────────────────────── */}
            {/* The ambient traveling robot drifts BEHIND this column (its path
                is a blend of the shared scene poses, so it can't be moved for
                one section without shifting its neighbours). A soft scrim
                deepens the field right under the type instead, so the dim
                ledger labels keep their contrast wherever the bot passes. */}
            {/* md:pl-10 walks the whole column clear of the bot's drift band —
                the scrim alone still let its arm clip the first glyph of a
                ledger key. */}
            <div className="relative md:pl-10">
              <div
                aria-hidden
                className="pointer-events-none absolute -left-28 -right-8 -top-10 -bottom-10 -z-10"
                style={{
                  background:
                    "radial-gradient(62% 58% at 34% 52%, color-mix(in srgb, var(--bg) 94%, transparent) 30%, color-mix(in srgb, var(--bg) 70%, transparent) 58%, transparent 78%)",
                }}
              />
              <h2
                id="operator-title"
                className="stage-3d font-grotesk leading-[0.86] tracking-[-0.03em]"
                style={{ fontWeight: 800, fontSize: "clamp(2.6rem,6.4vw,4.6rem)" }}
              >
                <span className="line-mask block">
                  <span data-head-line className="block origin-bottom">
                    Identity
                  </span>
                </span>
                <span className="line-mask block">
                  <span
                    data-head-line
                    className="block origin-bottom font-serif font-normal italic"
                    style={{ color: AMBER }}
                  >
                    confirmed.
                  </span>
                </span>
              </h2>

              <p
                data-reveal
                className="mt-6 max-w-md text-[15px] leading-[1.8]"
                style={{ color: STEEL }}
              >
                3+ years building and shipping production web applications —
                Next.js, React and TypeScript on the front, Azure and GCP behind
                them. The full record is one click away.
              </p>

              {/* identity ledger */}
              <ul className="mt-8 font-mono text-[11.5px]" role="list">
                {LEDGER.map(([k, v]) => (
                  <li
                    key={k}
                    data-ledger-row
                    className="relative flex items-baseline gap-4 overflow-hidden border-b py-2.5"
                    style={{ borderColor: LINE }}
                  >
                    {/* Bright bar that sweeps the row as its value lands —
                        the dossier reading itself into place. */}
                    <span
                      aria-hidden
                      data-row-scan
                      className="pointer-events-none absolute inset-y-0 left-0 w-full"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${AMBER}22 40%, ${AMBER}38 70%, transparent)`,
                      }}
                    />
                    <span
                      className="relative w-[70px] shrink-0 uppercase tracking-[0.24em]"
                      style={{ color: LABEL }}
                    >
                      {k}
                    </span>
                    <span className="relative min-w-0 flex-1 text-right" style={{ color: INK }}>
                      {v}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CV actions */}
              <div data-reveal className="mt-9 flex flex-wrap items-center gap-4">
                <MagneticButton
                  type="button"
                  onClick={() => setCvMode("download")}
                  strength={20}
                  className="group relative isolate overflow-hidden rounded-full px-8 py-3.5 font-mono text-[12px] uppercase tracking-[0.24em]"
                  style={{
                    color: "#1a0e04",
                    background: `linear-gradient(105deg, ${AMBER_HI}, ${AMBER})`,
                    boxShadow: `0 10px 40px -12px ${AMBER}88`,
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-700 ease-out group-hover:translate-x-full"
                    style={{ mixBlendMode: "overlay" }}
                  />
                  <span className="relative z-10 flex items-center gap-2 font-semibold">
                    Download CV
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-y-0.5">
                      ↓
                    </span>
                  </span>
                </MagneticButton>

                <button
                  type="button"
                  onClick={() => setCvMode("preview")}
                  className="group rounded-full border px-7 py-3.5 font-mono text-[12px] uppercase tracking-[0.24em] transition-colors"
                  style={{ borderColor: LINE_STRONG, color: INK }}
                >
                  <span className="flex items-center gap-2">
                    Preview
                    <span
                      aria-hidden
                      className="inline-block transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    >
                      ↗
                    </span>
                  </span>
                </button>
              </div>

              <p
                data-reveal
                className="mt-4 font-mono text-[10px] uppercase tracking-[0.26em]"
                style={{ color: STEEL }}
              >
                PDF · 159 KB · 2 pages
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Reduced motion gets the finished scan immediately, so the extra
           120vh would be dead scroll — collapse the band to one viewport.
           Phones hold it for a shorter run. */
        @media (prefers-reduced-motion: reduce) {
          .operator-band {
            min-height: 100svh;
          }
        }
        @media (max-width: 767px) {
          .operator-band {
            min-height: 170vh;
          }
        }
      `}</style>
      </section>

      <CvOverlay mode={cvMode} onClose={closeCv} />
    </>
  );
}

export default PortraitSection;
