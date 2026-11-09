import type { Metadata } from "next";
import { TvApp } from "@/components/tv/TvApp";
import { PRODUCT_NAME } from "@/components/tv/brand";
import "./tv.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
};

export default function TvPage() {
  return <TvApp />;
}
