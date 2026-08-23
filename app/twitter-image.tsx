/**
 * X / Twitter reuses the Open Graph card verbatim — one design to keep in
 * sync, and `summary_large_image` wants the same 1200x630 frame.
 *
 * `runtime` is declared as a literal rather than re-exported: Next reads
 * these route segment configs statically at build time and cannot follow a
 * re-export, so a forwarded `runtime` silently falls back to the default.
 */
export const runtime = "nodejs";
export { alt, size, contentType, default } from "./opengraph-image";
