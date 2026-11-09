# gstack usage log

How this team used [gstack](https://github.com/garrytan/gstack) during c0mpiled-17 Seoul (2026-11-09). Times are KST.

| Time | Skill | How we used it | Output |
|---|---|---|---|
| 09:58 to 11:05 | `/office-hours` (Phase 2A startup diagnostic, read from source before install) | Ran the six forcing questions one at a time against the founder's real case (his grandmother, who lives alone and watches TV most of the day). It pushed us off the original "voice channel finder" wedge onto a TV agent that learns from the senior, with the mother as the paying user. | [office-hours.md](office-hours.md) |
| 11:10 to 11:25 | gstack install | Official install: `git clone` + `./setup` into `~/.claude/skills/gstack`. Version 1.98.0.0, Claude host, full tier. Setup registered one Stop hook (session timeline). | installed skills |
| 11:30 | `/office-hours` design doc | Wrote the session result in the installed skill's startup-mode design doc template (`office-hours/sections/design-and-handoff.md`). | [office-hours.md](office-hours.md) |
| 10:25 (system clock) | `/office-hours` (installed skill, run via Skill tool) | Full run from the preamble through the design doc: Phase 2A diagnostic answered from the founder's session notes, premises, three alternatives, founder signals, builder profile logged, `gstack-redact` scan on the repo copy (one false positive, a session id read as a phone number, removed). Questions the founder has not answered are marked owner pending. | [office-hours-run.md](office-hours-run.md) |
| pending | `/review` | Planned review of the `build` branch right after the 12:30 feature freeze. | `review.md` |
