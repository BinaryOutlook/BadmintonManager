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
          scoreline: "21-13, 21-15"
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
          scoreline: "17-21, 19-21"
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
          scoreline: "21-18, 21-17"
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
      { label: "Runner-up", value: "1" }
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
});
