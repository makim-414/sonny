import type { Metadata, Viewport } from "next";
import { ASSISTANT_NAME } from "@/components/tv/brand";
import { RemoteApp } from "./RemoteApp";
import "./remote.css";

export const metadata: Metadata = {
  title: `${ASSISTANT_NAME} 리모컨`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RemotePage() {
  return <RemoteApp />;
}
