import { beforeEach, describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { CURRENT_SAVE_VERSION, persistedSaveSchema, type PersistedSave } from "../../game/store/save";
import {
  ACTIVE_SAVE_SLOT_KEY,
  LEGACY_SAVE_KEY,
  SAVE_REPOSITORY_PREFIX,
  SaveRepository,
  type SaveRepositoryStorage
} from "../../game/store/saveRepository";
import {
  CORRUPT_STORAGE_KEY,
  loadPersistedFromSaveRepository,
  useTournamentStore
} from "../../game/store/store";

class MemoryRepositoryStorage implements SaveRepositoryStorage {
  private readonly values = new Map<string, string>();

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

function gameSave(seed: number): PersistedSave {
  return persistedSaveSchema.parse({
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: seededPlayers[0].player.id,
    plannedTacticKey: "balancedControl",
    seed,
    tournament: null,
    liveMatch: null,
    career: null
  });
}

function installStorage(storage: MemoryRepositoryStorage) {
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true
  });
  useTournamentStore.setState({
    phase: "setup",
    selectedPlayerId: seededPlayers[0].player.id,
    plannedTacticKey: "balancedControl",
    seed: 9001,
    tournament: null,
    liveMatch: null,
    career: null,
    saveRecovery: null,
    activeSavePresent: false,
    corruptSavePresent: false,
    saveSlots: [],
    activeSaveSlotId: null,
    quarantinedSlotCount: 0,
    quarantinedSlotCounts: {},
    saveBackupCounts: {}
  });
}

describe("save repository store integration", () => {
  let storage: MemoryRepositoryStorage;

  beforeEach(() => {
    storage = new MemoryRepositoryStorage();
    installStorage(storage);
  });

  it("autosaves into the captured active slot with bounded backup revisions", () => {
    useTournamentStore.getState().chooseTactic("aggressiveSmash");
    const slotId = useTournamentStore.getState().activeSaveSlotId;

    useTournamentStore.getState().chooseTactic("defensiveWall");
    useTournamentStore.getState().chooseTactic("spreadCourt");

    expect(slotId).not.toBeNull();
    const repository = new SaveRepository({ storage });
    expect(repository.readSlot(slotId!)?.revision).toBe(3);
    expect(repository.readSlot(slotId!)?.save.plannedTacticKey).toBe("spreadCourt");
    expect(repository.listBackups(slotId!).map((backup) => backup.revision)).toEqual([2, 1]);
    expect(useTournamentStore.getState().saveSlots).toHaveLength(1);
  });

  it("switches between isolated slots without overwriting either career", () => {
    useTournamentStore.getState().importSaveAsSlot(gameSave(101), "Career Alpha");
    const alphaId = useTournamentStore.getState().activeSaveSlotId!;
    useTournamentStore.getState().importSaveAsSlot(gameSave(202), "Career Beta");
    const betaId = useTournamentStore.getState().activeSaveSlotId!;

    useTournamentStore.getState().switchSaveSlot(alphaId);
    expect(useTournamentStore.getState().seed).toBe(101);
    expect(useTournamentStore.getState().activeSaveSlotId).toBe(alphaId);

    useTournamentStore.getState().switchSaveSlot(betaId);
    expect(useTournamentStore.getState().seed).toBe(202);
    expect(new SaveRepository({ storage }).readSlot(alphaId)?.save.seed).toBe(101);
  });

  it("archives the active slot and safely falls back to the next live slot", () => {
    useTournamentStore.getState().importSaveAsSlot(gameSave(301), "Career Alpha");
    const alphaId = useTournamentStore.getState().activeSaveSlotId!;
    useTournamentStore.getState().importSaveAsSlot(gameSave(302), "Career Beta");
    const betaId = useTournamentStore.getState().activeSaveSlotId!;

    useTournamentStore.getState().archiveSaveSlot(betaId);
    expect(useTournamentStore.getState()).toMatchObject({
      activeSaveSlotId: alphaId,
      seed: 301,
      activeSavePresent: true
    });
    expect(useTournamentStore.getState().saveSlots.find((slot) => slot.slotId === betaId)?.archivedAt).not.toBeNull();

    useTournamentStore.getState().archiveSaveSlot(alphaId);
    expect(useTournamentStore.getState().activeSaveSlotId).toBeNull();
    expect(useTournamentStore.getState().activeSavePresent).toBe(false);
  });

  it("duplicates a slot into an isolated active copy", () => {
    useTournamentStore.getState().importSaveAsSlot(gameSave(351), "Career Alpha");
    const sourceId = useTournamentStore.getState().activeSaveSlotId!;

    useTournamentStore.getState().duplicateSaveSlot(sourceId);

    const duplicateId = useTournamentStore.getState().activeSaveSlotId!;
    const repository = new SaveRepository({ storage });
    expect(duplicateId).not.toBe(sourceId);
    expect(repository.readSlot(sourceId)?.save.seed).toBe(351);
    expect(repository.readSlot(duplicateId)).toMatchObject({
      name: "Career Alpha Copy",
      revision: 1,
      save: { seed: 351 }
    });
    expect(useTournamentStore.getState().saveSlots).toHaveLength(2);
  });

  it("hard-deletes an active slot and falls back without touching another career", () => {
    useTournamentStore.getState().importSaveAsSlot(gameSave(361), "Career Alpha");
    const alphaId = useTournamentStore.getState().activeSaveSlotId!;
    useTournamentStore.getState().importSaveAsSlot(gameSave(362), "Career Beta");
    const betaId = useTournamentStore.getState().activeSaveSlotId!;

    useTournamentStore.getState().deleteSaveSlot(betaId);

    const repository = new SaveRepository({ storage });
    expect(repository.readSlot(betaId)).toBeNull();
    expect(repository.readSlot(alphaId)?.save.seed).toBe(361);
    expect(useTournamentStore.getState()).toMatchObject({
      activeSaveSlotId: alphaId,
      seed: 361,
      activeSavePresent: true
    });

    useTournamentStore.getState().deleteActiveSave();
    expect(repository.readSlot(alphaId)).toBeNull();
    expect(useTournamentStore.getState().activeSavePresent).toBe(false);
  });

  it("imports as a new active slot while preserving the previous save", () => {
    useTournamentStore.getState().importSaveAsSlot(gameSave(401), "Original Career");
    const originalId = useTournamentStore.getState().activeSaveSlotId!;

    useTournamentStore.getState().importSaveAsSlot(gameSave(402), "Imported Career");

    const repository = new SaveRepository({ storage });
    expect(repository.listSlots()).toHaveLength(2);
    expect(repository.readSlot(originalId)?.save.seed).toBe(401);
    expect(useTournamentStore.getState().seed).toBe(402);
    expect(useTournamentStore.getState().activeSaveSlotId).not.toBe(originalId);
  });

  it("restores the latest backup into the same slot and preserves the pre-restore revision", () => {
    useTournamentStore.getState().importSaveAsSlot(gameSave(601), "Career Alpha");
    const alphaId = useTournamentStore.getState().activeSaveSlotId!;
    useTournamentStore.getState().chooseTactic("aggressiveSmash");
    useTournamentStore.getState().importSaveAsSlot(gameSave(602), "Career Beta");
    const betaId = useTournamentStore.getState().activeSaveSlotId!;

    useTournamentStore.getState().restoreLatestSaveBackup(alphaId);

    const repository = new SaveRepository({ storage });
    expect(useTournamentStore.getState()).toMatchObject({
      activeSaveSlotId: alphaId,
      seed: 601,
      plannedTacticKey: "balancedControl"
    });
    expect(repository.readSlot(alphaId)).toMatchObject({
      revision: 3,
      save: { plannedTacticKey: "balancedControl" }
    });
    expect(repository.listBackups(alphaId)[0]).toMatchObject({
      revision: 2,
      save: { plannedTacticKey: "aggressiveSmash" }
    });
    expect(repository.readSlot(betaId)?.save.seed).toBe(602);
    expect(useTournamentStore.getState().saveBackupCounts[alphaId]).toBe(2);
  });

  it("migrates the legacy singleton idempotently before loading the active slot", () => {
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(gameSave(501)));

    const loaded = loadPersistedFromSaveRepository(storage, () => 999);
    const loadedAgain = loadPersistedFromSaveRepository(storage, () => 999);

    expect(loaded.seed).toBe(501);
    expect(loaded.activeSavePresent).toBe(true);
    expect(loaded.activeSaveSlotId).not.toBeNull();
    expect(loadedAgain.activeSaveSlotId).toBe(loaded.activeSaveSlotId);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_SAVE_SLOT_KEY)).toBe(loaded.activeSaveSlotId);
    expect(storage.keys().filter((key) => key.startsWith(`${SAVE_REPOSITORY_PREFIX}:slot:`))).toHaveLength(1);
  });

  it("quarantines a malformed legacy singleton during repository-aware browser loading", () => {
    const malformed = "{not-json";
    storage.setItem(LEGACY_SAVE_KEY, malformed);

    const loaded = loadPersistedFromSaveRepository(storage, () => 777);

    expect(loaded.seed).toBe(777);
    expect(loaded.saveRecovery).toMatchObject({
      reason: "malformed_json",
      backupKey: CORRUPT_STORAGE_KEY,
      disposition: "quarantined"
    });
    expect(loaded.corruptSavePresent).toBe(true);
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe(malformed);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });
});
