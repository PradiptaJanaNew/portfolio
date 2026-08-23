"use client";

import { useEffect, useRef } from "react";
import { gsap, registerAll, ScrollTrigger, SplitText } from "@/lib/gsap";
import { SectionFrame } from "@/components/ui/SectionFrame";
import { profile } from "@/content/profile";
import { sceneStore } from "@/lib/sceneStore";

// Theme-aware semantic tokens (flip with data-theme via globals.css).
// Text/surface/border now read from CSS vars so the section is legible in
// both night and day; accent hues below stay static (read on both themes).
const BONE = "var(--bone)"; // primary text / headings
const STEEL = "var(--ink-faint)"; // muted labels
const LINE = "var(--line)"; // hairline borders
const SURFACE = "var(--surface)"; // panel fills
const AMBER = "#ff7a1a";
const AMBER_HI = "#ff8a3c";
const GREEN = "#39ffa5";

const LEDGER: ReadonlyArray<[string, string, boolean]> = [
  ["STATUS", "ONLINE", true],
  ["BASE", "Sonarpur · Kolkata · IN", false],
  ["STACK", "5 OWNED", false],
  ["CLOUD", "AZURE · GCP", false],
  ["AVAIL", "OPEN FOR WORK", false],
];

/**
 * The OPERATOR wordmark's extruded SIDE: ghost copies of the word stacked
 * back along Z inside a preserve-3d group, shading toward black so the
 * stack reads as one lit solid rather than nine flat repeats. Scroll yaws
 * the group, so the extrusion parallaxes for real — a baked text-shadow
 * would stay pinned to the front face and give the trick away.
 */
const EXTRUDE = Array.from({ length: 9 }, (_, i) => ({
  z: -(i + 1) * 6,
  color: `color-mix(in srgb, ${AMBER} ${72 - i * 7}%, #0a0603)`,
}));

const FIGURES: ReadonlyArray<{ v: number; suffix: string; label: string }> = [
  { v: 3, suffix: "+", label: "YEARS SHIPPING" },
  { v: 5, suffix: "", label: "STACKS OWNED" },
  { v: 2, suffix: "", label: "CLOUDS RUN" },
];

/**
 * Live "oscilloscope" telemetry — a scrolling EKG-style waveform drawn on
 * an SVG via rAF. A designed, on-brand graphic (signal/telemetry) in
 * place of a floating 3D primitive. Static under reduced motion.
 */
function Oscilloscope({ energyRef }: { energyRef: React.MutableRefObject<number> }) {
  const pathRef = useRef<SVGPolylineElement>(null);
  const glowRef = useRef<SVGPolylineElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const W = 320;
  const H = 96;

  useEffect(() => {
    const el = pathRef.current;
    const glow = glowRef.current;
    const head = headRef.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const N = 80;
    // `energy` is the damped scroll energy the section feeds in (0..1). It
    // widens the trace and speeds the heartbeat, so the telemetry actually
    // reads as telemetry — the scope used to loop identically no matter
    // what the visitor did, which is the tell that it is decoration.
    let energy = 0;
    const base = (t: number, i: number) => {
      const x = i / N;
      // calm sine + occasional heartbeat spike
      const beat = Math.sin((x * (6 + energy * 7) - t) * Math.PI * 2);
      const spikePos = (t * 0.5) % 1;
      const d = Math.abs(x - spikePos);
      const spike = d < 0.03 ? Math.sin((0.03 - d) / 0.03 * Math.PI) * 1.6 : 0;
      return (beat * 0.35 + spike) * (1 + energy * 0.85);
    };

    const writeHead = (t: number) => {
      if (!head) return;
      const hx = ((t * 0.5) % 1) * W;
      const hy = H / 2 - base(t, Math.round(((t * 0.5) % 1) * N)) * (H / 2.6);
      head.setAttribute("cx", hx.toFixed(1));
      head.setAttribute("cy", hy.toFixed(1));
    };

    if (reduced) {
      const pts = Array.from({ length: N + 1 }, (_, i) => `${(i / N) * W},${(H / 2 - base(0, i) * (H / 2.6)).toFixed(1)}`).join(" ");
      el.setAttribute("points", pts);
      glow?.setAttribute("points", pts);
      return;
    }

    let raf = 0;
    let t = 0;
    let hidden = false;
    const onVis = () => { hidden = document.hidden; if (!hidden) raf = requestAnimationFrame(loop); };
    const loop = () => {
      // ease toward the section's live scroll energy, then bleed it off
      energy += (energyRef.current - energy) * 0.12;
      energyRef.current *= 0.94;
      t += 0.02 + energy * 0.05;
      const pts = Array.from({ length: N + 1 }, (_, i) => `${(i / N) * W},${(H / 2 - base(t, i) * (H / 2.6)).toFixed(1)}`).join(" ");
      el.setAttribute("points", pts);
      glow?.setAttribute("points", pts);
      writeHead(t);
      if (!hidden) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, [energyRef]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="scope-fade" x1="0" x2="1">
          <stop offset="0" stopColor={AMBER} stopOpacity="0" />
          <stop offset="0.5" stopColor={AMBER_HI} stopOpacity="1" />
          <stop offset="1" stopColor={AMBER} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* faint scope grid */}
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={BONE} strokeOpacity="0.08" strokeWidth="0.5" />
      <line x1={W / 4} y1="0" x2={W / 4} y2={H} stroke={BONE} strokeOpacity="0.04" strokeWidth="0.5" />
      <line x1={W / 2} y1="0" x2={W / 2} y2={H} stroke={BONE} strokeOpacity="0.04" strokeWidth="0.5" />
      <line x1={(W / 4) * 3} y1="0" x2={(W / 4) * 3} y2={H} stroke={BONE} strokeOpacity="0.04" strokeWidth="0.5" />
      {/* blurred under-glow trace */}
      <polyline ref={glowRef} fill="none" stroke={AMBER} strokeOpacity="0.35" strokeWidth="4" style={{ filter: "blur(3px)" }} />
      <polyline ref={pathRef} fill="none" stroke="url(#scope-fade)" strokeWidth="1.5" />
      <circle ref={headRef} r="2.4" fill={AMBER_HI} style={{ filter: `drop-shadow(0 0 5px ${AMBER})` }} />
    </svg>
  );
}

function useCountUp(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let ctx: ReturnType<typeof gsap.context> | null = null;
    const boot = async () => {
      await registerAll();
      if (cancelled || !rootRef.current) return;
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const end = Number(el.dataset.count ?? "0");
          const suffix = el.dataset.suffix ?? "";
          // Reduced motion: skip the count-up animation but still show the
          // real final figure (not the 0 placeholder baked into the markup).
          if (reduced) {
            el.textContent = `${end}${suffix}`;
            return;
          }
          const obj = { v: 0 };
          gsap.to(obj, {
            v: end, duration: 1.6, ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onUpdate: () => { el.textContent = `${Math.round(obj.v)}${suffix}`; },
          });
        });
      }, rootRef.current);
    };
    void boot();
    return () => { cancelled = true; ctx?.revert(); };
  }, [rootRef]);
}

export function AboutSection() {
  const rootRef = useRef<HTMLDivElement>(null);
  // Live scroll energy for the telemetry scope. A ref, not state — the
  // scope reads it inside its own rAF, so React never re-renders for it.
  const energyRef = useRef(0);
  useCountUp(rootRef);

  // Orchestrated reveal: headline clips up, body text reveals line-by-line,
  // ledger rows stagger, and the dossier panels carry a subtle depth parallax
  // as they enter.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let ctx: ReturnType<typeof gsap.context> | null = null;
    const splits: InstanceType<typeof SplitText>[] = [];
    const boot = async () => {
      await registerAll();
      if (cancelled || !rootRef.current) return;
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ctx = gsap.context(() => {
        if (reduced) {
          gsap.set(
            ["[data-rise]", "[data-lines]", "[data-headline]", "[data-kicker]", "[data-rail]", "[data-ledger-row]", "[data-stat-rule]"],
            { opacity: 1, y: 0, x: 0, yPercent: 0, scaleX: 1, scaleY: 1 }
          );
          // Settle the extruded wordmark square-on so the ghost layers hide
          // exactly behind the front face.
          gsap.set("[data-word3d]", { rotateX: 0, rotateY: 0, z: 0, opacity: 1 });
          return;
        }

        // Kicker rule draws + fades in first.
        gsap.from("[data-kicker]", {
          opacity: 0, y: -12, duration: 0.7, ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 80%", once: true },
        });

        // The extruded wordmark FLIES IN along Z — turned away, far back,
        // then swinging square to the reader. (This replaced a flat
        // clip-up: with nine ghost layers behind the front face, a vertical
        // wipe hid the extrusion entirely, which was the whole point.)
        gsap.from("[data-word3d]", {
          z: -560,
          rotateY: -62,
          opacity: 0,
          duration: 1.15,
          ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 74%", once: true },
        });

        // …then scroll keeps yawing it, so the extruded side sweeps from
        // one edge of the word to the other as the section passes.
        gsap.fromTo(
          "[data-word3d]",
          { rotateY: -24, rotateX: 5 },
          {
            rotateY: 15,
            rotateX: -4,
            ease: "none",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.7,
            },
          }
        );

        // Vertical index rail "scans" down beside the headline.
        gsap.from("[data-rail]", {
          scaleY: 0, transformOrigin: "top center", duration: 1.1, ease: "power3.inOut",
          scrollTrigger: { trigger: rootRef.current, start: "top 74%", once: true },
        });

        // Line-by-line clip/y reveal of the lead + bio paragraphs.
        //
        // `autoSplit` re-splits on resize AND once the web fonts land. The
        // previous one-shot split ran against fallback metrics, so the lead
        // paragraph kept a stale break ("…designs, builds / and deploys /
        // the whole stack…") that never recovered. Per GSAP's contract the
        // animation MUST be built inside onSplit so a re-split re-targets
        // the fresh line elements; returning the tween lets GSAP revert it.
        gsap.utils.toArray<HTMLElement>("[data-lines]").forEach((el) => {
          const split = SplitText.create(el, {
            type: "lines",
            linesClass: "split-line",
            // NOT `mask: "lines"` — GSAP's mask wrapper is sized to the line
            // box, which crops the floated drop cap out of the bio's first
            // line. Clipping the line element itself leaves the float alone.
            autoSplit: true,
            onSplit: (self) => {
              gsap.set(self.lines, { overflow: "hidden" });
              return gsap.from(self.lines, {
                yPercent: 110,
                opacity: 0,
                duration: 0.9,
                stagger: 0.08,
                ease: "power4.out",
                scrollTrigger: { trigger: el, start: "top 86%", once: true },
              });
            },
          });
          splits.push(split);
        });

        gsap.from("[data-rise]", {
          opacity: 0, y: 28, duration: 0.8, stagger: 0.09, ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 66%", once: true },
        });

        // Ledger rows wipe in individually for a "data populating" feel.
        gsap.from("[data-ledger-row]", {
          opacity: 0, x: 18, duration: 0.55, stagger: 0.07, ease: "power3.out",
          scrollTrigger: { trigger: "[data-ledger]", start: "top 88%", once: true },
        });

        // Hairline divider between stats draws across.
        gsap.from("[data-stat-rule]", {
          scaleX: 0, transformOrigin: "left center", duration: 1.1, ease: "power3.inOut",
          scrollTrigger: { trigger: "[data-stat-band]", start: "top 86%", once: true },
        });

        // Feed the telemetry scope: scroll velocity → trace amplitude.
        // The same trigger walks the ambient robot into the gutter between
        // the bio and the telemetry column — pose 02 aims it at "the centre
        // starfield strip", but the bio column is the wider of the two, so
        // dead centre lands on the lead paragraph.
        ScrollTrigger.create({
          trigger: rootRef.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const v = Math.min(Math.abs(self.getVelocity()) / 2600, 1);
            if (v > energyRef.current) energyRef.current = v;

            const k = Math.sin(Math.PI * self.progress);
            sceneStore.travelerOffset.x = k * 2.1;
            sceneStore.travelerOffset.y = k * -1.6;
          },
        });

        // Subtle depth parallax on the dossier panels as the section scrolls.
        gsap.utils.toArray<HTMLElement>("[data-depth]").forEach((el) => {
          const depth = parseFloat(el.dataset.depth ?? "0") || 0;
          gsap.fromTo(
            el,
            { yPercent: depth },
            {
              yPercent: -depth,
              ease: "none",
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.6,
              },
            }
          );
        });
      }, rootRef.current);
    };
    void boot();
    return () => {
      cancelled = true;
      ctx?.revert();
      splits.forEach((s) => s.revert());
    };
  }, []);

  return (
    <SectionFrame id="about" ariaLabelledBy="about-title" className="overflow-visible">
      {/* local atmosphere: amber wash + baseline grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-[8%] top-[14%] h-[54vh] w-[54vh] rounded-full opacity-[0.12] blur-[130px]" style={{ background: AMBER }} />
        <div className="absolute right-[2%] bottom-[8%] h-[34vh] w-[34vh] rounded-full opacity-[0.06] blur-[120px]" style={{ background: "#4f9cff" }} />
        <div className="grid-bg absolute inset-0 opacity-[0.22]" />
      </div>

      <div ref={rootRef} className="relative mx-auto w-full max-w-6xl" style={{ color: BONE }}>
        {/* Kicker rule */}
        <div data-kicker className="flex items-center justify-between border-t pt-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ borderColor: LINE, color: STEEL }}>
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
            SYS.INIT · OPERATOR DOSSIER
          </span>
          <span className="hidden items-center gap-3 sm:flex">
            <span style={{ color: "var(--ink-faint)", opacity: 0.7 }}>REF · PKJ-0X9</span>
            <span style={{ color: AMBER }}>02 / 06</span>
          </span>
          <span style={{ color: AMBER }} className="sm:hidden">02 / 06</span>
        </div>

        {/* Hero row */}
        <div className="mt-8 grid gap-10 md:mt-14 md:grid-cols-[1.18fr_0.82fr] md:gap-16">
          {/* Left: identity + editorial body */}
          <div className="relative">
            {/* Signature detail: a thin amber "dossier index" rail running down
                the left edge of the identity column. */}
            <div className="relative flex">
              <div data-rail aria-hidden className="mr-6 hidden w-px shrink-0 sm:block" style={{ background: `linear-gradient(${AMBER}, ${AMBER}00)` }} />
              <div className="min-w-0">
                <div className="stage-3d">
                  <div
                    data-word3d
                    className="layer-3d relative"
                    style={{ transformOrigin: "50% 50%" }}
                  >
                    {EXTRUDE.map((e) => (
                      <span
                        key={e.z}
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-0 select-none font-grotesk leading-[0.8] tracking-[-0.035em]"
                        style={{
                          fontWeight: 800,
                          fontSize: "clamp(3.2rem,11vw,8.5rem)",
                          transform: `translateZ(${e.z}px)`,
                          color: e.color,
                        }}
                      >
                        OPERATOR
                      </span>
                    ))}
                    <h2
                      id="about-title"
                      data-headline
                      className="relative font-grotesk leading-[0.8] tracking-[-0.035em]"
                      style={{ fontWeight: 800, fontSize: "clamp(3.2rem,11vw,8.5rem)", color: BONE }}
                    >
                      OPERATOR
                    </h2>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.34em]" style={{ color: STEEL }}>
                  {profile.name} <span style={{ color: `${AMBER}` }}>—</span> {profile.role}
                </p>
              </div>
            </div>

            <p data-lines className="mt-8 max-w-xl font-serif text-[clamp(1.3rem,2.5vw,2rem)] italic leading-[1.22]" style={{ color: BONE, opacity: 0.92 }}>
              A senior software engineer who designs, builds and deploys the
              whole stack — from the first pixel to the last server.
            </p>
            <p data-lines className="mt-7 max-w-xl text-[15px] leading-[1.78]" style={{ color: "var(--ink-dim)" }}>
              <span className="float-left mr-3 mt-2 font-grotesk text-[3.4rem] leading-[0.62]" style={{ color: AMBER, fontWeight: 700 }}>
                {profile.bio.charAt(0)}
              </span>
              {profile.bio.slice(1)}
            </p>

            {/* Role chips — concrete capability tags pulled from profile. */}
            <div data-rise className="mt-8 flex flex-wrap gap-2">
              {profile.roles.map((r) => (
                <span
                  key={r}
                  className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors"
                  style={{ borderColor: "var(--line-strong)", color: BONE }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* Right: live telemetry panel + ledger */}
          <div className="flex flex-col gap-6">
            <div data-rise data-depth="4" className="crop-frame border p-4" style={{ borderColor: LINE, background: SURFACE }}>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: STEEL }}>
                <span>live telemetry</span>
                <span className="flex items-center gap-1.5" style={{ color: GREEN }}>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                  rec
                </span>
              </div>
              <div className="mt-3 h-[96px] w-full">
                <Oscilloscope energyRef={energyRef} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: LINE, color: STEEL }}>
                <span className="flex flex-col gap-0.5">UPTIME <b style={{ color: BONE, letterSpacing: "0.06em" }}>99.9%</b></span>
                <span className="flex flex-col gap-0.5">BUILD <b style={{ color: BONE, letterSpacing: "0.06em" }}>~38s</b></span>
                <span className="flex flex-col gap-0.5">REGION <b style={{ color: BONE, letterSpacing: "0.06em" }}>IN</b></span>
              </div>
            </div>

            <dl data-rise data-ledger data-depth="2.4" className="font-mono text-[12px]">
              {LEDGER.map(([k, v, dot], i) => (
                <div
                  key={k}
                  data-ledger-row
                  className="flex items-center justify-between border-b py-2.5"
                  style={{ borderColor: LINE }}
                >
                  <dt className="flex items-center gap-2.5 uppercase tracking-[0.24em]" style={{ color: STEEL }}>
                    <span style={{ color: AMBER, opacity: 0.65 }}>{String(i + 1).padStart(2, "0")}</span>
                    {k}
                  </dt>
                  <dd className="flex items-center gap-2 text-right uppercase tracking-[0.12em]" style={{ color: BONE }}>
                    {dot && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />}
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Stat band */}
        <div data-stat-band className="relative mt-14 md:mt-20">
          <div data-stat-rule className="absolute left-0 right-0 top-0 h-px" style={{ background: "var(--line-strong)" }} />
          <div className="grid grid-cols-3">
            {FIGURES.map((f, i) => (
              <div
                key={f.label}
                data-rise
                className={`relative py-7 ${i > 0 ? "border-l pl-6 md:pl-8" : ""}`}
                style={{ borderColor: LINE }}
              >
                {/* hairline tick at the top of each figure */}
                <span aria-hidden className="absolute left-0 top-0 h-2.5 w-px md:left-0" style={{ background: AMBER, opacity: i === 0 ? 0.9 : 0.4 }} />
                <div
                  data-count={f.v}
                  data-suffix={f.suffix}
                  className="font-grotesk tabular-nums leading-none"
                  style={{ fontWeight: 800, fontSize: "clamp(2.8rem,6.2vw,5.2rem)", color: BONE }}
                />
                <div className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: STEEL }}>
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}

export default AboutSection;
