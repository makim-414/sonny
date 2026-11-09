"use client";

import { useEffect, useState } from "react";
import { clock } from "./derive";
import { EMPTY_REPORT, parseReport, type HealthReport } from "./health";
import { T } from "./strings";

// Mom's Health card: the last three blood-pressure readings and this week's memory
// check against last week. If the agent's health API is missing, it shows the empty state.

const POLL_MS = 10000;

const dayFmt = new Intl.DateTimeFormat(T.locale, { month: "short", day: "numeric", timeZone: "Asia/Seoul" });
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${dayFmt.format(d)} ${clock(iso)}`;
};

export default function HealthCard() {
  const [report, setReport] = useState<HealthReport>(EMPTY_REPORT);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/agent/health-report", { cache: "no-store" });
        if (!res.ok) return; // not there yet: keep the empty state
        const json: unknown = await res.json();
        if (!stopped) setReport(parseReport(json));
      } catch {
        // offline or not built yet
      }
    };
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const { bp, memory, memoryLastWeek } = report;
  const empty = bp.length === 0 && !memory;
  const delta = memory && memoryLastWeek ? Math.round(memory.score - memoryLastWeek.score) : null;

  return (
    <section className="fa-health" aria-label={T.healthTitle}>
      <h2 className="fa-section-title">{T.healthTitle}</h2>
      {empty ? (
        <p className="fa-health-empty">{T.healthNone}</p>
      ) : (
        <div className="fa-health-body">
          {bp.length > 0 && (
            <div className="fa-health-block">
              <h3 className="fa-health-label">{T.healthBp}</h3>
              <ol className="fa-health-list">
                {bp.map((r) => (
                  <li key={r.at} className={r.flag ? "fa-health-row is-out" : "fa-health-row"}>
                    <span className="fa-health-value">
                      {r.systolic}/{r.diastolic}
                      {r.flag && <span className="fa-health-flag">{r.flag === "high" ? T.healthHigh : T.healthLow}</span>}
                    </span>
                    <time className="fa-health-time">{when(r.at)}</time>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {memory && (
            <div className="fa-health-block">
              <h3 className="fa-health-label">{T.healthMemory}</h3>
              <p className="fa-health-value">
                {memory.score}/{memory.max}
              </p>
              <p className="fa-health-time">{delta === null ? T.healthNoLast : T.healthVsLast(delta)}</p>
            </div>
          )}
        </div>
      )}
      <p className="fa-health-note">{T.healthNote}</p>
    </section>
  );
}
