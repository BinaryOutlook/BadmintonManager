import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../src/game/content/players";
import { createPlayerProfileViewModel } from "../../src/game/selectors/player";

describe("player profile view model", () => {
  it("generates a profile for every local player", () => {
    for (const entry of seededPlayers) {
      const profile = createPlayerProfileViewModel({
        playerId: entry.player.id,
        selectedPlayerId: seededPlayers[0].player.id,
        tournament: null
      });

      expect(profile?.player.id).toBe(entry.player.id);
      expect(profile?.overall).toBeGreaterThan(0);
      expect(profile?.tacticFits).toHaveLength(4);
      expect(profile?.radar).toHaveLength(6);
      expect(profile?.coachReport.archetype).toBeTruthy();
    }
  });

  it("keeps the managed player selectable context honest before a run starts", () => {
    const managed = seededPlayers[0].player;
    const profile = createPlayerProfileViewModel({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      tournament: null
    });

    expect(profile?.context.label).toBe("Selectable athlete");
    expect(profile?.performance.entries).toHaveLength(0);
    expect(profile?.performance.emptyState).toContain("No match evidence yet");
  });

  it("gives Three-Lung Dynamo a rally-control identity", () => {
    const player = seededPlayers.find((entry) => entry.player.name === "Three-Lung Dynamo")!.player;
    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: seededPlayers[0].player.id,
      tournament: null
    });

    expect(profile?.coachReport.archetype).toBe("Relentless Rally Controller");
    expect(profile?.coachReport.bestUse).toContain("Extend rallies");
    expect(profile?.tacticFits[0].drivers.length).toBeGreaterThan(0);
  });
});
