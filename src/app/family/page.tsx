import type { Metadata, Viewport } from "next";
import FamilyApp from "@/components/family/FamilyApp";

export const metadata: Metadata = {
  title: "할머니 집 · 효도 TV",
  description: "할머니 TV에서 오늘 있었던 일을 보고, TV로 말을 전해요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function FamilyPage() {
  return <FamilyApp />;
}
