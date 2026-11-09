import type { Metadata } from "next";
import { AllowancePage } from "../sections";
import { A } from "../strings";

export const metadata: Metadata = { title: A.tabs.allowance };

export default function Page() {
  return <AllowancePage />;
}
