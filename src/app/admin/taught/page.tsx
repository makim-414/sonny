import type { Metadata } from "next";
import { TaughtPage } from "../sections";
import { A } from "../strings";

export const metadata: Metadata = { title: A.tabs.taught };

export default function Page() {
  return <TaughtPage />;
}
