# gstack usage log

How this team used [gstack](https://github.com/garrytan/gstack) during c0mpiled-17 Seoul (2026-11-09). Times are KST from the system clock (approximate where marked).

| Time | Skill | How we used it | Output |
|---|---|---|---|
| 09:58 to 10:10 | `/office-hours` (Phase 2A startup diagnostic, read from source before install) | Ran the six forcing questions one at a time against the founder's real case (his grandmother, who lives alone and watches TV most of the day). It pushed us off the original "voice channel finder" wedge onto a TV agent that learns from the senior, with the mother as the paying user. | [office-hours.md](office-hours.md) |
| about 10:12 to 10:18 | gstack install | Official install: `git clone` + `./setup` into `~/.claude/skills/gstack`. Version 1.98.0.0, Claude host, full tier. Setup registered one Stop hook (session timeline). | installed skills |
| about 10:20 | `/office-hours` design doc | Wrote the session result in the installed skill's startup-mode design doc template (`office-hours/sections/design-and-handoff.md`). | [office-hours.md](office-hours.md) |
| 10:25 | `/office-hours` (installed skill, run via Skill tool) | Full run from the preamble through the design doc: Phase 2A diagnostic answered from the founder's session notes, premises, three alternatives, founder signals, builder profile logged, `gstack-redact` scan on the repo copy (one false positive, a session id read as a phone number, removed). Questions the founder has not answered are marked owner pending. | [office-hours-run.md](office-hours-run.md) |
| about 10:40 to 10:50 | `/setup-gbrain` | Followed the skill to install the GBrain CLI, init a keyless PGLite brain and run `doctor` for the product's memory. Skipped the MCP registration and CLAUDE.md steps because they change the owner's global setup. | [gbrain-usage.md](gbrain-usage.md) |
| pending | `/review` | Planned review of the `build` branch right after the 12:30 feature freeze. | `review.md` |

Note: inside this repo `gstack-slug` returned `art-rader-artrader-frontend` although `origin` is `makim-414/hyodo-tv`, so the `~/.gstack` design copy was saved under `projects/hyodo-tv` by hand.
