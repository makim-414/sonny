# Sonny: submission (c0mpiled-17 Seoul, 2026-11-09)

The form asks for three things: the 90 second demo video, the GitHub repo (https://github.com/makim-414/sonny) and a short description. The description is right below; the checklist follows.

## Short description (paste into the form)

**Tagline (6 words):** Sonny: the grandkid who's always home.

Backup taglines: "Grandma just talks. Mom stops worrying." / "A voice agent for parents who live alone."

**About 50 words (52):**

Sonny is the grandkid who's always home: a voice agent for parents who live alone. Grandma taps one icon and talks. Sonny handles pills, rides and groceries from an allowance mom tops up, calls mom before anything big, and learns what grandma teaches. Mom sees what got done, never what was said.

**About 150 words (147):**

Sonny is the grandkid who's always home: a voice agent for parents who live alone, paid for by their worried adult children. Today those children are already their parent's remote agent: this morning my mom booked my grandmother's taxi from her own phone, then called to check. Sonny takes that job. Grandma taps one icon, nothing to learn, and Sonny speaks first: pills, weather, the day ahead. She asks for a ride or groceries and it's paid from an allowance mom tops up; anything big or strange, Sonny calls mom first. Grandma teaches Sonny her recipes and routines, and it remembers. Mom sees what got done, never what was said. Built with a Claude agent calling real tools, GBrain for long-term memory, Kokoro for the voice and Silero VAD for hands-free listening, all self-hostable open source. Next: a TV dongle for the screen she watches all day.

## Checklist

Deliverables: a 90 second demo video (Loom or YouTube) and a public GitHub repo URL. Judging starts at 15:00. Presentation in English.

State at 11:10: repo https://github.com/makim-414/sonny is **private**, default branch `build`. Product name: **Sonny** (`src/lib/brand.ts`). First commit 10:03:48 KST (after the 10:00 start, so the repo is eligible). Submission form: Google Form, link expected around 13:30.

## 1. Repo, before making it public

- [ ] All session branches merged into `build` by the integration session (TV screen, agent brain, family app and pitch).
- [x] Product name Sonny set in `src/lib/brand.ts` and used across `docs/pitch/`.
- [ ] Leftover old names on screens and in copy: search for 손주 TV, Sonju, 효도, Hyodo (internal `HYODO_` env vars and `~/.hyodo-tv` stay until after the demo).
- [x] Repo renamed to https://github.com/makim-414/sonny. Use this URL in the README, the video end card and the form.
- [ ] Demo passwords in `src/lib/auth/users.ts` are test values on purpose (listed in the README). No real password anywhere.
- [ ] No secrets. The API key lives only in the macOS keychain (`anthropic-hackathon-key`) and `package.json` only reads it. Check before going public:

```bash
git grep -n -I -E 'sk-ant-[A-Za-z0-9_-]{10,}|ANTHROPIC_API_KEY=[^\\"$]' $(git rev-list --all) -- . ':!pnpm-lock.yaml'
```

Prints nothing when clean (checked 12:30 across all branches: clean).

- [ ] No `.env*` files committed: `git ls-files | grep -i env` should print nothing.
- [ ] No personal data about grandma: no real name, address, phone number, clinic name or face in code, seed data, screenshots or docs. The demo uses "Dr. Kim's clinic" as a made-up clinic.
- [ ] Check the first commit time is after 10:00 KST: `git log --reverse --format='%ci %s' | head -1`.
- [ ] Every commit is on `build`; nothing important is left only on a session branch.

## 2. Make the repo public

Integration session runs this only after section 1 is green **and the owner says yes** (treat it as irreversible: once public, assume it has been cloned):

```bash
gh repo edit makim-414/sonny --visibility public --accept-visibility-change-consequences
```

- [ ] Open the URL in a private browser window while logged out and confirm it loads.

## 3. README (judges read this in 30 seconds)

The current README has the one-liner and run steps. Before submitting, make sure it has, in this order:

- [ ] One-line pitch: "Pickle covers your whole workday through Zoom. We cover grandma's whole day through her TV."
- [ ] The demo video link at the top (YouTube or Loom).
- [ ] The core message first: a screen with nothing to learn. "No buttons. No menus. One icon, like the call button she already knows." A GIF of the tap and the particle.
- [ ] Two pillars: grandma hands things off to the agent; mom sees what got done, not what was said.
- [ ] What it does in 5 bullets: speaks first (medicine, weather), taxi to the hospital, learns from grandma (memory, lesson counter), groceries with family approval, family messages both ways, favorite show (one tool among many).
- [ ] Distribution in five steps: 0 phone web app on the home screen (today), 1 HDMI stick or USB app, 2 Android and Google TV app, 3 HDMI pass-through box over the set-top box (CEC or IR), 4 the TV itself.
- [ ] Screenshot or GIF: TV screen next to mom's phone.
- [ ] Open source, near the top: "Everything runs on open source you can self-host: Kokoro voice, Silero VAD, GBrain memory." Link `docs/OPEN_SOURCE.md` (every project 1,000+ stars, with license and how we use it).
- [ ] Market line: launches in English for English-speaking seniors first; the founder's Korean grandmother is the origin story. The app language is one switch, `APP_LANG` in `src/lib/brand.ts`.
- [ ] Demo accounts section (test values only, from `src/lib/auth/users.ts`):
  - Family admin: `/login`, email `mom@sonny.demo`, password `grandma-demo`.
  - Grandma's phone: pair from the admin, Device page (`/admin/device`), "Connect grandma's phone", scan the QR. Or open `/?demo=1`.
  - Skip sign-in anywhere with `?demo=1` (`/admin?demo=1`, `/family?demo=1`, `/?demo=1`).
  - Note: sessions are signed cookies; set `AUTH_SECRET` in any real deployment. `AUTH_MODE=off` turns sign-in off.
- [ ] Family admin and allowance: "Mom sets it up once from the admin: scans one QR on grandma's phone, done." and "Mom tops up an allowance; grandma spends it by voice; anything big waits for Mom's OK." Top-ups are demo credits until `STRIPE_SECRET_KEY` is set, then Stripe Checkout in test mode.
- [ ] How it works: one Claude agent with tools (memory, schedule, ride, order, EPG search, tune, family notify), TV web app, family web app, shared activity log. Link `docs/ARCHITECTURE.md`.
- [ ] Run: `pnpm install`, then `pnpm dev`, open `/admin` (sign in as the demo account), `/?demo=1` (grandma), `/tv?demo=1` (TV mode). Explain the key comes from the keychain item `anthropic-hackathon-key`, or set `ANTHROPIC_API_KEY` yourself.
- [ ] Honest notes: ride and grocery services are mocked; TV guide is seed data cut from a real Korean listing; voice uses the browser's Web Speech API (Chrome).
- [ ] Built at c0mpiled-17 Seoul, 2026-11-09, YC Fall 2026 RFS "AI for the Aging Population" (not in the Winter 2027 list; do not claim it is).
- [ ] A clear line for the gstack and GBrain side prize: "Built with GBrain (grandma's long-term memory, with provenance and corrections) and gstack (office hours, review)." Link `docs/gstack/` as evidence.
- [ ] Privacy line: no camera; mom sees tasks and safety, not conversations; private talk never leaves the server (`docs/family-app-contract.md`).
- [ ] Links to `docs/pitch/pitch.md` and `docs/pitch/demo-script.md`.

## 4. Demo video

- [ ] Recorded following `docs/pitch/shot-list.md` and `docs/pitch/demo-script.md` (grandma's phone on the left, mom's phone on the right, all lines in English with captions).
- [ ] The lesson counter shows the real count from memory with its "demo count" tag. No fixed or padded number.
- [ ] Length 1:30 or less. Check the exported file, not the editor timeline.
- [ ] Audio: voices clear, captions readable on a phone screen.
- [ ] Labels for anything mocked are visible on screen.
- [ ] No real personal data visible (names, addresses, phone numbers, faces).
- [ ] Uploaded to YouTube as **Unlisted** (or Loom with public link). Open the link logged out to confirm it plays.
- [ ] Link pasted into the README and into the submission form.

## 5. Submission form

- [ ] Google Form link from the organizers (expected around 13:30; event page https://luma.com/compiled-8lsr).
- [ ] Video URL (YouTube Unlisted or Loom), GitHub URL https://github.com/makim-414/sonny (public), short description (pick the 50 or 150 word version to fit the field).
- [ ] Submit by 14:30. Screenshot the confirmation.

## 6. Live presentation and the QR demo

- [ ] Rehearse `docs/pitch/pitch.md` with a timer (target 1:55, hard stop 2:00).
- [ ] Two QR codes the judges can scan, on a printed card or a screen: "Be grandma" opens `/?demo=1`, "Be her daughter" opens `/family?demo=1`. Without `?demo=1` they land on a sign-in page. Both use the on-site tunnel address (it changes on every restart, so generate or check them right before judging). Scan both with a phone on mobile data.
- [ ] The presenter's phone has the Sonny icon on its home screen, signed in, as the backup grandma.
- [ ] Reset the store just before judging so the judges see a clean feed.
- [ ] Rehearse the judge loop three times: judge one scans "Be grandma" and talks, judge two scans "Be her daughter" and taps "I'll be there at 7 tonight", grandma's phone reads it, judge one answers, the reply card fills on judge two's phone.
- [ ] Mic permission: iOS Safari asks on first use; have the judge tap Allow. If a phone blocks the mic, hand over the presenter's phone.
- [ ] Optional: `/tv` on a monitor over HDMI to show "next, her TV" (boot screen with `?boot`).
- [ ] Fallbacks: typed input on `/` if the mic fails, phone hotspot if Wi-Fi fails, the 90 second video on the desktop if both fail.

## Timeline (STATUS.md)

| Time | What |
|---|---|
| 12:15 | Sign-in, admin, allowance and the "Sonny is calling" screen done |
| 12:30 | Feature freeze, merge into `build` |
| 13:00 to 13:30 | Record the 90 second video (`docs/pitch/shot-list.md`) |
| 13:30 | Form link published; edit and upload the video |
| 14:30 | Submit the form (repo public only after the owner says yes) |
| 15:00 | Build closes, judging |
