// Mock grocery and household order. Needs family approval before it would ship.
const PRICES: Record<string, number> = {
  두부: 2500, 계란: 7900, 우유: 3200, 쌀: 32000, 휴지: 12900, 대파: 2900, 사과: 9900, 바나나: 4900,
  김: 5900, 라면: 4800, 물: 6900, 생수: 6900, 콩나물: 1500, 김치: 15900, 고등어: 8900, 파스: 9800,
};

export type ErrandOrder = {
  id: string;
  items: { name: string; qty: number; priceWon: number }[];
  totalWon: number;
  store: string;
  arrives: string;
  status: "awaiting_family_approval";
};

export function orderErrand(input: { items: { name: string; qty?: number }[]; now: Date }): ErrandOrder {
  const items = input.items.map(({ name, qty = 1 }) => {
    const key = Object.keys(PRICES).find((k) => name.includes(k));
    return { name, qty, priceWon: (key ? PRICES[key] : 5000) * qty };
  });
  return {
    id: `ORD-${input.now.getTime().toString(36).toUpperCase()}`,
    items,
    totalWon: items.reduce((s, i) => s + i.priceWon, 0),
    store: "동네 마트 새벽배송 (가짜)",
    arrives: "내일 아침 7시 전",
    status: "awaiting_family_approval",
  };
}
