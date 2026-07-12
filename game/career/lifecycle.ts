import { addDays } from "./calendar";
import { eventEndDate, generateCareerSeasonEvents } from "./events";
import { createInitialMediaState } from "./facilitiesMedia";
import type { CareerState, MediaSponsorState, SeasonReviewRecord } from "./models";
import { refreshAssistantAdvice } from "./tactics";

export { generateCareerSeasonEvents } from "./events";

export type SeasonRolloverReadiness = {
  ready: boolean;
  reason: string;
  endDate: string;
};

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function lastSeasonDate(state: CareerState) {
  return state.events.reduce(
    (latest, event) => compareText(eventEndDate(event), latest) > 0 ? eventEndDate(event) : latest,
    `${state.seasonId}-01-01`
  );
}

function currentSeasonUniverseIsTerminal(state: CareerState) {
  return state.events.every((event) =>
    state.universeEvents.some(
      (record) =>
        record.seasonId === state.seasonId &&
        record.eventId === event.id &&
        (record.status === "completed" || record.status === "legacy_unavailable")
    )
  );
}

export function seasonRolloverReadiness(state: CareerState): SeasonRolloverReadiness {
  const endDate = lastSeasonDate(state);

  if (state.seasonReviews.some((review) => review.seasonId === state.seasonId)) {
    return { ready: false, reason: "Season review already finalized.", endDate };
  }

  if (["event_entered", "between_rounds", "pre_match", "post_match"].includes(state.stage)) {
    return { ready: false, reason: `Career stage ${state.stage} must resolve before season review.`, endDate };
  }

  if (state.activeEventId) {
    return { ready: false, reason: "An active managed event still owns the career state.", endDate };
  }

  if (state.preparationSchedule.length > 0) {
    return { ready: false, reason: "Scheduled preparation must resolve before the season can close.", endDate };
  }

  if (state.date <= endDate) {
    return { ready: false, reason: `The ${state.seasonId} calendar runs through ${endDate}.`, endDate };
  }

  if (!currentSeasonUniverseIsTerminal(state)) {
    return { ready: false, reason: "At least one season event lacks terminal universe truth.", endDate };
  }

  return { ready: true, reason: "All current-season events are terminal and no managed action is pending.", endDate };
}

function openingCashForSeason(state: CareerState) {
  const firstSeasonEntry = state.economy.ledger.find((entry) => entry.date >= state.seasonStartedAt);
  return firstSeasonEntry
    ? firstSeasonEntry.balanceAfter - firstSeasonEntry.amount
    : state.economy.cash;
}

function buildSeasonReview(state: CareerState): SeasonReviewRecord {
  const managedPlayerId = state.program.managedPlayerId;
  const matches = state.matchHistory.filter(
    (record) =>
      (record.seasonId ?? record.date.slice(0, 4)) === state.seasonId &&
      (record.playerAId === managedPlayerId || record.playerBId === managedPlayerId)
  );
  const achievements = state.playerAchievements.filter(
    (achievement) =>
      (achievement.seasonId ?? achievement.date.slice(0, 4)) === state.seasonId &&
      achievement.playerId === managedPlayerId
  );
  const openingCash = openingCashForSeason(state);

  return {
    id: `season-review:${state.seasonId}`,
    seasonId: state.seasonId,
    createdAt: state.date,
    startDate: state.seasonStartedAt,
    endDate: lastSeasonDate(state),
    managedPlayerId,
    events: state.events.map((event) => ({
      ...event,
      location: { ...event.location },
      eligibility: { ...event.eligibility },
      prizeMoney: { ...event.prizeMoney },
      rankingPoints: { ...event.rankingPoints }
    })),
    finalRankings: state.rankings.map((ranking) => ({
      playerId: ranking.playerId,
      rank: ranking.rank,
      points: ranking.points,
      seasonPoints: ranking.seasonPoints
    })),
    record: {
      played: matches.length,
      wins: matches.filter((match) => match.winnerId === managedPlayerId).length,
      losses: matches.filter((match) => match.winnerId !== managedPlayerId).length,
      titles: achievements.filter((achievement) => achievement.result === "champion").length,
      runnerUps: achievements.filter((achievement) => achievement.result === "runner_up").length,
      enteredEvents: state.enteredEventIds.length,
      completedEvents: state.enteredEventIds.filter((eventId) => state.completedEventIds.includes(eventId)).length
    },
    economy: {
      openingCash,
      closingCash: state.economy.cash,
      netCash: state.economy.cash - openingCash
    },
    source: "resolved"
  };
}

export function finalizeSeasonReview(state: CareerState): CareerState {
  if (state.seasonReviews.some((review) => review.seasonId === state.seasonId)) {
    return state;
  }

  const readiness = seasonRolloverReadiness(state);

  if (!readiness.ready) {
    return state;
  }

  const review = buildSeasonReview(state);

  return {
    ...state,
    seasonReviews: [...state.seasonReviews, review],
    notes: [`${state.seasonId} season review is ready`, ...state.notes].slice(0, 6)
  };
}

function mediaForSeason(args: {
  previous: MediaSponsorState;
  seasonId: string;
  date: string;
  openingEventId: string;
}) {
  const base = createInitialMediaState(args.date);
  const seasonDate = (date: string) => `${args.seasonId}${date.slice(4)}`;

  return {
    ...base,
    reputation: args.previous.reputation,
    sponsors: base.sponsors.map((objective) => ({
      ...objective,
      id: `${args.seasonId}:${objective.id}`,
      deadline: seasonDate(objective.deadline),
      relatedEventIds: [args.openingEventId]
    })),
    federationObjectives: base.federationObjectives.map((objective) => ({
      ...objective,
      id: `${args.seasonId}:${objective.id}`,
      deadline: seasonDate(objective.deadline),
      relatedEventIds: [args.openingEventId]
    })),
    pressEvents: base.pressEvents.map((event) => ({
      ...event,
      id: `${args.seasonId}:${event.id}`,
      date: args.date
    })),
    reactionLog: [
      {
        id: `media-log-${args.date}-season-start`,
        date: args.date,
        source: "system" as const,
        message: `${args.seasonId} media objectives opened`,
        stateDelta: "Sponsor, federation, and press objectives regenerated from the new season calendar.",
        relatedIds: [args.openingEventId]
      },
      ...args.previous.reactionLog
    ].slice(0, 18)
  };
}

export function startNextSeason(state: CareerState): CareerState {
  const review = state.seasonReviews.find((entry) => entry.seasonId === state.seasonId);

  if (!review) {
    return state;
  }

  const currentYear = Number(state.seasonId);

  if (!Number.isInteger(currentYear)) {
    return state;
  }

  const seasonId = String(currentYear + 1);
  const seasonStartedAt = `${seasonId}-01-01`;
  const events = generateCareerSeasonEvents(seasonId);
  const openingEventId = events[0]?.id ?? `${seasonId}:opening-event`;
  const next: CareerState = {
    ...state,
    seasonId,
    seasonStartedAt,
    date: seasonStartedAt,
    stage: "planning",
    events,
    rankings: state.rankings.map((entry) => ({
      ...entry,
      seasonPoints: 0
    })),
    enteredEventIds: [],
    completedEventIds: [],
    activeEventId: null,
    preparationSchedule: [],
    selectedTrainingPlanId: null,
    lastPreMatchBrief: null,
    rivals: {
      ...state.rivals,
      programs: state.rivals.programs.map((program) => ({
        ...program,
        eventEntries: [],
        roster: program.roster.map((athlete) => ({
          ...athlete,
          age: Math.min(42, athlete.age + 1),
          fatigue: Math.max(8, athlete.fatigue * 0.35)
        }))
      })),
      fieldPressure: [],
      lastSimulatedDate: seasonStartedAt
    },
    media: mediaForSeason({
      previous: state.media,
      seasonId,
      date: seasonStartedAt,
      openingEventId
    }),
    notes: [`${seasonId} season opened with ${events.length} confirmed events`, ...state.notes].slice(0, 6)
  };

  return refreshAssistantAdvice(next);
}
