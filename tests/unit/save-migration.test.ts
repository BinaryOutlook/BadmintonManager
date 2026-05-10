import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { careerStateSchema } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import {
  migratePersistedSave,
  persistedSavePayloadSchema,
  persistedSaveSchema,
  validateImportedSaveText
} from "../../game/store/save";
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
  it("migrates version 2 tournament saves into version 8 without schema loss", () => {
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

    expect(migrated.version).toBe(8);
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

    expect(migrated.version).toBe(8);
    expect(migrated.career?.version).toBe(6);
    expect(migrated.career?.ecosystem.recruitment.roster).toHaveLength(1);
    expect(migrated.career?.ecosystem.staff.candidates).toHaveLength(5);
    expect(migrated.career?.ecosystem.psychology[0]?.athleteId).toBe(seededPlayers[0].player.id);
    expect(migrated.career?.rivals.programs).toHaveLength(4);
    expect(migrated.career?.rivals.lastSimulatedDate).toBe("");
    expect(migrated.career?.matchPlanning.plans).toHaveLength(1);
    expect(migrated.career?.facilities).toHaveLength(5);
    expect(migrated.career?.media.sponsors[0]?.status).toBe("active");
    expect(migrated.career?.matchPlanning.advice.map((entry) => entry.topic)).toEqual([
      "tactics",
      "training",
      "rotation",
      "scouting"
    ]);
  });

  it("migrates Phase 2 career saves into defaulted Phase 3 tactic and rival state", () => {
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

    expect(migrated.version).toBe(8);
    expect(migrated.career?.version).toBe(6);
    expect(migrated.career?.ecosystem.lowerEventEntries).toEqual([]);
    expect(migrated.career?.rivals.programs[0]?.eventEntries).toEqual([]);
    expect(migrated.career?.rivals.circuitLog.some((entry) => entry.type === "form")).toBe(true);
    expect(migrated.career?.matchPlanning.activePlanId).toBe("plan-command-balance");
    expect(migrated.career?.facilities.map((entry) => entry.type)).toEqual([
      "training_hall",
      "recovery_center",
      "analytics_lab",
      "youth_academy",
      "travel_quality"
    ]);
    expect(migrated.career?.media.federationObjectives[0]?.sponsorName).toBe("National Federation");
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates rival-only Phase 3 saves into defaulted tactic advice and infrastructure state", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 459);
    const { matchPlanning: _matchPlanning, ...phase3Career } = {
      ...career,
      version: 3 as const
    };
    const save = {
      version: 5,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 459,
      tournament: null,
      liveMatch: null,
      career: phase3Career
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(8);
    expect(migrated.career?.version).toBe(6);
    expect(migrated.career?.rivals.programs).toHaveLength(4);
    expect(migrated.career?.matchPlanning.advice).toHaveLength(4);
    expect(migrated.career?.facilities).toHaveLength(5);
    expect(migrated.career?.media.reactionLog[0]?.message).toContain("Media and sponsor");
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates tactics-only Phase 3 saves into facilities and media defaults", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 460);
    const { facilities: _facilities, media: _media, ...phase3TacticsCareer } = {
      ...career,
      version: 4 as const
    };
    const save = {
      version: 6,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 460,
      tournament: null,
      liveMatch: null,
      career: phase3TacticsCareer
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(8);
    expect(migrated.career?.version).toBe(6);
    expect(migrated.career?.matchPlanning.activePlanId).toBe("plan-command-balance");
    expect(migrated.career?.facilities.find((entry) => entry.type === "analytics_lab")?.nextUpgradeCost).toBe(19500);
    expect(migrated.career?.media.sponsors[0]?.sponsorName).toBe("Aero String Labs");
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates facilities/media Phase 3 saves into tactical viewer defaults", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 461);
    const phase3FacilitiesCareer = {
      ...career,
      version: 5 as const,
      lastMatchReport: {
        eventId: "metro-open-300",
        matchId: "managed-r16",
        opponentId: "opponent",
        result: "win" as const,
        scoreline: "21-17 21-19",
        round: "R16",
        pointsDelta: 210,
        cashDelta: 1500,
        fatigueDelta: 8,
        evidence: [],
        recommendations: []
      }
    };
    const save = {
      version: 7,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 461,
      tournament: null,
      liveMatch: null,
      career: phase3FacilitiesCareer
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(8);
    expect(migrated.career?.version).toBe(6);
    expect(migrated.career?.lastMatchReport?.tacticalViewer).toBeNull();
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("persists a career payload through the version 8 schema", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 456);
    const save = {
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 456,
      tournament: null,
      liveMatch: null,
      career
    };

    expect(persistedSaveSchema.parse(save).career).toEqual(careerStateSchema.parse(career));
  });

  it("defaults medical injury episodes when loading current saves from before the health pass", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 462);
    const save = {
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 462,
      tournament: null,
      liveMatch: null,
      career: {
        ...career,
        athletes: career.athletes.map(({ injury: _injury, ...athlete }) => athlete)
      }
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.athletes[0]?.injury).toMatchObject({
      status: "healthy",
      label: "Available",
      daysRemaining: 0
    });
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
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
      version: 7,
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

  it("previews a current exported save without mutating storage", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 464);
    const save = {
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 464,
      tournament: null,
      liveMatch: null,
      career
    };
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(save));
    storage.setItem(CORRUPT_STORAGE_KEY, "previous-corrupt-backup");

    const preview = validateImportedSaveText(JSON.stringify(save));

    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.save.version).toBe(8);
      expect(preview.save.career?.version).toBe(6);
    }
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(save));
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe("previous-corrupt-backup");
  });

  it("normalizes legacy public tier labels during current-save import", () => {
    const legacyPrefix = "Super";
    const career = createInitialCareerState(seededPlayers[0].player.id, 465);
    const save = {
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 465,
      tournament: {
        id: "legacy-event",
        name: "Legacy Event",
        tier: `${legacyPrefix} 750`,
        prizePoolUsd: 850_000,
        managedPlayerId: seededPlayers[0].player.id,
        rounds: [],
        currentRoundIndex: 0,
        rngState: 12345,
        eliminated: false,
        managedResults: []
      },
      liveMatch: null,
      career: {
        ...career,
        events: career.events.map((event) =>
          event.id === "metro-open-300"
            ? { ...event, tier: `${legacyPrefix} 300` }
            : event
        ),
        rankings: career.rankings.map((entry) => ({
          ...entry,
          eventHistory: [
            {
              eventId: "metro-open-300",
              round: "QF",
              points: 210,
              date: "2026-06-03",
              seasonId: career.seasonId,
              tier: `${legacyPrefix} 300`
            }
          ]
        }))
      }
    };

    const preview = validateImportedSaveText(JSON.stringify(save));

    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.save.tournament?.tier).toBe("Circuit 750");
      expect(preview.save.career?.events.find((event) => event.id === "metro-open-300")?.tier).toBe("Circuit 300");
      expect(preview.save.career?.rankings[0]?.eventHistory[0]?.tier).toBe("Circuit 300");
    }
  });

  it("previews and migrates a valid old tournament-only import", () => {
    const legacy = {
      version: 2,
      selectedPlayerId: seededPlayers[1].player.id,
      plannedTacticKey: "spreadCourt",
      seed: 2202,
      tournament: null,
      liveMatch: null
    };

    const preview = validateImportedSaveText(JSON.stringify(legacy));

    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.save.version).toBe(8);
      expect(preview.save.selectedPlayerId).toBe(legacy.selectedPlayerId);
      expect(preview.save.career).toBeNull();
    }
  });

  it("rejects malformed imports without changing active or corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "active-save");
    storage.setItem(CORRUPT_STORAGE_KEY, "corrupt-save");

    const preview = validateImportedSaveText("{not-json");

    expect(preview.ok).toBe(false);
    if (!preview.ok) {
      expect(preview.reason).toBe("malformed_json");
    }
    expect(storage.getItem(STORAGE_KEY)).toBe("active-save");
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe("corrupt-save");
  });

  it("rejects schema-invalid imports without changing active or corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "active-save");
    storage.setItem(CORRUPT_STORAGE_KEY, "corrupt-save");

    const preview = validateImportedSaveText(JSON.stringify({
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 777,
      tournament: null,
      liveMatch: null
    }));

    expect(preview.ok).toBe(false);
    if (!preview.ok) {
      expect(preview.reason).toBe("invalid_schema");
    }
    expect(storage.getItem(STORAGE_KEY)).toBe("active-save");
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe("corrupt-save");
  });
});
