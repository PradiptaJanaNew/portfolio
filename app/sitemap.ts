import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Generates /sitemap.xml. The single-page portfolio only has one URL, but
 * the route stays so search engines pick up the canonical domain — resolved
 * through the same helper as `metadataBase` and robots.txt, so the three can
 * never disagree about which host this site lives on.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
