import type { CareerEventDefinition, CareerTier } from "./models";

export const careerEventCatalog: CareerEventDefinition[] = [
  {
    id: "metro-open-300",
    name: "Metro Open",
    tier: "Super 300",
    startDate: "2026-06-03",
    durationDays: 5,
    travelCost: 2800,
    entryFee: 750,
    trainingCostModifier: 0.9,
    prizeMoney: { R16: 800, QF: 1800, SF: 4200, F: 8500, champion: 15000 },
    rankingPoints: { R16: 120, QF: 210, SF: 360, F: 540, champion: 700 },
    prestige: 54
  },
  {
    id: "harbor-masters-500",
    name: "Harbor Masters",
    tier: "Super 500",
    startDate: "2026-06-12",
    durationDays: 6,
    travelCost: 5100,
    entryFee: 1200,
    trainingCostModifier: 1,
    prizeMoney: { R16: 1200, QF: 3200, SF: 7600, F: 14500, champion: 26000 },
    rankingPoints: { R16: 180, QF: 320, SF: 520, F: 760, champion: 950 },
    prestige: 68
  },
  {
    id: "summit-invitational-750",
    name: "Summit Invitational",
    tier: "Super 750",
    startDate: "2026-06-24",
    durationDays: 6,
    travelCost: 7800,
    entryFee: 2000,
    trainingCostModifier: 1.12,
    prizeMoney: { R16: 1800, QF: 5600, SF: 12800, F: 24000, champion: 43000 },
    rankingPoints: { R16: 250, QF: 450, SF: 700, F: 980, champion: 1250 },
    prestige: 82
  }
];

export const tierOrder: Record<CareerTier, number> = {
  National: 1,
  Invitational: 2,
  "Super 300": 3,
  "Super 500": 4,
  "Super 750": 5,
  "Super 1000": 6,
  Finals: 7
};

export function getCareerEvent(events: CareerEventDefinition[], eventId: string) {
  return events.find((event) => event.id === eventId);
}

export function getNextEvent(events: CareerEventDefinition[], date: string) {
  return [...events]
    .filter((event) => event.startDate >= date)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
}

export function roundKeyForPlacement(round: string, won: boolean) {
  if (round === "F" && won) {
    return "champion";
  }

  return round;
}
