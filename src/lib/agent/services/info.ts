// Seed weather and news, written so the agent can read them out in plain words.
export function weatherToday() {
  return {
    place: "서울 마포구",
    sky: "맑음, 오후에 구름 조금",
    lowC: 4,
    highC: 13,
    morningC: 6,
    wind: "오후에 바람이 조금 셈",
    fineDust: "보통",
    rain: "비 소식 없음",
    advice: "아침엔 쌀쌀하니 두꺼운 겉옷을 챙기세요. 낮에는 산책하기 좋아요.",
  };
}

export function newsToday() {
  return [
    { topic: "건강", headline: "독감 예방접종, 65세 이상은 이달 말까지 보건소와 동네 병원에서 무료", plain: "어르신 독감 주사는 이달 말까지 공짜예요." },
    { topic: "생활", headline: "기초연금 이달 25일 지급, 단독가구 월 최대 34만 원대", plain: "기초연금은 25일에 들어와요." },
    { topic: "날씨", headline: "이번 주 목요일부터 기온 뚝, 첫 영하권 추위 예상", plain: "목요일부터 많이 추워진대요." },
    { topic: "연예", headline: "임영웅, 연말 전국 투어 서울 공연 추가 확정", plain: "임영웅이 연말에 서울에서 공연을 더 한대요." },
  ];
}
