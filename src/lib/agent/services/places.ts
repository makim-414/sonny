import { APP_LANG } from "@/lib/brand";

// Known places for the mock services. Fake addresses, mirrored in seed memory.
type Place = { name: string; address: string; aliases: string[] };
const KO: Record<string, Place> = {
  home: { name: "집", address: "햇살시 행복구 꽃길 12", aliases: ["집", "우리집", "home"] },
  hospital: { name: "햇살내과의원", address: "햇살시 행복구 가상로 45", aliases: ["병원", "내과", "햇살내과", "의원"] },
  temple: { name: "햇살사", address: "햇살시 행복구 절골길 21", aliases: ["절", "햇살사", "사찰"] },
  market: { name: "햇살시장", address: "햇살시 행복구 장터길 14", aliases: ["시장", "햇살시장"] },
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
