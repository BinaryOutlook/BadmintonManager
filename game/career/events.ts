import {
  addCalendarMonths,
  addDays,
  calendarMonthCursorForDate,
  calendarMonthLabel,
  dayOfMonth,
  daysBetween,
  mondayFirstWeekdayIndex,
  type CalendarMonthCursor
} from "./calendar";
import { managedMatchScheduleForEvent, scheduledDateForRound } from "./matchSchedule";
import { normalizeCareerTierLabel } from "./models";
import { playerMap } from "../content/players";
import type {
  CareerEventBracketSnapshot,
  CareerEventDefinition,
  CareerEventHistoryRecord,
  CareerEventHistoryStatus,
  CareerEventStatus,
  CareerMatchRecordSource,
  CareerState,
  CareerTier,
  ProgramEconomy,
  RankingEntry
} from "./models";
import {
  getManagedMatchContext,
  isTournamentComplete,
  type RoundName,
  type TournamentMatch,
  type TournamentState
} from "../tournament/tournament";

export type CalendarEventStatus =
  | CareerEventStatus
  | "entered"
  | "missed_deadline";

export const CALENDAR_PAGE_SIZE = 5;

export const careerEventCatalog: CareerEventDefinition[] = [
  {
    id: "metro-open-300",
    name: "Metro Open",
    tier: "Circuit 300",
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
    tier: "Circuit 500",
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
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
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
    tier: "Circuit 750",
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
    tier: "Circuit 1000",
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
    id: "coastline-classic-300",
    name: "Coastline Classic",
    tier: "Circuit 300",
    weekNumber: 33,
    startDate: "2026-08-13",
    durationDays: 4,
    location: {
      city: "South Quay",
      country: "Meridian Coast",
      venue: "Coastline Sports Hall"
    },
    entryDeadline: "2026-08-07",
    rankingCutoffDate: "2026-08-04",
    seedingDate: "2026-08-05",
    withdrawalDeadline: "2026-08-09",
    drawDate: "2026-08-11",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Compact coastal points event for post-academy rhythm",
    travelCost: 3000,
    entryFee: 700,
    trainingCostModifier: 0.9,
    prizeMoney: { R16: 800, QF: 1800, SF: 4200, F: 8500, champion: 15000 },
    rankingPoints: { R16: 120, QF: 210, SF: 360, F: 540, champion: 700 },
    prestige: 52
  },
  {
    id: "lakeside-sprint-300",
    name: "Lakeside Sprint",
    tier: "Circuit 300",
    weekNumber: 36,
    startDate: "2026-09-03",
    durationDays: 4,
    location: {
      city: "Lakehaven",
      country: "Home Federation",
      venue: "Mirrorlake Arena"
    },
    entryDeadline: "2026-08-28",
    rankingCutoffDate: "2026-08-25",
    seedingDate: "2026-08-26",
    withdrawalDeadline: "2026-08-30",
    drawDate: "2026-09-01",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Short-format ranking sprint with low travel drag",
    travelCost: 1800,
    entryFee: 650,
    trainingCostModifier: 0.86,
    prizeMoney: { R16: 800, QF: 1800, SF: 4200, F: 8500, champion: 15000 },
    rankingPoints: { R16: 120, QF: 210, SF: 360, F: 540, champion: 700 },
    prestige: 50
  },
  {
    id: "ember-city-open-500",
    name: "Ember City Open",
    tier: "Circuit 500",
    weekNumber: 39,
    startDate: "2026-09-24",
    durationDays: 5,
    location: {
      city: "Ember City",
      country: "Central Federation",
      venue: "Foundry Court"
    },
    entryDeadline: "2026-09-17",
    rankingCutoffDate: "2026-09-14",
    seedingDate: "2026-09-15",
    withdrawalDeadline: "2026-09-19",
    drawDate: "2026-09-22",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Autumn circuit step-up with firmer prize and points pressure",
    travelCost: 5600,
    entryFee: 1250,
    trainingCostModifier: 1,
    prizeMoney: { R16: 1200, QF: 3200, SF: 7600, F: 14500, champion: 26000 },
    rankingPoints: { R16: 180, QF: 320, SF: 520, F: 760, champion: 950 },
    prestige: 66
  },
  {
    id: "northern-lights-challenge-500",
    name: "Northern Lights Challenge",
    tier: "Circuit 500",
    weekNumber: 42,
    startDate: "2026-10-15",
    durationDays: 5,
    location: {
      city: "Aurora Bay",
      country: "Northern League",
      venue: "Skyline Badminton Dome"
    },
    entryDeadline: "2026-10-08",
    rankingCutoffDate: "2026-10-05",
    seedingDate: "2026-10-06",
    withdrawalDeadline: "2026-10-10",
    drawDate: "2026-10-13",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Cold-weather travel test with balanced circuit rewards",
    travelCost: 6200,
    entryFee: 1250,
    trainingCostModifier: 1.02,
    prizeMoney: { R16: 1200, QF: 3200, SF: 7600, F: 14500, champion: 26000 },
    rankingPoints: { R16: 180, QF: 320, SF: 520, F: 760, champion: 950 },
    prestige: 67
  },
  {
    id: "meridian-autumn-masters-750",
    name: "Meridian Autumn Masters",
    tier: "Circuit 750",
    weekNumber: 45,
    startDate: "2026-11-05",
    durationDays: 5,
    location: {
      city: "Meridian City",
      country: "Meridian Coast",
      venue: "Autumn Masters Hall"
    },
    entryDeadline: "2026-10-29",
    rankingCutoffDate: "2026-10-26",
    seedingDate: "2026-10-27",
    withdrawalDeadline: "2026-10-31",
    drawDate: "2026-11-03",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Late-season masters event without MVP qualification locks",
    travelCost: 7400,
    entryFee: 1900,
    trainingCostModifier: 1.08,
    prizeMoney: { R16: 1800, QF: 5600, SF: 12800, F: 24000, champion: 43000 },
    rankingPoints: { R16: 250, QF: 450, SF: 700, F: 980, champion: 1250 },
    prestige: 78
  },
  {
    id: "crownbridge-warmup-invitational",
    name: "Crownbridge Warmup Invitational",
    tier: "Invitational",
    weekNumber: 48,
    startDate: "2026-11-26",
    durationDays: 4,
    location: {
      city: "Crownbridge",
      country: "Neutral Circuit",
      venue: "Warmup Pavilion"
    },
    entryDeadline: "2026-11-20",
    rankingCutoffDate: "2026-11-17",
    seedingDate: "2026-11-18",
    withdrawalDeadline: "2026-11-22",
    drawDate: "2026-11-24",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    },
    stakesLabel: "Fictional invitational bridge before the week 52 finale",
    travelCost: 4200,
    entryFee: 600,
    trainingCostModifier: 0.94,
    prizeMoney: { R16: 500, QF: 1100, SF: 2400, F: 4200, champion: 8000 },
    rankingPoints: { R16: 90, QF: 150, SF: 260, F: 390, champion: 540 },
    prestige: 48
  },
  {
    id: "season-finals",
    name: "Season Finals",
    tier: "Finals",
    weekNumber: 52,
    startDate: "2026-12-23",
    durationDays: 6,
    location: {
      city: "Crownbridge",
      country: "Neutral Circuit",
      venue: "Finals Hall"
    },
    entryDeadline: "2026-12-12",
    rankingCutoffDate: "2026-12-08",
    seedingDate: "2026-12-10",
    withdrawalDeadline: "2026-12-14",
    drawDate: "2026-12-20",
    drawSize: 16,
    seedCount: 8,
    status: "scheduled",
    eligibility: {
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
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
  "Circuit 300": 3,
  "Circuit 500": 4,
  "Circuit 750": 5,
  "Circuit 1000": 6,
  Finals: 7
};

export function getCareerEvent(events: CareerEventDefinition[], eventId: string) {
  return events.find((event) => event.id === eventId);
}

export function hydrateCareerEventDefinition(event: CareerEventDefinition): CareerEventDefinition {
  const catalogEvent = careerEventCatalog.find((candidate) => candidate.id === event.id);

  return catalogEvent
    ? {
        ...catalogEvent,
        tier: catalogEvent.tier,
        weekNumber: catalogEvent.weekNumber,
        startDate: catalogEvent.startDate,
        durationDays: catalogEvent.durationDays,
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
        stakesLabel: catalogEvent.stakesLabel,
        travelCost: catalogEvent.travelCost,
        entryFee: catalogEvent.entryFee,
        trainingCostModifier: catalogEvent.trainingCostModifier,
        prizeMoney: catalogEvent.prizeMoney,
        rankingPoints: catalogEvent.rankingPoints,
        prestige: catalogEvent.prestige
      }
    : { ...event, tier: normalizeCareerTierLabel(event.tier) as CareerTier };
}

export function hydrateCareerEvents(events: CareerEventDefinition[]): CareerEventDefinition[] {
  const hydratedById = new Map(events.map((event) => [event.id, hydrateCareerEventDefinition(event)]));
  const catalogMerged = careerEventCatalog.map((event) => hydratedById.get(event.id) ?? event);
  const customEvents = [...hydratedById.values()].filter(
    (event) => !careerEventCatalog.some((catalogEvent) => catalogEvent.id === event.id)
  );

  return [...catalogMerged, ...customEvents].sort((left, right) => left.startDate.localeCompare(right.startDate));
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

export function eventEndDate(event: CareerEventDefinition) {
  return addDays(event.startDate, event.durationDays - 1);
}

export function upcomingCalendarEvents(career: CareerState): CareerEventDefinition[] {
  return [...career.events]
    .filter((event) => career.date <= eventEndDate(event))
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id));
}

export function pastCalendarRecords(career: CareerState): CareerEventHistoryRecord[] {
  return [...career.eventHistory].sort(
    (left, right) =>
      right.endDate.localeCompare(left.endDate) ||
      right.completedAt.localeCompare(left.completedAt) ||
      left.eventName.localeCompare(right.eventName)
  );
}

export type CalendarCommitment = {
  date: string;
  eventId: string;
  eventName: string;
  round: RoundName;
  opponentId: string | null;
  opponentLabel: string;
  result: "W" | "L" | null;
};

export type ScheduleCalendarMatchEntry = CalendarCommitment & {
  id: string;
  kind: "match";
  state: "completed" | "confirmed";
};

export type ScheduleCalendarDeadlineEntry = {
  id: string;
  kind: "deadline";
  state: "deadline";
  date: string;
  eventId: string;
  eventName: string;
  deadlineType: "entry" | "draw";
  label: string;
};

export type ScheduleCalendarEntry = ScheduleCalendarMatchEntry | ScheduleCalendarDeadlineEntry;

export type CalendarCommitmentDateGroup = {
  date: string;
  commitments: CalendarCommitment[];
};

export type CalendarMonthWeek = {
  days: Array<{
    date: string;
    dayNumber: number;
    inVisibleMonth: boolean;
    isCareerToday: boolean;
    entries: ScheduleCalendarEntry[];
  }>;
};

export type CalendarMonthViewModel = {
  cursor: CalendarMonthCursor;
  label: string;
  weeks: CalendarMonthWeek[];
  visibleRange: {
    startDate: string;
    endDateExclusive: string;
  };
  entries: ScheduleCalendarEntry[];
};

export type { CalendarMonthCursor };

const calendarCommitmentRounds: RoundName[] = ["R16", "QF", "SF", "F"];

const calendarRoundOrder = Object.fromEntries(
  calendarCommitmentRounds.map((round, index) => [round, index])
) as Record<RoundName, number>;

function playerLabel(playerId: string | null) {
  if (!playerId) {
    return "TBD";
  }

  return playerMap[playerId]?.name ?? playerId;
}

function isManagedCareerMatchRecord(career: CareerState, record: CareerState["matchHistory"][number]) {
  const managedPlayerId = career.program.managedPlayerId;

  return record.playerAId === managedPlayerId || record.playerBId === managedPlayerId;
}

function completedCommitmentForRecord(career: CareerState, record: CareerState["matchHistory"][number]): CalendarCommitment {
  const managedPlayerId = career.program.managedPlayerId;
  const opponentId = record.playerAId === managedPlayerId
    ? record.playerBId
    : record.playerBId === managedPlayerId
      ? record.playerAId
      : null;

  return {
    date: record.date,
    eventId: record.eventId,
    eventName: record.eventName,
    round: record.round,
    opponentId,
    opponentLabel: playerLabel(opponentId),
    result: record.winnerId === managedPlayerId ? "W" : "L"
  };
}

function scheduledCommitmentForRound(args: {
  event: CareerEventDefinition;
  round: RoundName;
  opponentId: string | null;
}): CalendarCommitment {
  return {
    date: scheduledDateForRound(args.event, args.round),
    eventId: args.event.id,
    eventName: args.event.name,
    round: args.round,
    opponentId: args.opponentId,
    opponentLabel: playerLabel(args.opponentId),
    result: null
  };
}

function activeOpponentIdForRound(args: {
  career: CareerState;
  eventId: string;
  round: RoundName;
  tournament: TournamentState | null;
}) {
  if (!args.tournament || args.tournament.id !== args.eventId || isTournamentComplete(args.tournament)) {
    return null;
  }

  const context = getManagedMatchContext(args.tournament);

  if (!context || context.roundName !== args.round) {
    return null;
  }

  return context.playerAId === args.career.program.managedPlayerId ? context.playerBId : context.playerAId;
}

function sortCalendarCommitments(commitments: CalendarCommitment[]) {
  return [...commitments].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.eventName.localeCompare(right.eventName) ||
      calendarRoundOrder[left.round] - calendarRoundOrder[right.round] ||
      left.eventId.localeCompare(right.eventId)
  );
}

export function timelineCommitmentsForCareer(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): CalendarCommitment[] {
  const managedMatchHistory = args.career.matchHistory.filter((record) =>
    isManagedCareerMatchRecord(args.career, record)
  );
  const completedRoundKeys = new Set(
    managedMatchHistory.map((record) => `${record.eventId}:${record.round}`)
  );
  const completedCommitments = managedMatchHistory.map((record) =>
    completedCommitmentForRecord(args.career, record)
  );
  const enteredEventIds = new Set(args.career.enteredEventIds);
  const completedEventIds = new Set(args.career.completedEventIds);
  const scheduledCommitments = args.career.events.flatMap((event) => {
    if (!enteredEventIds.has(event.id) || completedEventIds.has(event.id)) {
      return [];
    }

    const activeSchedule = managedMatchScheduleForEvent({
      career: args.career,
      tournament: args.tournament,
      eventId: event.id
    });

    return calendarCommitmentRounds.flatMap((round): CalendarCommitment[] => {
      if (completedRoundKeys.has(`${event.id}:${round}`)) {
        return [];
      }

      const date = scheduledDateForRound(event, round);
      const isActiveResolverRound = activeSchedule?.round === round && activeSchedule.playable;

      if (date < args.career.date && !isActiveResolverRound) {
        return [];
      }

      const opponentId = activeOpponentIdForRound({
        career: args.career,
        eventId: event.id,
        round,
        tournament: args.tournament
      });

      return [scheduledCommitmentForRound({ event, round, opponentId })];
    });
  });

  return sortCalendarCommitments([...completedCommitments, ...scheduledCommitments]);
}

export function calendarCommitmentsForCareer(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): CalendarCommitment[] {
  const managedMatchHistory = args.career.matchHistory.filter((record) =>
    isManagedCareerMatchRecord(args.career, record)
  );
  const completedRoundKeys = new Set(
    managedMatchHistory.map((record) => `${record.eventId}:${record.round}`)
  );
  const completedCommitments = managedMatchHistory.map((record) =>
    completedCommitmentForRecord(args.career, record)
  );
  const enteredEventIds = new Set(args.career.enteredEventIds);
  const completedEventIds = new Set(args.career.completedEventIds);
  const scheduledCommitments = args.career.events.flatMap((event) => {
    if (!enteredEventIds.has(event.id) || completedEventIds.has(event.id)) {
      return [];
    }

    const activeSchedule = managedMatchScheduleForEvent({
      career: args.career,
      tournament: args.tournament,
      eventId: event.id
    });
    const confirmedRound = activeSchedule?.round ?? (args.career.date >= event.drawDate ? "R16" : null);

    if (!confirmedRound || completedRoundKeys.has(`${event.id}:${confirmedRound}`)) {
      return [];
    }

    const date = scheduledDateForRound(event, confirmedRound);

    if (date < args.career.date && !activeSchedule?.playable) {
      return [];
    }

    const opponentId = activeOpponentIdForRound({
      career: args.career,
      eventId: event.id,
      round: confirmedRound,
      tournament: args.tournament
    });

    return [scheduledCommitmentForRound({ event, round: confirmedRound, opponentId })];
  });

  return sortCalendarCommitments([...completedCommitments, ...scheduledCommitments]);
}

export function groupCalendarCommitmentsByDate(commitments: CalendarCommitment[]): CalendarCommitmentDateGroup[] {
  return sortCalendarCommitments(commitments).reduce<CalendarCommitmentDateGroup[]>((groups, commitment) => {
    const latest = groups.at(-1);

    if (latest?.date === commitment.date) {
      latest.commitments.push(commitment);
      return groups;
    }

    groups.push({
      date: commitment.date,
      commitments: [commitment]
    });
    return groups;
  }, []);
}

function calendarDeadlineEntriesForCareer(career: CareerState): ScheduleCalendarDeadlineEntry[] {
  const enteredEventIds = new Set(career.enteredEventIds);
  const completedEventIds = new Set(career.completedEventIds);

  return career.events.flatMap((event): ScheduleCalendarDeadlineEntry[] => {
    if (completedEventIds.has(event.id)) {
      return [];
    }

    const entered = enteredEventIds.has(event.id);
    const eligibility = eventEligibilityFor(career, event);
    const managerRelevant = entered || eligibility.allowed;
    const entries: ScheduleCalendarDeadlineEntry[] = [];

    if (managerRelevant && career.date <= event.entryDeadline) {
      entries.push({
        id: `deadline:${event.id}:entry`,
        kind: "deadline",
        state: "deadline",
        date: event.entryDeadline,
        eventId: event.id,
        eventName: event.name,
        deadlineType: "entry",
        label: "Entry deadline"
      });
    }

    if (entered && career.date <= event.drawDate) {
      entries.push({
        id: `deadline:${event.id}:draw`,
        kind: "deadline",
        state: "deadline",
        date: event.drawDate,
        eventId: event.id,
        eventName: event.name,
        deadlineType: "draw",
        label: "Draw published"
      });
    }

    return entries;
  });
}

function scheduleCalendarEntryOrder(entry: ScheduleCalendarEntry) {
  return entry.kind === "match" ? 0 : 1;
}

function sortScheduleCalendarEntries(entries: ScheduleCalendarEntry[]) {
  return [...entries].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.eventName.localeCompare(right.eventName) ||
      scheduleCalendarEntryOrder(left) - scheduleCalendarEntryOrder(right) ||
      left.id.localeCompare(right.id)
  );
}

function scheduleCalendarMonthEntryOrder(entry: ScheduleCalendarEntry, careerDate: string) {
  if (entry.kind === "match" && !entry.result && entry.date <= careerDate) {
    return 0;
  }

  if (entry.kind === "match") {
    return 1;
  }

  return 2;
}

function sortScheduleCalendarMonthEntries(entries: ScheduleCalendarEntry[], careerDate: string) {
  return [...entries].sort(
    (left, right) =>
      scheduleCalendarMonthEntryOrder(left, careerDate) - scheduleCalendarMonthEntryOrder(right, careerDate) ||
      left.eventName.localeCompare(right.eventName) ||
      left.id.localeCompare(right.id)
  );
}

export function scheduleCalendarEntriesForCareer(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): ScheduleCalendarEntry[] {
  const matchEntries = calendarCommitmentsForCareer(args).map((commitment): ScheduleCalendarMatchEntry => ({
    ...commitment,
    id: `match:${commitment.eventId}:${commitment.round}:${commitment.result ?? "confirmed"}:${commitment.date}`,
    kind: "match",
    state: commitment.result ? "completed" : "confirmed"
  }));

  return sortScheduleCalendarEntries([
    ...calendarDeadlineEntriesForCareer(args.career),
    ...matchEntries
  ]);
}

export function scheduleCalendarMonthForCareer(args: {
  career: CareerState;
  tournament: TournamentState | null;
  monthCursor: CalendarMonthCursor;
}): CalendarMonthViewModel {
  const cursor = calendarMonthCursorForDate(args.monthCursor);
  const endDateExclusive = addCalendarMonths(cursor, 1);
  const entries = scheduleCalendarEntriesForCareer(args).filter(
    (entry) => entry.date >= cursor && entry.date < endDateExclusive
  );
  const entriesByDate = entries.reduce<Map<string, ScheduleCalendarEntry[]>>((groups, entry) => {
    const group = groups.get(entry.date) ?? [];
    group.push(entry);
    groups.set(entry.date, group);
    return groups;
  }, new Map());
  const leadingCells = mondayFirstWeekdayIndex(cursor);
  const daysInVisibleMonth = daysBetween(cursor, endDateExclusive);
  const cellCount = Math.max(35, Math.ceil((leadingCells + daysInVisibleMonth) / 7) * 7);
  const gridStartDate = addDays(cursor, -leadingCells);
  const days = Array.from({ length: cellCount }, (_, index) => {
    const date = addDays(gridStartDate, index);
    const inVisibleMonth = date >= cursor && date < endDateExclusive;

    return {
      date,
      dayNumber: dayOfMonth(date),
      inVisibleMonth,
      isCareerToday: date === args.career.date,
      entries: inVisibleMonth ? sortScheduleCalendarMonthEntries(entriesByDate.get(date) ?? [], args.career.date) : []
    };
  });

  return {
    cursor,
    label: calendarMonthLabel(cursor),
    weeks: Array.from({ length: cellCount / 7 }, (_, index) => ({
      days: days.slice(index * 7, index * 7 + 7)
    })),
    visibleRange: {
      startDate: cursor,
      endDateExclusive
    },
    entries: sortScheduleCalendarMonthEntries(entries, args.career.date)
  };
}

export function createCareerEventBracketSnapshot(tournament: TournamentState): CareerEventBracketSnapshot {
  return {
    championId: tournament.championId ?? null,
    managedPlayerId: tournament.managedPlayerId,
    rounds: tournament.rounds.map((round) => ({
      name: round.name,
      matches: round.matches.map((match) => ({
        id: match.id,
        sideAId: match.sideAId,
        sideBId: match.sideBId,
        winnerId: match.winnerId ?? null,
        scoreline: match.scoreline ?? null,
        managed: match.managed
      }))
    }))
  };
}

export function paginateCalendarItems<T>(
  items: T[],
  pageIndex: number,
  pageSize = CALENDAR_PAGE_SIZE
) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = currentPage * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    pageIndex: currentPage,
    pageCount,
    hasPrevious: currentPage > 0,
    hasNext: currentPage < pageCount - 1
  };
}

function eventHistoryStatusForPlacement(placementKey: string): CareerEventHistoryStatus {
  switch (placementKey) {
    case "champion":
      return "champion";
    case "F":
      return "runner_up";
    case "SF":
      return "semi_final";
    case "QF":
      return "quarter_final";
    default:
      return "round_of_16";
  }
}

function eventLedgerCost(args: {
  economy: ProgramEconomy;
  eventName: string;
  category: "entry" | "travel";
}) {
  return args.economy.ledger
    .filter((entry) => entry.category === args.category && entry.label.startsWith(args.eventName))
    .reduce((total, entry) => total + Math.abs(Math.min(0, entry.amount)), 0);
}

function historyAchievements(args: {
  state: CareerState;
  status: CareerEventHistoryStatus;
  pointsAwarded: number;
}) {
  const achievements: string[] = [];

  if (args.status === "champion" && !args.state.eventHistory.some((record) => record.status === "champion")) {
    achievements.push("First Title");
  }

  if (args.status === "runner_up") {
    achievements.push("Finalist");
  }

  if (args.pointsAwarded > 0) {
    achievements.push("Points Finish");
  }

  return achievements;
}

export function appendPlayedCareerEventHistory(args: {
  state: CareerState;
  event: CareerEventDefinition;
  placementKey: string;
  pointsAwarded: number;
  prizeMoney: number;
  matchId: string;
  scoreline: string;
  matchIds?: string[];
  scorelines?: string[];
  bracketSnapshot?: CareerEventBracketSnapshot;
}): CareerState {
  if (args.state.eventHistory.some((record) => record.eventId === args.event.id)) {
    return args.state;
  }

  const status = eventHistoryStatusForPlacement(args.placementKey);
  const travelCost = eventLedgerCost({
    economy: args.state.economy,
    eventName: args.event.name,
    category: "travel"
  });
  const entryCost = eventLedgerCost({
    economy: args.state.economy,
    eventName: args.event.name,
    category: "entry"
  });
  const record: CareerEventHistoryRecord = {
    eventId: args.event.id,
    eventName: args.event.name,
    tier: args.event.tier,
    startDate: args.event.startDate,
    endDate: eventEndDate(args.event),
    status,
    entered: args.state.enteredEventIds.includes(args.event.id),
    resultRound: args.placementKey,
    pointsAwarded: args.pointsAwarded,
    prizeMoney: args.prizeMoney,
    entryCost,
    travelCost,
    netCash: args.prizeMoney - entryCost - travelCost,
    completedAt: args.state.date,
    matchIds: args.matchIds ?? [args.matchId],
    scorelines: args.scorelines ?? [args.scoreline],
    achievements: historyAchievements({
      state: args.state,
      status,
      pointsAwarded: args.pointsAwarded
    }),
    bracketSnapshot: args.bracketSnapshot ?? null
  };

  return {
    ...args.state,
    eventHistory: [...args.state.eventHistory, record]
  };
}

export function appendCareerMatchRecord(args: {
  state: CareerState;
  event: CareerEventDefinition;
  matchId: string;
  date?: string;
  round: "R16" | "QF" | "SF" | "F";
  playerAId: string;
  playerBId: string;
  winnerId: string;
  scoreline: string;
  source?: CareerMatchRecordSource;
}): CareerState {
  const recordId = `${args.event.id}:${args.matchId}`;

  if (args.state.matchHistory.some((record) => record.id === recordId)) {
    return args.state;
  }

  return {
    ...args.state,
    matchHistory: [
      ...args.state.matchHistory,
      {
        id: recordId,
        eventId: args.event.id,
        eventName: args.event.name,
        date: args.date ?? args.state.date,
        round: args.round,
        playerAId: args.playerAId,
        playerBId: args.playerBId,
        winnerId: args.winnerId,
        scoreline: args.scoreline,
        source: args.source ?? "archive_import"
      }
    ]
  };
}

function sourceForTournamentMatch(match: TournamentMatch): CareerMatchRecordSource {
  if (match.managed) {
    return "played";
  }

  return match.simulationFidelity === "quick" ? "quick_sim" : "archive_import";
}

export function completedTournamentMatches(tournament: TournamentState) {
  return tournament.rounds.flatMap((round) =>
    round.matches
      .filter(
        (match) =>
          match.completed &&
          Boolean(match.winnerId) &&
          Boolean(match.scoreline)
      )
      .map((match) => ({
        ...match,
        round: round.name,
        winnerId: match.winnerId!,
        scoreline: match.scoreline!
      }))
  );
}

export function appendCompletedTournamentMatchRecords(args: {
  state: CareerState;
  event: CareerEventDefinition;
  tournament: TournamentState;
  date?: string;
}): CareerState {
  return completedTournamentMatches(args.tournament).reduce(
    (state, match) =>
      appendCareerMatchRecord({
        state,
        event: args.event,
        matchId: match.id,
        date: args.date,
        round: match.round,
        playerAId: match.sideAId,
        playerBId: match.sideBId,
        winnerId: match.winnerId,
        scoreline: match.scoreline,
        source: sourceForTournamentMatch(match)
      }),
    args.state
  );
}

export function tournamentMatchArchiveIds(tournament: TournamentState) {
  return completedTournamentMatches(tournament).map((match) => `${tournament.id}:${match.id}`);
}

export function tournamentMatchArchiveScorelines(tournament: TournamentState) {
  return completedTournamentMatches(tournament).map((match) => match.scoreline);
}

export function tournamentPlacements(tournament: TournamentState) {
  const placements = new Map<string, string>();

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (!match.completed || !match.winnerId) {
        continue;
      }

      const loserId = match.sideAId === match.winnerId ? match.sideBId : match.sideAId;
      placements.set(loserId, round.name);

      if (round.name === "F") {
        placements.set(match.winnerId, "champion");
      }
    }
  }

  return placements;
}

export function appendCareerResultAchievements(args: {
  state: CareerState;
  event: CareerEventDefinition;
  tournament?: TournamentState | null;
  date?: string;
}): CareerState {
  const finalMatch = args.tournament?.rounds
    .find((round) => round.name === "F")
    ?.matches.find((match) => match.completed && match.winnerId);

  if (!finalMatch?.winnerId) {
    return args.state;
  }

  const runnerUpId = finalMatch.sideAId === finalMatch.winnerId ? finalMatch.sideBId : finalMatch.sideAId;
  const candidates = [
    {
      playerId: finalMatch.winnerId,
      eventId: args.event.id,
      eventName: args.event.name,
      date: args.date ?? args.state.date,
      result: "champion" as const
    },
    {
      playerId: runnerUpId,
      eventId: args.event.id,
      eventName: args.event.name,
      date: args.date ?? args.state.date,
      result: "runner_up" as const
    }
  ];
  const additions = candidates.filter(
    (candidate) =>
      !args.state.playerAchievements.some(
        (record) =>
          record.playerId === candidate.playerId &&
          record.eventId === candidate.eventId &&
          record.result === candidate.result
      )
  );

  if (additions.length === 0) {
    return args.state;
  }

  return {
    ...args.state,
    playerAchievements: [...args.state.playerAchievements, ...additions]
  };
}

export function recordPastCareerEvents(state: CareerState): CareerState {
  const records = state.events
    .filter((event) => {
      if (state.eventHistory.some((record) => record.eventId === event.id)) {
        return false;
      }

      if (state.completedEventIds.includes(event.id)) {
        return false;
      }

      return state.date > eventEndDate(event);
    })
    .map((event): CareerEventHistoryRecord => {
      const entered = state.enteredEventIds.includes(event.id);

      return {
        eventId: event.id,
        eventName: event.name,
        tier: event.tier,
        startDate: event.startDate,
        endDate: eventEndDate(event),
        status: entered ? "skipped" : "missed_deadline",
        entered,
        resultRound: null,
        pointsAwarded: 0,
        prizeMoney: 0,
        entryCost: 0,
        travelCost: 0,
        netCash: 0,
        completedAt: state.date,
        matchIds: [],
        scorelines: [],
        achievements: [],
        bracketSnapshot: null
      };
    });

  if (records.length === 0) {
    return state;
  }

  return {
    ...state,
    eventHistory: [...state.eventHistory, ...records],
    activeEventId: records.some((record) => record.eventId === state.activeEventId) ? null : state.activeEventId,
    stage: records.some((record) => record.eventId === state.activeEventId) ? "event_complete" : state.stage,
    notes: [`Past events recorded: ${records.map((record) => record.eventName).join(", ")}`, ...state.notes].slice(0, 6)
  };
}
