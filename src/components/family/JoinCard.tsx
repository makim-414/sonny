"use client";

import { useEffect, useState } from "react";
import { unlockAudio } from "./IncomingCall";
import { T } from "./strings";

// First visit on a phone (judges scan the TV's Family QR): "You're Grandma's family now."
// The big button is the tap iOS needs before any ring can make a sound later.
const JOINED_KEY = "sonny.joined";
const NAME_KEY = "sonny.familyName";

export default function JoinCard() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let joined = false;
    try {
      joined = window.localStorage.getItem(JOINED_KEY) === "1";
    } catch {
      // storage blocked: ask every time
    }
    const id = setTimeout(() => setShow(!joined), 0);
    return () => clearTimeout(id);
  }, []);

  const join = () => {
    unlockAudio();
    const n = name.trim().slice(0, 24) || T.joinGuest;
    try {
      window.localStorage.setItem(JOINED_KEY, "1");
      window.localStorage.setItem(NAME_KEY, n);
    } catch {
      // fine: the name just won't be remembered
    }
    document.cookie = `sonny_family_name=${encodeURIComponent(n)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    setShow(false);
  };

  if (!show) return null;
  return (
    <div className="fa-join" role="dialog" aria-modal="true" aria-label={T.joinTitle}>
      <span className="fa-call-orb is-ringing" aria-hidden />
      <h2 className="fa-join-title">{T.joinTitle}</h2>
      <p className="fa-join-body">{T.joinBody}</p>
      <label className="fa-join-field">
        <span>{T.joinName}</span>
        <input
          className="fa-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={T.joinGuest}
          maxLength={24}
          autoComplete="given-name"
        />
      </label>
      <button className="fa-btn fa-btn-primary fa-join-btn" onClick={join}>
        {T.joinButton}
      </button>
    </div>
  );
}
