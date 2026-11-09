import type { Metadata, Viewport } from "next";
import { OrbApp } from "@/components/orb/OrbApp";
import { PRODUCT_NAME } from "@/lib/brand";
import { THEME_COLOR } from "./manifest";
import "@/styles/theme-sonny.css";
import "@/components/orb/orb.css";

// Grandma's phone home-screen app: one particle orb, no buttons.
export const metadata: Metadata = {
  title: PRODUCT_NAME,
  appleWebApp: { capable: true, title: PRODUCT_NAME, statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Next writes mobile-web-app-capable for appleWebApp; older iOS still reads the apple- name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default function Home() {
  return <OrbApp />;
}
