import * as THREE from "three";

/**
 * Shared scene store — a plain mutable singleton the R3F scene reads on
 * every frame and the scroll driver writes on every scroll tick.
 *
 * Kept as a module-local object (not zustand) so non-React consumers
 * (useFrame loops, ScrollTrigger onUpdate) can touch the live values
 * without triggering React re-renders.
 *
 * The scene is driven by a SINGLE normalized scroll progress value.
 * Components map that progress onto a pose curve and damp toward it in
 * the render loop — there are no GSAP tweens mutating THREE objects.
 */
export const sceneStore = {
  /** Whole-page scroll progress, 0 (top) → 1 (bottom). */
  progress: 0,
  /** Number of sections / scene poses. */
  sectionCount: 6,
  /** Active section index, derived by the scroll driver. */
  sectionIndex: 0,
  /**
   * Normalized scroll velocity (0..~1+), written by the scroll driver
   * and decayed in the render loop. The particle field reads it to
   * surge outward on fast scrolls, then settle.
   */
  scrollVelocity: 0,
  /**
   * World-space nudge added to the traveling robot's sampled pose.
   *
   * The pose curve has one waypoint per canonical section, so a band that
   * isn't one of the six (SYS.SHELL) inherits whatever the blend between
   * its neighbours produces — which parked the robot dead centre, walking
   * straight through the console's boot log. A section can write this
   * while it owns the viewport to steer the robot into a margin, then ease
   * it back to zero on the way out. The render loop DAMPS toward the
   * offset pose, so writes can be abrupt without the robot snapping.
   */
  travelerOffset: { x: 0, y: 0, z: 0 },
  /** Live refs the scene registers on mount. */
  core: { ref: null as THREE.Object3D | null },
  camera: { ref: null as THREE.PerspectiveCamera | null },
};

/**
 * The five skill modules. Preserved as a named export because
 * `content/skills.ts` imports it as the key type for its skill map.
 */
export type ModuleId = "frontend" | "backend" | "devops" | "cloud" | "mobile";
