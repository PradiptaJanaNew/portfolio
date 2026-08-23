/**
 * The site's canonical absolute origin.
 *
 * Every share surface depends on this. `metadataBase` resolves the Open
 * Graph image, the canonical link and the sitemap entries against it, so if
 * it points at the wrong host the social banner silently fails: WhatsApp,
 * LinkedIn and Slack fetch `og:image` from a domain that isn't ours and
 * render a bare text link instead of a card.
 *
 * Resolution order, first hit wins:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — set this on the production deployment.
 *   2. `SITE_URL` — same thing, for server-only setups.
 *   3. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's STABLE production host.
 *      Preview deployments also expose it, so previews still advertise the
 *      production domain, which is what we want for canonical + og:image.
 *   4. `VERCEL_URL` — the per-deployment host; the last usable fallback.
 *   5. localhost, for `next dev`.
 *
 * The previous hardcoded fallback was `https://portfolio.vercel.app`, a
 * domain this project does not own — which is exactly the failure above.
 */
function normalize(raw: string): string {
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];
  for (const c of candidates) {
    if (c && c.trim()) return normalize(c.trim());
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

/** Resolved once per server process. */
export const SITE_URL = getSiteUrl();

/** Bare host, for display ("pradiptajana.com"). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export default SITE_URL;
