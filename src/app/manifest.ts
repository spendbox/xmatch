import type { MetadataRoute } from "next";

// Lets people add Dashpad to their home screen (needed for notifications on iPhone)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashpad",
    short_name: "Dashpad",
    description: "Your world, your people. Meet someone new, masked, every hour. Unmask if you both say yes.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
