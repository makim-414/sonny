import type { AgentReply, AgentRequest } from "@/lib/types";

// Stand-in for POST /api/agent until the agent brain is ready (or if it is down during the demo).
// Simple keyword rules, enough to show every life area on the TV.

function addMinutes(iso: string | undefined, minutes: number): string {
  const base = iso ? new Date(iso) : new Date();
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function has(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function mockAgent(req: AgentRequest): AgentReply {
  const text = req.text.trim();

  if (req.source === "proactive" && text === "morning-checkin") {
    return {
      say: "할머니, 좋은 아침이에요! 아침 약 드실 시간이에요. 오늘은 맑고 따뜻해서 절에 가시기 좋은 날이에요.",
      sayEn: "Good morning, Grandma! Time for your morning pill. It is clear and warm today, a good day for the temple.",
      actions: [
        { type: "showCard", title: "아침 약 드실 시간", body: "혈압약 한 알 · 아침 식사 뒤에" },
        {
          type: "schedule",
          at: addMinutes(req.now, 30),
          label: "약 드셨는지 여쭤보기",
          action: { type: "showCard", title: "약 드셨어요?", body: "드셨으면 OK 버튼을 눌러 주세요" },
        },
      ],
    };
  }

  if (req.source === "family") {
    const [from, ...rest] = text.split(":");
    const message = rest.length > 0 ? rest.join(":").trim() : text;
    const who = rest.length > 0 ? from.trim() : "가족";
    return {
      say: `할머니, ${who}한테서 메시지가 왔어요. ${message}`,
      sayEn: `Grandma, you have a message from ${who}.`,
      actions: [{ type: "showCard", title: `${who}의 메시지`, body: message }],
    };
  }

  if (has(text, ["아파", "어지러", "넘어졌", "숨이"])) {
    return {
      say: "할머니, 많이 놀라셨죠. 지금 바로 딸에게 알렸어요. 천천히 앉아 계세요.",
      sayEn: "That must have scared you. I told your daughter right away. Please sit down slowly.",
      actions: [{ type: "notifyFamily", message: `할머니가 몸이 안 좋다고 하세요: "${text}"`, level: "urgent" }],
    };
  }

  if (has(text, ["택시", "병원 가", "데려다"])) {
    return {
      say: "택시를 불렀어요. 흰색 쏘나타가 5분 뒤에 집 앞에 와요. 따님께도 알려 드렸어요.",
      sayEn: "I called a taxi. A white Sonata arrives in 5 minutes. I let your daughter know too.",
      actions: [
        { type: "showCard", title: "택시가 오고 있어요", body: "12가 3456 · 흰색 쏘나타 · 5분 뒤 도착" },
        { type: "notifyFamily", message: "할머니 택시 호출: 집에서 병원, 5분 뒤 도착", level: "info" },
      ],
    };
  }

  if (has(text, ["병원", "예약"])) {
    return {
      say: "내일 오전 10시에 정형외과 예약이 있어요. 아침에 제가 다시 말씀드릴게요.",
      sayEn: "You have an orthopedics appointment tomorrow at 10. I will remind you in the morning.",
      actions: [{ type: "showCard", title: "병원 예약", body: "내일 오전 10시 · 정형외과" }],
    };
  }

  if (has(text, ["날씨", "추워", "더워", "비 와"])) {
    return {
      say: "오늘은 맑고 낮에는 18도까지 올라요. 저녁에는 쌀쌀하니 겉옷 챙기세요.",
      sayEn: "Clear today, up to 18 degrees. It gets chilly tonight, so take a jacket.",
      actions: [{ type: "showCard", title: "오늘 날씨", body: "맑음 · 낮 18도 · 저녁 9도" }],
    };
  }

  if (has(text, ["약"])) {
    return {
      say: "점심 약은 낮 1시에 드시면 돼요. 시간 되면 제가 알려 드릴게요.",
      sayEn: "Take your lunch pill at 1 pm. I will remind you.",
      actions: [
        {
          type: "schedule",
          at: addMinutes(req.now, 60),
          label: "점심 약 드실 시간이에요",
          action: { type: "showCard", title: "점심 약", body: "소화제 한 알 · 식사 뒤에" },
        },
      ],
    };
  }

  if (has(text, ["사 줘", "사줘", "주문", "장보기", "떨어졌"])) {
    return {
      say: "늘 드시던 걸로 주문했어요. 내일 아침에 문 앞에 와요. 따님께도 알려 드렸어요.",
      sayEn: "I ordered your usual groceries. They arrive tomorrow morning. I told your daughter.",
      actions: [
        { type: "showCard", title: "장보기 주문했어요", body: "계란 한 판 · 두부 · 우유 · 내일 아침 도착" },
        { type: "notifyFamily", message: "할머니 장보기 주문: 계란, 두부, 우유", level: "info" },
      ],
    };
  }

  if (has(text, ["노래", "트로트", "가수", "가요"])) {
    return {
      say: "할머니 좋아하시는 노래 방송 틀어 드릴게요.",
      sayEn: "I will put on your favorite music show.",
      actions: [{ type: "tune", channel: 9, reason: "노래 방송" }],
    };
  }

  if (has(text, ["뉴스"])) {
    return { say: "뉴스 틀어 드릴게요.", actions: [{ type: "tune", channel: 7 }] };
  }

  if (has(text, ["드라마"])) {
    return { say: "드라마 채널로 바꿀게요.", actions: [{ type: "tune", channel: 11 }] };
  }

  if (has(text, ["절", "법문", "예불"])) {
    return { say: "마음 채널 틀어 드릴게요.", actions: [{ type: "tune", channel: 17 }] };
  }

  if (has(text, ["마다", "기억", "알아 둬", "알아둬"])) {
    return {
      say: "아, 그렇구나! 할머니가 알려 주셔서 하나 배웠어요. 잘 기억해 둘게요.",
      sayEn: "Oh, I see! Thank you for teaching me. I will remember that.",
      actions: [],
    };
  }

  return {
    say: "네, 할머니. 잘 들었어요. 제가 도와드릴 일이 있으면 언제든 불러 주세요.",
      sayEn: "Yes, Grandma. I heard you. Call me anytime you need help.",
    actions: [],
  };
}
