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
  it("creates an opening round with one pending managed match", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 101);

    expect(getCurrentRound(tournament).name).toBe("R16");
    expect(getCurrentRound(tournament).matches).toHaveLength(8);
    expect(getCurrentRound(tournament).matches.filter((match) => !match.completed)).toHaveLength(1);
    expect(getManagedMatchContext(tournament)?.playerAId).toBe(managedPlayerId);
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

    const currentRound = getCurrentRound(advanced);

    if (advanced.eliminated || advanced.championId) {
      expect(advanced.rounds.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(currentRound.name).toBe("QF");
      expect(currentRound.matches).toHaveLength(4);
    }
  });
});
