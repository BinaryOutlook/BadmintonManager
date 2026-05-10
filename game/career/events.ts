import type { CareerEventDefinition, CareerState, CareerTier } from "./models";

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
  },
  {
    id: "continental-premier-1000",
    name: "Continental Premier",
    tier: "Super 1000",
    startDate: "2026-07-10",
    durationDays: 7,
    travelCost: 10500,
    entryFee: 2800,
    trainingCostModifier: 1.2,
    prizeMoney: { R16: 2600, QF: 7600, SF: 17500, F: 32000, champion: 58000 },
    rankingPoints: { R16: 320, QF: 620, SF: 900, F: 1250, champion: 1600 },
    prestige: 92
  },
  {
    id: "national-command-championship",
    name: "National Command Championship",
    tier: "National",
    startDate: "2026-07-22",
    durationDays: 4,
    travelCost: 1200,
    entryFee: 350,
    trainingCostModifier: 0.82,
    prizeMoney: { R16: 350, QF: 800, SF: 1700, F: 3200, champion: 6200 },
    rankingPoints: { R16: 60, QF: 110, SF: 190, F: 290, champion: 420 },
    prestige: 38
  },
  {
    id: "academy-select-invitational",
    name: "Academy Select Invitational",
    tier: "Invitational",
    startDate: "2026-08-02",
    durationDays: 4,
    travelCost: 2200,
    entryFee: 500,
    trainingCostModifier: 0.88,
    prizeMoney: { R16: 500, QF: 1100, SF: 2400, F: 4200, champion: 8000 },
    rankingPoints: { R16: 90, QF: 150, SF: 260, F: 390, champion: 540 },
    prestige: 46
  },
  {
    id: "season-finals",
    name: "Season Finals",
    tier: "Finals",
    startDate: "2026-08-20",
    durationDays: 6,
    travelCost: 9200,
    entryFee: 0,
    trainingCostModifier: 1.15,
    prizeMoney: { R16: 3500, QF: 9500, SF: 22000, F: 41000, champion: 72000 },
    rankingPoints: { R16: 280, QF: 560, SF: 840, F: 1160, champion: 1500 },
    prestige: 98
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

export function eventEligibilityFor(state: CareerState, event: CareerEventDefinition) {
  const athlete = state.athletes.find((entry) => entry.playerId === state.program.managedPlayerId) ?? state.athletes[0];
  const ranking = state.rankings.find((entry) => entry.playerId === state.program.managedPlayerId);
  const rank = ranking?.rank ?? athlete?.currentRank ?? 99;
  const points = ranking?.points ?? athlete?.rankingPoints ?? 0;
  const completedEvents = state.completedEventIds.length;
  const readiness = athlete?.readiness ?? 0;
  const requirements: string[] = [];

  if (event.tier === "Super 500") {
    requirements.push("rank 24 or better", "readiness 60+");
  }

  if (event.tier === "Super 750") {
    requirements.push("rank 16 or better", "readiness 68+");
  }

  if (event.tier === "Super 1000") {
    requirements.push("rank 8 or better", "1,700+ points", "readiness 72+");
  }

  if (event.tier === "Finals") {
    requirements.push("rank 8 or better", "2,600+ points or four completed events", "readiness 74+");
  }

  const allowed =
    event.tier === "National" ||
    event.tier === "Invitational" ||
    event.tier === "Super 300" ||
    (event.tier === "Super 500" && rank <= 24 && readiness >= 60) ||
    (event.tier === "Super 750" && rank <= 16 && readiness >= 68) ||
    (event.tier === "Super 1000" && rank <= 8 && points >= 1700 && readiness >= 72) ||
    (event.tier === "Finals" && rank <= 8 && readiness >= 74 && (points >= 2600 || completedEvents >= 4));

  return {
    allowed,
    reason: allowed
      ? `${event.tier} entry requirements met`
      : `${event.tier} gate requires ${requirements.join(", ")}`,
    requirements,
    rank,
    points,
    readiness,
    completedEvents
  };
}

export function roundKeyForPlacement(round: string, won: boolean) {
  if (round === "F" && won) {
    return "champion";
  }

  return round;
}
