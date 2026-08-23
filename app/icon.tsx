import { ImageResponse } from "next/og";

/**
 * Favicon (32x32), rendered via `next/og`.
 *
 * The previous icon was a soft neon blob that read as a grey smudge at tab
 * size. This is the site's actual mark instead: the orange "P" of the
 * PRADIPTA wordmark on the blue-hour field, inside the HUD's amber corner
 * brackets. It stays legible at 16px, which is the only size that matters.
 */

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f19",
          position: "relative",
        }}
      >
        {/* HUD corner brackets, the site's signature frame */}
        {[
          { top: 3, left: 3, bt: true, bl: true },
          { bottom: 3, right: 3, bb: true, br: true },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              display: "flex",
              ...(c.top !== undefined ? { top: c.top } : {}),
              ...(c.bottom !== undefined ? { bottom: c.bottom } : {}),
              ...(c.left !== undefined ? { left: c.left } : {}),
              ...(c.right !== undefined ? { right: c.right } : {}),
              ...(c.bt ? { borderTop: "2px solid #ff7a1a" } : {}),
              ...(c.bb ? { borderBottom: "2px solid #ff7a1a" } : {}),
              ...(c.bl ? { borderLeft: "2px solid #ff7a1a" } : {}),
              ...(c.br ? { borderRight: "2px solid #ff7a1a" } : {}),
            }}
          />
        ))}
        <div
          style={{
            display: "flex",
            fontSize: 23,
            fontWeight: 700,
            lineHeight: 1,
            color: "#ff7a1a",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          P
        </div>
      </div>
    ),
    { ...size }
  );
}
