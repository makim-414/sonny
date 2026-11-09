import type { Metadata, Viewport } from "next";
import { ASSISTANT_NAME } from "@/components/tv/brand";
import { RemoteApp } from "./RemoteApp";
import { THEME_COLOR } from "../manifest";
import "@/styles/theme-sonny.css";
import "./remote.css";

export const metadata: Metadata = {
  title: `${ASSISTANT_NAME} 리모컨`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLOR,
};

export default function RemotePage() {
  return <RemoteApp />;
}
