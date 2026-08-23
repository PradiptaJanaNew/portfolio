"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap, registerAll } from "@/lib/gsap";
import { profile } from "@/content/profile";
import { useDeviceCapabilities } from "@/lib/usePerfTier";

const CvTransferCanvas = dynamic(
  () => import("@/components/three/CvTransferCanvas").then((m) => m.CvTransferCanvas),
  { ssr: false, loading: () => null }
);

export type CvMode = "download" | "preview";

const AMBER = "#ff8a3c";
const CYAN = "#00d4ff";
const GREEN = "#39ffa5";

/** Bytes of the CV, shown in the transfer readout. */
const CV_BYTES = 162828;

const LOG_LINES: ReadonlyArray<{ at: number; text: string }> = [
  { at: 0.02, text: "$ fetch --artifact cv --owner pkj" },
  { at: 0.14, text: "› locating artifact ................ ok" },
  { at: 0.3, text: "› verifying signature ............. ok" },
  { at: 0.46, text: `› allocating ${CV_BYTES.toLocaleString("en-US")} bytes` },
  { at: 0.62, text: "› stream open · rendering pages" },
  { at: 0.84, text: "› handoff to browser .............. ok" },
  { at: 0.97, text: "› transfer complete" },
];

/** Fire the real browser download for the CV. */
function triggerDownload() {
  const a = document.createElement("a");
  a.href = profile.cvPath;
  a.download = profile.cvFileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * CV overlay — a full-screen takeover with two modes.
 *
 *   "download" runs the SYS.TRANSFER sequence: a GPU particle field
 *   assembles the document while a HUD counts the transfer up. The real
 *   browser download fires at ~85% so the save dialog and the animation
 *   land together, then the overlay dissolves itself.
 *
 *   "preview" embeds the PDF full-screen with the contact links beside
 *   it — including the GitHub and LinkedIn links, which are plain text in
 *   the PDF itself and therefore not clickable there.
 *
 * Reduced motion / low-tier devices skip the WebGL field entirely and get
 * a short, honest progress readout instead.
 */
export function CvOverlay({ mode, onClose }: { mode: CvMode | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const { tier, gpuTier, isMobile } = useDeviceCapabilities();

  const rootRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);

  // Uniform drivers for the WebGL field (refs so no React re-render per frame).
  const progressRef = useRef(0);
  const fadeRef = useRef(0);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  const heavyOk = !isMobile && tier !== "low" && gpuTier !== "low" && !prefersReduced();

  // ── Body scroll lock + focus management + Escape ─────────────────────
  useEffect(() => {
    if (!mode) return;
    lastFocused.current = document.activeElement;
    const { body } = document;

    // Position-fixed lock, NOT `overflow: hidden`. The page scrolls on the
    // body here, so simply hiding overflow drops the scroll offset and the
    // reader is dumped back at the hero when the overlay closes. Pinning the
    // body at a negative top preserves the exact position to restore.
    const scrollY = window.scrollY;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };
    body.style.position = "fixed";
    body.style.top = `${-scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    // Yield the GPU: the ambient scene canvas is always running, and this
    // overlay mounts a second heavy one. Same contract the hero and showcase
    // already use — `__bgPause` is mirrored because _Scene reads it on mount.
    const setBgPause = (paused: boolean) => {
      (window as unknown as { __bgPause?: boolean }).__bgPause = paused;
      window.dispatchEvent(
        new CustomEvent("portfolio:bg-pause", { detail: paused })
      );
    };
    setBgPause(true);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 60);

    return () => {
      setBgPause(false);
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.paddingRight = prev.paddingRight;
      // Restore synchronously, before focus moves, so nothing scrolls twice.
      window.scrollTo(0, scrollY);
      (lastFocused.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [mode, onClose]);

  // ── The transfer sequence ────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "download") return;
    let cancelled = false;
    let tl: gsap.core.Timeline | null = null;
    let fired = false;

    const boot = async () => {
      await registerAll();
      if (cancelled) return;

      const reduced = prefersReduced();
      const CIRC = 2 * Math.PI * 52;

      // Reduced motion: no theatre. Download now, close promptly.
      if (reduced) {
        if (pctRef.current) pctRef.current.textContent = "100";
        if (ringRef.current) {
          ringRef.current.style.strokeDasharray = `${CIRC}`;
          ringRef.current.style.strokeDashoffset = "0";
        }
        if (logRef.current) {
          logRef.current.innerHTML = LOG_LINES.map(
            (l) => `<div>${l.text}</div>`
          ).join("");
        }
        triggerDownload();
        const id = window.setTimeout(onClose, 900);
        return () => window.clearTimeout(id);
      }

      const state = { p: 0 };
      const shown = new Set<number>();

      tl = gsap.timeline({
        onComplete: () => {
          if (!cancelled) window.setTimeout(onClose, 620);
        },
      });

      // Overlay + field fade in.
      if (rootRef.current) {
        tl.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.34, ease: "power2.out" }, 0);
      }
      tl.to(fadeRef, { current: 1, duration: 0.5, ease: "power2.out" }, 0.05);

      // The transfer itself — deliberately not linear: a fast open, a
      // hold while "verifying", then the final run to 100.
      tl.to(
        state,
        {
          p: 1,
          duration: 2.9,
          ease: "power2.inOut",
          onUpdate: () => {
            const p = state.p;
            progressRef.current = p;
            if (pctRef.current) pctRef.current.textContent = String(Math.round(p * 100));
            if (ringRef.current) {
              ringRef.current.style.strokeDasharray = `${CIRC}`;
              ringRef.current.style.strokeDashoffset = `${CIRC * (1 - p)}`;
            }
            // Append log lines as their thresholds pass.
            LOG_LINES.forEach((l, i) => {
              if (p >= l.at && !shown.has(i) && logRef.current) {
                shown.add(i);
                const row = document.createElement("div");
                row.textContent = l.text;
                row.style.opacity = "0";
                logRef.current.appendChild(row);
                gsap.to(row, { opacity: 1, duration: 0.25, ease: "power1.out" });
                logRef.current.scrollTop = logRef.current.scrollHeight;
              }
            });
            // Hand off to the browser before the animation ends, so the
            // save starts while the page is still assembling.
            if (!fired && p >= 0.85) {
              fired = true;
              triggerDownload();
            }
          },
        },
        0.2
      );

      // "COMPLETE" stamp punches in at the end.
      if (stampRef.current) {
        tl.fromTo(
          stampRef.current,
          { opacity: 0, scale: 0.82, filter: "blur(6px)" },
          { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "back.out(2.2)" },
          "-=0.35"
        );
      }

      // Dissolve.
      tl.to(fadeRef, { current: 0, duration: 0.45, ease: "power2.in" }, "+=0.25");
      if (rootRef.current) {
        tl.to(rootRef.current, { opacity: 0, duration: 0.4, ease: "power2.in" }, "<");
      }
    };

    void boot();
    return () => {
      cancelled = true;
      tl?.kill();
      // Safety net: never leave the user without the file they asked for.
      if (!fired) triggerDownload();
    };
  }, [mode, onClose]);

  if (!mounted || !mode) return null;

  const overlay =
    mode === "download" ? (
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Downloading CV"
        className="fixed inset-0 z-[120] overflow-hidden"
        style={{ background: "rgba(5,7,12,0.975)", backdropFilter: "blur(4px)" }}
      >
        {/* GPU particle field — the document assembling. */}
        {heavyOk ? (
          <div aria-hidden className="absolute inset-0">
            <CvTransferCanvas progressRef={progressRef} fadeRef={fadeRef} accent={AMBER} />
          </div>
        ) : null}

        {/* Ambient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              `radial-gradient(60% 50% at 50% 42%, ${AMBER}1f, transparent 70%),` +
              `radial-gradient(40% 40% at 20% 80%, ${CYAN}14, transparent 70%)`,
          }}
        />

        {/* HUD. The particle page owns the CENTRE of the screen, so the
            readout is anchored to the edges — a label rail up top and a
            transfer bar along the bottom. Overlapping the two made both
            unreadable. */}
        <div className="pointer-events-none relative z-10 flex h-full w-full flex-col justify-between p-6 md:p-10">
          {/* top rail */}
          <div className="flex items-start justify-between">
            <span
              className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.4em]"
              style={{ color: AMBER }}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: AMBER, boxShadow: `0 0 8px ${AMBER}` }}
              />
              SYS.TRANSFER
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="pointer-events-auto rounded-full border px-5 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/55 transition-colors hover:text-white"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              skip
            </button>
          </div>

          {/* bottom transfer bar */}
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
            {/* log */}
            <div className="min-w-0 flex-1">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
                {profile.cvFileName}
              </p>
              <div
                ref={logRef}
                aria-live="polite"
                className="h-[104px] overflow-hidden text-left font-mono text-[11.5px] leading-[1.85]"
                style={{ color: GREEN, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
              />
            </div>

            {/* ring + stamp */}
            <div className="flex shrink-0 items-center gap-5">
              <div
                ref={stampRef}
                className="hidden rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.3em] md:block"
                style={{
                  color: GREEN,
                  opacity: 0,
                  borderColor: `${GREEN}55`,
                  background: `${GREEN}14`,
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
              >
                ✓ complete
              </div>
              <div className="relative h-[108px] w-[108px]">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                  <circle
                    ref={ringRef}
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={AMBER}
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${AMBER})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="font-grotesk tabular-nums text-[2.1rem] leading-none text-white"
                    style={{ fontWeight: 800, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}
                  >
                    <span ref={pctRef}>0</span>
                    <span className="ml-0.5 align-top text-[0.85rem]" style={{ color: AMBER }}>
                      %
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <PreviewPanel onClose={onClose} closeBtnRef={closeBtnRef} />
    );

  return createPortal(overlay, document.body);
}

/** Full-screen PDF preview with the links the PDF itself can't carry. */
function PreviewPanel({
  onClose,
  closeBtnRef,
}: {
  onClose: () => void;
  closeBtnRef: React.RefObject<HTMLButtonElement>;
}) {
  const links = [
    { label: "GitHub", value: "Pradipta-Bitpastel", href: profile.socials.github, external: true },
    { label: "LinkedIn", value: "in/pradiptakumarjana", href: profile.socials.linkedin, external: true },
    { label: "Email", value: profile.socials.email, href: `mailto:${profile.socials.email}`, external: false },
    { label: "Phone", value: profile.socials.phone, href: `tel:${profile.socials.phone.replace(/\s+/g, "")}`, external: false },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="CV preview"
      className="fixed inset-0 z-[120] flex flex-col"
      style={{ background: "rgba(6,8,14,0.96)", backdropFilter: "blur(6px)" }}
    >
      {/* header */}
      <div
        className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 md:px-8"
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: AMBER, boxShadow: `0 0 8px ${AMBER}` }}
          />
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.28em] text-white/80">
            {profile.cvFileName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={profile.cvPath}
            download={profile.cvFileName}
            className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-opacity hover:opacity-90"
            style={{ background: AMBER, color: "#1a0e04" }}
          >
            Download
          </a>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/70 transition-colors hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.22)" }}
          >
            Close
          </button>
        </div>
      </div>

      {/* body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <object
          data={`${profile.cvPath}#view=FitH`}
          type="application/pdf"
          className="min-h-0 w-full flex-1"
          aria-label="CV document"
        >
          {/* Shown when the browser has no inline PDF viewer (most mobile). */}
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/70">
              Inline preview isn&apos;t supported in this browser.
            </p>
            <a
              href={profile.cvPath}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-6 py-3 font-mono text-[11px] uppercase tracking-[0.24em]"
              style={{ background: AMBER, color: "#1a0e04" }}
            >
              Open the PDF ↗
            </a>
          </div>
        </object>

        {/* Links rail — the PDF prints these as plain text, so this is the
            only place a reader can actually click through to them. */}
        <aside
          className="shrink-0 border-t px-5 py-5 lg:w-[300px] lg:border-l lg:border-t-0 lg:py-8"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
            Links
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 lg:grid-cols-1 lg:gap-x-0">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  target={l.external ? "_blank" : undefined}
                  rel={l.external ? "noreferrer noopener" : undefined}
                  className="group flex flex-col gap-0.5 border-b py-3 transition-colors"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-white/40">
                    {l.label}
                  </span>
                  <span className="flex items-center gap-1.5 truncate font-mono text-[12px] text-white/85 transition-colors group-hover:text-[--hov]"
                        style={{ ["--hov" as string]: AMBER }}>
                    <span className="truncate">{l.value}</span>
                    {l.external ? (
                      <span aria-hidden className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        ↗
                      </span>
                    ) : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-6 font-mono text-[10px] leading-[1.8] tracking-[0.06em] text-white/40">
            {profile.availability}
          </p>
        </aside>
      </div>
    </div>
  );
}

export default CvOverlay;
