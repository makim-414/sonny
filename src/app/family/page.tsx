import type { Metadata, Viewport } from "next";
import FamilyApp from "@/components/family/FamilyApp";
import { PRODUCT_NAME, PRODUCT_NAME_EN, APP_LANG } from "@/lib/brand";
import { T } from "@/components/family/strings";

export const metadata: Metadata = {
  title: `${T.htmlTitle} · ${APP_LANG === "en" ? PRODUCT_NAME_EN : PRODUCT_NAME}`,
  description: T.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function FamilyPage() {
  return <FamilyApp />;
}
