// Known places for the mock services. Fake addresses, mirrored in seed memory.
export const PLACES: Record<string, { name: string; address: string; aliases: string[] }> = {
  home: { name: "집", address: "서울 마포구 성미산로 12길 8", aliases: ["집", "우리집", "home"] },
  hospital: { name: "서울바른내과의원", address: "서울 마포구 망원로 45", aliases: ["병원", "내과", "바른내과", "의원"] },
  temple: { name: "보현사", address: "서울 마포구 성산로 3길 21", aliases: ["절", "보현사", "사찰"] },
  market: { name: "망원시장", address: "서울 마포구 포은로8길 14", aliases: ["시장", "망원시장"] },
};

export function resolvePlace(text: string | undefined, fallback: keyof typeof PLACES = "home") {
  if (!text) return PLACES[fallback];
  const hit = Object.values(PLACES).find((p) => p.aliases.some((a) => text.includes(a)) || text.includes(p.name));
  return hit ?? { name: text, address: text, aliases: [] };
}
