# Design: Hyodo TV, a TV agent that learns from the senior it lives with

Run log: gstack `/office-hours` v1.98.0.0, invoked through the Skill tool on branch `gstack-usage`, 2026-11-09 10:25 KST. Telemetry: off. Cross-session copy saved in `~/.gstack/projects/hyodo-tv/`.
Status: DRAFT (approval pending from the founder)
Mode: Startup (Phase 2A), stage: pre-product.
Supersedes: none (first design doc on this branch). Earlier hand-run notes: [office-hours.md](office-hours.md).

## How this run was done
The founder's answers came from the session files `BRIEF.md`, `STATUS.md` and `office-hours-verdict.md` (c0mpiled-17 session folder). Questions the founder has not answered yet are marked **[owner pending]**, not guessed.

| Step | Ran? | Note |
|---|---|---|
| Preamble (`gstack-skill-start`) | yes | protocol 1, REPO_MODE solo, TELEMETRY off |
| Phase 1 context (git log, prior designs, builder profile) | yes | no prior design docs; builder profile tier: introduction |
| Phase 1 goal question | answered from files | Startup intent, pre-product (the hackathon is the build venue) |
| Prior learnings: cross-project opt-in | **[owner pending]** | left unset, so no learnings were searched across projects |
| Phase 2A diagnostic (Q1 to Q6) | yes, from files | routing for pre-product: Q1, Q2, Q3, plus Q4 as the hackathon wedge |
| Phase 2.75 landscape search | skipped | privacy gate is an owner question **[owner pending]**. Used the team's earlier research instead (`agent-ideas.md`: Ato, Kolvia, JoyCalls) |
| Phase 3 premises | yes | agreement **[owner pending]** |
| Phase 3.5 second opinion | skipped | optional, and short on time |
| Phase 4 alternatives | yes | choice **[owner pending]**, recommendation below |
| Phase 4.25 visual design | skipped | the TV screen is already being built in the `tv-screen` session |
| Spec review loop | skipped | deadline 11:20 |

## Problem Statement
A senior who lives alone spends most of her waking hours watching TV. Her daughter visits every third day. In between, the daughter learns how her mother is doing only by phoning to check, over and over.

## Diagnostic (Phase 2A forcing questions)

| Q | Founder's answer (from files) | Strength | What would make it strong |
|---|---|---|---|
| Q1 Demand reality | The founder watched his grandmother spend a long time each day flipping through about 220 channels (about 40 min/day, an estimate). No one has used or paid for anything yet. | Medium: the pain is observed; there is no demand evidence. | Someone who would be upset if it disappeared. Today the closest thing is the mother's price answer **[owner pending]**. |
| Q1 reframed for the "student" character | Gallery clients (retired, 65 and over) like teaching, like feeling useful to society, and have time. The founder has never seen his grandmother teach someone; that is to be checked with the mother. | Medium: strong founder-market fit, but the answer is about a category, not a person. | One real scene: who taught whom, what, and for how long **[owner pending]**. |
| Q2 Status quo | Senior: the remote, and most remotes already have voice search. Daughter: repeated check-in calls. | Strong for the daughter, weak for the channel feature. | The number of calls per day **[owner pending]**. |
| Q3 Desperate specificity | The mother. Between visits she has no way to know if things are fine except calling. An activity feed of what her mother asked the agent to do (orders, requests), with privacy levels, replaces the check-in call. | Strong: the person who pays is the person who worries, and her workaround is concrete. | Her own words about what she fears. |
| Q4 Narrowest wedge | One loop: the senior teaches the agent, it remembers and speaks first the next day, it does a small task by tool call, and the daughter's feed updates. | Medium: still wider than "one feature". | Something the daughter would pay for this week: the feed alone. |
| Q5 Observation | Not yet. No one has watched the grandmother use any prototype. | Weak | Assignment below. |
| Q6 Future fit | Seniors' time and knowledge get a use they never had: people now pay for human-taught post-training data. Realtime voice and agent memory became cheap in late 2026. | Medium: the first half is our own thesis; the second half is a rising tide every competitor can cite. | Proof that someone buys senior-taught data. |

Failure patterns named during the session: "platform vision" (seven features at once) and "solution looking for a problem" (the channel finder, when carrier remotes already have voice search).

## Premises [owner pending: agree or disagree]
1. The buyer is the adult daughter. The senior is the daily user. The product's job is to replace the check-in phone call.
2. Seniors would rather be useful than be cared for. Selling "teach an AI" instead of "get a companion" removes the stigma and becomes the distribution edge (first channel: the founder's gallery clients).
3. The senior will talk to the TV if the TV speaks first and lowers its volume while she answers.
4. Privacy is set by the senior: the daughter sees tasks and status by default, and taught stories only when the senior shares them.

## Approaches Considered
- **A. Minimal viable: the family activity feed.** Agent actions are logged with privacy levels and pushed to the daughter's phone. Effort S, risk low. It proves premise 1 fastest but looks like a dashboard, not an agent.
- **B. Ideal architecture: the full in-TV assistant.** Conversation, proactive check-ins, memory, schedule, news, family link and TV control behind one agent with tools, deployed later on an HDMI stick or passthrough box. Effort XL, risk high for a 5-hour build.
- **C. Creative/lateral: the student agent plus the feed (recommended).** The senior teaches, the agent remembers and speaks first, it does one tool call, and the daughter's feed updates. Effort M, risk medium. It is the only version that answers "how is this different from Ato?" in one demo.

**RECOMMENDATION:** Choose C, because the founder's goal today is to win the judging on clarity, technical implementation and creativity, and C is the only approach that shows all three in 90 seconds. Approval **[owner pending]**. The main session's build already follows C.

## Open Questions [owner pending]
- Has the grandmother ever enjoyed teaching someone? (Ask the mother.)
- Has she used the remote's voice button? If not, why not?
- What would the mother pay each month?
- How many check-in calls does the mother make each day?

## Success Criteria
- A judge scans the QR code, speaks, and sees the TV act, remember, and update the family phone, with no hand-holding.
- One real quote from the mother or a gallery client in the pitch.

## Distribution Plan
Gallery clients first, pitched as "teach an AI". Later, bundles with carrier set-tops and TV makers.

## The Assignment
Before lunch, phone the mother and ask four things: has the grandmother enjoyed teaching someone, has she used the voice remote, how many times a day does the mother call, and what would she pay each month. Then text three gallery clients the two pitch versions ("a companion for when you're alone" versus "teach an AI from your experience") and count the replies.

## What I noticed about how you think
You corrected the framing three times in an hour, each time toward a person rather than a feature: from finding a channel, to the grandmother as a teacher, to the mother who keeps phoning. The last correction is the one a YC partner would fund. Lead with it.

## Founder signals (Phase 4.5)
Observed: real problem, named specific users (the grandmother and the mother), pushed back on premises (twice), domain expertise (years of serving retired clients), agency (building today). Count: 5.
Builder profile before this session: PROFILE_READ=ok SESSION_TIER=introduction PRIOR_SESSION_COUNT=0 LAST_PROJECT= LAST_ASSIGNMENT= CROSS_PROJECT=false

## Tool notes
- `gstack-slug` returned `art-rader-artrader-frontend` inside this repo, although `origin` is `makim-414/hyodo-tv`. The `~/.gstack` copy of this doc was saved under `projects/hyodo-tv` by hand.
