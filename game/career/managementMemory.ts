import { addDays, daysBetween } from "./calendar";
import { eventEligibilityFor } from "./events";
import type { CareerState, TournamentAddress } from "./models";
import { programTasksForCareer } from "./program";
import { careerWorldPlayerMap } from "./world";

export type ManagementDestination =
  | { kind: "review" }
  | { kind: "reports" }
  | { kind: "live_match" }
  | { kind: "training" }
  | { kind: "program" }
  | { kind: "scouting" }
  | { kind: "promises" }
  | { kind: "facilities" }
  | { kind: "player_profile"; playerId: string }
  | ({ kind: "tournament" } & TournamentAddress);

export type CareerInboxItem = {
  id: string;
  category: "match" | "event" | "season" | "program" | "medical" | "scouting" | "promise" | "facility" | "finance";
  priority: "required" | "urgent" | "scheduled" | "information";
  date: string;
  title: string;
  detail: string;
  actionLabel: string;
  destination: ManagementDestination;
};

export type CareerArchiveReport = {
  id: string;
  category: "match" | "event" | "scouting" | "development";
  date: string;
  title: string;
  detail: string;
  evidence: string[];
  destination: ManagementDestination;
};

export function latestDetailedMatchMemory(state: CareerState) {
  const report = state.lastMatchReport;

  if (!report) {
    return null;
  }

  const record = state.matchHistory.find(
    (entry) =>
      entry.id === `${report.eventId}:${report.matchId}` ||
      (entry.eventId === report.eventId && entry.id.endsWith(`:${report.matchId}`))
  ) ?? null;

  return { report, record };
}

const priorityOrder: Record<CareerInboxItem["priority"], number> = {
  required: 0,
  urgent: 1,
  scheduled: 2,
  information: 3
};

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rosterName(state: CareerState, athleteId: string) {
  return careerWorldPlayerMap(state)[athleteId]?.name ??
    state.ecosystem.recruitment.roster.find((slot) => slot.athleteId === athleteId)?.name ??
    athleteId;
}

function subjectName(state: CareerState, subjectId: string) {
  return rosterName(state, subjectId) !== subjectId
    ? rosterName(state, subjectId)
    : state.ecosystem.recruitment.candidates.find((candidate) => candidate.id === subjectId)?.name ??
        state.ecosystem.academy.prospects.find((prospect) => prospect.id === subjectId)?.name ??
        subjectId;
}

export function careerInboxItems(state: CareerState): CareerInboxItem[] {
  const items: CareerInboxItem[] = [];

  const currentSeasonReview = state.seasonReviews.find(
    (review) => review.seasonId === state.seasonId
  );

  if (currentSeasonReview) {
    items.push({
      id: `inbox:season-review:${currentSeasonReview.seasonId}`,
      category: "season",
      priority: "required",
      date: currentSeasonReview.createdAt,
      title: `${currentSeasonReview.seasonId} season review ready`,
      detail: `${currentSeasonReview.record.wins}-${currentSeasonReview.record.losses} record · ${currentSeasonReview.record.titles} title(s) · ${currentSeasonReview.economy.netCash >= 0 ? "+" : ""}${currentSeasonReview.economy.netCash} net cash.`,
      actionLabel: "Review Season",
      destination: { kind: "reports" }
    });
  }

  if (state.stage === "post_match" && state.lastMatchReport) {
    items.push({
      id: `inbox:match-review:${state.lastMatchReport.matchId}`,
      category: "match",
      priority: "required",
      date: state.date,
      title: "Post-match review required",
      detail: `${state.lastMatchReport.scoreline} · settle evidence and choose the next career action.`,
      actionLabel: "Review Match",
      destination: { kind: "review" }
    });
  } else if (state.stage === "pre_match" && state.activeEventId) {
    items.push({
      id: `inbox:pre-match:${state.seasonId}:${state.activeEventId}:${state.date}`,
      category: "match",
      priority: "required",
      date: state.date,
      title: "Managed match window is open",
      detail: "The current opponent brief and medical gate are ready for a manager decision.",
      actionLabel: "Open Match Desk",
      destination: { kind: "live_match" }
    });
  }

  const nextEvent = [...state.events]
    .filter(
      (event) =>
        !state.enteredEventIds.includes(event.id) &&
        event.entryDeadline >= state.date
    )
    .sort(
      (left, right) =>
        compareText(left.entryDeadline, right.entryDeadline) ||
        compareText(left.id, right.id)
    )[0];

  if (nextEvent) {
    const gate = eventEligibilityFor(state, nextEvent);

    if (gate.daysUntilEntryDeadline >= 0 && gate.daysUntilEntryDeadline <= 3) {
      items.push({
        id: `inbox:event-entry:${state.seasonId}:${nextEvent.id}`,
        category: "event",
        priority: gate.daysUntilEntryDeadline <= 1 ? "urgent" : "scheduled",
        date: nextEvent.entryDeadline,
        title: `${nextEvent.name} entry decision`,
        detail: gate.allowed
          ? `Entry closes in ${gate.daysUntilEntryDeadline} day(s); the current eligibility and budget gates pass.`
          : `Entry closes in ${gate.daysUntilEntryDeadline} day(s); ${gate.reason}`,
        actionLabel: "Open Event",
        destination: { kind: "tournament", seasonId: state.seasonId, eventId: nextEvent.id }
      });
    }
  }

  for (const task of programTasksForCareer(state)) {
    items.push({
      id: task.id,
      category: task.athleteId ? "program" : "finance",
      priority: task.urgent ? "urgent" : "scheduled",
      date: task.athleteId ? state.date : addDays(state.date, 1),
      title: task.label,
      detail: task.detail,
      actionLabel: task.athleteId ? "Open Program" : "Review Payroll",
      destination: { kind: "program" }
    });
  }

  for (const athlete of state.athletes) {
    if (athlete.injury.status === "healthy" && athlete.fatigue < 65 && athlete.injuryRisk < 0.26) {
      continue;
    }

    items.push({
      id: `inbox:medical:${athlete.playerId}:${athlete.injury.triggeredAt ?? state.date}`,
      category: "medical",
      priority: athlete.injury.status === "out" || athlete.recoveryStatus === "red_zone" ? "urgent" : "scheduled",
      date: state.date,
      title: `${rosterName(state, athlete.playerId)} load review`,
      detail: `${athlete.injury.label} · ${Math.round(athlete.fatigue)} fatigue · ${Math.round(athlete.injuryRisk * 100)}% injury risk.`,
      actionLabel: "Open Training",
      destination: { kind: "training" }
    });
  }

  for (const assignment of state.ecosystem.scouting.assignments) {
    if (assignment.status !== "pending") {
      continue;
    }

    const daysUntilDue = daysBetween(state.date, assignment.dueAt);

    if (daysUntilDue <= 3) {
      items.push({
        id: `inbox:scouting:${assignment.id}`,
        category: "scouting",
        priority: daysUntilDue <= 0 ? "urgent" : "scheduled",
        date: assignment.dueAt,
        title: "Scouting report in progress",
        detail: `${assignment.scope} report for ${subjectName(state, assignment.subjectId)} is due ${assignment.dueAt}.`,
        actionLabel: "Open Scouting",
        destination: { kind: "scouting" }
      });
    }
  }

  for (const promise of state.ecosystem.promises) {
    if (promise.status !== "active") {
      continue;
    }

    const daysUntilDue = daysBetween(state.date, promise.deadline);

    if (daysUntilDue <= 7) {
      items.push({
        id: `inbox:promise:${promise.id}`,
        category: "promise",
        priority: daysUntilDue <= 2 ? "urgent" : "scheduled",
        date: promise.deadline,
        title: `${rosterName(state, promise.athleteId)} promise deadline`,
        detail: `${promise.targetType.replace(/_/g, " ")} · ${Math.max(0, daysUntilDue)} day(s) remaining.`,
        actionLabel: "Open Promises",
        destination: { kind: "promises" }
      });
    }
  }

  for (const facility of state.facilities) {
    if (facility.status !== "building" || !facility.buildCompleteDate) {
      continue;
    }

    const daysUntilDue = daysBetween(state.date, facility.buildCompleteDate);

    if (daysUntilDue <= 3) {
      items.push({
        id: `inbox:facility:${facility.id}:${facility.buildCompleteDate}`,
        category: "facility",
        priority: "information",
        date: facility.buildCompleteDate,
        title: `${facility.label} construction`,
        detail: `Active level ${Math.max(0, facility.level - 1)}; level ${facility.level} modifiers activate ${facility.buildCompleteDate}.`,
        actionLabel: "Open Facilities",
        destination: { kind: "facilities" }
      });
    }
  }

  return items.sort(
    (left, right) =>
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      compareText(left.date, right.date) ||
      compareText(left.id, right.id)
  );
}

export function careerArchiveReports(state: CareerState): CareerArchiveReport[] {
  const reports: CareerArchiveReport[] = [];

  for (const match of state.matchHistory.filter(
    (entry) =>
      entry.playerAId === state.program.managedPlayerId ||
      entry.playerBId === state.program.managedPlayerId
  )) {
    const opponentId = match.playerAId === state.program.managedPlayerId ? match.playerBId : match.playerAId;
    const managedWon = match.winnerId === state.program.managedPlayerId;

    reports.push({
      id: `report:match:${match.id}`,
      category: "match",
      date: match.date,
      title: `${managedWon ? "Win" : "Loss"} vs ${rosterName(state, opponentId)}`,
      detail: `${match.eventName} · ${match.round} · ${match.scoreline}`,
      evidence: [`Source: ${match.source}`, `Winner: ${rosterName(state, match.winnerId)}`],
      destination: {
        kind: "tournament",
        seasonId: match.seasonId ?? state.seasonId,
        eventId: match.eventId
      }
    });
  }

  for (const event of state.eventHistory) {
    reports.push({
      id: `report:event:${event.eventId}:${event.completedAt}`,
      category: "event",
      date: event.completedAt,
      title: `${event.eventName} · ${event.status.replace(/_/g, " ")}`,
      detail: `${event.resultRound ?? "No played round"} · ${event.pointsAwarded} points · net ${event.netCash >= 0 ? "+" : ""}${event.netCash}.`,
      evidence: [
        `${event.matchIds.length} recorded match(es)`,
        event.scorelines.length > 0 ? event.scorelines.join(" · ") : "No scoreline evidence recorded"
      ],
      destination: { kind: "tournament", seasonId: state.seasonId, eventId: event.eventId }
    });
  }

  for (const report of state.ecosystem.scouting.reports) {
    reports.push({
      id: `report:scouting:${report.id}`,
      category: "scouting",
      date: report.createdAt,
      title: `Scouting · ${subjectName(state, report.subjectId)}`,
      detail: `${report.confidence}% confidence · ${report.accuracy}% accuracy · ${report.state}.`,
      evidence: [report.recommendation, `Expires ${report.expiresAt}`],
      destination: { kind: "scouting" }
    });
  }

  for (const record of state.developmentHistory) {
    reports.push({
      id: `report:development:${record.id}`,
      category: "development",
      date: record.date,
      title: `${rosterName(state, record.athleteId)} · ${record.kind === "preparation" ? record.planLabel : "Development baseline"}`,
      detail: record.kind === "preparation" ? record.reason : record.note,
      evidence: record.kind === "preparation"
        ? [`${record.outcome} · cost ${record.cost}`, ...record.modifierSourceIds]
        : [`Source: ${record.source}`],
      destination: { kind: "player_profile", playerId: record.athleteId }
    });
  }

  return reports.sort(
    (left, right) => compareText(right.date, left.date) || compareText(left.id, right.id)
  );
}
