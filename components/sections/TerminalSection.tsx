"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useGsapSection } from "@/lib/useGsapSection";
import { sceneStore } from "@/lib/sceneStore";
import { useDeviceCapabilities } from "@/lib/usePerfTier";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { skills, MODULE_ORDER } from "@/content/skills";

const ShellCanvas = dynamic(
  () => import("@/components/three/ShellCanvas").then((m) => m.ShellCanvas),
  { ssr: false, loading: () => null }
);

/**
 * SYS.SHELL — the signature interactive section, now a scroll-driven boot.
 *
 * The band is a TALL section with a CSS-sticky stage (the same no-GSAP-pin
 * pattern SYS.METRICS uses), so scrolling through it does three things at
 * once:
 *
 *   1. The console flies in through real 3D — it starts pitched back on the
 *      Z axis and lands flat — while a DrawSVG outline traces its frame and
 *      a CRT power-on collapses the body open.
 *   2. Scroll TYPES the boot log. Each line is a monospace `ch`-width cell
 *      driven by a stepped ease, so characters land whole, one at a time,
 *      exactly in step with the wheel. Scroll back and the machine un-boots.
 *   3. A WebGL floor + data-rain backdrop spins up behind the glass, its
 *      speed riding the scroll velocity.
 *
 * The moment the visitor touches the console (focus, keypress, chip) the
 * boot fast-forwards to complete and the shell hands over: the boot log
 * stays as scrollback and typed commands append beneath it. Command
 * handling — `help · about · stack · projects · contact · whoami · clear`,
 * arrow-key history, the `sudo deploy` easter egg — is unchanged.
 *
 * Degradation: reduced motion and low-tier devices get the finished boot
 * instantly, no canvas, and the section collapses to a single viewport
 * (see the media queries at the foot of this file).
 *
 * Not one of the six canonical scroll sections — it's an interstitial
 * showcase band between BOOT and INIT, so the section nav/HUD ignore it.
 */

type Line = { kind: "in" | "out" | "sys" | "err"; text: string };

/** Hand the ambient robot back to its unmodified pose curve. */
function resetTraveler() {
  sceneStore.travelerOffset.x = 0;
  sceneStore.travelerOffset.y = 0;
  sceneStore.travelerOffset.z = 0;
}

const USER = "core";
const HOST = "portfolio";

const stackLines = MODULE_ORDER.map((id) => {
  const m = skills[id];
  return `${m.label.toLowerCase().padEnd(9)} ${m.items.slice(0, 4).join(" · ")}`;
});

const projectLines = projects.map(
  (p, i) => `${String(i + 1).padStart(2, "0")} ${p.name}`
);

const STATIC: Record<string, string[]> = {
  help: [
    "available commands —",
    "  about      operator dossier",
    "  stack      capability modules",
    "  projects   jump to execution log",
    "  contact    open comms channels",
    "  whoami     identity",
    "  clear      wipe scrollback",
    "(psst — try 'sudo deploy')",
  ],
  about: [
    `${profile.name} — ${profile.role.toLowerCase()}.`,
    "3+ yrs shipping web, mobile & cloud.",
    profile.location.replace(" — ", " · "),
  ],
  stack: stackLines,
  whoami: [profile.name.toLowerCase().replace(/\s+/g, "-")],
  ls: ["about  stack  projects  contact"],
};

/** Quick-run chips — one tap runs the command, same path as typing it. */
const QUICK = ["about", "stack", "projects", "contact", "clear"] as const;

/**
 * The scroll-typed cold boot. `k` picks the row's colour role; the text is
 * padded with dot leaders so the status column lines up like a real POST.
 */
type BootKind = "head" | "sys" | "ok" | "warn";
type BootLine = { k: BootKind; t: string };

const BOOT: readonly BootLine[] = [
  // KEEP EVERY LINE UNDER ~32 CHARACTERS.
  //
  // Each row is `white-space: pre` inside a `ch`-width cell — that is what
  // makes the typing land on whole glyphs — which also means a line cannot
  // wrap. The original rows ran to 57 characters and were simply cut off the
  // right edge of a phone. Measure before adding one: 32ch at the mobile
  // 11px mono is ~205px inside a ~318px console.
  { k: "head", t: "dev.os 3.1.4 — cold boot" },
  { k: "sys", t: "power-on self test ... pass" },
  { k: "ok", t: "mount /dev/core ...... ok" },
  { k: "ok", t: "frontend .. react · next · ts" },
  { k: "ok", t: "backend ... node · django" },
  { k: "ok", t: "devops .... docker · nginx" },
  { k: "ok", t: "cloud ..... azure · gcp" },
  { k: "ok", t: "mobile .... react native · expo" },
  { k: "sys", t: "uplink kolkata:in .... 24ms" },
  { k: "warn", t: "operator ... OPEN FOR WORK" },
  { k: "ok", t: "control surface ...... online" },
  { k: "sys", t: "type 'help' — prompt is live" },
];

/** Per-kind text colour, matched to the console's accent roles. */
const BOOT_CLASS: Record<BootKind, string> = {
  head: "text-ink",
  sys: "shell-sys text-cyan",
  ok: "text-ink/75",
  warn: "text-amber",
};

export function TerminalSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [canvasActive, setCanvasActive] = useState(false);

  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number>(-1);

  // Section scroll progress, read every frame by the WebGL backdrop. A ref
  // (not state) so the shader never costs a React render.
  const progressRef = useRef(0);

  // The boot timeline + a snapshot of "show the finished boot", so a visitor
  // touching the console can fast-forward it from outside the GSAP context.
  const bootTlRef = useRef<gsap.core.Timeline | null>(null);
  const settleRef = useRef<(() => void) | null>(null);
  const tookOverRef = useRef(false);

  const { webglBudget } = useDeviceCapabilities();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  // The floor-and-rain backdrop is pure decoration behind an opaque console,
  // so it is the first thing to drop when the budget tightens. On phones the
  // GPU is better spent on the portrait resolve and the showcase model.
  const canUseGl = webglBudget === "full" && !reduced;

  /**
   * Hand the console over to the visitor. Called on the first focus,
   * keypress or chip tap: the boot stops being scroll-driven, snaps to its
   * finished state, and the typed log becomes ordinary scrollback.
   */
  const takeOver = useCallback(() => {
    if (tookOverRef.current) return;
    tookOverRef.current = true;
    const tl = bootTlRef.current;
    tl?.scrollTrigger?.kill();
    tl?.kill();
    settleRef.current?.();
  }, []);

  // Only render backdrop frames while the band is actually on screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // The band is 250vh tall, so a generous rootMargin kept this canvas
    // rendering while the HERO was still on screen — two full-viewport WebGL
    // surfaces plus seven parallax layers, all compositing at once. Shrinking
    // the root means it only spins up once the console actually owns the
    // middle of the viewport.
    const io = new IntersectionObserver(
      ([e]) => setCanvasActive(e.isIntersecting),
      { rootMargin: "-25% 0px -25% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── The scroll-driven boot ─────────────────────────────────────────
  useGsapSection(
    rootRef,
    ({ root, reduced: reducedMotion, onCleanup }) => {
      const win = root.querySelector<HTMLElement>("[data-window]");
      const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-boot-row]"));
      // Measured BEFORE the rows are collapsed. Every boot row is a single
      // line, so one measurement covers all of them.
      const rowH = rows[0]?.getBoundingClientRect().height ?? 0;
      const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-type]"));
      const carets = Array.from(root.querySelectorAll<HTMLElement>("[data-caret]"));
      const chips = Array.from(root.querySelectorAll<HTMLElement>("[data-chip]"));
      const chrome = Array.from(root.querySelectorAll<HTMLElement>("[data-chrome]"));
      if (!win) return;

      /** The console, fully booted. Also the reduced-motion end state. */
      const settle = () => {
        for (const cell of cells) cell.style.width = `${cell.dataset.type ?? 0}ch`;
        gsap.set(rows, { opacity: 1, clearProps: "height,overflow" });
        gsap.set(carets, { opacity: 0 });
        gsap.set(chips, { opacity: 1, y: 0 });
        gsap.set(chrome, { opacity: 1, y: 0 });
        gsap.set(win, {
          opacity: 1, rotateX: 0, z: 0, y: 0, scale: 1, clearProps: "transform",
        });
      };
      settleRef.current = settle;
      onCleanup(() => {
        settleRef.current = null;
        bootTlRef.current = null;
      });

      // Backdrop progress lives on its own trigger so it keeps feeding the
      // shader after a visitor takes the console over and the boot timeline
      // (and its ScrollTrigger) is killed. The same trigger walks the
      // ambient robot out to the right margin: SYS.SHELL is not one of the
      // six pose waypoints, so the blend between BOOT and INIT parks it dead
      // centre — straight through the boot log. `sin(pi * p)` eases it out
      // and back, and the render loop damps the rest.
      ScrollTrigger.create({
        trigger: sectionRef.current!,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const k = Math.sin(Math.PI * self.progress);
          sceneStore.travelerOffset.x = k * 4.2;
          sceneStore.travelerOffset.y = k * 1.1;
        },
        onLeave: () => resetTraveler(),
        onLeaveBack: () => resetTraveler(),
      });
      onCleanup(resetTraveler);

      if (reducedMotion) {
        settle();
        return;
      }

      // Height 0, not just opacity 0. A hidden-but-laid-out row still
      // occupies its line, so all twelve reserved space from the start and
      // the prompt sat marooned at the bottom of the console with a dead gap
      // above it. Collapsing them makes the prompt ride directly under the
      // last line that has actually been typed, the way a real shell does.
      gsap.set(rows, { opacity: 0, height: 0, overflow: "hidden" });
      gsap.set(carets, { opacity: 0 });
      gsap.set(chips, { opacity: 0, y: 14 });
      gsap.set(chrome, { opacity: 0, y: 10 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current!,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
      });
      bootTlRef.current = tl;

      // ── 1. the console lands ─────────────────────────────────────
      tl.fromTo(
        win,
        { rotateX: 24, z: -460, y: 96, scale: 0.93, opacity: 0 },
        { rotateX: 0, z: 0, y: 0, scale: 1, opacity: 1, duration: 1.4, ease: "power3.out" },
        0
      )
        .fromTo(
          "[data-frame]",
          { drawSVG: "50% 50%" },
          { drawSVG: "0% 100%", duration: 1.5, ease: "power2.inOut" },
          0.12
        )
        // CRT power-on: the body snaps open from a single scanline.
        .fromTo(
          "[data-crt]",
          { scaleY: 0.012, opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 0.8, ease: "power4.out" },
          0.5
        )
        // specular sweep across the glass as it settles
        .fromTo(
          "[data-sweep]",
          { xPercent: -140, opacity: 0 },
          { xPercent: 140, opacity: 1, duration: 1.3, ease: "power2.inOut" },
          0.35
        )
        .to("[data-sweep]", { opacity: 0, duration: 0.3 }, 1.35)
        .to(chrome, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, 0.95)
        .to(chips, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 }, 1.05);

      // ── 2. scroll types the boot log ─────────────────────────────
      let at = 1.5;
      rows.forEach((row, i) => {
        const cell = cells[i];
        const caret = carets[i];
        const n = Number(cell?.dataset.type ?? 0);
        if (!cell || !n) return;
        // Long lines take longer to type, but not linearly — a flat rate
        // would make the 40-char rows drag the whole sequence.
        const dur = 0.14 + n * 0.015;
        tl.to(row, { opacity: 1, height: rowH, duration: 0.12, ease: "none" }, at)
          .to(caret, { opacity: 1, duration: 0.01 }, at)
          .fromTo(
            cell,
            { width: "0ch" },
            { width: `${n}ch`, duration: dur, ease: `steps(${n})` },
            at
          )
          .to(caret, { opacity: 0, duration: 0.01 }, at + dur);
        // A beat between lines, longer after the header and before the last.
        at += dur + (i === 0 ? 0.22 : 0.1);
      });

      // ── 3. hold on the booted console before the band releases ───
      tl.to({}, { duration: 1.6 }, at);
    },
    []
  );

  // Keep the log scrolled to the newest line, like a native terminal.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [lines]);

  const run = useCallback(
    (raw: string) => {
      const cmd = raw.trim().toLowerCase();
      if (!cmd) return;
      takeOver();

      // Record into history (most-recent-last); reset the cursor.
      historyRef.current = [...historyRef.current, raw.trim()];
      histIdxRef.current = -1;

      if (cmd === "clear") {
        setLines([]);
        return;
      }

      const echo: Line = { kind: "in", text: raw };

      // Action commands.
      if (cmd === "projects") {
        setLines((h) => [
          ...h,
          echo,
          ...projectLines.map((t) => ({ kind: "out" as const, text: t })),
          { kind: "sys", text: "→ jumping to SYS.EXECUTION…" },
        ]);
        const target = document.getElementById("projects");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (cmd === "contact") {
        setLines((h) => [
          ...h,
          echo,
          { kind: "out", text: `mail   ${profile.socials.email}` },
          { kind: "out", text: `github ${profile.socials.github.replace("https://", "")}` },
          { kind: "out", text: `in     ${profile.socials.linkedin.replace("https://www.", "")}` },
          { kind: "sys", text: "→ opening mail client…" },
        ]);
        window.location.href = `mailto:${profile.socials.email}`;
        return;
      }

      if (cmd === "sudo deploy") {
        setLines((h) => [
          ...h,
          echo,
          { kind: "out", text: "deploying core … ████████████ 100%" },
          { kind: "sys", text: "✓ signal locked. you found the easter egg." },
        ]);
        return;
      }

      const out = STATIC[cmd];
      setLines((h) => [
        ...h,
        echo,
        ...(out
          ? out.map((t) => ({ kind: "out" as const, text: t }))
          : [
              { kind: "err" as const, text: `command not found: ${cmd}` },
              { kind: "out" as const, text: "type 'help' for the command list" },
            ]),
      ]);
    },
    [takeOver]
  );

  // Submit current draft and clear the field.
  const submit = useCallback(() => {
    run(draft);
    setDraft("");
  }, [draft, run]);

  // Run a quick-run chip command and keep the keyboard focus.
  const runChip = useCallback(
    (c: string) => {
      run(c);
      setDraft("");
      inputRef.current?.focus();
    },
    [run]
  );

  // Arrow-key command history recall.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        submit();
        return;
      }
      const hist = historyRef.current;
      if (e.key === "ArrowUp") {
        if (!hist.length) return;
        e.preventDefault();
        histIdxRef.current =
          histIdxRef.current < 0 ? hist.length - 1 : Math.max(0, histIdxRef.current - 1);
        setDraft(hist[histIdxRef.current] ?? "");
      } else if (e.key === "ArrowDown") {
        if (!hist.length) return;
        e.preventDefault();
        if (histIdxRef.current < 0) return;
        histIdxRef.current = histIdxRef.current + 1;
        if (histIdxRef.current >= hist.length) {
          histIdxRef.current = -1;
          setDraft("");
        } else {
          setDraft(hist[histIdxRef.current] ?? "");
        }
      }
    },
    [submit]
  );

  return (
    <section
      id="shell"
      ref={sectionRef}
      aria-labelledby="shell-title"
      className="shell-band relative w-full min-h-[250vh]"
    >
      {/* Sticky stage — CSS-pinned while the tall band scrolls past it, the
          same no-GSAP-pin pattern SYS.METRICS uses. overflow-hidden is
          contained HERE so the 3D entrance never leaks past the frame. */}
      <div className="sticky top-0 flex h-[100svh] w-full items-center overflow-hidden px-[clamp(20px,5vw,96px)] pb-[clamp(24px,4vh,96px)] pt-[var(--hud-inset)]">
        {/* WebGL floor + data rain. Desktop / high-tier only; parked
            (frameloop:'never') whenever the band is off screen. */}
        {canUseGl && (
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
            <ShellCanvas active={canvasActive} progressRef={progressRef} />
          </div>
        )}

        {/* local atmosphere: cyan wash so the surface reads as a lit console */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div
            className="absolute left-1/2 top-1/2 h-[60vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07] blur-[140px]"
            style={{ background: "var(--cyan)" }}
          />
        </div>

        <div ref={rootRef} className="shell-root stage-3d relative mx-auto w-full max-w-3xl">
          <h2 id="shell-title" className="sr-only">
            Interactive command terminal
          </h2>

          {/* Kicker */}
          <div
            data-chrome
            className="mb-5 flex items-end justify-between gap-4 border-t border-line pt-3 font-mono"
          >
            <span className="shell-acc-cyan flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-cyan">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan"
                style={{ boxShadow: "0 0 10px var(--cyan)" }}
              />
              SYS.SHELL // command surface
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.28em] text-ink-dim sm:inline">
              from a single command surface
            </span>
          </div>

          {/* Terminal window — the element GSAP flies in through 3D. */}
          <div
            data-window
            onClick={() => {
              takeOver();
              inputRef.current?.focus();
            }}
            className="shell-window layer-3d group relative cursor-text overflow-hidden rounded-2xl border border-line font-mono"
          >
            {/* DrawSVG outline that traces the window as it lands. Sized by
                the box (preserveAspectRatio none) with a non-scaling stroke,
                so one rect fits every viewport. */}
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 z-30 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <rect
                data-frame
                x="0.5"
                y="0.5"
                width="99"
                height="99"
                rx="2"
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="1"
                strokeOpacity="0.55"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Specular sweep riding the landing. */}
            <div
              aria-hidden
              data-sweep
              className="pointer-events-none absolute inset-y-0 -left-1/3 z-20 w-1/3 opacity-0"
              style={{
                background:
                  "linear-gradient(100deg, transparent, rgba(0,212,255,0.16) 45%, rgba(255,255,255,0.10) 55%, transparent)",
              }}
            />

            {/* Scanline + grain overlay (decorative, non-interactive). */}
            <div
              aria-hidden
              className="shell-scan pointer-events-none absolute inset-0 z-20 opacity-[0.35] mix-blend-soft-light"
            />
            {/* Top edge cyan glow line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(0,212,255,0.7), transparent)",
              }}
            />

            {/* Title bar */}
            <div className="shell-titlebar relative z-10 flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                {[
                  { c: "#ff5f57", g: "rgba(255,95,87,0.7)" },
                  { c: "#febc2e", g: "rgba(254,188,46,0.7)" },
                  { c: "#28c840", g: "rgba(40,200,64,0.7)" },
                ].map((d) => (
                  <span
                    key={d.c}
                    className="h-3 w-3 rounded-full"
                    style={{ background: d.c, boxShadow: `0 0 8px ${d.g}` }}
                  />
                ))}
              </div>
              <span className="mx-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-ink-dim">
                <span className="shell-acc-cyan text-cyan">●</span>
                {USER}@{HOST} — bash
              </span>
              <span
                className="shell-badge hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.24em] text-green sm:inline-flex"
                style={{
                  borderColor: "rgba(57,255,165,0.25)",
                  background: "rgba(57,255,165,0.06)",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-green"
                  style={{ boxShadow: "0 0 8px var(--green)" }}
                />
                connected
              </span>
            </div>

            {/* Body — `data-crt` is the element that snaps open from a
                single scanline when the console powers on. */}
            <div
              data-crt
              className="relative z-10 origin-center px-3.5 pb-4 pt-4 text-[11px] leading-[1.7] sm:px-6 sm:pb-5 sm:text-[13px]"
            >
              {/* Scrollback: the scroll-typed boot log, then live output. */}
              <div
                ref={scrollRef}
                className="terminal-scroll h-[38svh] space-y-0.5 overflow-x-hidden overflow-y-auto pr-1 sm:h-[42vh]"
              >
                {BOOT.map((b) => (
                  <div
                    key={b.t}
                    data-boot-row
                    className={`flex items-baseline gap-2 whitespace-pre ${BOOT_CLASS[b.k]}`}
                  >
                    <span aria-hidden className="select-none text-cyan/35">
                      {b.k === "head" ? "#" : "›"}
                    </span>
                    {/* `data-type` carries the character count; GSAP animates
                        the cell's width in `ch` with a stepped ease so whole
                        glyphs land one at a time. */}
                    <span data-type={b.t.length} className="type-cell">
                      {b.t}
                    </span>
                    <span
                      aria-hidden
                      data-caret
                      className="inline-block h-[1.05em] w-[0.55em] translate-y-[0.14em] bg-cyan opacity-0"
                      style={{ boxShadow: "0 0 8px rgba(0,212,255,0.7)" }}
                    />
                  </div>
                ))}

                {lines.map((line, i) => (
                  <Row key={i} line={line} />
                ))}

                {/* Live input row */}
                <div className="flex items-baseline gap-2 pt-1.5">
                  <PromptLabel />
                  <div className="relative flex-1">
                    {/* The real input is transparent-text; we render the
                        typed value + a blinking block caret on top so the
                        caret matches the terminal aesthetic. */}
                    <input
                      ref={inputRef}
                      type="text"
                      value={draft}
                      onChange={(e) => {
                        takeOver();
                        setDraft(e.target.value);
                      }}
                      onFocus={() => {
                        takeOver();
                        setFocused(true);
                      }}
                      onBlur={() => setFocused(false)}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="Terminal command input"
                      onKeyDown={onKeyDown}
                      className="shell-input w-full bg-transparent text-transparent caret-transparent outline-none"
                      style={{ caretColor: "transparent" }}
                    />
                    {/* Visible overlay text + caret */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 flex items-center whitespace-pre text-ink"
                    >
                      <span>{draft}</span>
                      <span
                        className="ml-px inline-block h-[1.05em] w-[0.55em] translate-y-[0.1em] bg-cyan"
                        style={{
                          boxShadow: "0 0 8px rgba(0,212,255,0.7)",
                          animation: focused
                            ? "none"
                            : "shell-blink 1.05s steps(1) infinite",
                          opacity: focused ? 1 : undefined,
                        }}
                      />
                    </div>
                  </div>
                  <kbd className="hidden shrink-0 select-none rounded border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-ink-dim sm:inline-block">
                    ⏎ run
                  </kbd>
                </div>
              </div>
            </div>

            {/* Status footer */}
            <div className="shell-footer relative z-10 flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[9.5px] uppercase tracking-[0.2em] text-ink-dim sm:px-6">
              <span className="flex items-center gap-3">
                <span>
                  ln{" "}
                  <b className="text-ink/80">
                    {String(BOOT.length + lines.length).padStart(2, "0")}
                  </b>
                </span>
                <span className="hidden sm:inline">utf-8</span>
                <span className="hidden sm:inline">/bin/bash</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="shell-acc-cyan text-cyan">↑↓</span> history
                <span className="text-ink-dim/60">·</span>
                <span className="shell-acc-cyan text-cyan">⏎</span> exec
              </span>
            </div>
          </div>

          {/* Quick-run chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {QUICK.map((c) => (
              <button
                key={c}
                data-chip
                type="button"
                onClick={() => runChip(c)}
                className="group/chip rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] lowercase tracking-[0.06em] text-ink-dim transition-colors duration-200 hover:border-cyan/50 hover:text-cyan"
              >
                <span className="text-cyan/60 transition-colors group-hover/chip:text-cyan">
                  $
                </span>{" "}
                {c}
              </button>
            ))}
          </div>

          <p
            data-chrome
            className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-dim"
          >
            tip: scroll to boot · type a command or tap a chip · arrows recall history
          </p>
        </div>
      </div>

      {/* Component-scoped keyframes + scrollbar styling (no globals.css edit). */}
      <style jsx>{`
        /* The scroll-typed boot needs runway. Reduced motion gets the
           finished console immediately, so the extra 150vh would be a
           pointless dead scroll — collapse the band to one viewport. */
        @media (prefers-reduced-motion: reduce) {
          .shell-band {
            min-height: 100svh;
          }
        }
        /* Phones type the same log over a shorter run so the band doesn't
           eat a third of the page's scroll on a small screen. */
        @media (max-width: 767px) {
          .shell-band {
            min-height: 155vh;
          }
        }
        /* Terminal-window surfaces — theme-aware via the <html data-theme>
           attribute so they flip in BOTH directions (CSS, not JS state).
           NIGHT values reproduce the original hardcoded console exactly. */
        /* The console is a nearly-opaque surface. It used to sit at 0.85,
           which let the ambient traveling robot walk straight through the
           boot log and eat characters. The "see through to the scene" feel
           now comes from the WebGL floor BEHIND the window instead, where
           it can't fight the type. */
        /* NO backdrop-filter here. The surface is ~96% opaque, so the blur
           contributed almost nothing visually while forcing the compositor to
           re-read and re-blur a full-width backdrop on every scrolled frame —
           one of the more expensive things a large element can do. */
        .shell-window {
          background: rgba(7, 10, 18, 0.955);
          box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.85),
            0 0 80px -10px rgba(0, 212, 255, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .shell-scan {
          background-image: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.05) 0px,
            rgba(255, 255, 255, 0.05) 1px,
            transparent 1px,
            transparent 3px
          );
        }
        .shell-titlebar {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.04),
            rgba(255, 255, 255, 0)
          );
        }
        .shell-footer {
          background: rgba(255, 255, 255, 0.015);
        }
        /* DAY is a warm DUSK, not a bright parchment — so the console keeps a
           DARK surface (a terminal reads as a terminal) and is merely warmed
           with a brown tint. It previously flipped to a near-white panel while
           the body text stayed on the light --ink token, which made the whole
           console unreadable in day mode. */
        :global(:root[data-theme="day"]) .shell-window {
          background: rgba(24, 18, 11, 0.96);
          box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.8),
            0 0 80px -10px rgba(255, 138, 60, 0.18),
            inset 0 1px 0 rgba(255, 241, 216, 0.07);
        }
        :global(:root[data-theme="day"]) .shell-scan {
          background-image: repeating-linear-gradient(
            to bottom,
            rgba(255, 241, 216, 0.05) 0px,
            rgba(255, 241, 216, 0.05) 1px,
            transparent 1px,
            transparent 3px
          );
        }
        :global(:root[data-theme="day"]) .shell-titlebar {
          background: linear-gradient(
            180deg,
            rgba(255, 241, 216, 0.05),
            rgba(255, 241, 216, 0)
          );
        }
        :global(:root[data-theme="day"]) .shell-footer {
          background: rgba(255, 241, 216, 0.02);
        }
        @keyframes shell-blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
        .terminal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .terminal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 255, 0.22);
          border-radius: 999px;
        }
        .terminal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 255, 0.4);
        }
        .terminal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 212, 255, 0.22) transparent;
        }
      `}</style>

      {/* DAY-mode accent contrast. The console accents (cyan/green) are very
          light hues that wash out on the parchment/white day surfaces, so on
          day we swap them for deeper variants of the SAME hue — the terminal
          identity is preserved, readability is restored. NIGHT is untouched.
          Global (not scoped) so it can reach the PromptLabel/Row subcomponents,
          but every selector is namespaced under .shell-root. */}
      <style jsx global>{`
        /* The site-wide :focus-visible ring (cyan outline + 4px radius) is
           great everywhere else, but on the terminal it drew a rounded cyan
           box around the command line. The blinking block caret already
           signals focus here, so suppress the generic ring on this field. */
        .shell-root .shell-input:focus,
        .shell-root .shell-input:focus-visible {
          outline: none;
          border-radius: 0;
        }
        /* Day keeps the DARK console surface (see .shell-window above), so the
           accents stay BRIGHT — merely warmed a step toward the amber day key
           so the console belongs to the dusk palette. The previous values here
           were deep/dark hues chosen for a white panel that no longer exists. */
        :root[data-theme="day"] .shell-root .shell-sys {
          color: #57d8f0;
        }
        :root[data-theme="day"] .shell-root .shell-acc-cyan {
          color: #57d8f0;
        }
        :root[data-theme="day"] .shell-root .shell-acc-green {
          color: #63e8ae;
        }
        :root[data-theme="day"] .shell-root .shell-acc-blue {
          color: #7fb6ff;
        }
        :root[data-theme="day"] .shell-root .shell-acc-purple {
          color: #c08cff;
        }
        :root[data-theme="day"] .shell-root .shell-badge {
          color: #63e8ae;
          border-color: rgba(99, 232, 174, 0.4) !important;
          background: rgba(99, 232, 174, 0.1) !important;
        }
      `}</style>
    </section>
  );
}

/** Color-coded prompt label (user@host:~$). */
function PromptLabel() {
  return (
    <span className="shrink-0 select-none whitespace-pre">
      <span className="shell-acc-green text-green">{USER}</span>
      <span className="text-ink-dim">@</span>
      <span className="shell-acc-blue text-blue">{HOST}</span>
      <span className="text-ink-dim">:</span>
      <span className="shell-acc-purple text-purple">~</span>
      <span className="shell-acc-cyan text-cyan">$</span>
    </span>
  );
}

/** A single scrollback row, styled per line kind. */
function Row({ line }: { line: Line }) {
  if (line.kind === "in") {
    return (
      <div className="flex items-baseline gap-2">
        <PromptLabel />
        <span className="text-ink">{line.text}</span>
      </div>
    );
  }
  if (line.kind === "sys") {
    return <div className="shell-sys text-cyan">{line.text}</div>;
  }
  if (line.kind === "err") {
    return (
      <div className="text-amber">
        <span className="opacity-60">✗ </span>
        {line.text}
      </div>
    );
  }
  return (
    <div className="flex gap-2 whitespace-pre-wrap text-ink/75">
      <span aria-hidden className="select-none text-cyan/35">
        ›
      </span>
      <span>{line.text}</span>
    </div>
  );
}

export default TerminalSection;
