import { addDays } from "./calendar";
import type { CareerState } from "./models";
import { currentManagedMatchSchedule } from "./matchSchedule";
import type { RoundName, TournamentState } from "../tournament/tournament";

export type CareerActionPhase = "setup" | "overview" | "match" | "complete";
export type CareerDailyActionTone = "ready" | "required" | "disabled";

export type CareerDailyAction =
  | {
      kind: "advance_day";
      tone: "ready";
      label: "Advance Day";
      reason: string;
      targetDate: string;
    }
  | {
      kind: "play_scheduled_match";
      tone: "required";
      label: string;
      reason: string;
      eventId: string;
      round: RoundName;
      route: "pre_match";
      scheduledDate: string;
    }
  | {
      kind: "resume_live_match";
      tone: "required";
      label: "Resume Match";
      reason: string;
      route: "live_match";
    }
  | {
      kind: "review_match";
      tone: "required";
      label: "Review Match";
      reason: string;
      route: "review";
    }
  | {
      kind: "unavailable";
      tone: "disabled";
      label: "Career Unavailable";
      reason: string;
    };

export function getCareerDailyAction(args: {
  career: CareerState | null;
  tournament: TournamentState | null;
  phase: CareerActionPhase;
  liveMatchActive: boolean;
}): CareerDailyAction {
  if (args.phase === "match" || args.liveMatchActive) {
    return {
      kind: "resume_live_match",
      tone: "required",
      label: "Resume Match",
      reason: "A managed match is already in progress.",
      route: "live_match"
    };
  }

  if (!args.career) {
    return {
      kind: "unavailable",
      tone: "disabled",
      label: "Career Unavailable",
      reason: "No active career calendar is available."
    };
  }

  if (args.career.stage === "post_match") {
    return {
      kind: "review_match",
      tone: "required",
      label: "Review Match",
      reason: "The latest managed match needs post-match review.",
      route: "review"
    };
  }

  const schedule = currentManagedMatchSchedule({
    career: args.career,
    tournament: args.tournament
  });

  if (schedule?.playable) {
    return {
      kind: "play_scheduled_match",
      tone: "required",
      label: `Play ${schedule.event.name} ${schedule.round}`,
      reason: `${schedule.event.name} ${schedule.round} is scheduled for today.`,
      eventId: schedule.event.id,
      round: schedule.round,
      route: "pre_match",
      scheduledDate: schedule.scheduledDate
    };
  }

  return {
    kind: "advance_day",
    tone: "ready",
    label: "Advance Day",
    reason: "No required match action remains on the current career day.",
    targetDate: addDays(args.career.date, 1)
  };
}
