import { APP_LANG } from "@/lib/brand";
import { resolvePlace } from "./places";

// Mock taxi service (modeled on mom booking Kakao T for grandma this morning).
// Never calls or charges anything real.
const CARS_EN = [
  { plate: "7XKD482", model: "white Toyota Camry", driver: "Mike" },
  { plate: "8LMR215", model: "silver Honda Accord", driver: "Rosa" },
  { plate: "6TBN903", model: "black Ford Fusion", driver: "James" },
];
const CARS_KO = [
  { plate: "서울 32사 4821", model: "흰색 쏘나타", driver: "박정호 기사님" },
  { plate: "서울 15바 7730", model: "은색 K5", driver: "이성민 기사님" },
  { plate: "서울 48자 1192", model: "검정 그랜저", driver: "최영수 기사님" },
];

export type RideBooking = {
  id: string;
  pickup: { name: string; address: string };
  destination: { name: string; address: string };
  plate: string;
  carModel: string;
  driver: string;
  pickupAt: string; // ISO
  etaMin: number; // minutes until the car arrives at pickup
  tripMin: number;
  fareWon: number;
  fareCents: number; // charged to the allowance wallet (demo price)
  status: "dispatched" | "reserved";
};

export function requestRide(input: { from?: string; to: string; when?: string; now: Date }): RideBooking {
  const pickup = resolvePlace(input.from, "home");
  const destination = resolvePlace(input.to, "hospital");
  const CARS = APP_LANG === "en" ? CARS_EN : CARS_KO;
  const car = CARS[Math.floor(input.now.getTime() / 60_000) % CARS.length];
  const whenMs = input.when ? Date.parse(input.when) : NaN;
  const reserved = Number.isFinite(whenMs) && whenMs - input.now.getTime() > 15 * 60_000;
  const etaMin = reserved ? Math.round((whenMs - input.now.getTime()) / 60_000) : 6;
  return {
    id: `RIDE-${input.now.getTime().toString(36).toUpperCase()}`,
    pickup: { name: pickup.name, address: pickup.address },
    destination: { name: destination.name, address: destination.address },
    plate: car.plate,
    carModel: car.model,
    driver: car.driver,
    pickupAt: new Date(input.now.getTime() + etaMin * 60_000).toISOString(),
    etaMin,
    tripMin: 8, // shaped on a real morning ride: 8 minutes, card payment (values here are fake)
    fareWon: 5900,
    fareCents: 450,
    status: reserved ? "reserved" : "dispatched",
  };
}
