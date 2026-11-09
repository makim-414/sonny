"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import IncomingCall from "@/components/family/IncomingCall";
import LightPage from "@/components/family/LightPage";
import type { Summary } from "@/components/family/derive";
import { T } from "@/components/family/strings";
import type { Routine } from "@/app/api/family/state";
import type { WalletEntry } from "@/lib/types";
import { logout } from "../login/actions";
import { A } from "./strings";

// Shared frame for every /admin page: one poll of /admin/data, the page links,
// the incoming-call screen and the light theme. Pages read the data through useAdmin().

export const PAGES = ["today", "taught", "routines", "allowance", "privacy", "device"] as const;
export type Page = (typeof PAGES)[number];

export type AdminData = {
  guardian: { name: string; email: string };
  taught: { lessons: { id: string; text: string; at: string; provenance?: string }[]; personalCount: number; memoryBackend: string };
  routines: Routine[];
  wallet: { currency: "usd" | "krw"; balance: number; perSpendLimit: number; ledger: WalletEntry[]; stripe: boolean };
  privacy: { shown: number; summaryOnly: number; hidden: number };
  device: { paired: { id: string; pairedAt: string; label: string }[]; lastTalk: string };
  today: Summary;
  waiting: number;
};

type AdminCtx = {
  data: AdminData | null;
  busy: boolean;
  refresh: () => Promise<void>;
  run: (fn: () => Promise<unknown>, ok?: string) => void;
};

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin outside AdminShell");
  return ctx;
}

const POLL_MS = 3000;

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<AdminData | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/admin/data", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) setData((await res.json()) as AdminData);
    } catch {
      // keep the last data on screen
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const run = useCallback(
    (fn: () => Promise<unknown>, ok?: string) =>
      startTransition(async () => {
        try {
          await fn();
          if (ok) setNotice(ok);
        } catch {
          setNotice(A.error);
        }
        await refresh();
      }),
    [refresh],
  );

  const current = PAGES.find((p) => pathname === `/admin/${p}`) ?? null;

  return (
    <Ctx.Provider value={{ data, busy, refresh, run }}>
      <div className="fa ad theme-light">
        <LightPage />
        <IncomingCall />
        <header className="fa-header ad-header">
          <div>
            <Link href="/admin" className="ad-brand" aria-current={current === null ? "page" : undefined}>
              {A.title}
            </Link>
            <p className="fa-sub">{data ? A.signedInAs(data.guardian.name) : T.loading}</p>
          </div>
          <form action={logout}>
            <button className="ad-link" type="submit">
              {A.signOut}
            </button>
          </form>
        </header>

        <nav className="ad-tabs" aria-label={A.nav}>
          {PAGES.map((p) => (
            <Link key={p} href={`/admin/${p}`} className={p === current ? "ad-tab is-on" : "ad-tab"} aria-current={p === current ? "page" : undefined}>
              {A.tabs[p]}
            </Link>
          ))}
        </nav>

        {notice && (
          <p className="fa-notice ad-notice" role="status">
            {notice}
          </p>
        )}

        <main className="ad-main">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
