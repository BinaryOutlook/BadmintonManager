import type { CareerState } from "./models";
import { applyPassiveRecovery } from "./health";

const DAY_MS = 86_400_000;

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: string, days: number) {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function daysBetween(left: string, right: string) {
  return Math.round((parseDate(right).getTime() - parseDate(left).getTime()) / DAY_MS);
}

export function buildWeek(date: string) {
  return Array.from({ length: 7 }).map((_, index) => addDays(date, index));
}

export function advanceCareerCalendar(state: CareerState): CareerState {
  const date = addDays(state.date, 1);
  const activeEvent = state.activeEventId
    ? state.events.find((event) => event.id === state.activeEventId)
    : undefined;
  const stage =
    activeEvent && state.enteredEventIds.includes(activeEvent.id) && date >= activeEvent.startDate
      ? "pre_match"
      : state.stage;

  return {
    ...state,
    date,
    stage,
    athletes: state.athletes.map(applyPassiveRecovery),
    notes:
      stage === "pre_match" && state.stage !== "pre_match"
        ? [`${activeEvent?.name ?? "Event"} match day opened`, ...state.notes].slice(0, 6)
        : state.notes
  };
}
