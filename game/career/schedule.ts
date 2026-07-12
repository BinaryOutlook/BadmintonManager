import type { RoundName, TournamentState } from "../tournament/tournament";
import {
  addCalendarMonths,
  addDays,
  calendarMonthCursorForDate,
  calendarMonthLabel,
  type CalendarMonthCursor
} from "./calendar";
import {
  scheduleCalendarEntriesForCareer,
  type ScheduleCalendarEntry
} from "./events";
import type {
  CareerState,
  FacilityState,
  ScoutAssignment,
  ScheduledPreparationBlock
} from "./models";
import { careerWorldPlayerMap } from "./world";

export type ManagerScheduleStatus =
  | "scheduled"
  | "due"
  | "overdue"
  | "completed"
  | "blocked"
  | "cancelled"
  | "expired";

export type ManagerScheduleCategory =
  | "event"
  | "medical"
  | "travel"
  | "training"
  | "scouting"
  | "facility";

export type ManagerScheduleDestination =
  | { kind: "tournament"; seasonId: string; eventId: string }
  | { kind: "scheduled_match"; eventId: string }
  | { kind: "training"; athleteId: string; blockId?: string }
  | { kind: "scouting"; assignmentId: string }
  | { kind: "facilities"; facilityId: string }
  | null;

type ManagerScheduleBase = {
  id: string;
  category: ManagerScheduleCategory;
  date: string;
  status: ManagerScheduleStatus;
  title: string;
  detail: string;
  destination: ManagerScheduleDestination;
};

export type ManagerScheduleEventEntry =
  | (ManagerScheduleBase & {
      category: "event";
      eventKind: "match";
      seasonId: string;
      eventId: string;
      eventName: string;
      round: RoundName;
      opponentId: string | null;
      opponentLabel: string;
      result: "W" | "L" | null;
    })
  | (ManagerScheduleBase & {
      category: "event";
      eventKind: "entry_deadline" | "draw";
      seasonId: string;
      eventId: string;
      eventName: string;
      deadlineType: "entry" | "draw";
    });

export type ManagerScheduleTrainingEntry = ManagerScheduleBase & {
  category: "training";
  trainingKind: "preparation";
  blockId: string;
  athleteId: string;
  planId: string;
  planLabel: string;
  focus: ScheduledPreparationBlock["planSnapshot"]["focus"];
  intensity: ScheduledPreparationBlock["planSnapshot"]["intensity"];
  rulesVersion: 1;
  source: ScheduledPreparationBlock["source"] | "resolution";
  outcome: "pending" | "completed" | "blocked";
};

export type ManagerScheduleMedicalEntry = ManagerScheduleBase & {
  category: "medical";
  athleteId: string;
  athleteName: string;
  injuryLabel: string;
  injuryStatus: "managed" | "out";
  triggeredAt: string | null;
};

export type ManagerScheduleTravelEntry = ManagerScheduleBase & {
  category: "travel";
  seasonId: string;
  eventId: string;
  eventName: string;
  city: string;
  country: string;
  travelCostCommitted: number | null;
  bookingState: "committed";
};

export type ManagerScheduleScoutingEntry = ManagerScheduleBase & {
  category: "scouting";
  assignmentId: string;
  subjectId: string;
  subjectType: ScoutAssignment["subjectType"];
  subjectLabel: string;
  scope: ScoutAssignment["scope"];
  assignmentStatus: ScoutAssignment["status"];
};

export type ManagerScheduleFacilityEntry = ManagerScheduleBase & {
  category: "facility";
  facilityId: string;
  facilityType: FacilityState["type"];
  level: number;
  source: "build" | "history";
};

export type ManagerScheduleEntry =
  | ManagerScheduleEventEntry
  | ManagerScheduleTrainingEntry
  | ManagerScheduleMedicalEntry
  | ManagerScheduleTravelEntry
  | ManagerScheduleScoutingEntry
  | ManagerScheduleFacilityEntry;

export type ManagerScheduleDateGroup = {
  date: string;
  entries: ManagerScheduleEntry[];
};

export type ManagerScheduleMonthViewModel = {
  cursor: CalendarMonthCursor;
  label: string;
  visibleRange: {
    startDate: string;
    endDateExclusive: string;
  };
  entries: ManagerScheduleEntry[];
  groups: ManagerScheduleDateGroup[];
};

type ManagerScheduleArgs = {
  career: CareerState;
  tournament: TournamentState | null;
};

const displayStatusOrder: Record<ManagerScheduleStatus, number> = {
  overdue: 0,
  due: 1,
  blocked: 2,
  scheduled: 3,
  completed: 4,
  expired: 5,
  cancelled: 6
};

const resolutionPrecedence: Record<ManagerScheduleStatus, number> = {
  scheduled: 0,
  due: 1,
  overdue: 2,
  cancelled: 3,
  blocked: 4,
  expired: 5,
  completed: 6
};

const categoryOrder: Record<ManagerScheduleCategory, number> = {
  event: 0,
  medical: 1,
  travel: 2,
  training: 3,
  scouting: 4,
  facility: 5
};

const eventKindOrder = {
  match: 0,
  entry_deadline: 1,
  draw: 2
} as const;

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unresolvedStatus(date: string, careerDate: string): ManagerScheduleStatus {
  if (date < careerDate) {
    return "overdue";
  }

  return date === careerDate ? "due" : "scheduled";
}

function managerScheduleEntryOrder(entry: ManagerScheduleEntry) {
  return entry.category === "event" ? eventKindOrder[entry.eventKind] : 0;
}

function compareManagerScheduleEntries(left: ManagerScheduleEntry, right: ManagerScheduleEntry) {
  return (
    compareText(left.date, right.date) ||
    displayStatusOrder[left.status] - displayStatusOrder[right.status] ||
    categoryOrder[left.category] - categoryOrder[right.category] ||
    managerScheduleEntryOrder(left) - managerScheduleEntryOrder(right) ||
    compareText(left.id, right.id)
  );
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort(compareText);

  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function preferredCollisionEntry(
  existing: ManagerScheduleEntry,
  candidate: ManagerScheduleEntry
): ManagerScheduleEntry {
  const precedence = resolutionPrecedence[candidate.status] - resolutionPrecedence[existing.status];

  if (precedence !== 0) {
    return precedence > 0 ? candidate : existing;
  }

  return compareText(stableSerialize(candidate), stableSerialize(existing)) < 0 ? candidate : existing;
}

function normalizeManagerScheduleEntries(entries: ManagerScheduleEntry[]): ManagerScheduleEntry[] {
  const byId = new Map<string, ManagerScheduleEntry>();

  for (const entry of entries) {
    const existing = byId.get(entry.id);
    byId.set(entry.id, existing ? preferredCollisionEntry(existing, entry) : entry);
  }

  return [...byId.values()].sort(compareManagerScheduleEntries);
}

function athleteLabel(career: CareerState, athleteId: string) {
  return careerWorldPlayerMap(career)[athleteId]?.name ??
    career.ecosystem.recruitment.roster.find((entry) => entry.athleteId === athleteId)?.name ??
    career.ecosystem.recruitment.candidates.find((entry) => entry.id === athleteId)?.name ??
    career.ecosystem.academy.prospects.find((entry) => entry.id === athleteId)?.name ??
    athleteId;
}

function scoutingSubjectLabel(career: CareerState, subjectId: string) {
  return career.ecosystem.recruitment.candidates.find((entry) => entry.id === subjectId)?.name ??
    career.ecosystem.academy.prospects.find((entry) => entry.id === subjectId)?.name ??
    careerWorldPlayerMap(career)[subjectId]?.name ??
    career.ecosystem.recruitment.roster.find((entry) => entry.athleteId === subjectId)?.name ??
    subjectId;
}

function eventScheduleEntries(args: ManagerScheduleArgs): ManagerScheduleEventEntry[] {
  return scheduleCalendarEntriesForCareer(args).map((entry) => eventScheduleEntry(args.career, entry));
}

function eventScheduleEntry(career: CareerState, entry: ScheduleCalendarEntry): ManagerScheduleEventEntry {
  if (entry.kind === "match") {
    const status = entry.state === "completed" ? "completed" : unresolvedStatus(entry.date, career.date);

    return {
      id: `event:match:${career.seasonId}:${entry.eventId}:${entry.round}`,
      category: "event",
      eventKind: "match",
      date: entry.date,
      status,
      title: `${entry.eventName} ${entry.round}`,
      detail: entry.result
        ? `${entry.opponentLabel} · ${entry.result === "W" ? "Win" : "Loss"}`
        : `${entry.opponentLabel} · Confirmed managed match`,
      destination:
        entry.state !== "completed" && (status === "due" || status === "overdue")
          ? { kind: "scheduled_match", eventId: entry.eventId }
          : { kind: "tournament", seasonId: career.seasonId, eventId: entry.eventId },
      seasonId: career.seasonId,
      eventId: entry.eventId,
      eventName: entry.eventName,
      round: entry.round,
      opponentId: entry.opponentId,
      opponentLabel: entry.opponentLabel,
      result: entry.result
    };
  }

  const eventKind = entry.deadlineType === "entry" ? "entry_deadline" : "draw";

  return {
    id: `event:deadline:${career.seasonId}:${entry.eventId}:${entry.deadlineType}:${entry.date}`,
    category: "event",
    eventKind,
    date: entry.date,
    status: unresolvedStatus(entry.date, career.date),
    title: `${entry.eventName} · ${entry.label}`,
    detail: entry.deadlineType === "entry"
      ? "Final date for the manager to confirm event entry."
      : "The confirmed opening draw becomes available.",
    destination: { kind: "tournament", seasonId: career.seasonId, eventId: entry.eventId },
    seasonId: career.seasonId,
    eventId: entry.eventId,
    eventName: entry.eventName,
    deadlineType: entry.deadlineType
  };
}

function preparationScheduleEntries(career: CareerState): ManagerScheduleTrainingEntry[] {
  const pending = career.preparationSchedule.map((block): ManagerScheduleTrainingEntry => ({
    id: `training:${block.id}`,
    category: "training",
    trainingKind: "preparation",
    date: block.scheduledDate,
    status: unresolvedStatus(block.scheduledDate, career.date),
    title: `${athleteLabel(career, block.athleteId)} · ${block.planSnapshot.label}`,
    detail: `${block.planSnapshot.intensity} ${block.planSnapshot.focus} preparation scheduled by ${block.source}; resolves once on Advance Day.`,
    destination: { kind: "training", athleteId: block.athleteId, blockId: block.id },
    blockId: block.id,
    athleteId: block.athleteId,
    planId: block.planSnapshot.id,
    planLabel: block.planSnapshot.label,
    focus: block.planSnapshot.focus,
    intensity: block.planSnapshot.intensity,
    rulesVersion: block.rulesVersion,
    source: block.source,
    outcome: "pending"
  }));
  const resolved = career.developmentHistory.flatMap((record): ManagerScheduleTrainingEntry[] => {
    if (record.kind !== "preparation") {
      return [];
    }

    return [{
      id: `training:${record.blockId}`,
      category: "training",
      trainingKind: "preparation",
      date: record.date,
      status: record.outcome,
      title: `${athleteLabel(career, record.athleteId)} · ${record.planLabel}`,
      detail: record.reason,
      destination: { kind: "training", athleteId: record.athleteId, blockId: record.blockId },
      blockId: record.blockId,
      athleteId: record.athleteId,
      planId: record.planId,
      planLabel: record.planLabel,
      focus: record.focus,
      intensity: record.intensity,
      rulesVersion: record.rulesVersion,
      source: "resolution",
      outcome: record.outcome
    }];
  });

  return [...pending, ...resolved];
}

function medicalScheduleEntries(career: CareerState): ManagerScheduleMedicalEntry[] {
  return career.athletes.flatMap((athlete): ManagerScheduleMedicalEntry[] => {
    if (athlete.injury.status === "healthy" || !athlete.injury.returnDate) {
      return [];
    }

    const date = athlete.injury.returnDate;
    const athleteName = athleteLabel(career, athlete.playerId);

    return [{
      id: `medical:${athlete.playerId}:${athlete.injury.triggeredAt ?? date}:return`,
      category: "medical",
      date,
      status: unresolvedStatus(date, career.date),
      title: `${athleteName} medical return`,
      detail: `${athlete.injury.label} · projected return from active medical management.`,
      destination: { kind: "training", athleteId: athlete.playerId },
      athleteId: athlete.playerId,
      athleteName,
      injuryLabel: athlete.injury.label,
      injuryStatus: athlete.injury.status,
      triggeredAt: athlete.injury.triggeredAt
    }];
  });
}

function travelScheduleEntries(career: CareerState): ManagerScheduleTravelEntry[] {
  const enteredEventIds = new Set(career.enteredEventIds);

  return career.events.flatMap((event): ManagerScheduleTravelEntry[] => {
    if (!enteredEventIds.has(event.id)) {
      return [];
    }

    const date = addDays(event.startDate, -1);
    const status = date < career.date ? "completed" : unresolvedStatus(date, career.date);
    const travelLedgerEntry = career.economy.ledger
      .filter(
        (entry) =>
          entry.category === "travel" &&
          entry.label === `${event.name} travel` &&
          entry.amount <= 0
      )
      .sort((left, right) => compareText(left.date, right.date) || compareText(left.id, right.id))
      .at(-1);

    return [{
      id: `travel:${career.seasonId}:${event.id}`,
      category: "travel",
      date,
      status,
      title: `${event.name} travel`,
      detail: `Booked travel to ${event.location.city}, ${event.location.country}; entry-time cost and travel load are already committed, so no additional charge is due.`,
      destination: { kind: "tournament", seasonId: career.seasonId, eventId: event.id },
      seasonId: career.seasonId,
      eventId: event.id,
      eventName: event.name,
      city: event.location.city,
      country: event.location.country,
      travelCostCommitted: travelLedgerEntry ? Math.abs(travelLedgerEntry.amount) : null,
      bookingState: "committed"
    }];
  });
}

function scoutingStatus(assignment: ScoutAssignment, careerDate: string): ManagerScheduleStatus {
  switch (assignment.status) {
    case "ready":
      return "completed";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    default:
      return unresolvedStatus(assignment.dueAt, careerDate);
  }
}

function scoutingScheduleEntries(career: CareerState): ManagerScheduleScoutingEntry[] {
  return career.ecosystem.scouting.assignments.map((assignment): ManagerScheduleScoutingEntry => {
    const subjectLabel = scoutingSubjectLabel(career, assignment.subjectId);

    return {
      id: `scouting:${assignment.id}:due`,
      category: "scouting",
      date: assignment.dueAt,
      status: scoutingStatus(assignment, career.date),
      title: `Scout report · ${subjectLabel}`,
      detail: assignment.status === "pending"
        ? `${assignment.scope} assignment commissioned ${assignment.startedAt}.`
        : `${assignment.scope} assignment is ${assignment.status}.`,
      destination: { kind: "scouting", assignmentId: assignment.id },
      assignmentId: assignment.id,
      subjectId: assignment.subjectId,
      subjectType: assignment.subjectType,
      subjectLabel,
      scope: assignment.scope,
      assignmentStatus: assignment.status
    };
  });
}

function isCompletionHistory(
  facility: FacilityState,
  history: FacilityState["history"][number]
) {
  return history.id === `${facility.id}-${history.date}-complete-${history.level}`;
}

function facilityScheduleEntries(career: CareerState): ManagerScheduleFacilityEntry[] {
  return career.facilities.flatMap((facility): ManagerScheduleFacilityEntry[] => {
    const building: ManagerScheduleFacilityEntry[] =
      facility.status === "building" && facility.buildCompleteDate
        ? [{
            id: `facility:${facility.id}:level:${facility.level}:complete`,
            category: "facility",
            date: facility.buildCompleteDate,
            status: unresolvedStatus(facility.buildCompleteDate, career.date),
            title: `${facility.label} level ${facility.level} completion`,
            detail: "Construction is underway; the new modifiers activate after completion.",
            destination: { kind: "facilities", facilityId: facility.id },
            facilityId: facility.id,
            facilityType: facility.type,
            level: facility.level,
            source: "build"
          }]
        : [];
    const completed = facility.history.flatMap((history): ManagerScheduleFacilityEntry[] => {
      if (!isCompletionHistory(facility, history)) {
        return [];
      }

      return [{
        id: `facility:${facility.id}:level:${history.level}:complete`,
        category: "facility",
        date: history.date,
        status: "completed",
        title: `${facility.label} level ${history.level} completion`,
        detail: `Construction is complete; level ${history.level} modifiers are active.`,
        destination: { kind: "facilities", facilityId: facility.id },
        facilityId: facility.id,
        facilityType: facility.type,
        level: history.level,
        source: "history"
      }];
    });

    return [...building, ...completed];
  });
}

export function managerScheduleEntriesForCareer(args: ManagerScheduleArgs): ManagerScheduleEntry[] {
  return normalizeManagerScheduleEntries([
    ...eventScheduleEntries(args),
    ...medicalScheduleEntries(args.career),
    ...travelScheduleEntries(args.career),
    ...preparationScheduleEntries(args.career),
    ...scoutingScheduleEntries(args.career),
    ...facilityScheduleEntries(args.career)
  ]);
}

export function managerScheduleEntriesBetween(
  args: ManagerScheduleArgs & {
    startDate: string;
    endDateExclusive: string;
  }
): ManagerScheduleEntry[] {
  return managerScheduleEntriesForCareer(args).filter(
    (entry) => entry.date >= args.startDate && entry.date < args.endDateExclusive
  );
}

export function groupManagerScheduleEntriesByDate(
  entries: ManagerScheduleEntry[]
): ManagerScheduleDateGroup[] {
  return normalizeManagerScheduleEntries(entries).reduce<ManagerScheduleDateGroup[]>((groups, entry) => {
    const latest = groups.at(-1);

    if (latest?.date === entry.date) {
      latest.entries.push(entry);
      return groups;
    }

    groups.push({ date: entry.date, entries: [entry] });
    return groups;
  }, []);
}

export function managerScheduleMonthForCareer(
  args: ManagerScheduleArgs & { monthCursor: CalendarMonthCursor }
): ManagerScheduleMonthViewModel {
  const cursor = calendarMonthCursorForDate(args.monthCursor);
  const endDateExclusive = addCalendarMonths(cursor, 1);
  const entries = managerScheduleEntriesBetween({
    career: args.career,
    tournament: args.tournament,
    startDate: cursor,
    endDateExclusive
  });

  return {
    cursor,
    label: calendarMonthLabel(cursor),
    visibleRange: { startDate: cursor, endDateExclusive },
    entries,
    groups: groupManagerScheduleEntriesByDate(entries)
  };
}
