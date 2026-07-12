import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { startNextSeason } from "../../game/career/lifecycle";
import { createInitialCareerState } from "../../game/career/state";
import {
  activeWorldSeededPlayers,
  advanceWorldRegistry,
  averagePlayerRating,
  createInitialWorldRegistry
} from "../../game/career/world";
import {
  CURRENT_SAVE_VERSION,
  migratePersistedSave,
  persistedSavePayloadSchema,
  persistedSaveSchema
} from "../../game/store/save";

function currentSave(career: ReturnType<typeof createInitialCareerState>) {
  return {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: career.program.managedPlayerId,
    plannedTacticKey: "balancedControl" as const,
    seed: career.seed,
    tournament: null,
    liveMatch: null,
    career
  };
}

describe("deterministic career world", () => {
  it("builds an honest legacy snapshot and advances independently of player array order", () => {
    const initial = createInitialWorldRegistry({ seed: 77_001, seasonId: "2026", date: "2026-06-01" });
    const forward = advanceWorldRegistry({
      registry: initial,
      careerSeed: 77_001,
      seasonId: "2027",
      date: "2027-01-01",
      protectedPlayerIds: new Set(["player-1"])
    });
    const reverse = advanceWorldRegistry({
      registry: { ...initial, players: [...initial.players].reverse() },
      careerSeed: 77_001,
      seasonId: "2027",
      date: "2027-01-01",
      protectedPlayerIds: new Set(["player-1"])
    });

    expect(initial.players).toHaveLength(seededPlayers.length);
    expect(initial.players.every((record) => record.origin === "legacy_snapshot" && record.status === "active")).toBe(true);
    expect(initial.lifecycleLog).toEqual([]);
    expect(reverse).toEqual(forward);
    expect(advanceWorldRegistry({
      registry: forward,
      careerSeed: 77_001,
      seasonId: "2027",
      date: "2027-01-01",
      protectedPlayerIds: new Set(["player-1"])
    })).toEqual(forward);
  });

  it("applies growth and decline curves, retires eligible players, and replaces the active field", () => {
    const initial = createInitialWorldRegistry({ seed: 77_002, seasonId: "2026", date: "2026-06-01" });
    const growthId = "player-2";
    const declineId = "player-3";
    const retirementId = "player-4";
    const configured = {
      ...initial,
      players: initial.players.map((record) => {
        if (record.player.id === growthId) {
          return { ...record, player: { ...record.player, age: record.peakAge - 1 } };
        }
        if (record.player.id === declineId) {
          return {
            ...record,
            player: { ...record.player, age: record.declineAge },
            retirementAge: 45
          };
        }
        if (record.player.id === retirementId) {
          return {
            ...record,
            player: { ...record.player, age: record.retirementAge - 1 }
          };
        }
        return record;
      })
    };
    const before = new Map(configured.players.map((record) => [record.player.id, record]));
    const next = advanceWorldRegistry({
      registry: configured,
      careerSeed: 77_002,
      seasonId: "2027",
      date: "2027-01-01",
      protectedPlayerIds: new Set([declineId])
    });
    const after = new Map(next.players.map((record) => [record.player.id, record]));

    expect(averagePlayerRating(after.get(growthId)!.player)).toBeGreaterThan(averagePlayerRating(before.get(growthId)!.player));
    expect(averagePlayerRating(after.get(declineId)!.player)).toBeLessThan(averagePlayerRating(before.get(declineId)!.player));
    expect(after.get(retirementId)).toMatchObject({ status: "retired", retiredSeason: "2027" });
    expect(next.lifecycleLog.some((event) => event.playerId === retirementId && event.type === "retirement")).toBe(true);
    expect(next.players.filter((record) => record.origin === "generated_intake" && record.debutSeason === "2027").length).toBeGreaterThanOrEqual(2);
    expect(next.players.filter((record) => record.status === "active").length).toBeGreaterThanOrEqual(32);
    expect(new Set(next.players.map((record) => record.player.id)).size).toBe(next.players.length);
    expect(next.players.flatMap((record) => [
      ...Object.values(record.player.ratings.technical),
      ...Object.values(record.player.ratings.physical),
      ...Object.values(record.player.ratings.mental)
    ]).every((rating) => rating >= 1 && rating <= 100)).toBe(true);
  });

  it("matches a stable multi-season world golden and keeps active world players in career rankings", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 77_003);
    const closed2026 = { ...initial, seasonReviews: [{
      id: "season-review:2026",
      seasonId: "2026",
      createdAt: "2027-01-01",
      startDate: initial.seasonStartedAt,
      endDate: "2026-12-31",
      managedPlayerId: initial.program.managedPlayerId,
      events: initial.events,
      finalRankings: initial.rankings,
      record: { played: 0, wins: 0, losses: 0, titles: 0, runnerUps: 0, enteredEvents: 0, completedEvents: 0 },
      economy: { openingCash: initial.economy.cash, closingCash: initial.economy.cash, netCash: 0 },
      source: "resolved" as const
    }] };
    const season2027 = startNextSeason(closed2026);
    const season2028 = startNextSeason({ ...season2027, seasonReviews: [...season2027.seasonReviews, {
      ...closed2026.seasonReviews[0]!,
      id: "season-review:2027",
      seasonId: "2027",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      events: season2027.events
    }] });
    const active = season2028.world.players.filter((record) => record.status === "active");
    const retired = season2028.world.players.filter((record) => record.status === "retired");
    const generated = season2028.world.players.filter((record) => record.origin === "generated_intake");
    const managed = season2028.world.players.find((record) => record.player.id === initial.program.managedPlayerId)!;
    const summary = {
      seasonId: season2028.seasonId,
      active: active.length,
      retired: retired.length,
      generated: generated.length,
      lifecycleEvents: season2028.world.lifecycleLog.length,
      managedAge: managed.player.age,
      managedRating: Number(averagePlayerRating(managed.player).toFixed(3)),
      firstGeneratedIds: generated.slice(0, 4).map((record) => record.player.id)
    };

    expect(summary).toEqual({
      seasonId: "2028",
      active: 50,
      retired: 1,
      generated: 4,
      lifecycleEvents: 99,
      managedAge: 27,
      managedRating: 85.786,
      firstGeneratedIds: ["world-2027-01", "world-2027-02", "world-2028-01", "world-2028-02"]
    });
    expect(new Set(activeWorldSeededPlayers(season2028).map((entry) => entry.player.id))).toEqual(
      new Set(season2028.rankings.map((entry) => entry.playerId))
    );
  });

  it("round-trips current saves and hydrates pre-world v13 saves", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 77_004);
    const save = currentSave(career);

    expect(persistedSaveSchema.parse(save)).toEqual(save);

    const { world: _world, ...careerWithoutWorld } = career;
    const parsed = persistedSavePayloadSchema.parse({ ...save, career: careerWithoutWorld });
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.world.players).toHaveLength(seededPlayers.length);
    expect(migrated.career?.world.lifecycleLog).toEqual([]);
    expect(migrated.career?.world.players.every((record) => record.status === "active")).toBe(true);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates v12 into a current honest world snapshot without invented prior lifecycle events", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 77_005);
    const save = currentSave(career);
    const { world: _world, seasonStartedAt: _started, seasonReviews: _reviews, ...phase8Career } = career;
    const parsed = persistedSavePayloadSchema.parse({
      ...save,
      version: 12,
      career: { ...phase8Career, version: 10 }
    });
    const migrated = migratePersistedSave(parsed);

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.career?.world).toMatchObject({
      initializedAt: career.date,
      lastAdvancedSeasonId: career.seasonId,
      lifecycleLog: []
    });
    expect(migrated.career?.world.players).toHaveLength(seededPlayers.length);
    expect(migrated.career?.world.players.every((record) =>
      record.status === "active" && record.origin === "legacy_snapshot" && record.retiredSeason === null
    )).toBe(true);
  });

  it("survives a twenty-season career and a JSON save round-trip", () => {
    let career = createInitialCareerState(seededPlayers[0].player.id, 77_006);

    for (let index = 0; index < 20; index += 1) {
      const review = {
        id: `season-review:${career.seasonId}`,
        seasonId: career.seasonId,
        createdAt: `${career.seasonId}-12-31`,
        startDate: career.seasonStartedAt,
        endDate: `${career.seasonId}-12-31`,
        managedPlayerId: career.program.managedPlayerId,
        events: career.events,
        finalRankings: career.rankings.map((entry) => ({
          playerId: entry.playerId,
          rank: entry.rank,
          points: entry.points,
          seasonPoints: entry.seasonPoints
        })),
        record: {
          played: 0,
          wins: 0,
          losses: 0,
          titles: 0,
          runnerUps: 0,
          enteredEvents: 0,
          completedEvents: 0
        },
        economy: {
          openingCash: career.economy.cash,
          closingCash: career.economy.cash,
          netCash: 0
        },
        source: "resolved" as const
      };

      career = startNextSeason({
        ...career,
        seasonReviews: [...career.seasonReviews, review]
      });
    }

    const activeRecords = career.world.players.filter((record) => record.status === "active");
    const save = currentSave(career);
    const restored = persistedSaveSchema.parse(JSON.parse(JSON.stringify(save)));

    expect(career.seasonId).toBe("2046");
    expect(activeRecords.length).toBeGreaterThanOrEqual(32);
    expect(career.world.players.some((record) => record.status === "retired")).toBe(true);
    expect(career.world.players.some((record) => record.origin === "generated_intake")).toBe(true);
    expect(new Set(career.world.players.map((record) => record.player.id)).size).toBe(career.world.players.length);
    expect(new Set(activeRecords.map((record) => record.player.id))).toEqual(
      new Set(career.rankings.map((entry) => entry.playerId))
    );
    expect(restored).toEqual(save);
  });
});
