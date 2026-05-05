import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../src/game/content/players";
import { tacticLibrary } from "../../src/game/content/tactics";
import { simulateMatch } from "../../src/game/core/match";
import {
  advanceTournament,
  createManagedMatchInput,
  createTournament,
  getCurrentRound,
  getManagedMatchContext
} from "../../src/game/tournament/tournament";

describe("tournament progression", () => {
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
});
