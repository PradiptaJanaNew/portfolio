/**
 * The site's canonical absolute origin.
 *
 * Every share surface depends on this. `metadataBase` resolves the Open
 * Graph image, the canonical link, robots.txt and the sitemap against it, so
 * if it points at the wrong host the damage is quiet but real: search engines
 * index the wrong URL, and WhatsApp/LinkedIn/Slack advertise it in every
 * preview.
 *
 * Resolution order, first hit wins:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` / `SITE_URL` — an explicit override always
 *      wins, so a new domain needs no code change.
 *   2. A Vercel PRODUCTION build → `PRODUCTION_URL` below.
 *   3. A Vercel PREVIEW build → that deployment's own host, so a preview
 *      links to itself rather than to production.
 *   4. localhost, for `next dev`.
 *
 * Why production is hardcoded rather than read from Vercel: this used to
 * trust `VERCEL_PROJECT_PRODUCTION_URL`, and on the live deployment that
 * variable returned the auto-generated `portfolio-beta-gold-…vercel.app`
 * rather than the domain actually attached to the project. Everything
 * canonical then pointed at a URL nobody was meant to see. The canonical
 * domain is a fact about this site, so it lives in the repo where it can be
 * reviewed — not in an environment variable someone has to remember to set.
 */

/** The domain this site is published on. Change here when the domain moves. */
const PRODUCTION_URL = "https://pradipta-jana.vercel.app";

function normalize(raw: string): string {
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (explicit && explicit.trim()) return normalize(explicit.trim());

  if (process.env.VERCEL_ENV === "production") return PRODUCTION_URL;

  const deployment = process.env.VERCEL_URL;
  if (deployment && deployment.trim()) return normalize(deployment.trim());

  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

/** Resolved once per server process. */
export const SITE_URL = getSiteUrl();

/** Bare host, for display ("pradipta-jana.vercel.app"). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export default SITE_URL;
