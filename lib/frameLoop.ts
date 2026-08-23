"use client";

/**
 * One requestAnimationFrame for every scroll-driven DOM effect on the page.
 *
 * The site grew four independent rAF loops — the hero parallax, the ridge
 * backdrop, the celestial sky and the telemetry scope — each of which read
 * `window.scrollY` and then wrote inline transforms. Interleaved, that is a
 * read-after-write per loop per frame: the second loop's `scrollY` read has
 * to flush the first loop's pending style invalidation, and so on down the
 * chain. Four callbacks, four potential style recalcs, one frame.
 *
 * This ticker does the reads ONCE at the top of the frame, hands every
 * subscriber the same immutable snapshot, and lets them write. Reads and
 * writes stay in separate phases, which is the whole point.
 *
 * It also owns pointer damping, which two of those loops were each doing
 * separately with their own listener.
 */

export interface FrameState {
  /** Seconds since the previous frame, clamped so a tab-switch can't jump. */
  readonly dt: number;
  /** Seconds since the loop started. */
  readonly time: number;
  /** `window.scrollY`, read once per frame. */
  readonly scrollY: number;
  /** Viewport height, refreshed on resize only. */
  readonly vh: number;
  /** Viewport width, refreshed on resize only. */
  readonly vw: number;
  /** Damped pointer, -1..1 from the viewport centre. */
  readonly px: number;
  readonly py: number;
}

type Subscriber = (state: FrameState) => void;

const subscribers = new Set<Subscriber>();

const state = {
  dt: 0,
  time: 0,
  scrollY: 0,
  vh: 0,
  vw: 0,
  px: 0,
  py: 0,
};

let raf = 0;
let last = 0;
let hidden = false;
let targetX = 0;
let targetY = 0;
let listening = false;

function measure() {
  state.vh = window.innerHeight;
  state.vw = window.innerWidth;
}

function onPointerMove(e: PointerEvent) {
  targetX = (e.clientX / window.innerWidth) * 2 - 1;
  targetY = (e.clientY / window.innerHeight) * 2 - 1;
}

function onVisibility() {
  hidden = document.hidden;
  if (!hidden && subscribers.size > 0 && !raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

function tick(now: number) {
  raf = 0;

  // ── READ PHASE ────────────────────────────────────────────────────
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  state.dt = dt;
  state.time += dt;
  state.scrollY = window.scrollY || 0;

  // Frame-rate independent damping toward the live pointer.
  const k = 1 - Math.pow(0.0006, dt);
  state.px += (targetX - state.px) * k;
  state.py += (targetY - state.py) * k;

  // ── WRITE PHASE ───────────────────────────────────────────────────
  for (const fn of subscribers) {
    try {
      fn(state);
    } catch {
      /* one broken effect must not stop the whole page's animation */
    }
  }

  if (!hidden && subscribers.size > 0) raf = requestAnimationFrame(tick);
}

function start() {
  if (!listening) {
    listening = true;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (!raf && !hidden) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

function stop() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if (listening) {
    listening = false;
    window.removeEventListener("resize", measure);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("visibilitychange", onVisibility);
  }
}

/**
 * Register a per-frame callback. Returns its unsubscribe function; the loop
 * shuts down entirely once the last subscriber leaves, so an off-screen page
 * costs nothing.
 */
export function onFrame(fn: Subscriber): () => void {
  if (typeof window === "undefined") return () => {};
  subscribers.add(fn);
  start();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) stop();
  };
}

/** Current frame snapshot, for code that needs a value outside the loop. */
export function frameState(): FrameState {
  return state;
}

export default onFrame;
