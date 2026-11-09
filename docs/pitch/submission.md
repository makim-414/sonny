# Submission checklist (c0mpiled-17 Seoul, 2026-11-09)

Deliverables: a 90 second demo video (Loom or YouTube) and a public GitHub repo URL. Judging starts at 15:00. Presentation in English.

State when this list was written (about 12:30): repo `makim-414/hyodo-tv` is **private**, default branch `build`, rename pending. First commit 10:03:48 KST (after the 10:00 start, so the repo is eligible).

## 1. Repo, before making it public

- [ ] All session branches merged into `build` by the integration session (TV screen, agent brain, family app and pitch).
- [ ] Final repo name decided. If renamed, update the GitHub URL in the README, the video end card and the submission form.
- [ ] No secrets. The API key lives only in the macOS keychain (`anthropic-hackathon-key`) and `package.json` only reads it. Check before going public:

```bash
git grep -n -I -E 'sk-ant-[A-Za-z0-9_-]{10,}|ANTHROPIC_API_KEY=[^\\"$]' $(git rev-list --all) -- . ':!pnpm-lock.yaml'
```

Prints nothing when clean (checked 12:30 across all branches: clean).

- [ ] No `.env*` files committed: `git ls-files | grep -i env` should print nothing.
- [ ] No personal data about grandma: no real name, address, phone number, clinic name or face in code, seed data, screenshots or docs. The demo uses "서울내과" as a made-up clinic.
- [ ] Check the first commit time is after 10:00 KST: `git log --reverse --format='%ci %s' | head -1`.
- [ ] Every commit is on `build`; nothing important is left only on a session branch.

## 2. Make the repo public

Owner or integration session runs this after section 1 is green (treat it as irreversible: once public, assume it has been cloned):

```bash
gh repo edit makim-414/hyodo-tv --visibility public --accept-visibility-change-consequences
```

- [ ] Open the URL in a private browser window while logged out and confirm it loads.

## 3. README (judges read this in 30 seconds)

The current README has the one-liner and run steps. Before submitting, make sure it has, in this order:

- [ ] One-line pitch: "Pickle covers your whole workday through Zoom. We cover grandma's whole day through her TV."
- [ ] The demo video link at the top (YouTube or Loom).
- [ ] What it does in 5 bullets: speaks first (medicine, weather), taxi to the hospital, learns from grandma (memory), groceries with family approval, family messages both ways, favorite show (one tool among many).
- [ ] Screenshot or GIF: TV screen next to mom's phone.
- [ ] How it works: one Claude agent with tools (memory, schedule, ride, order, EPG search, tune, family notify), TV web app, family web app, shared activity log. Link `docs/ARCHITECTURE.md`.
- [ ] Run: `pnpm install`, then `pnpm dev`, open `/tv` and `/family`. Explain the key comes from the keychain item `anthropic-hackathon-key`, or set `ANTHROPIC_API_KEY` yourself.
- [ ] Honest notes: ride and grocery services are mocked; TV guide is seed data cut from a real Korean listing; voice uses the browser's Web Speech API (Chrome).
- [ ] Built at c0mpiled-17 Seoul, 2026-11-09, YC RFS "AI for the Aging Population". Mention GBrain if the agent brain uses it (there is a side prize for gstack and GBrain use).
- [ ] Links to `docs/pitch/pitch.md` and `docs/pitch/demo-script.md`.

## 4. Demo video

- [ ] Recorded following `docs/pitch/demo-script.md` (TV on the left, phone on the right, English subtitles burned in).
- [ ] Length 1:30 or less. Check the exported file, not the editor timeline.
- [ ] Audio: Korean voices audible, English subtitles readable on a phone screen.
- [ ] Labels for anything mocked are visible on screen.
- [ ] No real personal data visible (names, addresses, phone numbers, faces).
- [ ] Uploaded to YouTube as **Unlisted** (or Loom with public link). Open the link logged out to confirm it plays.
- [ ] Link pasted into the README and into the submission form.

## 5. Submission form

- [ ] Event page: https://luma.com/compiled-8lsr (use the submission link the organizers share).
- [ ] Fields: team name, product name, one-liner, GitHub URL (public), video URL, track "AI for the Aging Population".
- [ ] Submit before 15:00. Screenshot the confirmation.

## 6. Live presentation

- [ ] Rehearse `docs/pitch/pitch.md` twice with a timer (target 1:50).
- [ ] Laptop on the venue Wi-Fi and a phone hotspot ready (venue Wi-Fi is slow).
- [ ] Fallback: the recorded video on the laptop desktop in case the live demo fails.
- [ ] `/family` open on a real phone for the approval tap, if showing it live.

## Timeline

| Time | What |
|---|---|
| 13:30 | Pitch and demo script frozen |
| 13:45 | Code freeze on `build`, integration test of the full day |
| 14:00 | Record the video (two takes) |
| 14:30 | Video uploaded, README updated, repo public |
| 14:45 | Form submitted |
| 15:00 | Judging |
