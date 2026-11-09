import { APP_LANG } from "@/lib/brand";

// Demo prices in US cents for the allowance wallet.
const PRICES_USD: Record<string, number> = {
  burger: 200, burgers: 200, pizza: 1200,
  milk: 399, eggs: 449, bread: 349, water: 599, "toilet paper": 1299, bananas: 199, apples: 499, coffee: 899,
  tofu: 299, rice: 1499, soup: 249, tea: 499, butter: 549, cheese: 599, chicken: 899, juice: 449,
  두부: 299, 계란: 449, 우유: 399, 쌀: 1499, 휴지: 1299, 생수: 599, 물: 599, 사과: 499, 바나나: 199,
};

// Mock grocery and household order. Needs family approval before it would ship.
const PRICES: Record<string, number> = {
  두부: 2500, 계란: 7900, 우유: 3200, 쌀: 32000, 휴지: 12900, 대파: 2900, 사과: 9900, 바나나: 4900,
  김: 5900, 라면: 4800, 물: 6900, 생수: 6900, 콩나물: 1500, 김치: 15900, 고등어: 8900, 파스: 9800,
};

export type ErrandOrder = {
  id: string;
  items: { name: string; qty: number; priceWon: number; priceCents: number }[];
  totalWon: number;
  totalCents: number; // charged to the allowance wallet (demo prices)
  store: string;
  arrives: string;
  status: "awaiting_family_approval" | "paid";
};

export function orderErrand(input: { items: { name: string; qty?: number }[]; now: Date }): ErrandOrder {
  const items = input.items.map(({ name, qty = 1 }) => {
    const key = Object.keys(PRICES).find((k) => name.includes(k));
    const keyUsd = Object.keys(PRICES_USD).find((k) => name.toLowerCase().includes(k));
    return { name, qty, priceWon: (key ? PRICES[key] : 5000) * qty, priceCents: (keyUsd ? PRICES_USD[keyUsd] : 500) * qty };
  });
  return {
    id: `ORD-${input.now.getTime().toString(36).toUpperCase()}`,
    items,
    totalWon: items.reduce((s, i) => s + i.priceWon, 0),
    totalCents: items.reduce((s, i) => s + i.priceCents, 0),
    store: APP_LANG === "en" ? "Corner Grocery delivery (fake)" : "동네 마트 새벽배송 (가짜)",
    arrives: APP_LANG === "en" ? "tomorrow before 9 AM" : "내일 아침 7시 전",
    status: "awaiting_family_approval",
  };
}
