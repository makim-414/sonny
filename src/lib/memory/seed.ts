import type { MemoryFact } from "./types";

// Demo grandma. Addresses and names are fake.
export const SEED_FACTS: Omit<MemoryFact, "id" | "at">[] = [
  { text: "할머니 성함은 김순자, 연세는 여든둘이시다", category: "family", source: "seed" },
  { text: "가수 임영웅을 아주 좋아하신다. 임영웅 나오는 프로그램은 꼭 보신다", category: "likes", source: "seed" },
  { text: "절에는 매주 화요일과 금요일 아침에 가신다 (집 근처 보현사)", category: "routine", source: "seed" },
  { text: "혈압약을 매일 아침 8시에 드신다", category: "health", source: "seed" },
  { text: "딸(민정)은 사흘에 한 번 와서 주무시고 간다", category: "family", source: "seed" },
  { text: "다니는 병원은 서울바른내과의원, 주소는 서울 마포구 망원로 45 (가짜)", category: "place", source: "seed" },
  { text: "집 주소는 서울 마포구 성미산로 12길 8, 2층 (가짜)", category: "place", source: "seed" },
  { text: "무릎이 안 좋으셔서 오래 걷기 힘드시다", category: "health", source: "seed" },
  { text: "아침 드라마와 트로트 프로그램을 즐겨 보신다", category: "likes", source: "seed" },
];
