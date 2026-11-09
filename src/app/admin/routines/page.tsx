import type { Metadata } from "next";
import { RoutinesPage } from "../sections";
import { A } from "../strings";

export const metadata: Metadata = { title: A.tabs.routines };

export default function Page() {
  return <RoutinesPage />;
}
