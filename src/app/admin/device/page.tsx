import type { Metadata } from "next";
import { DevicePage } from "../sections";
import { A } from "../strings";

export const metadata: Metadata = { title: A.tabs.device };

export default function Page() {
  return <DevicePage />;
}
