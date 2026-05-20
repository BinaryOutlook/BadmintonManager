import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { getCareerEvent } from "../../game/career/events";
import { careerStateSchema } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import type { MatchResult, Side } from "../../game/core/models";
import {
  migratePersistedSave,
  persistedSavePayloadSchema,
  persistedSaveSchema,
  validateImportedSaveText
} from "../../game/store/save";
import { CORRUPT_STORAGE_KEY, STORAGE_KEY, loadPersistedFromStorage } from "../../game/store/store";
import { advanceTournament, createTournament, getManagedMatchContext } from "../../game/tournament/tournament";

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
  function straightGamesResult(winner: Side): MatchResult {
    return {
      winner,
      setsWonA: winner === "A" ? 2 : 0,
      setsWonB: winner === "B" ? 2 : 0,
      setSummaries: [
        {
          winner,
          scoreA: winner === "A" ? 21 : 14,
          scoreB: winner === "B" ? 21 : 14,
          points: []
        },
        {
          winner,
          scoreA: winner === "A" ? 21 : 16,
          scoreB: winner === "B" ? 21 : 16,
          points: []
        }
      ],
      stats: {
        winnersA: winner === "A" ? 22 : 12,
        winnersB: winner === "B" ? 22 : 12,
        unforcedErrorsA: winner === "A" ? 8 : 17,
        unforcedErrorsB: winner === "B" ? 8 : 17,
        totalSmashesA: 16,
        totalSmashesB: 15,
        peakSmashSpeedA: 388,
        peakSmashSpeedB: 381,
        staminaDrainA: 8,
        staminaDrainB: 10,
        longestRally: 26,
        totalPoints: 72
      },
      scoreline: winner === "A" ? "21-14, 21-16" : "14-21, 16-21",
      fidelity: "detailed",
      summaryEvents: [
        {
          kind: "straight_games",
          side: winner,
          title: "Forced deterministic result",
          detail: "Save migration proof supplies the result instead of relying on match luck."
        }
      ]
    };
  }

  it("migrates version 2 tournament saves into version 10 without schema loss", () => {
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

    expect(migrated.version).toBe(10);
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

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
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

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
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

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
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

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
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

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
    expect(migrated.career?.lastMatchReport?.tacticalViewer).toBeNull();
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("persists a career payload through the version 10 schema", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 456);
    const save = {
      version: 10,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 456,
      tournament: null,
      liveMatch: null,
      career
    };

    expect(persistedSaveSchema.parse(save).career).toEqual(careerStateSchema.parse(career));
  });

  it("defaults missing player career history arrays on current saves", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 4562);
    const {
      matchHistory: _matchHistory,
      playerAchievements: _playerAchievements,
      ...careerWithoutProfileHistory
    } = career;
    const save = {
      version: 10,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 4562,
      tournament: null,
      liveMatch: null,
      career: careerWithoutProfileHistory
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.matchHistory).toEqual([]);
    expect(migrated.career?.playerAchievements).toEqual([]);
    expect(migrated.career?.universeEvents).toEqual([]);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates version 9 saves with missing universe records into honest legacy-unavailable records", () => {
    const currentCareer = createInitialCareerState(seededPlayers[0].player.id, 4563);
    const event = getCareerEvent(currentCareer.events, "metro-open-300")!;
    const { universeEvents: _universeEvents, ...careerWithoutUniverse } = currentCareer;
    const oldSave = {
      version: 9,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 4563,
      tournament: null,
      liveMatch: null,
      career: {
        ...careerWithoutUniverse,
        version: 7 as const,
        eventHistory: [
          {
            eventId: event.id,
            eventName: event.name,
            tier: event.tier,
            startDate: event.startDate,
            endDate: "2026-06-07",
            status: "missed_deadline" as const,
            entered: false,
            resultRound: null,
            pointsAwarded: 0,
            prizeMoney: 0,
            entryCost: 0,
            travelCost: 0,
            netCash: 0,
            completedAt: "2026-06-08",
            matchIds: [],
            scorelines: [],
            achievements: []
          }
        ],
        matchHistory: [],
        playerAchievements: []
      }
    };

    const parsed = persistedSavePayloadSchema.parse(oldSave);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
    expect(migrated.career?.universeEvents).toEqual([
      expect.objectContaining({
        seasonId: currentCareer.seasonId,
        eventId: event.id,
        source: "legacy_unavailable",
        status: "legacy_unavailable",
        championId: null,
        runnerUpId: null,
        managedPlayerResult: "not_entered"
      })
    ]);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates version 8 career saves with an empty event history", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 4561);
    const {
      eventHistory: _eventHistory,
      matchHistory: _matchHistory,
      playerAchievements: _playerAchievements,
      ...careerWithoutHistory
    } = career;
    const oldSave = {
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 4561,
      tournament: null,
      liveMatch: null,
      career: {
        ...careerWithoutHistory,
        version: 6 as const
      }
    };

    const parsed = persistedSavePayloadSchema.parse(oldSave);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(10);
    expect(migrated.career?.version).toBe(8);
    expect(migrated.career?.eventHistory).toEqual([]);
    expect(migrated.career?.matchHistory).toEqual([]);
    expect(migrated.career?.playerAchievements).toEqual([]);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("preserves locked career identity when draft selection metadata differs", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 466);
    const save = {
      version: 10,
      selectedPlayerId: seededPlayers[5].player.id,
      plannedTacticKey: "balancedControl",
      seed: 466,
      tournament: null,
      liveMatch: null,
      career
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.program.managedPlayerId).toBe(seededPlayers[0].player.id);
    expect(migrated.selectedPlayerId).toBe(seededPlayers[5].player.id);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("round-trips active between-round tournament state through export and import preview", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const career = createInitialCareerState(managedPlayerId, 467);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, managedPlayerId, 467),
      id: event.id,
      name: event.name,
      tier: event.tier,
      prizePoolUsd: event.prizeMoney.champion * 2
    };
    const context = getManagedMatchContext(tournament);

    if (!context) {
      throw new Error("Expected managed match context.");
    }

    const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
    const advancedTournament = advanceTournament({
      tournament,
      seededEntries: seededPlayers,
      managedMatchId: context.matchId,
      managedResult: straightGamesResult(managedSide)
    });
    const nextContext = getManagedMatchContext(advancedTournament);

    if (!nextContext) {
      throw new Error("Expected next managed match after non-final win.");
    }

    const nextOpponentId = nextContext.playerAId === managedPlayerId ? nextContext.playerBId : nextContext.playerAId;
    const save = {
      version: 10,
      selectedPlayerId: managedPlayerId,
      plannedTacticKey: "balancedControl",
      seed: 467,
      tournament: advancedTournament,
      liveMatch: null,
      career: {
        ...career,
        date: event.startDate,
        stage: "post_match" as const,
        activeEventId: event.id,
        enteredEventIds: [event.id],
        completedEventIds: [],
        lastMatchReport: {
          eventId: event.id,
          matchId: context.matchId,
          opponentId: context.playerAId === managedPlayerId ? context.playerBId : context.playerAId,
          result: "win" as const,
          scoreline: "21-14, 21-16",
          round: context.roundName,
          pointsDelta: 0,
          cashDelta: 0,
          fatigueDelta: 8,
          evidence: ["Forced deterministic between-round import proof"],
          recommendations: ["Continue into the next managed round"],
          tacticalViewer: null
        }
      }
    };

    const preview = validateImportedSaveText(JSON.stringify(save));

    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.save.version).toBe(10);
      expect(preview.save.tournament?.id).toBe(event.id);
      expect(preview.save.tournament?.currentRoundIndex).toBe(1);
      expect(getManagedMatchContext(preview.save.tournament!)?.matchId).toBe(nextContext.matchId);
      expect(preview.save.career?.stage).toBe("post_match");
      expect(preview.save.career?.activeEventId).toBe(event.id);
      expect(preview.save.career?.completedEventIds).not.toContain(event.id);
      expect(nextOpponentId).toBeTruthy();
    }
  });

  it("defaults medical injury episodes when loading current saves from before the health pass", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 462);
    const save = {
      version: 10,
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
      version: 10,
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
      expect(preview.save.version).toBe(10);
      expect(preview.save.career?.version).toBe(8);
    }
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(save));
    expect(storage.getItem(CORRUPT_STORAGE_KEY)).toBe("previous-corrupt-backup");
  });

  it("normalizes legacy public tier labels during current-save import", () => {
    const legacyPrefix = "Super";
    const career = createInitialCareerState(seededPlayers[0].player.id, 465);
    const save = {
      version: 10,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 465,
      tournament: {
        id: "legacy-event",
        name: "Singapore Open",
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
      expect(preview.save.tournament?.name).toBe("Harborline Open");
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
      expect(preview.save.version).toBe(10);
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
