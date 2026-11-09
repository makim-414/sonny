# TVmaze provider

`src/lib/epg/providers/tvmaze.ts` answers "when is <person> on US TV this week?" from the free TVmaze API (no key). Show `TVMAZE_ATTRIBUTION` ("TV data: TVmaze") wherever this data appears. TVmaze data is CC BY-SA.

## API

- `searchPerson(query, nowISO)` returns `{ show, network, startISO, role, guest }[]`.
  - Gets `GET /schedule?country=US&date=YYYY-MM-DD` for today and the next 6 days. "Today" is the US Eastern date of `nowISO`: TVmaze's US schedule uses US local dates, and Korea is a day ahead of the US.
  - For every scheduled show it gets `GET /shows/{id}/cast` (gives `guest: false`, `role` = character). For every scheduled episode it gets `GET /episodes/{id}/guestcast` (gives `guest: true`).
  - A person matches when the query is a case-insensitive substring of their name, so `"dustin hoff"` finds Dustin Hoffman. If the same person matches twice in one episode, they are listed once and the regular cast wins.
  - Results are sorted by `startISO`. Shows that have not ended yet come first. Shows that already aired come after them, oldest first (ends are worked out from the runtime).
  - It never throws and returns `[]` on any error (bad `nowISO`, a schedule that will not load, a lookup that still fails after retries). A 404 cast list counts as empty, not as an error.
- `warmTvmaze(nowISO)` fills the cache. Call it once at server start (see Cost).
- `TVMAZE_ATTRIBUTION = "TV data: TVmaze"`.

## Limits built in

| What | Value |
|---|---|
| User-Agent | `sonny-demo` |
| Timeout per request | 5 s (`AbortSignal.timeout`) |
| Concurrent requests | 6 max (a slot passes straight to the next waiter) |
| Rate | 19 request starts per 10 s window (TVmaze allows 20 per 10 s per IP) |
| Retries | up to 4 on reset, timeout, 429 or 5xx, each after a 5 to 11 s pause |
| Cache | in memory, 6 h per schedule day and per cast list; parallel callers share one request; failures are not cached |

## Cost (measured 2026-11-09)

TVmaze enforces its rate limit hard. In a burst of 40 calls, exactly 20 came back 200 and the other 20 got `ECONNRESET`, even for responses TVmaze had cached. A cold scan is 7 schedule days + about 266 show casts + about 520 episode guest casts, so about 790 calls. At 20 calls per 10 s that takes about 7 minutes no matter how it is done. After that every search is answered from memory in a few ms for 6 hours. So the server should call `warmTvmaze(new Date().toISOString())` at boot, and the agent should not call `searchPerson` cold during a live turn.

Node note: `api.tvmaze.com` has an IPv6 address that cannot be reached from here. Node's default 250 ms happy-eyeballs window then gives up before IPv4 connects. The app's `dev`/`start` scripts already set `--network-family-autoselection-attempt-timeout=2000`. The check script sets the same value through `net.setDefaultAutoSelectFamilyAttemptTimeout(2000)`.

## Check run

`npx tsx scripts/tvmaze-check.ts [guest]` first picks a guest from today's US late-night talk shows (Eastern 23:00 to 01:59). Then it searches "Dustin Hoffman" on a cold cache, then the guest and "dustin hoff" on the warm cache.

Run on 2026-11-09 11:02 KST (Mac, home network), wall time 7:08:

| Query | Cache | Results | Time |
|---|---|---|---|
| Dustin Hoffman | cold | 5 | 415,570 ms |
| Ariana Grande (late-night pick) | warm | 2 | 4 ms |
| dustin hoff | warm | 5 | 3 ms |

I checked one result against the API by hand: episode 3803610 of "Today" (2026-11-10T12:00Z) lists Dustin Hoffman in `/episodes/3803610/guestcast`.

Output:

```
nowISO 2026-11-09T02:02:13.570Z
late-night pick: Ariana Grande (The Tonight Show Starring Jimmy Fallon, 2026-11-08 23:59 ET)
== Dustin Hoffman: 5 result(s) in 415570 ms
{"show":"Today","network":"NBC","startISO":"2026-11-10T12:00:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"TODAY with Jenna & Sheinelle","network":"NBC","startISO":"2026-11-10T15:00:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"The Tonight Show Starring Jimmy Fallon","network":"NBC","startISO":"2026-11-11T04:35:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"Late Night with Seth Meyers","network":"NBC","startISO":"2026-11-12T05:35:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"Sunday TODAY with Willie Geist","network":"NBC","startISO":"2026-11-08T13:00:00.000Z","role":"Dustin Hoffman","guest":true}
== Ariana Grande: 2 result(s) in 4 ms
{"show":"The Tonight Show Starring Jimmy Fallon","network":"NBC","startISO":"2026-11-09T04:59:00.000Z","role":"Ariana Grande","guest":true}
{"show":"The Voice","network":"NBC","startISO":"2026-11-10T02:00:00.000Z","role":"Coach","guest":false}
== dustin hoff: 5 result(s) in 3 ms
{"show":"Today","network":"NBC","startISO":"2026-11-10T12:00:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"TODAY with Jenna & Sheinelle","network":"NBC","startISO":"2026-11-10T15:00:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"The Tonight Show Starring Jimmy Fallon","network":"NBC","startISO":"2026-11-11T04:35:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"Late Night with Seth Meyers","network":"NBC","startISO":"2026-11-12T05:35:00.000Z","role":"Dustin Hoffman","guest":true}
{"show":"Sunday TODAY with Willie Geist","network":"NBC","startISO":"2026-11-08T13:00:00.000Z","role":"Dustin Hoffman","guest":true}
TV data: TVmaze
```

"Sunday TODAY with Willie Geist" (2026-11-08T13:00Z) had already aired at `nowISO`, so it is sorted last. Ariana Grande's Fallon slot (2026-11-09T04:59Z = 2026-11-08 23:59 ET) was still upcoming. Her second hit is The Voice, where she is in the regular cast (`role: "Coach"`, `guest: false`).
