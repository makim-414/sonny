"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PLAN, parsePlan, WEEKDAY_LIST, type HealthPlan as Plan, type Weekday } from "@/components/family/health";
import { A } from "./strings";

// Health check-ins on /admin: when Sonny calls grandma for a blood-pressure reading
// and a weekly memory check. Backed by the agent's /api/agent/health-plan and
// /api/agent/health-check; until they exist the section says so and stays quiet.

async function save(plan: Plan): Promise<boolean> {
  try {
    const res = await fetch("/api/agent/health-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(plan),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function HealthPlan() {
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const res = await fetch("/api/agent/health-plan", { cache: "no-store" });
        if (stopped) return;
        if (!res.ok) return setAvailable(false);
        setPlan(parsePlan(await res.json()));
        setAvailable(true);
      } catch {
        if (!stopped) setAvailable(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 2500);
    return () => clearTimeout(id);
  }, [note]);

  const update = async (next: Plan) => {
    setPlan(next);
    if (!(await save(next))) setNote(A.healthUnavailable);
    else setNote(A.saved);
  };

  const callNow = async (kind: "bp" | "memory") => {
    try {
      const res = await fetch("/api/agent/health-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      setNote(res.ok ? A.healthCalling : A.healthUnavailable);
    } catch {
      setNote(A.healthUnavailable);
    }
  };

  const off = available === false;

  return (
    <section className="ad-section ad-health" aria-label={A.healthTitle}>
      <h2 className="fa-section-title">{A.healthTitle}</h2>
      <p className="ad-caption">{off ? A.healthUnavailable : A.healthHint}</p>
      {note && (
        <p className="fa-notice" role="status">
          {note}
        </p>
      )}

      <div className="ad-card ad-health-row">
        <div className="ad-health-head">
          <h3 className="ad-card-title">{A.healthBp}</h3>
          <button
            type="button"
            role="switch"
            aria-checked={plan.bp.enabled}
            className={plan.bp.enabled ? "ad-switch is-on" : "ad-switch"}
            disabled={off}
            onClick={() => void update({ ...plan, bp: { ...plan.bp, enabled: !plan.bp.enabled } })}
          >
            {plan.bp.enabled ? A.healthOn : A.healthOff}
          </button>
        </div>
        <label className="ad-field">
          <span>{A.healthBpWhen}</span>
          <input
            type="time"
            value={plan.bp.time}
            disabled={off}
            onChange={(e) => void update({ ...plan, bp: { ...plan.bp, time: e.target.value } })}
          />
        </label>
        <button type="button" className="fa-btn" disabled={off} onClick={() => void callNow("bp")}>
          {A.healthCallNow}
        </button>
      </div>

      <div className="ad-card ad-health-row">
        <div className="ad-health-head">
          <h3 className="ad-card-title">{A.healthMemory}</h3>
          <button
            type="button"
            role="switch"
            aria-checked={plan.memory.enabled}
            className={plan.memory.enabled ? "ad-switch is-on" : "ad-switch"}
            disabled={off}
            onClick={() => void update({ ...plan, memory: { ...plan.memory, enabled: !plan.memory.enabled } })}
          >
            {plan.memory.enabled ? A.healthOn : A.healthOff}
          </button>
        </div>
        <div className="ad-row">
          <label className="ad-field">
            <span>{A.healthMemoryWhen}</span>
            <select
              value={plan.memory.day}
              disabled={off}
              onChange={(e) => void update({ ...plan, memory: { ...plan.memory, day: e.target.value as Weekday } })}
            >
              {WEEKDAY_LIST.map((d) => (
                <option key={d} value={d}>
                  {A.healthDays[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-field">
            <span>{A.time}</span>
            <input
              type="time"
              value={plan.memory.time}
              disabled={off}
              onChange={(e) => void update({ ...plan, memory: { ...plan.memory, time: e.target.value } })}
            />
          </label>
        </div>
        <button type="button" className="fa-btn" disabled={off} onClick={() => void callNow("memory")}>
          {A.healthCallNow}
        </button>
      </div>
    </section>
  );
}
