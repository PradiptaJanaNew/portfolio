import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Generated robots.txt.
 *
 * Generated rather than static so the Sitemap line can never drift from the
 * origin `metadataBase` uses — see lib/siteUrl.ts, which is the single place
 * the canonical domain is decided.
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
