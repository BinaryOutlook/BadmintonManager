import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { tacticLibrary } from "../../game/content/tactics";
import { simulateMatch } from "../../game/core/match";
import type { MatchResult, Side } from "../../game/core/models";
import {
  advanceTournament,
  createManagedMatchInput,
  createTournament,
  getCurrentRound,
  getManagedMatchContext,
  getNextManagedOpponentId,
  isManagedPlayerStillInEvent,
  isTournamentComplete,
  managedPlayerStillAlive,
  type TournamentState
} from "../../game/tournament/tournament";

describe("tournament progression", () => {
  function straightGamesResult(winner: Side): MatchResult {
    return {
      winner,
      setsWonA: winner === "A" ? 2 : 0,
      setsWonB: winner === "B" ? 2 : 0,
      setSummaries: [
        {
          winner,
          scoreA: winner === "A" ? 21 : 12,
          scoreB: winner === "B" ? 21 : 12,
          points: []
        },
        {
          winner,
          scoreA: winner === "A" ? 21 : 16,
          scoreB: winner === "B" ? 21 : 16,
          points: []
        }
      ],
      stats: {
        winnersA: winner === "A" ? 23 : 10,
        winnersB: winner === "B" ? 23 : 10,
        unforcedErrorsA: winner === "A" ? 7 : 19,
        unforcedErrorsB: winner === "B" ? 7 : 19,
        totalSmashesA: 18,
        totalSmashesB: 14,
        peakSmashSpeedA: 390,
        peakSmashSpeedB: 379,
        staminaDrainA: 8,
        staminaDrainB: 11,
        longestRally: 25,
        totalPoints: 70
      },
      scoreline: winner === "A" ? "21-12, 21-16" : "12-21, 16-21",
      fidelity: "detailed",
      summaryEvents: [
        {
          kind: "straight_games",
          side: winner,
          title: "Forced deterministic result",
          detail: "Tournament helper proof supplies the result instead of relying on match luck."
        }
      ]
    };
  }

  function managedWinner(tournament: TournamentState, managedPlayerId: string): Side {
    const context = getManagedMatchContext(tournament);

    if (!context) {
      throw new Error("Expected a managed match context.");
    }

    return context.playerAId === managedPlayerId ? "A" : "B";
  }

  function forceManagedResult(tournament: TournamentState, managedPlayerId: string, won: boolean) {
    const context = getManagedMatchContext(tournament);

    if (!context) {
      throw new Error("Expected a managed match context.");
    }

    const managedSide = managedWinner(tournament, managedPlayerId);
    const winner = won ? managedSide : managedSide === "A" ? "B" : "A";

    return advanceTournament({
      tournament,
      seededEntries: seededPlayers,
      managedMatchId: context.matchId,
      managedResult: straightGamesResult(winner)
    });
  }

  it("draws a deterministic 16-player tournament field from the expanded pool", () => {
    const managedPlayerId = seededPlayers[20].player.id;
    const first = createTournament(seededPlayers, managedPlayerId, 303);
    const second = createTournament(seededPlayers, managedPlayerId, 303);
    const alternate = createTournament(seededPlayers, managedPlayerId, 304);
    const entrantIds = first.rounds[0].matches.flatMap((match) => [match.sideAId, match.sideBId]);
    const repeatedIds = second.rounds[0].matches.flatMap((match) => [match.sideAId, match.sideBId]);
    const alternateIds = alternate.rounds[0].matches.flatMap((match) => [match.sideAId, match.sideBId]);

    expect(entrantIds).toHaveLength(16);
    expect(new Set(entrantIds)).toHaveLength(16);
    expect(entrantIds).toContain(managedPlayerId);
    expect(entrantIds).toEqual(repeatedIds);
    expect(entrantIds).not.toEqual(alternateIds);
    expect(first.name).toBe("Harborline Open");
    expect(first.tier).toBe("Circuit 750");
  });

  it("creates an opening round with one pending managed match", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 101);

    expect(getCurrentRound(tournament).name).toBe("R16");
    expect(getCurrentRound(tournament).matches).toHaveLength(8);
    expect(getCurrentRound(tournament).matches.filter((match) => !match.completed)).toHaveLength(1);
    expect(getManagedMatchContext(tournament)?.playerAId).toBe(managedPlayerId);
    expect(
      getCurrentRound(tournament)
        .matches.filter((match) => !match.managed)
        .every((match) => match.completed && match.simulationFidelity === "quick")
    ).toBe(true);
    expect(
      getCurrentRound(tournament)
        .matches.filter((match) => match.managed)
        .every((match) => !match.completed && match.simulationFidelity === "detailed")
    ).toBe(true);
  });

  it("advances to the next round after a completed managed match", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 202);
    const managed = createManagedMatchInput({
      tournament,
      playerMap: Object.fromEntries(seededPlayers.map((entry) => [entry.player.id, entry.player])),
      tacticA: tacticLibrary.balancedControl
    });

    expect(managed).toBeDefined();

    const managedResult = simulateMatch(managed!.input);
    const advanced = advanceTournament({
      tournament,
      seededEntries: seededPlayers,
      managedMatchId: managed!.context.matchId,
      managedResult
    });

    expect(advanced.managedResults).toHaveLength(1);
    expect(advanced.managedResults[0]?.round).toBe(managed!.context.roundName);
    expect(
      advanced.rounds[0].matches.find((match) => match.id === managed!.context.matchId)
        ?.simulationFidelity
    ).toBe("detailed");

    const currentRound = getCurrentRound(advanced);

    if (advanced.eliminated || advanced.championId) {
      expect(advanced.rounds.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(currentRound.name).toBe("QF");
      expect(currentRound.matches).toHaveLength(4);
      expect(
        currentRound.matches
          .filter((match) => !match.managed)
          .every((match) => match.completed && match.simulationFidelity === "quick")
      ).toBe(true);
      expect(
        currentRound.matches
          .filter((match) => match.managed)
          .every((match) => !match.completed && match.simulationFidelity === "detailed")
      ).toBe(true);
    }
  });

  it("classifies completion, still-in-event, and next-opponent boundaries", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const openingTournament = createTournament(seededPlayers, managedPlayerId, 404);
    const openingOpponentId = getNextManagedOpponentId(openingTournament);

    expect(isTournamentComplete(openingTournament)).toBe(false);
    expect(managedPlayerStillAlive(openingTournament)).toBe(true);
    expect(isManagedPlayerStillInEvent(openingTournament)).toBe(true);
    expect(openingOpponentId).toBeTruthy();

    const afterOpeningWin = forceManagedResult(openingTournament, managedPlayerId, true);

    expect(isTournamentComplete(afterOpeningWin)).toBe(false);
    expect(managedPlayerStillAlive(afterOpeningWin)).toBe(true);
    expect(isManagedPlayerStillInEvent(afterOpeningWin)).toBe(true);
    expect(getNextManagedOpponentId(afterOpeningWin)).toBeTruthy();
    expect(getNextManagedOpponentId(afterOpeningWin)).not.toBe(openingOpponentId);

    const afterOpeningLoss = forceManagedResult(openingTournament, managedPlayerId, false);

    expect(isTournamentComplete(afterOpeningLoss)).toBe(true);
    expect(managedPlayerStillAlive(afterOpeningLoss)).toBe(false);
    expect(isManagedPlayerStillInEvent(afterOpeningLoss)).toBe(false);
    expect(getNextManagedOpponentId(afterOpeningLoss)).toBeNull();

    let titleRun = afterOpeningWin;
    while (getManagedMatchContext(titleRun)?.roundName !== "F") {
      titleRun = forceManagedResult(titleRun, managedPlayerId, true);
    }

    const afterTitle = forceManagedResult(titleRun, managedPlayerId, true);

    expect(afterTitle.championId).toBe(managedPlayerId);
    expect(isTournamentComplete(afterTitle)).toBe(true);
    expect(managedPlayerStillAlive(afterTitle)).toBe(true);
    expect(isManagedPlayerStillInEvent(afterTitle)).toBe(false);
    expect(getNextManagedOpponentId(afterTitle)).toBeNull();
  });
});
