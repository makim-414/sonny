"use client";

import { useState } from "react";
import { A } from "./strings";

// Presenter's safety net: rings every family phone with a "grandma is stuck" call,
// in case the live voice moment does not trigger it on stage.
export default function StuckDemo() {
  const [note, setNote] = useState("");
  const ring = async () => {
    try {
      const res = await fetch("/api/family/calls/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "struggle" }),
      });
      setNote(res.ok ? A.stuckRinging : A.error);
    } catch {
      setNote(A.error);
    }
    setTimeout(() => setNote(""), 3000);
  };
  return (
    <div className="ad-stuck">
      <button type="button" className="fa-btn fa-btn-primary ad-stuck-btn" onClick={() => void ring()}>
        {A.stuckButton}
      </button>
      {note && (
        <p className="fa-notice" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
