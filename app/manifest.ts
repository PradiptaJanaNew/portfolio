import type { MetadataRoute } from "next";
import { profile } from "@/content/profile";

/**
 * Web app manifest — what a phone uses when the site is pinned to a home
 * screen, and where Chrome reads the address-bar/splash colour from.
 *
 * `icons` point at the generated `/icon` and `/apple-icon` routes so there
 * is exactly one source for the mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.name} — ${profile.role}`,
    short_name: "Pradipta Jana",
    description:
      "Scroll-driven 3D portfolio: Next.js, React, React Native and cloud-deployed apps, built around a reactive control core.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f19",
    theme_color: "#0b0f19",
    orientation: "portrait-primary",
    categories: ["portfolio", "developer", "productivity"],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
