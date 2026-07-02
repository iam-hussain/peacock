import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — teal tile + white peacock mark (PNG; apple-icon can't be SVG).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#45897d" }}>
        <svg width="128" height="151" viewBox="0 0 88 104">
          <g fill="#14201E">
            <g transform="rotate(-26 44 68)">
              <rect x="42" y="42" width="4" height="26" rx="2" />
              <circle cx="44" cy="35.5" r="5.5" />
            </g>
            <g transform="rotate(26 44 68)">
              <rect x="42" y="42" width="4" height="26" rx="2" />
              <circle cx="44" cy="35.5" r="5.5" />
            </g>
            <rect x="42" y="34" width="4" height="34" rx="2" />
            <circle cx="44" cy="27.5" r="5.5" />
            <ellipse cx="44" cy="76" rx="27" ry="28" />
          </g>
          <circle cx="36" cy="73" r="7" fill="#ffffff" />
          <circle cx="36" cy="73" r="3.2" fill="#0E8C82" />
          <circle cx="52" cy="73" r="7" fill="#ffffff" />
          <circle cx="52" cy="73" r="3.2" fill="#0E8C82" />
          <polygon points="37,85 51,85 44,99" fill="#E7B53C" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
