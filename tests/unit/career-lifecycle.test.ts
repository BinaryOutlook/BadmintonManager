import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { addDays } from "../../game/career/calendar";
import { eventEndDate, recordPastCareerEvents } from "../../game/career/events";
import {
  finalizeSeasonReview,
  generateCareerSeasonEvents,
  seasonRolloverReadiness,
  startNextSeason
} from "../../game/career/lifecycle";
import type { CareerEventDefinition, CareerStage, CareerState } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import { simulateUniverseThroughDate } from "../../game/career/universe";

type SeasonEvent = CareerEventDefinition & {
  seasonId: string;
  templateId: string;
};

type SeasonReview = {
  id: string;
  seasonId: string;
};

type LifecycleCareerState = CareerState & {
  seasonReviews: SeasonReview[];
};

function lifecycleState(state: CareerState) {
  return state as LifecycleCareerState;
}

function readinessValue(result: ReturnType<typeof seasonRolloverReadiness>) {
  return typeof result === "boolean" ? result : result.ready;
}

function seasonEvents(seasonId: string) {
  return generateCareerSeasonEvents(seasonId) as SeasonEvent[];
}

function endOfSeasonCareer(): CareerState {
  const initial = createInitialCareerState(seededPlayers[0].player.id, 41_041);
  const events = seasonEvents("2026");
  const lastEventEnd = events.reduce(
    (latest, event) => eventEndDate(event) > latest ? eventEndDate(event) : latest,
    "2026-01-01"
  );
  const rolloverDate = addDays(lastEventEnd, 1);
  const dated: CareerState = {
    ...initial,
    seasonId: "2026",
    date: rolloverDate,
    stage: "event_complete",
    activeEventId: null,
    enteredEventIds: [],
    completedEventIds: [],
    events
  };
  const simulated = simulateUniverseThroughDate({
    career: dated,
    activeTournament: null,
    targetDate: rolloverDate
  }).career;

  return recordPastCareerEvents(simulated);
}

describe("career season lifecycle", () => {
  it("generates deterministic season-qualified editions from stable templates", () => {
    const first = seasonEvents("2027");
    const replay = seasonEvents("2027");
    const prior = seasonEvents("2026");

    expect(first).toEqual(replay);
    expect(first).toHaveLength(prior.length);

    const metro2026 = prior.find((event) => event.templateId === "metro-open-300");
    const metro2027 = first.find((event) => event.templateId === "metro-open-300");

    expect(metro2026).toMatchObject({
      id: "metro-open-300",
      seasonId: "2026",
      templateId: "metro-open-300",
      startDate: "2026-06-03"
    });
    expect(metro2027).toMatchObject({
      id: "2027:metro-open-300",
      seasonId: "2027",
      templateId: "metro-open-300",
      startDate: "2027-06-03",
      entryDeadline: "2027-06-01",
      drawDate: "2027-06-02"
    });
    expect(metro2027?.id).not.toBe(metro2026?.id);

    expect(first.every((event) => event.id === `${event.seasonId}:${event.templateId}`)).toBe(true);
    expect(new Set(first.map((event) => event.id)).size).toBe(first.length);
  });

  it("does not become rollover-ready before every event is terminal", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 41_041);
    const events = seasonEvents("2026");
    const planning: CareerState = {
      ...initial,
      seasonId: "2026",
      events
    };

    expect(readinessValue(seasonRolloverReadiness(planning))).toBe(false);

    const terminal = endOfSeasonCareer();
    const lastEvent = terminal.events.at(-1)!;
    const missingTerminalRecord: CareerState = {
      ...terminal,
      universeEvents: terminal.universeEvents.filter(
        (record) => !(record.seasonId === terminal.seasonId && record.eventId === lastEvent.id)
      )
    };

    expect(readinessValue(seasonRolloverReadiness(missingTerminalRecord))).toBe(false);
  });

  it.each<CareerStage>(["event_entered", "between_rounds", "pre_match", "post_match"])(
    "blocks rollover while the managed career stage is %s",
    (stage) => {
      const terminal = endOfSeasonCareer();
      const pending: CareerState = {
        ...terminal,
        stage,
        activeEventId: terminal.events.at(-1)!.id
      };

      expect(readinessValue(seasonRolloverReadiness(pending))).toBe(false);
      expect(readinessValue(seasonRolloverReadiness(terminal))).toBe(true);
    }
  );

  it("does not discard unresolved preparation when closing a season", () => {
    const terminal = endOfSeasonCareer();
    const pending: CareerState = {
      ...terminal,
      preparationSchedule: [
        {
          id: "season-end-preparation",
          athleteId: terminal.program.managedPlayerId,
          scheduledDate: terminal.date,
          scheduledOn: terminal.date,
          source: "manager",
          rulesVersion: 1,
          planSnapshot: {
            id: "season-end-plan",
            label: "Season-end review block",
            focus: "recovery",
            intensity: "light",
            cost: 0,
            fatigueDelta: -4,
            injuryRiskDelta: -0.02,
            recoveryDelta: 3,
            attributeDelta: { smash: 0, stamina: 0, composure: 0, recovery: 1 }
          }
        }
      ]
    };

    expect(seasonRolloverReadiness(pending)).toMatchObject({
      ready: false,
      reason: "Scheduled preparation must resolve before the season can close."
    });
    expect(finalizeSeasonReview(pending)).toBe(pending);
  });

  it("finalizes one season review and treats replay as a no-op", () => {
    const terminal = endOfSeasonCareer();
    const finalized = lifecycleState(finalizeSeasonReview(terminal));
    const replayed = lifecycleState(finalizeSeasonReview(finalized));

    expect(finalized.seasonReviews).toHaveLength(1);
    expect(finalized.seasonReviews[0]).toMatchObject({
      id: "season-review:2026",
      seasonId: "2026",
      record: {
        enteredEvents: 0,
        completedEvents: 0
      },
      economy: {
        openingCash: 0,
        closingCash: terminal.economy.cash,
        netCash: terminal.economy.cash
      }
    });
    expect(replayed).toEqual(finalized);
    expect(replayed.seasonReviews).toHaveLength(1);
  });

  it("starts the next season without rewriting durable career history or finance", () => {
    const finalized = lifecycleState(finalizeSeasonReview(endOfSeasonCareer()));
    const historyBefore = {
      eventHistory: finalized.eventHistory,
      matchHistory: finalized.matchHistory,
      playerAchievements: finalized.playerAchievements,
      universeEvents: finalized.universeEvents,
      rankingResults: finalized.rankingResults,
      seasonReviews: finalized.seasonReviews
    };
    const rankingsBefore = finalized.rankings.map((entry) => ({
      playerId: entry.playerId,
      rank: entry.rank,
      points: entry.points
    }));
    const cashBefore = finalized.economy.cash;

    const next = lifecycleState(startNextSeason(finalized));

    expect(next.seasonId).toBe("2027");
    expect(next.events).toEqual(generateCareerSeasonEvents("2027"));
    expect(next.enteredEventIds).toEqual([]);
    expect(next.completedEventIds).toEqual([]);
    expect(next.activeEventId).toBeNull();
    expect(next.stage).toBe("planning");
    expect(next.economy.cash).toBe(cashBefore);
    expect(next.rankings.map((entry) => ({
      playerId: entry.playerId,
      rank: entry.rank,
      points: entry.points
    }))).toEqual(rankingsBefore);
    expect({
      eventHistory: next.eventHistory,
      matchHistory: next.matchHistory,
      playerAchievements: next.playerAchievements,
      universeEvents: next.universeEvents,
      rankingResults: next.rankingResults,
      seasonReviews: next.seasonReviews
    }).toEqual(historyBefore);
  });

  it("does not roll an already-started season forward again", () => {
    const finalized = finalizeSeasonReview(endOfSeasonCareer());
    const next = startNextSeason(finalized);

    expect(startNextSeason(next)).toEqual(next);
  });
});
