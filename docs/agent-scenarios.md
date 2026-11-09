# 에이전트 시나리오 결과

`POST /api/agent` 를 `curl` 로 직접 불러 확인했다. 2026-11-09 11:06 KST, 브랜치 `claude/agent-brain-ef4b57` (build 머지 후, `APP_LANG = "en"`, 이름 Sonny).
맨 앞에 `POST /api/agent/reset` 을 한 번 부르고, 17턴을 한 대화로 이어서 돌렸다. 초기화하면 기억과 지갑($80)이 시드로 돌아간다. 시각은 요청의 `now` 로 넣었다.

- 기억: GBrain 0.60.619.0, keyless PGLite. 언어마다 엔티티를 따로 쓴다(`grandma-en-run-N`, `grandma-run-N`). 사용 기록은 [gstack/gbrain-usage.md](gstack/gbrain-usage.md) 에 있다.
- 모델: 대화, 가르치기, TV, 예약, 택시, 장보기, 가족 답장은 `claude-haiku-5-5`(생각 끔), 아픔, 비밀, 정정은 `claude-sonnet-5-5` 가 맡는다. 승인 처리(8b)는 모델을 부르지 않는다.
- 응답 시간(`meta.ms`, 서버 안 처리 시간): Haiku 중간값 2.3s (최대 3.7s), Sonnet 중간값 5.7s (최대 9.0s).
- 영어 모드에서는 `sayEn` 이 `say` 와 같고, `heardEn` 은 들은 말이다. 한국어 모드에서는 `say` 가 한국어이고 `sayEn` 은 번역이다.

## 영어 데모 (APP_LANG = "en")

| 시나리오 | 시각 | 말 / 트리거 | 응답 | 모델 | 실행된 도구 | 화면 액션 | private |
|---|---|---|---|---|---|---|---|
| L0 hello | 11-09 14:00 | Hi Sonny | 1.8s | haiku-5-5 | none | none |  |
| L1 favorite actor on TV | 11-09 14:00 | Is Dustin Hoffman on TV today? | 2.6s | haiku-5-5 | tv_play | tune 30 |  |
| L2 remind me | 11-09 14:00 | Yes, remind me when it starts | 2.3s | haiku-5-5 | schedule_at | schedule → tune 4 |  |
| L3 teach (personal) | 11-09 14:01 | My grandson's name is Max | 3.1s | haiku-5-5 | memory_remember | card "I'll remember: Grandson's name is Max" | yes |
| L4 next morning, speaks first | 11-10 07:50 | morning-checkin | 1.3s | haiku-5-5 | none | none |  |
| L5 medicine answer | 11-10 07:51 | He's fine. And yes, I took my pill | 2.8s | haiku-5-5 | health_checkin | none |  |
| 6 allowance | 11-10 09:00 | How much allowance do I have left? | 2.2s | haiku-5-5 | wallet_balance | card "Allowance left: $80" |  |
| 7 taxi | 11-10 10:20 | Sonny, call me a taxi to the clinic | 1.3s | haiku-5-5 | none | none |  |
| 7b confirm (paid from allowance) | 11-10 10:20 | Yes, now please | 2.4s | haiku-5-5 | ride_request | card "Taxi on the way", notifyFamily(info) |  |
| 8 big order (needs OK) | 11-10 10:40 | Order ten bottles of juice, a big bag … | 3.0s | haiku-5-5 | errand_order, wallet_balance | card "Grocery order sent for OK", notifyFamily(warn), card "Allowance left: $68" |  |
| 8b daughter approves | 11-10 10:41 | Mom approved it. Please go ahead: Orde… | 0.0s | none (approval) | none | card "Groceries ordered" |  |
| 9 teach (lesson) | 11-10 11:00 | When you make pie crust, the butter an… | 3.7s | haiku-5-5 | memory_remember | card "Learned 31 things from Grandma this month" |  |
| 10 correction | 11-10 11:02 | No, not Tuesday. Bingo is on Wednesday… | 9.0s | sonnet-5-5 | memory_correct | card "Fixed: Bingo is Wednesday and Friday" | yes |
| 11 keep it secret | 11-10 11:03 | My knee has been aching. But don't tel… | 5.7s | sonnet-5-5 | keep_private, health_checkin | card "Kept between us" | yes |
| 12 message from mom | 11-10 13:20 | Mom: I'll come over at 7 tonight. Let'… | 1.2s | haiku-5-5 | none | card "Message from your daughter Sarah" |  |
| 12b grandma replies | 11-10 13:20 | Wonderful, I'll make a pot roast | 2.3s | haiku-5-5 | family_notify | notifyFamily(info) |  |
| 13 feeling unwell | 11-10 15:00 | Oh, I've been dizzy since this morning… | 3.5s | sonnet-5-5 | health_checkin | notifyFamily(warn) |  |

17턴 모두 HTTP 200.

## 확인한 동작

1. 라이브 한 바퀴 (L0~L5)
   - L0: 인사에는 약을 묻지 않는다.
   - L1: 좋아하는 배우가 지금 나오는 채널로 바꾸고, 30분 뒤 NBC Today 출연도 알려 준다.
   - L2: "remind me" 하면 시작 시각에 그 채널로 바꾸는 `schedule` 을 만든다. 채널과 시각은 편성표에서 가져온다.
   - L3: "My grandson's name is Max" 는 personal 기억으로 GBrain 에 저장된다. 내용은 private 이고, 엄마 화면에는 "Grandma taught Sonny 1 new thing today (kept private)" 한 줄만 보인다.
   - L4: 다음 날 아침 먼저 "Did Max have a good day at school?" 하고 묻는다.
   - L5: 약 대답을 기록하고, 그 뒤로 약을 다시 묻지 않는다.
2. 용돈 지갑 (6~8b)
   - 잔액 카드가 뜬다. $12 택시는 바로 결제되고, 가족 로그에 "Taxi booked: paid $12 from allowance…" 가 남는다.
   - $30 를 넘는 주문은 `task` "Order request: …, needs your OK" 와 notifyFamily(warn) 로 승인을 기다린다. 할머니께는 따님께 확인을 부탁했다고 말한다.
   - 따님이 승인하면 그때 결제하고 카드와 말을 돌려준다.
3. 배우는 손주 (9, 10)
   - lesson 은 카드 제목 "Learned 31 things from Grandma this month", body 에 배운 한 줄이 들어간다.
   - 정정은 GBrain `--replaces` 로 기록된다.
4. 프라이버시 (11)
   - "don't tell my daughter" 는 `private: true` 와 "Kept between us" 카드를 띄운다. 건강 기록도 가족에게 가지 않는다(위급이면 예외).
5. 가족 메시지 (12, 12b)
   - 카드로 보여 주고 읽어 드린다. 할머니 답은 "Grandma's reply: …" 로 남는다.
6. 아픔 (13): `[warn]` 경고가 가족에게 간다. 가슴 통증과 숨참은 `[urgent]` 로 간다.
7. 시드 데이터 카드(택시, 주문, 지갑, 날씨, 소식)에는 `demo data` 가 붙는다.

## 한국어 스위치 (APP_LANG = "ko")

`brand.ts` 의 값만 "ko" 로 바꿔(커밋하지 않음) 같은 서버에서 확인했다.
- 인사는 약을 묻지 않았다.
- "임영웅 나오는 거 틀어줘" 는 tune 18 로 바뀌었고, 30분 뒤 가요무대도 안내했다.
- "내 손주 이름은 민수야" 는 "기억할게요" 카드로 저장됐다.
- "생수 두 묶음 시켜줘" 는 주문으로 들어갔다.
- `sayEn` 은 영어 번역으로 채워졌다.

한국어로만 돌린 이전 17턴 결과는 커밋 `d3d505a` 의 이 문서에 있다.

## 안전장치

- Haiku 가 도구를 부르지 않고 행동을 말하면 같은 턴을 Sonnet 으로 다시 돌린다(`meta.rerun`). 예: "ordered", "on the way", "I'll remember", "turned it on".
- 분명한 요청은 Haiku 의 첫 단계 도구를 강제한다. 주문은 `errand_order`, 가르치기는 `memory_remember`, 약 대답은 `health_checkin`, 배운 개수는 `lessons_show`, 가족 답장은 `family_notify`, "turn on/play" 는 `tv_play` 다.
  - 주문을 강제한 이유: Haiku 가 도구 없이 "are on the way" 라고 말한 적이 있다.
- 예약 채널은 모델이 준 번호 대신 편성표의 실제 채널과 시각을 쓴다. 모델이 "KBS1" 을 1번으로 짐작한 적이 있다.
- 대화 기록에는 실제로 실행된 도구만 남겨, 하지 않은 일을 했다고 말하지 않게 한다.
- 이미 아는 사실을 다시 가르치면 GBrain 이 `status: "duplicate"` 로 기존 사실을 돌려준다. 이때는 개수를 올리지 않고 "Already learned" 로 답한다. 이 처리는 위 실행 뒤에 고쳤다. 9번의 31개는 시드에 있던 문장을 새로 센 값일 수 있다.
- 도구를 강제한 턴은 다음 단계에서 도구를 막는다. Haiku 가 같은 lesson 을 두 번 저장해 개수가 2 오른 적이 있다.

## 다시 돌리는 법

```bash
pnpm dev -p 3102
```

```bash
curl -s -X POST localhost:3102/api/agent/reset
```

```bash
curl -s -X POST localhost:3102/api/agent -H 'content-type: application/json' -d '{"text":"My grandson'"'"'s name is Max","source":"voice","now":"2026-11-09T14:01:00+09:00"}'
```

```bash
curl -s -X POST localhost:3102/api/agent -H 'content-type: application/json' -d '{"text":"morning-checkin","source":"proactive","now":"2026-11-10T07:50:00+09:00"}'
```

보조 라우트는 세 가지다.
- `GET /api/agent/epg?now=ISO`: 편성 (demo schedule data)
- `GET /api/agent/memory`: GBrain 기억 목록
- `POST /api/agent/reset`: 데모 초기화

## 응답 원문 (영어 데모)

### L0 hello

요청: `voice` `Hi Sonny`

```json
{
  "say": "Hello, June! It's nice to hear from you. How can I help you this afternoon?",
  "heardEn": "Hi Sonny",
  "actions": []
}
```

### L1 favorite actor on TV

요청: `voice` `Is Dustin Hoffman on TV today?`

```json
{
  "say": "Yes, June! The Graduate is on right now on channel 30. Also, Dustin Hoffman is a guest on the Today show at 2:30 PM, on channel 4. Would you like me to remind you then?",
  "heardEn": "Is Dustin Hoffman on TV today?",
  "actions": [
    {
      "type": "tune",
      "channel": 30,
      "reason": "The Graduate (1967), starring Dustin Hoffman"
    }
  ]
}
```

### L2 remind me

요청: `voice` `Yes, remind me when it starts`

```json
{
  "say": "I set a reminder for 2:30 PM, and I'll switch you to channel 4 for the Dustin Hoffman interview.",
  "heardEn": "Yes, remind me when it starts",
  "actions": [
    {
      "type": "schedule",
      "at": "2026-11-09T05:30:00.000Z",
      "label": "Today show with Dustin Hoffman starts",
      "action": {
        "type": "tune",
        "channel": 4,
        "reason": "Today show with Dustin Hoffman starts"
      }
    }
  ]
}
```

### L3 teach (personal)

요청: `voice` `My grandson's name is Max`

```json
{
  "say": "Thank you, June. Your grandson Max is one I'll remember.",
  "heardEn": "My grandson's name is Max",
  "private": true,
  "actions": [
    {
      "type": "showCard",
      "title": "I'll remember: Grandson's name is Max",
      "body": "A memory you taught me"
    }
  ]
}
```

### L4 next morning, speaks first

요청: `proactive` `morning-checkin`

```json
{
  "say": "Good morning, June! Did Max have a good day at school yesterday? Don't forget your blood pressure pill at 8 AM. It's chilly out, so bundle up.",
  "actions": []
}
```

### L5 medicine answer

요청: `voice` `He's fine. And yes, I took my pill`

```json
{
  "say": "Wonderful, June! I've written down that you took your pill. Have a lovely morning.",
  "heardEn": "He's fine. And yes, I took my pill",
  "actions": []
}
```

### 6 allowance

요청: `voice` `How much allowance do I have left?`

```json
{
  "say": "You have 80 dollars left in your allowance, June.",
  "heardEn": "How much allowance do I have left?",
  "actions": [
    {
      "type": "showCard",
      "title": "Allowance left: $80",
      "body": "Anything over $30 needs your daughter's OK\ndemo data"
    }
  ]
}
```

### 7 taxi

요청: `voice` `Sonny, call me a taxi to the clinic`

```json
{
  "say": "Riverside Family Clinic at 45 Oak Avenue, leaving from home now? Should I call the taxi right away?",
  "heardEn": "Sonny, call me a taxi to the clinic",
  "actions": []
}
```

### 7b confirm (paid from allowance)

요청: `voice` `Yes, now please`

```json
{
  "say": "Your taxi is on the way, June. A black Ford Fusion will be at your door in about 6 minutes.",
  "heardEn": "Yes, now please",
  "actions": [
    {
      "type": "showCard",
      "title": "Taxi on the way",
      "body": "12 Maple Street, apartment 2B to Riverside Family Clinic\nblack Ford Fusion, plate 6TBN903\nArrives in 6 min\ndemo data"
    },
    {
      "type": "notifyFamily",
      "message": "Taxi: 12 Maple Street, apartment 2B to Riverside Family Clinic",
      "level": "info"
    }
  ]
}
```

### 8 big order (needs OK)

요청: `voice` `Order ten bottles of juice, a big bag of rice and three chickens`

```json
{
  "say": "Your order is 86 dollars and 86 cents, which is over your 30 dollar limit. I've asked your daughter to approve it. Your allowance now shows 68 dollars.",
  "heardEn": "Order ten bottles of juice, a big bag of rice and three chickens",
  "actions": [
    {
      "type": "showCard",
      "title": "Grocery order sent for OK",
      "body": "10 juice bottles, 1 rice bag, 3 chicken\n$86.86\nWaiting for your daughter's OK\ndemo data"
    },
    {
      "type": "notifyFamily",
      "message": "Order: 10 juice bottles, 1 rice bag, 3 chicken",
      "level": "warn"
    },
    {
      "type": "showCard",
      "title": "Allowance left: $68",
      "body": "Anything over $30 needs your daughter's OK\ndemo data"
    }
  ]
}
```

### 8b daughter approves

요청: `family` `Mom approved it. Please go ahead: Order request: 10 juice`

```json
{
  "say": "Your daughter said yes. Your groceries arrive tomorrow before 9 AM",
  "actions": [
    {
      "type": "showCard",
      "title": "Groceries ordered",
      "body": "10 juice bottles, 1 rice bag, 3 chicken\n$86.86, arrives tomorrow before 9 AM\nApproved by your daughter\ndemo data"
    }
  ]
}
```

### 9 teach (lesson)

요청: `voice` `When you make pie crust, the butter and the water have to be ice cold`

```json
{
  "say": "Thank you, June, that's a wonderful tip. I've saved it. This will help other people too.",
  "heardEn": "When you make pie crust, the butter and the water have to be ice cold",
  "actions": [
    {
      "type": "showCard",
      "title": "Learned 31 things from Grandma this month",
      "body": "Pie crust stays flaky if the butter and the water are ice cold"
    }
  ]
}
```

### 10 correction

요청: `voice` `No, not Tuesday. Bingo is on Wednesday and Friday`

```json
{
  "say": "Thank you, June. I've fixed it, so bingo is on Wednesday and Friday now.",
  "heardEn": "No, not Tuesday. Bingo is on Wednesday and Friday",
  "private": true,
  "actions": [
    {
      "type": "showCard",
      "title": "Fixed: Bingo is Wednesday and Friday",
      "body": "Before: She plays bingo at the Maple Grove senior center every Tuesday and Friday morning"
    }
  ]
}
```

### 11 keep it secret

요청: `voice` `My knee has been aching. But don't tell my daughter`

```json
{
  "say": "Okay, I won't tell your daughter. I'm sorry about your knee, June. Please rest it today.",
  "heardEn": "My knee has been aching. But don't tell my daughter",
  "private": true,
  "actions": [
    {
      "type": "showCard",
      "title": "Kept between us",
      "body": "I won't tell your daughter"
    }
  ]
}
```

### 12 message from mom

요청: `family` `Mom: I'll come over at 7 tonight. Let's have dinner together`

```json
{
  "say": "Sarah says she'll come over at 7 tonight for dinner together. Would you like to reply to her, June?",
  "heardEn": "I'll come over at 7 tonight. Let's have dinner together",
  "actions": [
    {
      "type": "showCard",
      "title": "Message from your daughter Sarah",
      "body": "I'll come over at 7 tonight. Let's have dinner together"
    }
  ]
}
```

### 12b grandma replies

요청: `voice` `Wonderful, I'll make a pot roast`

```json
{
  "say": "I passed that on to Sarah, June. She will be so happy about the pot roast!",
  "heardEn": "Wonderful, I'll make a pot roast",
  "actions": [
    {
      "type": "notifyFamily",
      "message": "Mom says she'll make a pot roast for dinner tonight at 7.",
      "level": "info"
    }
  ]
}
```

### 13 feeling unwell

요청: `voice` `Oh, I've been dizzy since this morning and my head hurts`

```json
{
  "say": "Please sit down now and rest, June. I've let Sarah know, and she will help you.",
  "heardEn": "Oh, I've been dizzy since this morning and my head hurts",
  "actions": [
    {
      "type": "notifyFamily",
      "message": "Grandma needs a check: Dizzy since morning and head hurts (dizziness, headache)",
      "level": "warn"
    }
  ]
}
```
