"use client";

import { useEffect, type RefObject } from "react";
import { gsap, registerAll } from "@/lib/gsap";

/**
 * What a section's `build` callback receives.
 *
 * Everything a scroll-driven section needs is resolved BEFORE the callback
 * runs — plugins registered, root element present, motion preference and
 * device tier decided — so sections read as one flat timeline description
 * instead of eight lines of async boot boilerplate repeated per file.
 */
export interface SectionCtx {
  /** The section root (never null inside `build`). */
  root: HTMLElement;
  /** `prefers-reduced-motion: reduce` is on. */
  reduced: boolean;
  /** Coarse pointer / narrow viewport — skip pins and extra canvases. */
  isTouch: boolean;
  /**
   * Scoped `gsap.matchMedia()` for breakpoint-specific choreography.
   * Reverted automatically with the context.
   */
  mm: ReturnType<typeof gsap.matchMedia>;
  /** Register a teardown to run alongside the context revert. */
  onCleanup: (fn: () => void) => void;
}

/**
 * Boots one `gsap.context` per section.
 *
 * Every section on this site repeated the same dance: await `registerAll()`,
 * bail if unmounted, read `prefers-reduced-motion`, open a context scoped to
 * the root, and revert on cleanup. That boilerplate is here once. The
 * callback gets a live `SectionCtx` and can register extra teardown (canvas
 * loops, SplitText instances) through `onCleanup`.
 *
 * `build` is intentionally NOT in the dep array — pass a stable `deps` list
 * for anything the timeline actually reads.
 */
export function useGsapSection(
  rootRef: RefObject<HTMLElement | null>,
  build: (ctx: SectionCtx) => void,
  deps: unknown[] = []
): void {
  useEffect(() => {
    if (!rootRef.current) return;

    let cancelled = false;
    let ctx: ReturnType<typeof gsap.context> | null = null;
    const cleanups: Array<() => void> = [];

    const boot = async () => {
      await registerAll();
      const root = rootRef.current;
      if (cancelled || !root) return;

      const mq = (q: string) =>
        typeof window.matchMedia === "function" && window.matchMedia(q).matches;

      const reduced = mq("(prefers-reduced-motion: reduce)");
      const isTouch = mq("(hover: none)") || mq("(max-width: 767px)");

      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        cleanups.push(() => mm.revert());
        build({
          root,
          reduced,
          isTouch,
          mm,
          onCleanup: (fn) => cleanups.push(fn),
        });
      }, root);
    };

    void boot();

    return () => {
      cancelled = true;
      // Section teardown first (loops, splits), then the context revert —
      // reverting first would strip the elements a cleanup might touch.
      for (const fn of cleanups.splice(0)) {
        try {
          fn();
        } catch {
          /* a failed teardown must not block the rest */
        }
      }
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useGsapSection;
