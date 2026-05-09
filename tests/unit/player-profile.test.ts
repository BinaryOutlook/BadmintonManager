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
  });
});
