import type { Metadata, Viewport } from "next";
import { APP_LANG, PRODUCT_NAME, PRODUCT_NAME_EN } from "@/lib/brand";
import AdminApp from "./AdminApp";
import { A } from "./strings";
import "@/components/family/family.css";
import "./admin.css";

export const metadata: Metadata = {
  title: `${A.title} · ${APP_LANG === "en" ? PRODUCT_NAME_EN : PRODUCT_NAME}`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function AdminPage() {
  return <AdminApp />;
}
