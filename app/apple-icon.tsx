import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180x180) — what iOS uses for "Add to Home Screen" and
 * what Safari shows in bookmarks. Same mark as the favicon, drawn at a size
 * where the full split wordmark initial and the HUD frame both read.
 */

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          position: "relative",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 50% 34%, rgba(79,156,255,0.28), rgba(11,15,25,0) 62%)",
          }}
        />
        {[
          { top: 16, left: 16, bt: true, bl: true },
          { top: 16, right: 16, bt: true, br: true },
          { bottom: 16, left: 16, bb: true, bl: true },
          { bottom: 16, right: 16, bb: true, br: true },
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
              ...(c.bt ? { borderTop: "4px solid #ff7a1a" } : {}),
              ...(c.bb ? { borderBottom: "4px solid #ff7a1a" } : {}),
              ...(c.bl ? { borderLeft: "4px solid #ff7a1a" } : {}),
              ...(c.br ? { borderRight: "4px solid #ff7a1a" } : {}),
            }}
          />
        ))}
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -4,
            color: "#ff7a1a",
          }}
        >
          PJ
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 10,
            fontSize: 13,
            letterSpacing: 5,
            color: "#8fa0bf",
          }}
        >
          DEV.OS
        </div>
      </div>
    ),
    { ...size }
  );
}
