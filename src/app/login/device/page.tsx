import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LightPage from "@/components/family/LightPage";
import { L } from "../strings";
import "@/components/family/family.css";
import "../login.css";

export const metadata: Metadata = { title: L.deviceTitle };

async function Expired({ searchParams }: { searchParams: PageProps<"/login/device">["searchParams"] }) {
  if ((await searchParams).expired !== "1") return null;
  return (
    <p className="lg-error" role="alert">
      {L.pairBad}
    </p>
  );
}

export default function DevicePage({ searchParams }: PageProps<"/login/device">) {
  return (
    <div className="fa lg theme-light">
      <LightPage />
      <main className="lg-card">
        <h1 className="lg-title">{L.deviceTitle}</h1>
        <Suspense fallback={null}>
          <Expired searchParams={searchParams} />
        </Suspense>
        <p className="lg-body">{L.deviceBody}</p>
        <Link className="lg-submit lg-link-button" href="/?demo=1" prefetch={false}>
          {L.deviceDemo}
        </Link>
        <p className="lg-demo">
          <Link href="/login?next=%2Fadmin%2Fdevice" prefetch={false}>
            {L.deviceFamily}
          </Link>
        </p>
      </main>
    </div>
  );
}
