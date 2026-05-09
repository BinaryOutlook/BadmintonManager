import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { tacticLibrary } from "../../game/content/tactics";
import { advanceCareerCalendar } from "../../game/career/calendar";
import { chargeEventEntry } from "../../game/career/economy";
import { getCareerEvent } from "../../game/career/events";
import { settleCareerMatch } from "../../game/career/hubs";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import { applyTrainingPlan, trainingPlans } from "../../game/career/training";
import { simulateMatch } from "../../game/core/match";
import { createManagedMatchInput, createTournament } from "../../game/tournament/tournament";

describe("career core slice", () => {
  it("applies training with development, readiness, fatigue, injury risk, and cashflow trade-offs", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 7001);
    const athlete = managedAthlete(career);
    const plan = trainingPlans.find((entry) => entry.id === "rear-court-power")!;

    const result = applyTrainingPlan({
      athlete,
      economy: career.economy,
      plan,
      date: career.date
    });

    expect(result.athlete.development.smash).toBeGreaterThan(athlete.development.smash);
    expect(result.athlete.fatigue).toBeGreaterThan(athlete.fatigue);
    expect(result.athlete.injuryRisk).toBeGreaterThan(athlete.injuryRisk);
    expect(result.athlete.readiness).toBeLessThan(athlete.readiness);
    expect(result.economy.cash).toBe(career.economy.cash - plan.cost);
    expect(result.economy.trainingSpend).toBe(plan.cost);
  });

  it("recovers passively while advancing the calendar into a pre-match event day", () => {
    const career = {
      ...createInitialCareerState(seededPlayers[0].player.id, 7002),
      activeEventId: "metro-open-300",
      enteredEventIds: ["metro-open-300"],
      stage: "event_entered" as const
    };
    const dayTwo = advanceCareerCalendar(career);
    const eventDay = advanceCareerCalendar(dayTwo);

    expect(dayTwo.date).toBe("2026-06-02");
    expect(eventDay.date).toBe("2026-06-03");
    expect(eventDay.stage).toBe("pre_match");
    expect(managedAthlete(eventDay).fatigue).toBeLessThan(managedAthlete(career).fatigue);
  });

  it("reconciles event entry, prize money, ranking points, and post-match readiness", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 7003);
    const event = getCareerEvent(initial.events, "metro-open-300")!;
    const economy = chargeEventEntry({
      economy: initial.economy,
      date: initial.date,
      label: event.name,
      travelCost: event.travelCost,
      entryFee: event.entryFee
    });
    const career = {
      ...initial,
      date: event.startDate,
      economy,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "pre_match" as const
    };
    const tournament = {
      ...createTournament(seededPlayers, career.program.managedPlayerId, 7003),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const prepared = createManagedMatchInput({
      tournament,
      playerMap: Object.fromEntries(seededPlayers.map((entry) => [entry.player.id, entry.player])),
      tacticA: tacticLibrary.balancedControl
    })!;
    const result = simulateMatch(prepared.input);
    const managedSide = prepared.context.playerAId === career.program.managedPlayerId ? "A" : "B";
    const opponentId = managedSide === "A" ? prepared.context.playerBId : prepared.context.playerAId;
    const settled = settleCareerMatch({
      state: career,
      matchId: prepared.context.matchId,
      opponentId,
      managedSide,
      managedRunMatch: {
        round: prepared.context.roundName,
        opponentId,
        opponentName: "Opponent",
        scoreline: result.scoreline,
        won: result.winner === managedSide,
        stats: {
          winners: managedSide === "A" ? result.stats.winnersA : result.stats.winnersB,
          unforcedErrors:
            managedSide === "A" ? result.stats.unforcedErrorsA : result.stats.unforcedErrorsB,
          totalSmashes: managedSide === "A" ? result.stats.totalSmashesA : result.stats.totalSmashesB,
          peakSmashSpeed:
            managedSide === "A" ? result.stats.peakSmashSpeedA : result.stats.peakSmashSpeedB,
          longestRally: result.stats.longestRally,
          totalPoints: result.stats.totalPoints,
          staminaDrain: managedSide === "A" ? result.stats.staminaDrainA : result.stats.staminaDrainB
        }
      },
      result
    });

    expect(settled.stage).toBe("post_match");
    expect(settled.lastMatchReport?.pointsDelta).toBeGreaterThan(0);
    expect(settled.lastMatchReport?.cashDelta).toBeGreaterThan(0);
    expect(managedAthlete(settled).rankingPoints).toBeGreaterThan(managedAthlete(initial).rankingPoints);
    expect(settled.economy.prizeIncome).toBeGreaterThan(0);
    expect(settled.economy.cash).toBeGreaterThan(career.economy.cash);
    expect(managedAthlete(settled).fatigue).toBeGreaterThan(managedAthlete(career).fatigue);
  });
});
