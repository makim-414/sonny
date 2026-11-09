"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { T } from "@/components/family/strings";
import { PAGES, useAdmin, type Page } from "./AdminShell";
import HealthPlan from "./HealthPlan";
import StuckDemo from "./StuckDemo";
import WeekDashboard from "@/components/family/WeekDashboard";
import { A } from "./strings";

// /admin : today's summary and one big card per page.
export default function Overview() {
  const { data } = useAdmin();
  const router = useRouter();

  // Old links used /admin?tab=allowance; send them to the page's own address.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const page = PAGES.find((p) => p === tab);
    if (page) router.replace(`/admin/${page}`);
  }, [router]);

  const s = data?.today;
  const status: Record<Page, string> = {
    today: data ? (data.waiting ? A.waitingN(data.waiting) : A.nothingWaiting) : T.loading,
    taught: data ? A.taughtCount(data.taught.lessons.length) : T.loading,
    routines: data ? A.routinesN(data.routines.length) : T.loading,
    allowance: data
      ? new Intl.NumberFormat(T.locale, { style: "currency", currency: data.wallet.currency.toUpperCase() }).format(data.wallet.balance / 100)
      : T.loading,
    privacy: data ? A.privateN(data.privacy.hidden) : T.loading,
    device: data ? (data.device.paired.length ? A.paired(data.device.paired.length) : A.notPaired) : T.loading,
  };

  return (
    <>
      <h1 className="ad-page-title">{A.overview}</h1>
      <StuckDemo />
      <section className="fa-summary ad-overview-summary" aria-label={T.todayTitle}>
        <h2 className="fa-summary-title">{T.todayTitle}</h2>
        {s?.reassure && <p className={`fa-reassure fa-reassure-${s.reassure.tone}`}>{s.reassure.text}</p>}
        <p className="fa-summary-line">{s ? s.sentence : T.loading}</p>
      </section>
      <WeekDashboard wide />
      <ul className="ad-cards">
        {PAGES.map((p) => (
          <li key={p}>
            <Link href={`/admin/${p}`} className="ad-card-link">
              <span className="ad-card-title">{A.tabs[p]}</span>
              <span className="ad-card-desc">{A.cards[p]}</span>
              <span className="ad-card-status">{status[p]}</span>
            </Link>
          </li>
        ))}
      </ul>
      <HealthPlan />
    </>
  );
}
