import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { createInitialCareerState } from "../../game/career/state";
import { getCareerEvent } from "../../game/career/events";
import { getCareerDailyAction } from "../../game/career/dailyAction";
import { managedMatchScheduleForEvent, scheduledDateForRound } from "../../game/career/matchSchedule";
import type { MatchResult, Side } from "../../game/core/models";
import {
  advanceTournament,
  createTournament,
  getManagedMatchContext
} from "../../game/tournament/tournament";

function straightGamesResult(winner: Side): MatchResult {
  return {
    winner,
    setsWonA: winner === "A" ? 2 : 0,
    setsWonB: winner === "B" ? 2 : 0,
    setSummaries: [
      {
        winner,
        scoreA: winner === "A" ? 21 : 13,
        scoreB: winner === "B" ? 21 : 13,
        points: []
      },
      {
        winner,
        scoreA: winner === "A" ? 21 : 15,
        scoreB: winner === "B" ? 21 : 15,
        points: []
      }
    ],
    stats: {
      winnersA: winner === "A" ? 24 : 11,
      winnersB: winner === "B" ? 24 : 11,
      unforcedErrorsA: winner === "A" ? 7 : 18,
      unforcedErrorsB: winner === "B" ? 7 : 18,
      totalSmashesA: 18,
      totalSmashesB: 16,
      peakSmashSpeedA: 391,
      peakSmashSpeedB: 384,
      staminaDrainA: 9,
      staminaDrainB: 11,
      longestRally: 28,
      totalPoints: 70
    },
    scoreline: winner === "A" ? "21-13, 21-15" : "13-21, 15-21",
    fidelity: "detailed",
    summaryEvents: []
  };
}

function careerEnteredMetroEvent(seed = 9601) {
  const managedPlayerId = seededPlayers[0].player.id;
  const initial = createInitialCareerState(managedPlayerId, seed);
  const event = getCareerEvent(initial.events, "metro-open-300")!;
  const career = {
    ...initial,
    date: event.startDate,
    activeEventId: event.id,
    enteredEventIds: [event.id],
    stage: "event_entered" as const
  };
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };

  return { career, event, tournament, managedPlayerId };
}

function tournamentAfterOpeningWin(seed = 9602) {
  const setup = careerEnteredMetroEvent(seed);
  const context = getManagedMatchContext(setup.tournament);

  if (!context) {
    throw new Error("Expected an opening managed match.");
  }

  const managedSide = context.playerAId === setup.managedPlayerId ? "A" : "B";
  const tournament = advanceTournament({
    tournament: setup.tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: straightGamesResult(managedSide)
  });

  return { ...setup, tournament };
}

describe("career daily action resolver", () => {
  it("resolves a due entered event to a playable scheduled match", () => {
    const { career, event } = careerEnteredMetroEvent();
    const action = getCareerDailyAction({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });

    expect(action).toMatchObject({
      kind: "play_scheduled_match",
      tone: "required",
      label: `Play ${event.name} R16`,
      eventId: event.id,
      round: "R16",
      route: "pre_match",
      scheduledDate: event.startDate
    });
  });

  it("resolves between rounds before the next scheduled match to advance day", () => {
    const { career, event, tournament } = tournamentAfterOpeningWin();
    const betweenRounds = {
      ...career,
      stage: "between_rounds" as const
    };
    const action = getCareerDailyAction({
      career: betweenRounds,
      tournament,
      phase: "overview",
      liveMatchActive: false
    });

    expect(action).toMatchObject({
      kind: "advance_day",
      tone: "ready",
      targetDate: scheduledDateForRound(event, "QF")
    });
  });

  it("resolves post-match state to review before scheduled match checks", () => {
    const { career } = careerEnteredMetroEvent();
    const action = getCareerDailyAction({
      career: {
        ...career,
        stage: "post_match" as const
      },
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });

    expect(action).toMatchObject({
      kind: "review_match",
      tone: "required",
      label: "Review Match",
      route: "review"
    });
  });

  it("resolves an active live match to resume before all career-day checks", () => {
    const { career } = careerEnteredMetroEvent();
    const action = getCareerDailyAction({
      career,
      tournament: null,
      phase: "match",
      liveMatchActive: true
    });

    expect(action).toMatchObject({
      kind: "resume_live_match",
      tone: "required",
      label: "Resume Match",
      route: "live_match"
    });
  });

  it("chooses the earliest due entered event when a later entry is active", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const initial = createInitialCareerState(managedPlayerId, 9603);
    const metro = getCareerEvent(initial.events, "metro-open-300")!;
    const harbor = getCareerEvent(initial.events, "harbor-masters-500")!;
    const career = {
      ...initial,
      date: metro.startDate,
      activeEventId: harbor.id,
      enteredEventIds: [metro.id, harbor.id],
      stage: "event_entered" as const
    };
    const action = getCareerDailyAction({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });

    expect(action).toMatchObject({
      kind: "play_scheduled_match",
      eventId: metro.id,
      label: `Play ${metro.name} R16`
    });
  });

  it("resolves an event by id even when activeEventId points elsewhere", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const initial = createInitialCareerState(managedPlayerId, 9604);
    const metro = getCareerEvent(initial.events, "metro-open-300")!;
    const harbor = getCareerEvent(initial.events, "harbor-masters-500")!;
    const career = {
      ...initial,
      date: metro.startDate,
      activeEventId: harbor.id,
      enteredEventIds: [metro.id, harbor.id],
      stage: "event_entered" as const
    };

    expect(managedMatchScheduleForEvent({ career, tournament: null, eventId: metro.id })).toMatchObject({
      event: metro,
      playable: true,
      round: "R16"
    });
  });

  it("does not keep an expired entered event playable after its window closes", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const initial = createInitialCareerState(managedPlayerId, 9605);
    const metro = getCareerEvent(initial.events, "metro-open-300")!;
    const career = {
      ...initial,
      date: "2026-06-09",
      activeEventId: metro.id,
      enteredEventIds: [metro.id],
      stage: "event_entered" as const
    };

    expect(managedMatchScheduleForEvent({ career, tournament: null, eventId: metro.id })).toBeNull();
    expect(getCareerDailyAction({ career, tournament: null, phase: "overview", liveMatchActive: false })).toMatchObject({
      kind: "advance_day"
    });
  });
});
