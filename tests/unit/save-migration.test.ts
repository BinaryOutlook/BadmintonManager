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
  it("migrates version 2 tournament saves into version 5 without schema loss", () => {
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

    expect(migrated.version).toBe(5);
    expect(migrated.selectedPlayerId).toBe(legacy.selectedPlayerId);
    expect(migrated.career).toBeNull();
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates Phase 1 career saves into defaulted Phase 3 ecosystem and rival state", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 455);
    const phase1Career = {
      ...career,
      version: 1
    };
    const { ecosystem: _ecosystem, ...careerWithoutEcosystem } = phase1Career;
    const save = {
      version: 3,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 455,
      tournament: null,
      liveMatch: null,
      career: careerWithoutEcosystem
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(5);
    expect(migrated.career?.version).toBe(3);
    expect(migrated.career?.ecosystem.recruitment.roster).toHaveLength(1);
    expect(migrated.career?.ecosystem.staff.candidates).toHaveLength(5);
    expect(migrated.career?.ecosystem.psychology[0]?.athleteId).toBe(seededPlayers[0].player.id);
    expect(migrated.career?.rivals.programs).toHaveLength(4);
    expect(migrated.career?.rivals.lastSimulatedDate).toBe(career.date);
  });

  it("migrates Phase 2 career saves into defaulted Phase 3 rival state", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 458);
    const { rivals: _rivals, ...phase2Career } = {
      ...career,
      version: 2 as const
    };
    const save = {
      version: 4,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 458,
      tournament: null,
      liveMatch: null,
      career: phase2Career
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(5);
    expect(migrated.career?.version).toBe(3);
    expect(migrated.career?.ecosystem.lowerEventEntries).toEqual([]);
    expect(migrated.career?.rivals.programs[0]?.eventEntries).toEqual([]);
    expect(migrated.career?.rivals.circuitLog.some((entry) => entry.type === "form")).toBe(true);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("persists a career payload through the version 5 schema", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 456);
    const save = {
      version: 5,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 456,
      tournament: null,
      liveMatch: null,
      career
    };

    expect(persistedSaveSchema.parse(save).career).toEqual(careerStateSchema.parse(career));
  });

  it("loads prior Phase 2 saves that predate lower-event entry records", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 457);
    const { lowerEventEntries: _lowerEventEntries, ...ecosystemWithoutEntries } = career.ecosystem;
    const { rivals: _rivals, ...phase2Career } = {
      ...career,
      version: 2 as const
    };
    const save = {
      version: 4,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 457,
      tournament: null,
      liveMatch: null,
      career: {
        ...phase2Career,
        ecosystem: ecosystemWithoutEntries
      }
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.ecosystem.lowerEventEntries).toEqual([]);
    expect(migrated.career?.rivals.programs).toHaveLength(4);
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
      version: 5,
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
