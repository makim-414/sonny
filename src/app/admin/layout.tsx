import type { Metadata, Viewport } from "next";
import { APP_LANG, PRODUCT_NAME, PRODUCT_NAME_EN } from "@/lib/brand";
import AdminShell from "./AdminShell";
import { A } from "./strings";
import "@/components/family/family.css";
import "./admin.css";

const product = APP_LANG === "en" ? PRODUCT_NAME_EN : PRODUCT_NAME;

export const metadata: Metadata = {
  title: { default: `${A.title} · ${product}`, template: `%s · ${A.title} · ${product}` },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Every /admin page shares the frame: header, page links, incoming call, light theme.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
