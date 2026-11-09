import { APP_LANG } from "@/lib/brand";

// Known places for the mock services. Fake addresses, mirrored in seed memory.
type Place = { name: string; address: string; aliases: string[] };
const KO: Record<string, Place> = {
  home: { name: "집", address: "서울 마포구 성미산로 12길 8", aliases: ["집", "우리집", "home"] },
  hospital: { name: "서울바른내과의원", address: "서울 마포구 망원로 45", aliases: ["병원", "내과", "바른내과", "의원"] },
  temple: { name: "보현사", address: "서울 마포구 성산로 3길 21", aliases: ["절", "보현사", "사찰"] },
  market: { name: "망원시장", address: "서울 마포구 포은로8길 14", aliases: ["시장", "망원시장"] },
};
const EN: Record<string, Place> = {
  home: { name: "Home", address: "12 Maple Street, Apt 2B", aliases: ["home", "house", "my place"] },
  hospital: { name: "Riverside Family Clinic", address: "45 Oak Avenue", aliases: ["clinic", "doctor", "hospital", "riverside"] },
  temple: { name: "Maple Grove Senior Center", address: "300 Elm Road", aliases: ["senior center", "bingo", "center", "maple grove"] },
  market: { name: "Saturday Farmers Market", address: "Town Square", aliases: ["market", "farmers market", "grocery"] },
};
export const PLACES = APP_LANG === "en" ? EN : KO;

export function resolvePlace(text: string | undefined, fallback: string = "home"): Place {
  if (!text) return PLACES[fallback];
  const t = text.toLowerCase();
  const hit = Object.values(PLACES).find((p) => p.aliases.some((a) => t.includes(a.toLowerCase())) || t.includes(p.name.toLowerCase()));
  return hit ?? { name: text, address: text, aliases: [] };
}
