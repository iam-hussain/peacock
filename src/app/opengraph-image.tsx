import { ImageResponse } from "next/og";

export const alt = "Peacock Investment Club — Many feathers, one fortune.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "#F7F8F7",
          fontFamily: "sans-serif",
        }}
      >
        <svg width="150" height="177" viewBox="0 0 88 104">
          <g transform="rotate(-26 44 68)">
            <rect x="42" y="42" width="4" height="26" rx="2" fill="#14201E" />
            <circle cx="44" cy="35.5" r="5.5" fill="#14201E" />
          </g>
          <g transform="rotate(26 44 68)">
            <rect x="42" y="42" width="4" height="26" rx="2" fill="#14201E" />
            <circle cx="44" cy="35.5" r="5.5" fill="#14201E" />
          </g>
          <rect x="42" y="34" width="4" height="34" rx="2" fill="#0E8C82" />
          <circle cx="44" cy="27.5" r="5.5" fill="#0E8C82" />
          <ellipse cx="44" cy="76" rx="27" ry="28" fill="#0E8C82" />
          <circle cx="36" cy="74" r="7" fill="#fff" />
          <circle cx="36" cy="71" r="3" fill="#14201E" />
          <circle cx="52" cy="74" r="7" fill="#fff" />
          <circle cx="52" cy="71" r="3" fill="#14201E" />
          <polygon points="37,84 44,84 44,98" fill="#F4C430" />
          <polygon points="44,84 51,84 44,98" fill="#D9A521" />
        </svg>

        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 30 }}>
          <span style={{ fontSize: 96, fontWeight: 800, color: "#14201E", letterSpacing: "-0.03em" }}>peacock</span>
          <span style={{ width: 24, height: 24, borderRadius: 12, background: "#0E8C82", marginLeft: 14, marginBottom: 16 }} />
        </div>

        <div style={{ fontSize: 26, fontWeight: 600, color: "#7A8884", letterSpacing: "0.16em", marginTop: 6 }}>
          INVESTMENT CLUB
        </div>

        <div style={{ fontSize: 32, fontWeight: 500, color: "#0E8C82", marginTop: 34 }}>
          Many feathers, one fortune.
        </div>
      </div>
    ),
    { ...size },
  );
}
