import type { Metadata } from "next";
import { PrivacyPage } from "../sections";
import { A } from "../strings";

export const metadata: Metadata = { title: A.tabs.privacy };

export default function Page() {
  return <PrivacyPage />;
}
