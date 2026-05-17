import type { CareerEventDefinition, CareerState } from "./models";
import {
  getManagedMatchContext,
  isTournamentComplete,
  type RoundName,
  type TournamentState
} from "../tournament/tournament";

const DAY_MS = 86_400_000;

export const managedRoundOffsets: Record<RoundName, number> = {
  R16: 0,
  QF: 1,
  SF: 2,
  F: 3
};

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: string, days: number) {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function compareDates(left: string, right: string) {
  return Math.round((parseDate(left).getTime() - parseDate(right).getTime()) / DAY_MS);
}

export function scheduledDateForRound(event: CareerEventDefinition, round: RoundName) {
  return addUtcDays(event.startDate, managedRoundOffsets[round]);
}

function eventEndDate(event: CareerEventDefinition) {
  return addUtcDays(event.startDate, event.durationDays - 1);
}

export interface ManagedMatchSchedule {
  event: CareerEventDefinition;
  round: RoundName;
  matchId: string | null;
  scheduledDate: string;
  dueToday: boolean;
  overdue: boolean;
  playable: boolean;
}

function activeEnteredEvent(career: CareerState) {
  if (!career.activeEventId || career.completedEventIds.includes(career.activeEventId)) {
    return null;
  }

  const event = career.events.find((entry) => entry.id === career.activeEventId) ?? null;

  if (!event || !career.enteredEventIds.includes(event.id)) {
    return null;
  }

  return event;
}

function dueEnteredEvents(career: CareerState) {
  return career.events
    .filter((event) => {
      if (!career.enteredEventIds.includes(event.id) || career.completedEventIds.includes(event.id)) {
        return false;
      }

      return career.date >= event.startDate && career.date <= eventEndDate(event);
    })
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id));
}

function buildSchedule(args: {
  career: CareerState;
  event: CareerEventDefinition;
  round: RoundName;
  matchId: string | null;
}): ManagedMatchSchedule {
  const scheduledDate = scheduledDateForRound(args.event, args.round);
  const dateDelta = compareDates(args.career.date, scheduledDate);

  return {
    event: args.event,
    round: args.round,
    matchId: args.matchId,
    scheduledDate,
    dueToday: dateDelta === 0,
    overdue: dateDelta > 0,
    playable: dateDelta >= 0
  };
}

export function currentManagedMatchSchedule(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): ManagedMatchSchedule | null {
  if (args.tournament && !isTournamentComplete(args.tournament)) {
    const event = args.career.events.find((entry) => entry.id === args.tournament?.id) ?? activeEnteredEvent(args.career);

    if (!event || !args.career.enteredEventIds.includes(event.id)) {
      return null;
    }

    if (args.tournament.id !== event.id) {
      return null;
    }

    const context = getManagedMatchContext(args.tournament);

    return context
      ? buildSchedule({
          career: args.career,
          event,
          round: context.roundName,
          matchId: context.matchId
        })
      : null;
  }

  const dueEvent = nextDueEnteredEvent(args);

  if (dueEvent) {
    return buildSchedule({
      career: args.career,
      event: dueEvent,
      round: "R16",
      matchId: null
    });
  }

  const activeEvent = activeEnteredEvent(args.career);

  return activeEvent && args.career.date < activeEvent.startDate
    ? buildSchedule({
        career: args.career,
        event: activeEvent,
        round: "R16",
        matchId: null
      })
    : null;
}

export function managedMatchScheduleForEvent(args: {
  career: CareerState;
  tournament: TournamentState | null;
  eventId: string;
}): ManagedMatchSchedule | null {
  const event = args.career.events.find((entry) => entry.id === args.eventId) ?? null;

  if (!event || !args.career.enteredEventIds.includes(event.id) || args.career.completedEventIds.includes(event.id)) {
    return null;
  }

  if (args.tournament && !isTournamentComplete(args.tournament)) {
    if (args.tournament.id !== event.id) {
      return null;
    }

    const context = getManagedMatchContext(args.tournament);

    return context
      ? buildSchedule({
          career: args.career,
          event,
          round: context.roundName,
          matchId: context.matchId
        })
      : null;
  }

  return args.career.date >= event.startDate && args.career.date <= eventEndDate(event)
    ? buildSchedule({
        career: args.career,
        event,
        round: "R16",
        matchId: null
      })
    : null;
}

export function nextDueEnteredEvent(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): CareerEventDefinition | null {
  if (args.tournament && !isTournamentComplete(args.tournament)) {
    const tournamentEvent = args.career.events.find((event) => event.id === args.tournament?.id) ?? null;

    return tournamentEvent &&
      args.career.enteredEventIds.includes(tournamentEvent.id) &&
      !args.career.completedEventIds.includes(tournamentEvent.id)
      ? tournamentEvent
      : null;
  }

  return dueEnteredEvents(args.career)[0] ?? null;
}

export function activateDueEnteredEvent(args: {
  career: CareerState;
  tournament: TournamentState | null;
  eventId?: string;
}): CareerState {
  const event = args.eventId
    ? args.career.events.find((entry) => entry.id === args.eventId) ?? null
    : nextDueEnteredEvent(args);

  if (!event || !args.career.enteredEventIds.includes(event.id) || args.career.completedEventIds.includes(event.id)) {
    return args.career;
  }

  const note =
    args.career.activeEventId && args.career.activeEventId !== event.id
      ? `Activated ${event.name} before later entered event ${args.career.activeEventId}`
      : `${event.name} R16 match day opened`;

  return {
    ...args.career,
    activeEventId: event.id,
    stage: "pre_match",
    notes: args.career.notes[0] === note ? args.career.notes : [note, ...args.career.notes].slice(0, 6)
  };
}

export type CareerDayAdvanceRoute = "pre_match" | "live_match";

export type CareerDayAdvanceGuard =
  | {
      allowed: true;
      schedule: ManagedMatchSchedule | null;
    }
  | {
      allowed: false;
      reason: string;
      route: CareerDayAdvanceRoute;
      schedule: ManagedMatchSchedule | null;
    };

export function canAdvanceCareerDay(args: {
  career: CareerState | null;
  tournament: TournamentState | null;
  liveMatchActive: boolean;
}): CareerDayAdvanceGuard {
  if (!args.career) {
    return {
      allowed: false,
      reason: "No active career calendar is available.",
      route: "pre_match",
      schedule: null
    };
  }

  const schedule = currentManagedMatchSchedule({
    career: args.career,
    tournament: args.tournament
  });

  if (args.liveMatchActive) {
    return {
      allowed: false,
      reason: "Finish the live match before advancing the career day.",
      route: "live_match",
      schedule
    };
  }

  if (schedule?.playable) {
    return {
      allowed: false,
      reason: `Match day blocked: play ${schedule.event.name} ${schedule.round} before advancing.`,
      route: "pre_match",
      schedule
    };
  }

  return {
    allowed: true,
    schedule
  };
}
