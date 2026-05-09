import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { careerStateSchema } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import { migratePersistedSave, persistedSavePayloadSchema, persistedSaveSchema } from "../../game/store/save";

describe("career save migration", () => {
  it("migrates version 2 tournament saves into version 3 without schema loss", () => {
    const legacy = {
      version: 2,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 123,
      tournament: null,
      liveMatch: null
    };
    const parsed = persistedSavePayloadSchema.parse(legacy);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(3);
    expect(migrated.selectedPlayerId).toBe(legacy.selectedPlayerId);
    expect(migrated.career).toBeNull();
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("persists a career payload through the version 3 schema", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 456);
    const save = {
      version: 3,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 456,
      tournament: null,
      liveMatch: null,
      career
    };

    expect(persistedSaveSchema.parse(save).career).toEqual(careerStateSchema.parse(career));
  });
});
