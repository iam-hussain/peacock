import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peacock Investment Club",
    short_name: "Peacock",
    description: "Many feathers, one fortune. Every rupee your club holds, in plain sight.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F8F7",
    theme_color: "#0E8C82",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" },
    ],
  };
}
