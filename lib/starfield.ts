/**
 * Star fields for the celestial sky and the hero's painted sky.
 *
 * The stars themselves are tiny <span>s — a 1-3px dot rasterises to almost
 * nothing, and the compositor handles a hundred of them without noticing.
 * What DID cost was how they twinkled: the old rule animated
 *
 *     0%,100% { opacity: calc(var(--o, 0.6) * 0.35) }
 *
 * and an opacity keyframe whose value comes from a custom property cannot be
 * promoted to the compositor — the variable has to be resolved on the main
 * thread, every frame, for every star. 104 of those ran continuously on every
 * section of the site.
 *
 * The fix is not fewer stars, it is making the animation compositable:
 *
 *   1. Literal keyframe values, so nothing has to be resolved per frame.
 *   2. Per-star brightness baked into the star's COLOUR, not into a parent's
 *      opacity. A parent with `opacity < 1` groups its whole subtree into one
 *      layer, which cancels every child's ability to composite independently
 *      — the animations then paint into the group on the main thread, which
 *      is the exact cost the change was meant to remove.
 */

/** Deterministic PRNG so SSR and client agree (no hydration mismatch). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

export interface Star {
  /** Horizontal position, % of the container. */
  x: number;
  /** Vertical position, % of the container. */
  y: number;
  /** Diameter in px. */
  size: number;
  /**
   * Whether this star pulses. Only a minority do — see the note above; the
   * rest are static and cost nothing after their first paint.
   */
  twinkle: boolean;
  /** Twinkle cycle length, seconds. Meaningless when `twinkle` is false. */
  dur: number;
  /** Negative phase offset so the field never pulses in unison. */
  delay: number;
  /** Fully-resolved fill, brightness baked in (never a parent opacity). */
  color: string;
  /** Matching halo. */
  glow: string;
}

export interface StarGroup {
  stars: Star[];
}

export interface StarFieldOptions {
  /** Total stars across all groups. */
  count: number;
  /** How many brightness tiers to split them into. */
  groups?: number;
  /** Vertical extent as a percentage of the container (stars sit up high). */
  spread?: number;
  /**
   * How many stars actually pulse. Keep this small — it is the number of
   * permanently-running animations this field adds to every frame of the
   * page, in every section, for the whole session.
   */
  twinkling?: number;
}

/**
 * Build the groups for one field. Call at module scope — the result is
 * static, and the seeded PRNG makes it identical on server and client.
 */
export function buildStarField(
  seed: number,
  { count, groups = 3, spread = 55, twinkling = 14 }: StarFieldOptions
): StarGroup[] {
  const rnd = seeded(seed);
  const buckets: Star[][] = Array.from({ length: groups }, () => []);
  // Spread the animated ones evenly through the field so the pulsing is
  // scattered rather than clustered in one corner.
  const every = Math.max(1, Math.round(count / Math.max(twinkling, 1)));

  for (let i = 0; i < count; i++) {
    const g = i % groups;
    const peak = +(0.5 + g * 0.17).toFixed(2);
    buckets[g].push({
      x: +(rnd() * 100).toFixed(2),
      y: +(rnd() * spread).toFixed(2),
      size: +(0.7 + rnd() * 1.9).toFixed(2),
      twinkle: i % every === 0,
      dur: +(2.6 + rnd() * 3).toFixed(2),
      delay: -+(rnd() * 5).toFixed(2),
      color: `rgba(234, 242, 255, ${peak})`,
      glow: `0 0 4px rgba(200, 220, 255, ${(peak * 0.55).toFixed(2)})`,
    });
  }

  return buckets.map((stars) => ({ stars }));
}
