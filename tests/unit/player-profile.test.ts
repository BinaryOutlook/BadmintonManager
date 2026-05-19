import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { createInitialCareerState } from "../../game/career/state";
import { createPlayerProfileViewModel } from "../../game/selectors/player";

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

  it("derives persisted career records, trophies, and top head-to-head opponents", () => {
    const player = seededPlayers[0].player;
    const mostPlayedOpponent = seededPlayers[1].player;
    const secondOpponent = seededPlayers[2].player;
    const career = {
      ...createInitialCareerState(player.id, 7123),
      matchHistory: [
        {
          id: "metro-open-300:R16-1",
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-03",
          round: "R16" as const,
          playerAId: player.id,
          playerBId: mostPlayedOpponent.id,
          winnerId: player.id,
          scoreline: "21-13, 21-15",
          source: "played" as const
        },
        {
          id: "harbor-masters-500:QF-1",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-13",
          round: "QF" as const,
          playerAId: mostPlayedOpponent.id,
          playerBId: player.id,
          winnerId: mostPlayedOpponent.id,
          scoreline: "17-21, 19-21",
          source: "played" as const
        },
        {
          id: "summit-invitational-750:SF-1",
          eventId: "summit-invitational-750",
          eventName: "Summit Invitational",
          date: "2026-06-26",
          round: "SF" as const,
          playerAId: player.id,
          playerBId: secondOpponent.id,
          winnerId: player.id,
          scoreline: "21-18, 21-17",
          source: "played" as const
        }
      ],
      playerAchievements: [
        {
          playerId: player.id,
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-07",
          result: "champion" as const
        },
        {
          playerId: player.id,
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-17",
          result: "runner_up" as const
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: player.id,
      tournament: null,
      career
    });

    expect(profile?.career.recordCards).toEqual([
      { label: "W-L", value: "2-1" },
      { label: "Win %", value: "67%" },
      { label: "Titles", value: "1" },
      { label: "Runner-up", value: "1" },
      { label: "Finals", value: "2" }
    ]);
    expect(profile?.career.titles.map((achievement) => achievement.eventName)).toEqual(["Metro Open"]);
    expect(profile?.career.runnerUpFinishes.map((achievement) => achievement.eventName)).toEqual(["Harbor Masters"]);
    expect(profile?.career.headToHead[0]).toMatchObject({
      opponentId: mostPlayedOpponent.id,
      played: 2,
      wins: 1,
      losses: 1,
      winPercentageLabel: "50%"
    });
    expect(profile?.career.headToHead[1]).toMatchObject({
      opponentId: secondOpponent.id,
      played: 1,
      wins: 1,
      losses: 0,
      winPercentageLabel: "100%"
    });
  });

  it("calculates records from universe matches where neither player is managed", () => {
    const managed = seededPlayers[0].player;
    const player = seededPlayers[1].player;
    const opponent = seededPlayers[2].player;
    const career = {
      ...createInitialCareerState(managed.id, 8124),
      matchHistory: [
        {
          id: "metro-open-300:R16-2",
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-03",
          round: "R16" as const,
          playerAId: player.id,
          playerBId: opponent.id,
          winnerId: player.id,
          scoreline: "21-16, 21-19",
          source: "quick_sim" as const
        },
        {
          id: "harbor-masters-500:QF-3",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-13",
          round: "QF" as const,
          playerAId: opponent.id,
          playerBId: player.id,
          winnerId: opponent.id,
          scoreline: "19-21, 21-18, 19-21",
          source: "quick_sim" as const
        }
      ],
      playerAchievements: [
        {
          playerId: player.id,
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-07",
          result: "runner_up" as const
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });

    expect(profile?.career.recordCards).toEqual([
      { label: "W-L", value: "1-1" },
      { label: "Win %", value: "50%" },
      { label: "Titles", value: "0" },
      { label: "Runner-up", value: "1" },
      { label: "Finals", value: "1" }
    ]);
    expect(profile?.career.headToHead).toEqual([
      expect.objectContaining({
        opponentId: opponent.id,
        played: 2,
        wins: 1,
        losses: 1,
        winPercentageLabel: "50%"
      })
    ]);
  });

  it("shows managed-player spotlight only when a non-managed profile has recorded matches against them", () => {
    const managed = seededPlayers[0].player;
    const player = seededPlayers[1].player;
    const unrelatedOpponent = seededPlayers[2].player;
    const career = {
      ...createInitialCareerState(managed.id, 8125),
      matchHistory: [
        {
          id: "metro-open-300:R16-2",
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-03",
          round: "R16" as const,
          playerAId: player.id,
          playerBId: managed.id,
          winnerId: player.id,
          scoreline: "21-16, 21-19",
          source: "quick_sim" as const
        },
        {
          id: "harbor-masters-500:R16-4",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-13",
          round: "R16" as const,
          playerAId: player.id,
          playerBId: unrelatedOpponent.id,
          winnerId: unrelatedOpponent.id,
          scoreline: "19-21, 18-21",
          source: "quick_sim" as const
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });
    const managedProfile = createPlayerProfileViewModel({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });
    const noSpotlightProfile = createPlayerProfileViewModel({
      playerId: unrelatedOpponent.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });

    expect(profile?.career.managedPlayerSpotlight).toMatchObject({
      opponentId: managed.id,
      opponentName: managed.name,
      played: 1,
      wins: 1,
      losses: 0,
      winPercentageLabel: "100%"
    });
    expect(managedProfile?.career.managedPlayerSpotlight).toBeNull();
    expect(noSpotlightProfile?.career.managedPlayerSpotlight).toBeNull();
  });

  it("keeps legacy bracket snapshots out of universe record counts", () => {
    const managed = seededPlayers[0].player;
    const player = seededPlayers[1].player;
    const opponent = seededPlayers[2].player;
    const matchRecord = {
      id: "metro-open-300:R16-2",
      eventId: "metro-open-300",
      eventName: "Metro Open",
      date: "2026-06-03",
      round: "R16" as const,
      playerAId: player.id,
      playerBId: opponent.id,
      winnerId: player.id,
      scoreline: "21-16, 21-19",
      source: "quick_sim" as const
    };
    const career = {
      ...createInitialCareerState(managed.id, 8126),
      matchHistory: [matchRecord, matchRecord],
      eventHistory: [
        {
          eventId: "metro-open-300",
          eventName: "Metro Open",
          tier: "Circuit 300" as const,
          startDate: "2026-06-03",
          endDate: "2026-06-07",
          status: "round_of_16" as const,
          entered: true,
          resultRound: "R16",
          pointsAwarded: 90,
          prizeMoney: 2_000,
          entryCost: 0,
          travelCost: 0,
          netCash: 2_000,
          completedAt: "2026-06-07",
          matchIds: [matchRecord.id],
          scorelines: [matchRecord.scoreline],
          achievements: [],
          bracketSnapshot: {
            championId: null,
            managedPlayerId: managed.id,
            rounds: [
              {
                name: "R16" as const,
                matches: [
                  {
                    id: "R16-2",
                    sideAId: player.id,
                    sideBId: opponent.id,
                    winnerId: player.id,
                    scoreline: matchRecord.scoreline,
                    managed: false
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });

    expect(profile?.career.recordCards).toEqual([
      { label: "W-L", value: "1-0" },
      { label: "Win %", value: "100%" },
      { label: "Titles", value: "0" },
      { label: "Runner-up", value: "0" },
      { label: "Finals", value: "0" }
    ]);
    expect(profile?.career.headToHead).toEqual([
      expect.objectContaining({
        opponentId: opponent.id,
        played: 1,
        wins: 1,
        losses: 0
      })
    ]);
  });

  it("does not fabricate legacy history from bracket snapshots without match records", () => {
    const managed = seededPlayers[0].player;
    const player = seededPlayers[1].player;
    const opponent = seededPlayers[2].player;
    const career = {
      ...createInitialCareerState(managed.id, 8127),
      matchHistory: [],
      playerAchievements: [],
      eventHistory: [
        {
          eventId: "metro-open-300",
          eventName: "Metro Open",
          tier: "Circuit 300" as const,
          startDate: "2026-06-03",
          endDate: "2026-06-07",
          status: "round_of_16" as const,
          entered: true,
          resultRound: "R16",
          pointsAwarded: 90,
          prizeMoney: 2_000,
          entryCost: 0,
          travelCost: 0,
          netCash: 2_000,
          completedAt: "2026-06-07",
          matchIds: ["metro-open-300:R16-2"],
          scorelines: ["21-16, 21-19"],
          achievements: [],
          bracketSnapshot: {
            championId: null,
            managedPlayerId: managed.id,
            rounds: [
              {
                name: "R16" as const,
                matches: [
                  {
                    id: "R16-2",
                    sideAId: player.id,
                    sideBId: opponent.id,
                    winnerId: player.id,
                    scoreline: "21-16, 21-19",
                    managed: false
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });

    expect(profile?.career.hasRecordedHistory).toBe(false);
    expect(profile?.career.recordCards).toContainEqual({ label: "W-L", value: "0-0" });
    expect(profile?.career.recordCards).toContainEqual({ label: "Win %", value: "N/A" });
    expect(profile?.career.headToHead).toEqual([]);
  });
});
