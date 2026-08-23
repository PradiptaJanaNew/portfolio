import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Generated robots.txt.
 *
 * This replaced a static `public/robots.txt` whose Sitemap line hardcoded
 * `https://portfolio.vercel.app` — a domain this project does not own, so
 * the sitemap it advertised was never fetchable. Generating it keeps the
 * sitemap URL locked to the same resolved origin as `metadataBase`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
