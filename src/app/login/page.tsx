import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { L } from "./strings";
import { DEMO_GUARDIAN } from "@/lib/auth/users";
import "@/components/family/family.css";
import "./login.css";

export const metadata: Metadata = { title: L.title };

function safeNext(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  return (
    <>
      <LoginForm next={next} />
      <p className="lg-demo">
        <Link href={`${next.split("?")[0]}?demo=1`} prefetch={false}>
          {L.demo}
        </Link>
        <span>
          {DEMO_GUARDIAN.email} · {DEMO_GUARDIAN.password}
        </span>
      </p>
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="fa lg">
      <main className="lg-card">
        <h1 className="lg-title">{L.title}</h1>
        <p className="lg-sub">{L.sub}</p>
        <Suspense fallback={<LoginForm next="/admin" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
