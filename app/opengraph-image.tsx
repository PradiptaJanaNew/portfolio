import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { profile } from "@/content/profile";

/**
 * The share card — what WhatsApp, LinkedIn, Slack, X and iMessage render
 * when this link is pasted anywhere.
 *
 * It deliberately mirrors the hero: the same dark blue-hour field, the same
 * orange/bone split wordmark, the same HUD crop marks, and the operator
 * portrait that the SYS.OPERATOR section resolves in WebGL. Someone who has
 * seen the site recognises the card, and someone who hasn't gets a face, a
 * name and a role in one glance.
 *
 * NODE runtime, not edge: the portrait is read off disk and inlined as a
 * data URI. Satori (which backs ImageResponse) cannot decode WebP, so this
 * reads a PNG derived from the same cutout the site uses.
 *
 * The route has no dynamic inputs, so Next PRERENDERS it during `next build`
 * and ships the finished PNG as a static asset — the disk read happens at
 * build time, where `public/` is guaranteed to be there. Keep it that way: if
 * this ever gains a dynamic segment it becomes a serverless function, and the
 * file tracer cannot see through `join(process.cwd(), ...)` to bundle the PNG.
 */
export const runtime = "nodejs";
export const alt = `${profile.name} — ${profile.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0f19";
const BONE = "#eaf1ff";
const ORANGE = "#ff7a1a";
const BLUE = "#4f9cff";
const STEEL = "#8fa0bf";

/**
 * Read the portrait once per server process and hold it as a data URI.
 * Wrapped because a missing file must degrade to a type-only card rather
 * than 500 the metadata route — a card with no image still beats no card.
 */
let portrait: string | null = null;
try {
  const bytes = readFileSync(join(process.cwd(), "public/images/og-portrait.png"));
  portrait = `data:image/png;base64,${bytes.toString("base64")}`;
} catch {
  portrait = null;
}

/**
 * Satori ships no bold face, so `fontWeight: 800` on a system stack renders
 * at regular — which left the wordmark looking nothing like the site's. Pull
 * the real display face (Oxanium, the same one the hero uses) from Google.
 *
 * The desktop User-Agent matters: without it the CSS endpoint serves woff2,
 * which Satori cannot parse. An ancient UA gets a plain TTF.
 *
 * Memoised as a promise so a warm server fetches once, and null on any
 * failure — the card then falls back to the system stack rather than 500ing.
 */
let displayFont: Promise<ArrayBuffer | null> | null = null;
function loadDisplayFont(): Promise<ArrayBuffer | null> {
  displayFont ??= (async () => {
    try {
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Oxanium:wght@800",
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } }
      ).then((r) => r.text());
      const url = css.match(/src:\s*url\((.+?)\)/)?.[1];
      if (!url) return null;
      return await fetch(url).then((r) => r.arrayBuffer());
    } catch {
      return null;
    }
  })();
  return displayFont;
}

export default async function OpengraphImage() {
  const fontData = await loadDisplayFont();
  const display = fontData ? "Oxanium" : "ui-sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          color: BONE,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* blue-hour wash + amber key, matching the hero's lighting */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 22% 18%, rgba(79,156,255,0.24), rgba(11,15,25,0) 58%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 88% 86%, rgba(255,122,26,0.22), rgba(11,15,25,0) 55%)",
          }}
        />

        {/* HUD frame + corner crop marks */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            display: "flex",
            border: "1px solid rgba(234,241,255,0.14)",
          }}
        />
        {[
          { top: 20, left: 20, bt: true, bl: true },
          { top: 20, right: 20, bt: true, br: true },
          { bottom: 20, left: 20, bb: true, bl: true },
          { bottom: 20, right: 20, bb: true, br: true },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 26,
              height: 26,
              display: "flex",
              ...(c.top !== undefined ? { top: c.top } : {}),
              ...(c.bottom !== undefined ? { bottom: c.bottom } : {}),
              ...(c.left !== undefined ? { left: c.left } : {}),
              ...(c.right !== undefined ? { right: c.right } : {}),
              ...(c.bt ? { borderTop: `2px solid ${ORANGE}` } : {}),
              ...(c.bb ? { borderBottom: `2px solid ${ORANGE}` } : {}),
              ...(c.bl ? { borderLeft: `2px solid ${ORANGE}` } : {}),
              ...(c.br ? { borderRight: `2px solid ${ORANGE}` } : {}),
            }}
          />
        ))}

        {/* ── type column ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 0 78px",
            width: portrait ? 760 : 1200,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 20,
              letterSpacing: 6,
              color: BLUE,
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 9,
                background: BLUE,
                display: "flex",
              }}
            />
            SYS.BOOT // 01
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 22,
              fontFamily: display,
              fontSize: 104,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 0.92,
            }}
          >
            <div style={{ display: "flex", color: ORANGE }}>PRADIPTA</div>
            <div style={{ display: "flex", color: BONE }}>JANA</div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 25,
              letterSpacing: 3,
              color: BONE,
            }}
          >
            {profile.role}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 22,
              lineHeight: 1.45,
              color: STEEL,
              maxWidth: 600,
            }}
          >
            Next.js · React · React Native · Azure · GCP
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 34,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 18,
              letterSpacing: 4,
              color: ORANGE,
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 44, height: 2, background: ORANGE, display: "flex" }} />
            Open for work · Kolkata / Remote
          </div>
        </div>

        {/* ── portrait plate ── */}
        {portrait ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "flex-end",
              justifyContent: "flex-end",
              paddingRight: 44,
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portrait}
              alt=""
              width={412}
              height={620}
              style={{ objectFit: "contain" }}
            />
          </div>
        ) : null}
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "Oxanium", data: fontData, weight: 800 as const, style: "normal" as const }]
        : [],
    }
  );
}
