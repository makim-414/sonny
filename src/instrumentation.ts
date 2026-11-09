// Runs once when the Next.js server starts. Warms the TVmaze listings cache in the
// background so the first "When is ... on TV?" during the demo answers from live data.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/epg/live");
  }
}
