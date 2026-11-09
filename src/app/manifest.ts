import type { MetadataRoute } from "next";
import { APP_LANG, PRODUCT_NAME, PRODUCT_NAME_EN } from "@/lib/brand";

// Manifest colors must be hex: this is the DS --background (oklch 0.12) in sRGB.
export const THEME_COLOR = "#060606";

// Served at /manifest.webmanifest. Name comes from the one brand file.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: `${PRODUCT_NAME_EN}: an AI companion that talks first, remembers, and keeps the family in the loop.`,
    lang: APP_LANG,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
