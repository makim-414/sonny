import { APP_LANG } from "@/lib/brand";
import type { MemoryFact } from "./types";

// Demo grandma. Addresses and names are fake.
const SEED_FACTS_KO: Omit<MemoryFact, "id" | "at">[] = [
  { text: "할머니는 여든둘이시고 혼자 사신다", category: "family", source: "seed" },
  { text: "가수 임영웅을 아주 좋아하신다. 임영웅 나오는 프로그램은 꼭 보신다", category: "likes", source: "seed" },
  { text: "절에는 매주 화요일과 금요일 아침에 가신다 (집 근처 햇살사)", category: "routine", source: "seed" },
  { text: "혈압약을 매일 아침 8시에 드신다", category: "health", source: "seed" },
  { text: "딸(수진)은 사흘에 한 번 와서 주무시고 간다", category: "family", source: "seed" },
  { text: "다니는 병원은 햇살내과의원, 주소는 햇살시 행복구 가상로 45 (가짜)", category: "place", source: "seed" },
  { text: "집 주소는 햇살시 행복구 꽃길 12, 2층 (가짜)", category: "place", source: "seed" },
  { text: "무릎이 안 좋으셔서 오래 걷기 힘드시다", category: "health", source: "seed" },
  { text: "아침 드라마와 트로트 프로그램을 즐겨 보신다", category: "likes", source: "seed" },
];

// Lessons grandma taught earlier this month (demo data). They count toward
// "이번 달 할머니께 배운 것 N개" and are framed as public-good AI teaching data.
const SEED_LESSONS_KO: { text: string; at: string }[] = [
  { text: "식혜는 엿기름물을 밥과 함께 보온밥솥에 다섯 시간 두면 밥알이 동동 뜬다", at: "2026-11-01T19:30:00+09:00" },
  { text: "무생채는 고춧가루로 먼저 색을 입힌 뒤 소금을 넣어야 빛깔이 곱다", at: "2026-11-01T19:30:00+09:00" },
  { text: "된장찌개는 멸치 육수에 된장을 체에 걸러 풀어야 텁텁하지 않다", at: "2026-11-02T19:30:00+09:00" },
  { text: "미역국은 참기름에 미역을 충분히 볶은 뒤 물을 부어야 국물이 뽀얗다", at: "2026-11-02T19:30:00+09:00" },
  { text: "감기 기운 있을 땐 배에 꿀과 생강을 넣고 중탕해 먹으면 목이 편하다", at: "2026-11-02T19:30:00+09:00" },
  { text: "콩나물국은 뚜껑을 처음부터 닫거나 열어 두고 끝까지 바꾸지 않아야 비린내가 안 난다", at: "2026-11-03T19:30:00+09:00" },
  { text: "햇살시장 생선가게는 화요일 아침에 들어온 고등어가 제일 싱싱하다", at: "2026-11-03T19:30:00+09:00" },
  { text: "겨울엔 보일러를 외출 모드로 두면 동파를 막고 가스비도 아낀다", at: "2026-11-03T19:30:00+09:00" },
  { text: "무릎 아플 땐 계단 내려갈 때 아픈 다리를 먼저 내딛는다", at: "2026-11-04T19:30:00+09:00" },
  { text: "나물은 데친 뒤 찬물에 바로 헹궈야 색이 곱다", at: "2026-11-04T19:30:00+09:00" },
  { text: "잡채 당면은 삶은 뒤 간장과 참기름에 먼저 버무려 두면 불지 않는다", at: "2026-11-04T19:30:00+09:00" },
  { text: "쌀뜨물로 설거지하면 기름기가 잘 빠지고 손도 덜 튼다", at: "2026-11-05T19:30:00+09:00" },
  { text: "동치미는 무를 통째로 소금에 굴려 사흘 두었다가 국물을 부어야 시원하다", at: "2026-11-05T19:30:00+09:00" },
  { text: "호박죽은 단호박을 쪄서 으깬 뒤 찹쌀가루를 조금씩 풀어야 덩어리가 안 진다", at: "2026-11-05T19:30:00+09:00" },
  { text: "손주 아플 때 이마에 미지근한 물수건을 자주 갈아 주면 열이 내린다", at: "2026-11-05T19:30:00+09:00" },
  { text: "깍두기는 무에 설탕을 조금 먼저 버무리면 물이 덜 생긴다", at: "2026-11-06T19:30:00+09:00" },
  { text: "멸치볶음은 마른 팬에 먼저 볶아 비린내를 날린 뒤 양념한다", at: "2026-11-06T19:30:00+09:00" },
  { text: "겨울 빨래는 신문지를 사이에 끼워 널면 빨리 마른다", at: "2026-11-06T19:30:00+09:00" },
  { text: "햇살사 가는 길 언덕은 오른쪽 골목으로 돌아가면 덜 가파르다", at: "2026-11-06T19:30:00+09:00" },
  { text: "떡국 떡은 찬물에 30분 불려야 쫄깃하고 국물이 탁하지 않다", at: "2026-11-07T19:30:00+09:00" },
  { text: "시금치는 뿌리째 데쳐야 단맛이 남는다", at: "2026-11-07T19:30:00+09:00" },
  { text: "고구마는 신문지에 싸서 서늘한 곳에 두면 겨우내 안 썩는다", at: "2026-11-07T19:30:00+09:00" },
  { text: "잠 안 올 땐 따뜻한 대추차 한 잔이 좋다", at: "2026-11-07T19:30:00+09:00" },
  { text: "갈비찜은 배를 갈아 넣고 하룻밤 재워야 고기가 연하다", at: "2026-11-07T19:30:00+09:00" },
  { text: "장독은 볕 좋은 날 뚜껑을 열어 바람을 쐬어 줘야 곰팡이가 안 핀다", at: "2026-11-08T19:30:00+09:00" },
  { text: "두부는 소금물에 담가 두면 이틀은 더 간다", at: "2026-11-08T19:30:00+09:00" },
  { text: "어지러울 땐 바로 앉아서 머리를 무릎 쪽으로 숙이고 천천히 숨 쉰다", at: "2026-11-08T19:30:00+09:00" },
  { text: "파는 뿌리째 흙에 꽂아 두면 오래 싱싱하다", at: "2026-11-08T19:30:00+09:00" },
  { text: "부침개는 반죽에 얼음물을 쓰면 바삭하다", at: "2026-11-08T19:30:00+09:00" },
  { text: "명절 전 시장은 사흘 전에 가야 값이 덜 오른다", at: "2026-11-08T19:30:00+09:00" },
];

const SEED_FACTS_EN: Omit<MemoryFact, "id" | "at">[] = [
  { text: "Grandma's name is June, she is 82 and lives alone", category: "family", source: "seed" },
  { text: "She is a big Dustin Hoffman fan and never misses a show he is on", category: "likes", source: "seed" },
  { text: "She plays bingo at the Maple Grove senior center every Tuesday and Friday morning", category: "routine", source: "seed" },
  { text: "She takes her blood pressure pill every morning at 8", category: "health", source: "seed" },
  { text: "Her daughter Sarah visits every three days and stays the night", category: "family", source: "seed" },
  { text: "Her doctor is at Riverside Family Clinic, 45 Oak Avenue (fake address)", category: "place", source: "seed" },
  { text: "Her home is 12 Maple Street, apartment 2B (fake address)", category: "place", source: "seed" },
  { text: "Her knees are weak, so long walks are hard for her", category: "health", source: "seed" },
  { text: "She loves morning talk shows and old movies", category: "likes", source: "seed" },
];

const SEED_LESSONS_EN: { text: string; at: string }[] = [
  { text: "Pie crust stays flaky if the butter and the water are ice cold", at: "2026-11-01T19:30:00+09:00" },
  { text: "A spoon of vinegar in the water keeps poached eggs together", at: "2026-11-01T19:30:00+09:00" },
  { text: "Chicken soup tastes better the next day, so make it the night before", at: "2026-11-02T19:30:00+09:00" },
  { text: "Rub a cut onion on a bee sting to ease it", at: "2026-11-02T19:30:00+09:00" },
  { text: "Put a slice of bread in the cookie jar to keep cookies soft", at: "2026-11-02T19:30:00+09:00" },
  { text: "Iron shirts while they are still a little damp", at: "2026-11-03T19:30:00+09:00" },
  { text: "Baking soda and water take the smell out of a cutting board", at: "2026-11-03T19:30:00+09:00" },
  { text: "Let bread dough rise in a warm oven with only the light on", at: "2026-11-03T19:30:00+09:00" },
  { text: "Brown the meat in small batches or it steams instead of browning", at: "2026-11-04T19:30:00+09:00" },
  { text: "A raw potato soaks up extra salt in a soup", at: "2026-11-04T19:30:00+09:00" },
  { text: "Store tomatoes on the counter, not in the fridge", at: "2026-11-04T19:30:00+09:00" },
  { text: "Wrap celery in foil and it stays crisp for weeks", at: "2026-11-05T19:30:00+09:00" },
  { text: "The farmers market on Saturday has the best peaches before 9", at: "2026-11-05T19:30:00+09:00" },
  { text: "Lemon and salt clean a copper pot", at: "2026-11-05T19:30:00+09:00" },
  { text: "Warm milk with honey helps you fall asleep", at: "2026-11-05T19:30:00+09:00" },
  { text: "Keep a wooden spoon across a pot so it does not boil over", at: "2026-11-06T19:30:00+09:00" },
  { text: "Old newspaper cleans windows without streaks", at: "2026-11-06T19:30:00+09:00" },
  { text: "Freeze grapes for a cool summer snack", at: "2026-11-06T19:30:00+09:00" },
  { text: "Write the date on every jar of jam you make", at: "2026-11-06T19:30:00+09:00" },
  { text: "Put rice in the salt shaker so the salt does not clump", at: "2026-11-07T19:30:00+09:00" },
  { text: "Soak beans overnight and they cook in half the time", at: "2026-11-07T19:30:00+09:00" },
  { text: "A cold spoon on puffy eyes in the morning helps", at: "2026-11-07T19:30:00+09:00" },
  { text: "Mashed potatoes are fluffier with warm milk", at: "2026-11-07T19:30:00+09:00" },
  { text: "Coffee grounds keep slugs away from the garden", at: "2026-11-07T19:30:00+09:00" },
  { text: "When you feel dizzy, sit down and put your head toward your knees", at: "2026-11-08T19:30:00+09:00" },
  { text: "Plant tulip bulbs in the fall before the first frost", at: "2026-11-08T19:30:00+09:00" },
  { text: "Cast iron pans should be dried on the stove so they do not rust", at: "2026-11-08T19:30:00+09:00" },
  { text: "Hang a sock of cedar chips in the closet to keep moths away", at: "2026-11-08T19:30:00+09:00" },
  { text: "Sweep the porch before guests come, it makes the house look loved", at: "2026-11-08T19:30:00+09:00" },
  { text: "Call the pharmacy a week before the pills run out", at: "2026-11-08T19:30:00+09:00" },
];

export const SEED_FACTS = APP_LANG === "en" ? SEED_FACTS_EN : SEED_FACTS_KO;
export const SEED_LESSONS = APP_LANG === "en" ? SEED_LESSONS_EN : SEED_LESSONS_KO;
export const SEED_PROVENANCE = APP_LANG === "en" ? "seed: June taught this in a talk with Sonny (demo data)" : "seed: 할머니가 TV 대화에서 가르침 (demo data)";
export const TAUGHT_BY = APP_LANG === "en" ? "June taught this in a talk with Sonny" : "할머니가 TV 대화에서 가르침";
export const CORRECTED_BY = APP_LANG === "en" ? "June corrected this" : "할머니가 정정함";
