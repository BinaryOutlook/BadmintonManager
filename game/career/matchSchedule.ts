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
  const event = activeEnteredEvent(args.career);

  if (!event) {
    return null;
  }

  if (args.tournament) {
    if (args.tournament.id !== event.id || isTournamentComplete(args.tournament)) {
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

  return args.career.date >= event.startDate
    ? buildSchedule({
        career: args.career,
        event,
        round: "R16",
        matchId: null
      })
    : null;
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
