import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wichtelwerk",
    short_name: "Wichtelwerk",
    description: "Wichteln für die ganze Firma.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fbf7ee",
    theme_color: "#173f35",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
