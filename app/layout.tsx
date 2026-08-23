import type { Metadata, Viewport } from "next";
import { Oxanium, IBM_Plex_Mono, Bricolage_Grotesque, Instrument_Serif } from "next/font/google";
import "@/app/globals.css";

// Editorial display — Bricolage Grotesque: characterful, high-contrast
// grotesque for the oversized "dossier" headlines. Distinctive, not the
// usual sci-fi/Space-Grotesk default.
const grotesk = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-grotesk",
  display: "swap",
  fallback: ["ui-sans-serif", "sans-serif"]
});

// Editorial accent — Instrument Serif: an elegant high-contrast serif for
// pull quotes / lead text, a deliberate counterpoint to the mono UI.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "serif"]
});
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { SceneContainer } from "@/components/three/SceneContainer";
import { HudFrame } from "@/components/ui/HudFrame";
import { Atmosphere } from "@/components/ui/Atmosphere";
import { Preloader } from "@/components/ui/Preloader";
import { Reticle } from "@/components/ui/Reticle";
import { ParallaxBackdrop } from "@/components/ui/ParallaxBackdrop";
import { CelestialSky } from "@/components/ui/CelestialSky";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ThemeTransitionOverlay } from "@/components/ui/ThemeTransitionOverlay";
import { ThemeProvider } from "@/lib/useTheme";
import { SITE_URL } from "@/lib/siteUrl";
import { profile } from "@/content/profile";

// Display — Oxanium: geometric sci-fi, free on Google Fonts. Used
// for giant section numbers + headline display text.
const display = Oxanium({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-sans-serif", "sans-serif"]
});

// Mono — IBM Plex Mono: mono-first body + HUD labels + numerics.
// Weights 400/500/700.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"]
});

const TITLE = `${profile.name} — ${profile.role}`;
const DESCRIPTION =
  "Senior Software Engineer shipping production web, mobile and cloud — Next.js, React, React Native, Azure and GCP. A scroll-driven 3D portfolio built around a reactive control core.";
const SHARE_BLURB =
  "Full-stack engineer shipping web, mobile and cloud from a single command surface.";

export const metadata: Metadata = {
  // `metadataBase` is what every share surface resolves og:image and the
  // canonical link against. lib/siteUrl.ts owns that decision — read the note
  // there before changing how the origin is derived; getting it wrong points
  // canonical, the sitemap and every social preview at the wrong host, and
  // does so silently.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${profile.name}`
  },
  description: DESCRIPTION,
  applicationName: "DEV.OS",
  authors: [{ name: profile.name, url: SITE_URL }],
  creator: profile.name,
  publisher: profile.name,
  keywords: [
    profile.name,
    "Senior Software Engineer",
    "Full-stack developer",
    "Next.js developer",
    "React developer",
    "React Native developer",
    "TypeScript",
    "Three.js",
    "React Three Fiber",
    "GSAP",
    "Azure",
    "GCP",
    "Kolkata",
    "portfolio"
  ],
  alternates: { canonical: "/" },
  // `max-image-preview: large` is the directive that lets Google and
  // LinkedIn render the full-width card instead of a thumbnail.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  openGraph: {
    type: "profile",
    siteName: `${profile.name} — DEV.OS`,
    locale: "en_US",
    title: TITLE,
    description: SHARE_BLURB,
    url: "/",
    firstName: "Pradipta",
    lastName: "Jana",
    username: "pradiptakumarjana"
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SHARE_BLURB,
    creator: "@pradiptajana"
  },
  category: "technology",
  formatDetection: { telephone: false, email: false, address: false }
};

/**
 * The address-bar / splash colour. Split out of `metadata` because Next 14
 * moved themeColor and viewport into their own export.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
    { media: "(prefers-color-scheme: light)", color: "#14110b" }
  ]
};

/**
 * Structured data. A `ProfilePage` wrapping a `Person` is what gets a
 * personal site an entity panel and a rich result; the `WebSite` node gives
 * search engines the canonical name for the domain. Emitted server-side as
 * a plain script tag so it is in the initial HTML, where crawlers read it.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfilePage",
      "@id": `${SITE_URL}/#profilepage`,
      url: `${SITE_URL}/`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "en",
      mainEntity: { "@id": `${SITE_URL}/#person` },
      isPartOf: { "@id": `${SITE_URL}/#website` }
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: `${profile.name} — DEV.OS`,
      description: DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#person` }
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: profile.name,
      givenName: "Pradipta",
      familyName: "Jana",
      jobTitle: profile.role,
      description: profile.summary,
      email: `mailto:${profile.socials.email}`,
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/opengraph-image`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kolkata",
        addressRegion: "West Bengal",
        addressCountry: "IN"
      },
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: profile.education.school
      },
      knowsAbout: [
        "Next.js",
        "React",
        "React Native",
        "TypeScript",
        "Node.js",
        "Django",
        "Three.js",
        "GSAP",
        "Microsoft Azure",
        "Google Cloud Platform",
        "CI/CD"
      ],
      sameAs: [profile.socials.github, profile.socials.linkedin]
    }
  ]
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${grotesk.variable} ${serif.variable}`}>
      <head>
        {/* Structured data must be in the initial HTML — crawlers read the
            server response, not the hydrated DOM. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="bg-bg text-ink font-mono antialiased">
        {/* Phase 5 cross-browser audit: a minimal no-JS notice. The
            entire site is a client-side 3D + scroll experience, so a
            user with JS disabled gets nothing usable — give them a
            single line explaining why and a link to the email contact. */}
        <noscript>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              background: "#0b0f19",
              color: "#e7ecf5",
              fontFamily: "ui-monospace, monospace",
              textAlign: "center"
            }}
          >
            This portfolio renders a scroll-driven 3D experience and needs
            JavaScript. Please enable it and reload, or reach me at{" "}
            <a
              href="mailto:pradiptajana.co@gmail.com"
              style={{ color: "#4f9cff", marginLeft: "0.4em" }}
            >
              pradiptajana.co@gmail.com
            </a>
            .
          </div>
        </noscript>
        <ThemeProvider>
          {/* Celestial sky (moon/stars/shooting-stars ↔ sun/clouds), BEHIND
              the ridge backdrop + the transparent Canvas. */}
          <CelestialSky />
          {/* Layered depth backdrop, BEHIND the transparent Canvas. */}
          <ParallaxBackdrop />
          {/* Canvas lives OUTSIDE the smooth-scroll wrapper so it is not
              translated by ScrollSmoother / Lenis — it stays pinned. */}
          <SceneContainer />
          {/* Atmosphere + HUD frame — fixed overlays */}
          <Atmosphere />
          <HudFrame />
          {/* Day/night toggle (top-centre HUD pill). */}
          <ThemeToggle />
          {/* Cloud reveal that veils the screen while the theme swaps. */}
          <ThemeTransitionOverlay />
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
          {/* Custom reticle cursor (desktop/fine-pointer only) + one-shot
              boot preloader. Both self-gate and remove themselves when
              not applicable. */}
          <Reticle />
          <Preloader />
        </ThemeProvider>
      </body>
    </html>
  );
}
