"use client";

import { useEffect } from "react";

// Mom's screens are read in daylight on a phone: switch the whole document to the
// DS light theme (theme-light.css matches :root[data-theme="light"]) while one is open.
// Each page wrapper also carries the "theme-light" class so the first paint is light.
export default function LightPage() {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    root.dataset.theme = "light";
    return () => {
      if (before) root.dataset.theme = before;
      else delete root.dataset.theme;
    };
  }, []);
  return null;
}
