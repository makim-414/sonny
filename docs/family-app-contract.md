# Family app contract

Owner: family-pitch session (`src/app/family/**`, `src/app/api/family/**`, `src/app/api/events/**`, `src/components/family/**`).
What mom's phone (`/family`) reads, what it sends to the TV, and what the agent should log so the phone shows the right thing.

Language: every string on the phone lives in `src/components/family/strings.ts` (ko and en). `APP_LANG` in `src/lib/brand.ts` picks one; with `"en"` the routes also log "Mom: ..." instead of "엄마: ...". The parsers below match both Korean and English wording.

## Sign-in (src/proxy.ts, src/lib/auth/**)

- Admin pages: `/admin` (overview) and `/admin/today`, `/admin/taught`, `/admin/routines`, `/admin/allowance`, `/admin/privacy`, `/admin/device`, all in one shared frame (`src/app/admin/layout.tsx`).
- Guardian pages and data (`/admin/**`, `/admin/data`, `/family`, `/api/family`, `/api/events`) need the guardian cookie. Pages redirect to `/login`, APIs answer 401.
- Grandma's side (`/`, `/tv`, `/remote`, `/api/agent/**`, `/api/family/inbox`) needs a paired device cookie or a guardian cookie. Pages redirect to `/login/device`.
- `?demo=1` on any of them signs in as the demo guardian or demo device. `?pair=<token>` (from the admin QR) pairs a device. `AUTH_MODE=off` disables all checks.
- The TV and grandma's phone keep polling `/api/family/inbox`; that works as long as the device was paired or opened with `?demo=1` once.

## Routes

| Route | Who calls it | What it does |
|---|---|---|
| `GET /api/family` | `/family`, every 2 s | `{ events, hiddenCount, summary, approvedIds, inboxWaiting }`. `events` is the family view (below), `summary` is computed on the server from the raw log. |
| `POST /api/family` `{ text, from? }` | `/family` | Puts `{ id, at, from: "엄마", text }` into `store.tvInbox` and logs `family` "엄마: text". |
| `POST /api/family` `{ approve: eventId }` | `/family` approval card | Marks the request approved, puts "엄마가 승인했어요. 진행해 주세요: (request text)" into `tvInbox`, logs `family` "엄마: 택시 요청을 승인했어요". |
| `GET /api/family/inbox` | The TV, every 3 s | Returns everything waiting and clears the inbox. |
| `GET /api/events` | Anyone | The family view of the log, oldest first. `?since=<event id or ISO time>` for newer only. |
| `GET /api/events?view=all` | TV, debugging | Raw log, including private lines. Not for the phone. |
| `POST /api/events` `{ kind, text, at?, visibility?, familyText? }` | Demo seeding | Calls `logEvent`. |

## Privacy: what the phone can see

Redaction happens on the server in `src/app/api/family/view.ts`. Private words never reach the phone, not even in the network panel.

| `visibility` | On the phone |
|---|---|
| `family` | Shown. Uses `familyText` if present, else `text`. |
| `summary` | Only `familyText` is shown. If there is no `familyText`, the line is hidden and counted. |
| `private` | Hidden and counted: "할머니의 사적인 대화 N건은 표시하지 않았어요." |
| not set | `heard` and `said` count as private (or summary if `familyText` is set). Every other kind counts as `family`. |

The agent's echo of inbox items ("엄마 → TV: ...") is dropped because `POST /api/family` already logged it. Agent bookkeeping is dropped too: memory lookups ("기억 찾기", "기억 꺼냄") and brain errors ("두뇌 오류").

## What the agent should log

- **Approval card (taxi or order):** kind `task` (or `alert`), visibility `family`, text mentions 택시 / 카카오T / 차량 / 배차 (taxi) or 주문 / 장보기 / 배달 / 구매 / 마트 (order). Example: `logEvent("task", "택시 요청: 집 앞에서 서울내과, 10분 뒤 도착", now, { visibility: "family" })`.
- **Other tasks:** kind `task`, shown with the label "할 일".
- **Alert color:** optional prefix `[info]`, `[warn]`, `[urgent]` (or the agent's `가족 알림(urgent):`). No prefix means warn, unless the text has 아프 / 가슴 / 응급 / 119, which means urgent. Any urgent alert turns the summary line red: "확인이 필요한 알림이 있어요. 지금 전화해 보세요."
- **Grandma's answer to mom:** kind `family`, text starting with `할머니 답 요약:` or `Grandma's reply:` (no "엄마:" or "Mom:" prefix). Shown as "할머니 소식" and in the reply card under the message mom just sent.
- **Medicine taken:** any non-question event that says 약 ... 먹었/먹음/드셨/복용 (for example `memory` "건강 기록: 아침 약 먹음", or a private `heard` "방금 약 먹었어"). The summary reads it from the raw log, so it works even when the words are private.
- **Grandma's personal talk and lessons she did not share:** visibility `private`. Shareable lessons: `memory` with visibility `family` (label "기록").
- **TV state:** `store.currentChannel`, else the last `tuned` event (first "N번" in its text).

## Summary line (top of the phone)

From the raw log: last time grandma spoke (`heard`, ignoring proactive triggers), medicine status, TV channel, and one reassurance line: green "오늘은 전화 안 하셔도 괜찮아요." when she talked today and took her medicine with no urgent alert.

## Hidden setup on grandma's phone (`/setup`)

- Opened by a 2 second long-press on the top-left corner of `/` (wired by the TV session), or directly at `/setup`. Needs a paired device or a guardian session (proxy), then the family PIN (`FAMILY_PIN`, demo `0000`, checked on the server).
- Saved on the phone in localStorage (every read and write in try/catch). Grandma's screen reads the same keys:

| Key | Values | Default |
|---|---|---|
| `sonny.rate` | `"0.7"`, `"0.85"`, `"1"` (voice speed) | `"0.85"` |
| `sonny.waitMs` | `"1500"`, `"2000"`, `"3000"` (silence before Sonny answers) | `"2000"` |
| `sonny.textScale` | `"normal"`, `"large"`, `"xlarge"` | `"normal"` |
| `sonny.captions` | `"on"`, `"off"` | `"on"` |
| `sonny.volume` | `"0"` to `"1"` in steps of 0.1 | `"1"` |
| `sonny.lang` | `"en"`, `"ko"` | `APP_LANG` |

- Also on the page: a test sound (Kokoro through `/api/tts`, at the chosen volume and speed), a mic test (level bar plus live transcript), and "Disconnect this phone" (asks twice; drops the device cookie and its row in the admin's device list).

## Nudge calls (`reason: "nudge"`)

- Sonny rings mom to suggest a call to grandma, with something to talk about. No wallet entry (`walletEntryId` absent, `amount: 0`).
- The call screen shows "Call grandma now" (decision `approve`) and "Remind me at 7 PM" (decision `missed`; a spoken "no" or the ring-screen Decline also means later).
- `approve`: tvInbox gets "Mom approved call <id>: Mom is calling grandma now. Tell grandma "Mom's going to call you."".
- `missed`: tvInbox gets "Mom missed call <id>: Mom will call grandma at 7 PM." and Today shows a task line "7 PM: call grandma".
- Demo: `POST /api/family/calls/demo?demo=1 { "reason": "nudge", "script"? }`.
- The Kokoro read-out waits at most 5 seconds, then the browser voice reads the script instead.
