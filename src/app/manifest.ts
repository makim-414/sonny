import type { MetadataRoute } from "next";
import { PRODUCT_NAME, PRODUCT_NAME_EN } from "@/lib/brand";

// Served at /manifest.webmanifest. Name comes from the one brand file.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: `${PRODUCT_NAME_EN}: an AI companion that talks first, remembers, and keeps the family in the loop.`,
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05060a",
    theme_color: "#05060a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
