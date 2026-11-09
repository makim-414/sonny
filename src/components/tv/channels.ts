import type { Channel } from "@/lib/types";

// The virtual channel lineup shown on the TV. Fake channels, no real broadcast video.
// The agent's EPG should use the same channel numbers.

export type Scene = "news" | "trot" | "drama" | "nature" | "temple" | "health" | "generic";

export type Slot = { from: number; to: number; title: string }; // hours, local demo time

export type TvChannel = Channel & { scene: Scene; slots: Slot[] };

export const CHANNELS: TvChannel[] = [
  {
    number: 7,
    name: "한빛 뉴스",
    scene: "news",
    slots: [
      { from: 6, to: 9, title: "아침 뉴스" },
      { from: 9, to: 12, title: "생활 뉴스" },
      { from: 12, to: 18, title: "오후 뉴스" },
      { from: 18, to: 24, title: "저녁 종합 뉴스" },
    ],
  },
  {
    number: 9,
    name: "가요 채널",
    scene: "trot",
    slots: [
      { from: 6, to: 12, title: "아침 트로트 한마당" },
      { from: 12, to: 19, title: "추억의 가요무대" },
      { from: 19, to: 22, title: "트로트 콘서트 생중계" },
      { from: 22, to: 24, title: "밤의 노래 선물" },
    ],
  },
  {
    number: 11,
    name: "드라마 채널",
    scene: "drama",
    slots: [
      { from: 6, to: 13, title: "봄날의 골목 재방송" },
      { from: 13, to: 20, title: "우리 집 사람들" },
      { from: 20, to: 24, title: "봄날의 골목" },
    ],
  },
  {
    number: 13,
    name: "자연 다큐",
    scene: "nature",
    slots: [
      { from: 6, to: 15, title: "산과 강의 사계절" },
      { from: 15, to: 24, title: "바다가 들려주는 이야기" },
    ],
  },
  {
    number: 17,
    name: "마음 채널",
    scene: "temple",
    slots: [
      { from: 5, to: 10, title: "아침 예불" },
      { from: 10, to: 18, title: "마음을 여는 법문" },
      { from: 18, to: 24, title: "저녁 예불" },
    ],
  },
  {
    number: 21,
    name: "건강 채널",
    scene: "health",
    slots: [
      { from: 6, to: 12, title: "백세 건강 체조" },
      { from: 12, to: 24, title: "명의에게 묻다" },
    ],
  },
];

export function findChannelIndex(number: number): number {
  return CHANNELS.findIndex((c) => c.number === number);
}

// Unknown numbers from the agent still get a screen instead of an error.
export function channelForNumber(number: number): TvChannel {
  return (
    CHANNELS.find((c) => c.number === number) ?? {
      number,
      name: `${number}번 채널`,
      scene: "generic",
      slots: [{ from: 0, to: 24, title: "방송 중" }],
    }
  );
}

export function programTitle(channel: TvChannel, now: Date): string {
  const h = now.getHours();
  const slot = channel.slots.find((s) => h >= s.from && h < s.to);
  return slot?.title ?? "정규 방송";
}
