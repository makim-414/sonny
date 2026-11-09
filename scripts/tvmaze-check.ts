// Live check of the TVmaze provider. Run: npx tsx scripts/tvmaze-check.ts [guest name]
// 1. Finds a guest on today's US late-night talk shows (unless one is given).
// 2. "Dustin Hoffman" on a cold cache (pays for every schedule and cast lookup).
// 3. The late-night guest and "dustin hoff" on the warm cache.
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { searchPerson, TVMAZE_ATTRIBUTION } from "../src/lib/epg/providers/tvmaze";

// Same fix as NODE_OPTIONS in package.json: api.tvmaze.com has an unreachable IPv6
// route here and Node's default 250 ms happy-eyeballs window gives up on IPv4.
setDefaultAutoSelectFamilyAttemptTimeout(2000);

const nowISO = new Date().toISOString();

async function findLateNightGuest(): Promise<string | null> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(nowISO),
  );
  const headers = { "User-Agent": "sonny-demo" };
  const res = await fetch(`https://api.tvmaze.com/schedule?country=US&date=${today}`, { headers });
  const eps = (await res.json()) as {
    id: number;
    airtime: string;
    show: { name: string; type: string };
  }[];
  // Late night = talk shows starting 23:00 to 01:59 Eastern.
  const late = eps.filter(
    (e) => e.show.type === "Talk Show" && (e.airtime >= "23:00" || e.airtime < "02:00"),
  );
  for (const e of late) {
    const g = await fetch(`https://api.tvmaze.com/episodes/${e.id}/guestcast`, { headers });
    const cast = (await g.json()) as { person: { name: string } }[];
    if (cast[0]) {
      console.log(`late-night pick: ${cast[0].person.name} (${e.show.name}, ${today} ${e.airtime} ET)`);
      return cast[0].person.name;
    }
  }
  return null;
}

async function run(name: string) {
  const t0 = performance.now();
  const rows = await searchPerson(name, nowISO);
  const ms = Math.round(performance.now() - t0);
  console.log(`\n== ${name}: ${rows.length} result(s) in ${ms} ms`);
  for (const r of rows) console.log(JSON.stringify(r));
}

async function main() {
  console.log(`nowISO ${nowISO}`);
  // Pick the guest first (a few calls), then let TVmaze's 10 s rate window clear.
  const guest = process.argv[2] ?? (await findLateNightGuest());
  await new Promise((r) => setTimeout(r, 10_000));
  await run("Dustin Hoffman");
  if (guest) await run(guest);
  else console.log("no late-night guest found today");
  await run("dustin hoff"); // case-insensitive substring, warm cache
  console.log(`\n${TVMAZE_ATTRIBUTION}`);
}

main();
