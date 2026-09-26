import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FinTrack",
    short_name: "FinTrack",
    description: "Le tue finanze personali: conti, budget, obiettivi e analisi.",
    lang: "it",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Movimenti",
        url: "/transactions",
        icons: [{ src: "/icons/192.png", sizes: "192x192" }],
      },
      { name: "Budget", url: "/budgets", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
    ],
  };
}
