import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { careerStateSchema } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import { migratePersistedSave, persistedSavePayloadSchema, persistedSaveSchema } from "../../game/store/save";
import { CORRUPT_STORAGE_KEY, STORAGE_KEY, loadPersistedFromStorage } from "../../game/store/store";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

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

  it("quarantines malformed JSON saves and exposes a recovery notice", () => {
    const raw = "{not-valid-json";
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);

    const loaded = loadPersistedFromStorage(storage, () => 9101);

    expect(loaded.seed).toBe(9101);
    expect(loaded.career).toBeNull();
    expect(loaded.saveRecovery?.reason).toBe("malformed_json");
    expect(loaded.saveRecovery?.backupKey).toBe(CORRUPT_STORAGE_KEY);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe(raw);
  });

  it("quarantines schema-invalid saves and exposes a recovery notice", () => {
    const raw = JSON.stringify({
      version: 3,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 123,
      tournament: null,
      liveMatch: null
    });
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);

    const loaded = loadPersistedFromStorage(storage, () => 9102);

    expect(loaded.seed).toBe(9102);
    expect(loaded.career).toBeNull();
    expect(loaded.saveRecovery?.reason).toBe("invalid_schema");
    expect(loaded.saveRecovery?.backupKey).toBe(CORRUPT_STORAGE_KEY);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe(raw);
  });
});
