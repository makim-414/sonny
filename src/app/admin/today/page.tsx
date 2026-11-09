import type { Metadata } from "next";
import { TodayPage } from "../sections";
import { A } from "../strings";

export const metadata: Metadata = { title: A.tabs.today };

export default function Page() {
  return <TodayPage />;
}
