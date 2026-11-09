import type { Metadata, Viewport } from "next";
import { PRODUCT_NAME } from "@/lib/brand";
import SetupApp from "./SetupApp";
import "@/components/family/family.css";
import "./setup.css";

export const metadata: Metadata = { title: `Setup · ${PRODUCT_NAME}`, robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Hidden family setup on grandma's phone. Opened by a 2 second long-press on the
// top-left corner of /, then the family PIN.
export default function SetupPage() {
  return <SetupApp />;
}
