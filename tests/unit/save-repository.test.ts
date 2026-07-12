import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_VERSION, persistedSaveSchema, type PersistedSave } from "../../game/store/save";
import {
  ACTIVE_SAVE_SLOT_KEY,
  LEGACY_SAVE_KEY,
  SAVE_REPOSITORY_PREFIX,
  SaveRepository,
  type SaveRepositoryStorage
} from "../../game/store/saveRepository";

class MemoryStorage implements SaveRepositoryStorage {
  protected readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  keys() {
    return [...this.values.keys()];
  }
}

class BackupFailureStorage extends MemoryStorage {
  override setItem(key: string, value: string) {
    if (key.startsWith(`${SAVE_REPOSITORY_PREFIX}:backup:`)) {
      throw new Error("Backup storage unavailable");
    }
    super.setItem(key, value);
  }
}

class LegacyRemovalFailureStorage extends MemoryStorage {
  blockLegacyRemoval = true;

  override removeItem(key: string) {
    if (key === LEGACY_SAVE_KEY && this.blockLegacyRemoval) {
      return;
    }
    super.removeItem(key);
  }
}

class ReadbackMismatchStorage extends MemoryStorage {
  corruptNextSlotWrite = false;

  override setItem(key: string, value: string) {
    if (this.corruptNextSlotWrite && key.startsWith(`${SAVE_REPOSITORY_PREFIX}:slot:`)) {
      this.corruptNextSlotWrite = false;
      super.setItem(key, `${value}corrupt`);
      return;
    }
    super.setItem(key, value);
  }
}

function gameSave(seed = 901): PersistedSave {
  return persistedSaveSchema.parse({
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: "player-test",
    plannedTacticKey: "balancedControl",
    seed,
    tournament: null,
    liveMatch: null,
    career: null
  });
}

function repository(
  storage: MemoryStorage,
  options: { times?: string[]; ids?: string[] } = {}
) {
  const times = [...(options.times ?? ["2026-07-13T10:00:00.000Z"])];
  const ids = [...(options.ids ?? ["slot-a", "quarantine-a"])];
  let lastTime = times[0] ?? "2026-07-13T10:00:00.000Z";
  let lastId = ids[0] ?? "generated-id";

  return new SaveRepository({
    storage,
    clock: () => {
      lastTime = times.shift() ?? lastTime;
      return lastTime;
    },
    idFactory: () => {
      lastId = ids.shift() ?? lastId;
      return lastId;
    }
  });
}

describe("multi-slot save repository", () => {
  it("creates verified versioned envelopes and discovers slots by enumerating keys", () => {
    const storage = new MemoryStorage();
    storage.setItem("unrelated-key", "leave me alone");
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z"],
      ids: ["career-one"]
    });

    const created = saves.createSlot({ name: "  Singapore Project  ", save: gameSave() });

    expect(created).toMatchObject({
      storageVersion: 1,
      slotId: "career-one",
      name: "Singapore Project",
      revision: 1,
      archivedAt: null
    });
    expect(created.save).toEqual(gameSave());
    expect(saves.getActiveSlotId()).toBe("career-one");
    expect(saves.listSlots()).toEqual([created]);
    expect(storage.getItem("unrelated-key")).toBe("leave me alone");
    expect(storage.keys().some((key) => key.includes("manifest"))).toBe(false);
  });

  it("backs up every existing revision before overwrite and retains the newest two", () => {
    const storage = new MemoryStorage();
    const saves = repository(storage, {
      times: [
        "2026-07-13T10:00:00.000Z",
        "2026-07-13T11:00:00.000Z",
        "2026-07-13T12:00:00.000Z",
        "2026-07-13T13:00:00.000Z"
      ],
      ids: ["career-one"]
    });

    saves.createSlot({ name: "Career One", save: gameSave(1) });
    saves.updateSlot("career-one", gameSave(2));
    saves.updateSlot("career-one", gameSave(3));
    const current = saves.updateSlot("career-one", gameSave(4));

    expect(current.revision).toBe(4);
    expect(current.save.seed).toBe(4);
    expect(saves.listBackups("career-one").map((backup) => [backup.revision, backup.save.seed])).toEqual([
      [3, 3],
      [2, 2]
    ]);
    expect(storage.getItem(`${SAVE_REPOSITORY_PREFIX}:backup:career-one:1`)).toBeNull();
  });

  it("duplicates a slot into an isolated identity without rewriting the source", () => {
    const storage = new MemoryStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z", "2026-07-13T11:00:00.000Z"],
      ids: ["career-one", "career-copy"]
    });
    const source = saves.createSlot({ name: "Career One", save: gameSave(21) });

    const duplicate = saves.duplicateSlot(source.slotId);
    saves.updateSlot(duplicate.slotId, gameSave(22));

    expect(duplicate).toMatchObject({
      slotId: "career-copy",
      name: "Career One Copy",
      revision: 1,
      save: { seed: 21 }
    });
    expect(saves.getActiveSlotId()).toBe("career-copy");
    expect(saves.readSlot(source.slotId)?.save.seed).toBe(21);
    expect(saves.readSlot(source.slotId)?.revision).toBe(1);
  });

  it("deletes only the selected slot and its backups after the active pointer is cleared", () => {
    const storage = new MemoryStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z", "2026-07-13T11:00:00.000Z"],
      ids: ["career-one", "career-two"]
    });
    saves.createSlot({ name: "Career One", save: gameSave(31) });
    saves.updateSlot("career-one", gameSave(32));
    saves.createSlot({ name: "Career Two", save: gameSave(41) });
    saves.setActiveSlot("career-one");

    saves.deleteSlot("career-one");

    expect(saves.getActiveSlotId()).toBeNull();
    expect(saves.readSlot("career-one")).toBeNull();
    expect(saves.listBackups("career-one")).toEqual([]);
    expect(saves.readSlot("career-two")?.save.seed).toBe(41);
  });

  it("does not touch the active slot when its pre-overwrite backup cannot be verified", () => {
    const storage = new BackupFailureStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z", "2026-07-13T11:00:00.000Z"],
      ids: ["career-one"]
    });
    const original = saves.createSlot({ name: "Career One", save: gameSave(1) });

    expect(() => saves.updateSlot("career-one", gameSave(2))).toThrow("Backup storage unavailable");
    expect(saves.readSlot("career-one")).toEqual(original);
  });

  it("restores the prior slot when an overwrite fails its readback check", () => {
    const storage = new ReadbackMismatchStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z", "2026-07-13T11:00:00.000Z"],
      ids: ["career-one"]
    });
    const original = saves.createSlot({ name: "Career One", save: gameSave(1) });
    storage.corruptNextSlotWrite = true;

    expect(() => saves.updateSlot("career-one", gameSave(2))).toThrow("Storage verification failed");
    expect(saves.readSlot("career-one")).toEqual(original);
    expect(saves.listBackups("career-one")).toEqual([original]);
  });

  it("isolates an invalid slot in a per-slot quarantine without affecting healthy saves", () => {
    const storage = new MemoryStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z", "2026-07-13T11:00:00.000Z"],
      ids: ["healthy", "quarantine-one"]
    });
    saves.createSlot({ name: "Healthy", save: gameSave(1) });
    const corruptRaw = "{not-json";
    storage.setItem(`${SAVE_REPOSITORY_PREFIX}:slot:broken`, corruptRaw);

    expect(saves.readSlot("broken")).toBeNull();
    expect(storage.getItem(`${SAVE_REPOSITORY_PREFIX}:slot:broken`)).toBeNull();
    expect(saves.readSlot("healthy")?.save.seed).toBe(1);

    const quarantines = saves.listQuarantinedSlots("broken");
    expect(quarantines).toHaveLength(1);
    expect(quarantines[0]?.key).toContain(`${SAVE_REPOSITORY_PREFIX}:quarantine:broken:`);
    expect(quarantines[0]?.record).toMatchObject({
      storageVersion: 1,
      slotId: "broken",
      originalRaw: corruptRaw
    });
  });

  it("migrates the legacy singleton only after verified slot and active-pointer writes", () => {
    const storage = new MemoryStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z"],
      ids: ["legacy-career"]
    });
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(gameSave(77)));

    const result = saves.migrateLegacySave();

    expect(result.status).toBe("migrated");
    expect(saves.getActiveSlotId()).toBe("legacy-career");
    expect(saves.getActiveSlot()?.save.seed).toBe(77);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });

  it("reuses a verified migrated slot when cleanup failed, making migration idempotent", () => {
    const storage = new LegacyRemovalFailureStorage();
    const saves = repository(storage, {
      times: ["2026-07-13T10:00:00.000Z"],
      ids: ["legacy-career", "should-not-be-used"]
    });
    const legacyRaw = JSON.stringify(gameSave(88));
    storage.setItem(LEGACY_SAVE_KEY, legacyRaw);

    expect(saves.migrateLegacySave()).toMatchObject({ status: "failed" });
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(legacyRaw);
    expect(saves.listSlots()).toHaveLength(1);
    expect(storage.getItem(ACTIVE_SAVE_SLOT_KEY)).toBe("legacy-career");

    storage.blockLegacyRemoval = false;
    const retried = saves.migrateLegacySave();

    expect(retried).toMatchObject({ status: "migrated", reusedExistingSlot: true });
    expect(saves.listSlots()).toHaveLength(1);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });

  it("preserves malformed legacy data in place for explicit recovery", () => {
    const storage = new MemoryStorage();
    const saves = repository(storage);
    storage.setItem(LEGACY_SAVE_KEY, "not-json");

    expect(saves.migrateLegacySave()).toMatchObject({ status: "invalid" });
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe("not-json");
    expect(saves.listSlots()).toEqual([]);
  });
});
