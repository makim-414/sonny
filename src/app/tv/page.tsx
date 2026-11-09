import type { Metadata } from "next";
import { TvApp } from "@/components/tv/TvApp";
import { ASSISTANT_NAME } from "@/components/tv/brand";
import "./tv.css";

export const metadata: Metadata = {
  title: `${ASSISTANT_NAME} TV`,
};

export default function TvPage() {
  return <TvApp />;
}
