import type { CareerState } from "./models";
import { applyPassiveRecovery } from "./health";
import { currentManagedMatchSchedule } from "./matchSchedule";
import type { TournamentState } from "../tournament/tournament";

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

export function advanceCareerCalendar(
  state: CareerState,
  options: {
    tournament?: TournamentState | null;
  } = {}
): CareerState {
  const date = addDays(state.date, 1);
  const datedState = { ...state, date };
  const schedule = currentManagedMatchSchedule({
    career: datedState,
    tournament: options.tournament ?? null
  });
  const stage =
    state.stage !== "post_match" && schedule?.playable
      ? "pre_match"
      : state.stage === "between_rounds" && schedule
        ? "between_rounds"
        : state.stage;

  return {
    ...state,
    date,
    stage,
    athletes: state.athletes.map(applyPassiveRecovery),
    notes:
      stage === "pre_match" && state.stage !== "pre_match"
        ? [`${schedule?.event.name ?? "Event"} ${schedule?.round ?? "match"} day opened`, ...state.notes].slice(0, 6)
        : state.notes
  };
}
