import { addDays, daysBetween } from "./calendar";
import type { CareerEventDefinition, CareerEventStatus, CareerState, CareerTier, RankingEntry } from "./models";

export type CalendarEventStatus =
  | CareerEventStatus
  | "entered"
  | "missed_deadline";

export const careerEventCatalog: CareerEventDefinition[] = [
  {
    id: "metro-open-300",
    name: "Metro Open",
    tier: "Super 300",
    weekNumber: 23,
    startDate: "2026-06-03",
    durationDays: 5,
    location: {
      city: "Port Azure",
      country: "Meridian Coast",
      venue: "Harborline Fieldhouse"
    },
    entryDeadline: "2026-06-01",
    rankingCutoffDate: "2026-05-29",
    seedingDate: "2026-05-30",
    withdrawalDeadline: "2026-06-01",
    drawDate: "2026-06-02",
    drawSize: 16,
    seedCount: 8,
    status: "entry_open",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Developmental circuit points with low travel pressure",
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
    weekNumber: 24,
    startDate: "2026-06-12",
    durationDays: 6,
    location: {
      city: "North Quay",
      country: "Meridian Coast",
      venue: "Tideglass Arena"
    },
    entryDeadline: "2026-06-06",
    rankingCutoffDate: "2026-06-03",
    seedingDate: "2026-06-04",
    withdrawalDeadline: "2026-06-08",
    drawDate: "2026-06-10",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: 24,
      minPoints: null,
      readinessFloor: 60,
      minCompletedEvents: null
    },
    stakesLabel: "Mid-tier points race event with firmer readiness demands",
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
    weekNumber: 26,
    startDate: "2026-06-24",
    durationDays: 6,
    location: {
      city: "Highridge",
      country: "Alpine Union",
      venue: "Summit House"
    },
    entryDeadline: "2026-06-16",
    rankingCutoffDate: "2026-06-12",
    seedingDate: "2026-06-14",
    withdrawalDeadline: "2026-06-18",
    drawDate: "2026-06-21",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: 16,
      minPoints: null,
      readinessFloor: 68,
      minCompletedEvents: null
    },
    stakesLabel: "Prestige invitational for top-half circuit programs",
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
    weekNumber: 28,
    startDate: "2026-07-10",
    durationDays: 7,
    location: {
      city: "Eastrail",
      country: "Continental League",
      venue: "Grand Concourse Hall"
    },
    entryDeadline: "2026-06-29",
    rankingCutoffDate: "2026-06-25",
    seedingDate: "2026-06-27",
    withdrawalDeadline: "2026-07-02",
    drawDate: "2026-07-07",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: 8,
      minPoints: 1700,
      readinessFloor: 72,
      minCompletedEvents: null
    },
    stakesLabel: "Elite circuit anchor with severe points and fatigue consequences",
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
    weekNumber: 30,
    startDate: "2026-07-22",
    durationDays: 4,
    location: {
      city: "Lakeside Borough",
      country: "Home Federation",
      venue: "Civic Badminton Centre"
    },
    entryDeadline: "2026-07-17",
    rankingCutoffDate: "2026-07-14",
    seedingDate: "2026-07-15",
    withdrawalDeadline: "2026-07-18",
    drawDate: "2026-07-20",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Domestic form-builder with manageable cost",
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
    weekNumber: 31,
    startDate: "2026-08-02",
    durationDays: 4,
    location: {
      city: "Westhaven",
      country: "Meridian Coast",
      venue: "Academy Courtworks"
    },
    entryDeadline: "2026-07-27",
    rankingCutoffDate: "2026-07-24",
    seedingDate: "2026-07-25",
    withdrawalDeadline: "2026-07-29",
    drawDate: "2026-07-31",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Selection-pressure event for prospects and rotation athletes",
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
    weekNumber: 34,
    startDate: "2026-08-20",
    durationDays: 6,
    location: {
      city: "Crownbridge",
      country: "Neutral Circuit",
      venue: "Finals Hall"
    },
    entryDeadline: "2026-08-10",
    rankingCutoffDate: "2026-08-08",
    seedingDate: "2026-08-09",
    withdrawalDeadline: "2026-08-12",
    drawDate: "2026-08-17",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: 8,
      minPoints: 2600,
      readinessFloor: 74,
      minCompletedEvents: 4
    },
    stakesLabel: "Fictional season finale based on circuit rank or proven event volume",
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

export function hydrateCareerEventDefinition(event: CareerEventDefinition): CareerEventDefinition {
  const catalogEvent = careerEventCatalog.find((candidate) => candidate.id === event.id);

  return catalogEvent
    ? {
        ...event,
        weekNumber: catalogEvent.weekNumber,
        location: catalogEvent.location,
        entryDeadline: catalogEvent.entryDeadline,
        rankingCutoffDate: catalogEvent.rankingCutoffDate,
        seedingDate: catalogEvent.seedingDate,
        withdrawalDeadline: catalogEvent.withdrawalDeadline,
        drawDate: catalogEvent.drawDate,
        drawSize: catalogEvent.drawSize,
        seedCount: catalogEvent.seedCount,
        status: catalogEvent.status,
        eligibility: catalogEvent.eligibility,
        stakesLabel: catalogEvent.stakesLabel
      }
    : event;
}

export function hydrateCareerEvents(events: CareerEventDefinition[]): CareerEventDefinition[] {
  return events.map(hydrateCareerEventDefinition);
}

export function getNextEvent(events: CareerEventDefinition[], date: string) {
  return [...events]
    .filter((event) => event.startDate >= date)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
}

export function eventStatusFor(state: CareerState, event: CareerEventDefinition, date = state.date): CalendarEventStatus {
  if (state.completedEventIds.includes(event.id)) {
    return "completed";
  }

  const endDate = addDays(event.startDate, event.durationDays - 1);

  if (state.enteredEventIds.includes(event.id)) {
    if (date >= event.startDate && date <= endDate) {
      return "in_progress";
    }

    if (date >= event.drawDate) {
      return "draw_published";
    }

    return "entered";
  }

  if (date > event.entryDeadline) {
    return "missed_deadline";
  }

  if (date > event.withdrawalDeadline) {
    return "entry_closed";
  }

  if (date >= event.drawDate) {
    return "draw_published";
  }

  return date >= event.rankingCutoffDate ? "entry_open" : event.status;
}

export function eventDeadlineMilestones(event: CareerEventDefinition) {
  return [
    { key: "ranking_cutoff", label: "Ranking cutoff", date: event.rankingCutoffDate },
    { key: "seeding", label: "Seeding snapshot", date: event.seedingDate },
    { key: "entry", label: "Entry deadline", date: event.entryDeadline },
    { key: "withdrawal", label: "Withdrawal deadline", date: event.withdrawalDeadline },
    { key: "draw", label: "Draw published", date: event.drawDate },
    { key: "start", label: "Match week begins", date: event.startDate }
  ];
}

export function eventEligibilityFor(state: CareerState, event: CareerEventDefinition) {
  const athlete = state.athletes.find((entry) => entry.playerId === state.program.managedPlayerId) ?? state.athletes[0];
  const ranking = state.rankings.find((entry) => entry.playerId === state.program.managedPlayerId);
  const rank = ranking?.rank ?? athlete?.currentRank ?? 99;
  const points = ranking?.points ?? athlete?.rankingPoints ?? 0;
  const seasonPoints = ranking?.seasonPoints ?? 0;
  const completedEvents = state.completedEventIds.length;
  const readiness = athlete?.readiness ?? 0;
  const requirements: string[] = [];
  const status = eventStatusFor(state, event);
  const daysUntilEntryDeadline = daysBetween(state.date, event.entryDeadline);

  if (event.eligibility.minRank) {
    requirements.push(`rank ${event.eligibility.minRank} or better`);
  }

  if (event.eligibility.minPoints) {
    requirements.push(`${event.eligibility.minPoints.toLocaleString()}+ circuit points`);
  }

  if (event.eligibility.readinessFloor > 0) {
    requirements.push(`readiness ${event.eligibility.readinessFloor}+`);
  }

  if (event.tier === "Finals" && event.eligibility.minCompletedEvents) {
    requirements.push(
      `${event.eligibility.minPoints?.toLocaleString() ?? 0}+ season race points or ${event.eligibility.minCompletedEvents} completed events`
    );
  }

  const entryWindowOpen = status !== "missed_deadline" || state.enteredEventIds.includes(event.id);
  const rankAllowed = event.eligibility.minRank === null || rank <= event.eligibility.minRank;
  const readinessAllowed = readiness >= event.eligibility.readinessFloor;
  const pointsAllowed =
    event.eligibility.minPoints === null ||
    points >= event.eligibility.minPoints ||
    (event.tier === "Finals" && seasonPoints >= event.eligibility.minPoints);
  const completedAllowed =
    event.eligibility.minCompletedEvents === null || completedEvents >= event.eligibility.minCompletedEvents;
  const pointsOrVolumeAllowed = event.tier === "Finals" ? pointsAllowed || completedAllowed : pointsAllowed;
  const allowed = entryWindowOpen && rankAllowed && readinessAllowed && pointsOrVolumeAllowed;
  const failedRequirements = [
    !entryWindowOpen ? `entry deadline passed on ${event.entryDeadline}` : null,
    !rankAllowed && event.eligibility.minRank ? `rank ${event.eligibility.minRank} or better` : null,
    !readinessAllowed ? `readiness ${event.eligibility.readinessFloor}+` : null,
    !pointsOrVolumeAllowed && event.eligibility.minPoints ? `${event.eligibility.minPoints.toLocaleString()}+ circuit points` : null,
    event.tier === "Finals" && !pointsOrVolumeAllowed && event.eligibility.minCompletedEvents
      ? `${event.eligibility.minCompletedEvents} completed events`
      : null
  ].filter((entry): entry is string => Boolean(entry));

  return {
    allowed,
    reason: allowed
      ? `${event.tier} entry requirements met before the ${event.entryDeadline} deadline`
      : `${event.tier} gate requires ${failedRequirements.length > 0 ? failedRequirements.join(", ") : requirements.join(", ")}`,
    requirements,
    status,
    entryDeadline: event.entryDeadline,
    daysUntilEntryDeadline,
    rank,
    points,
    seasonPoints,
    readiness,
    completedEvents
  };
}

export function buildEventSeedingSnapshot(args: {
  state: CareerState;
  event: CareerEventDefinition;
  date?: string;
}) {
  const date = args.date ?? args.state.date;
  const locked = date >= args.event.seedingDate;
  const seeds = [...args.state.rankings]
    .sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId))
    .slice(0, args.event.seedCount)
    .map((entry, index) => ({
      seed: index + 1,
      playerId: entry.playerId,
      rank: entry.rank,
      points: entry.points,
      seasonPoints: entry.seasonPoints
    }));
  const managed = seeds.find((entry) => entry.playerId === args.state.program.managedPlayerId) ?? null;

  return {
    eventId: args.event.id,
    status: locked ? "locked" as const : "projected" as const,
    rankingCutoffDate: args.event.rankingCutoffDate,
    seedingDate: args.event.seedingDate,
    drawDate: args.event.drawDate,
    drawSize: args.event.drawSize,
    seedCount: args.event.seedCount,
    source: "fictional circuit ranking at seeding snapshot",
    seeds,
    managedSeed: managed
  };
}

export function roundKeyForPlacement(round: string, won: boolean) {
  if (round === "F" && won) {
    return "champion";
  }

  return round;
}
