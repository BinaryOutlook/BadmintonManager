import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { addDays } from "../../game/career/calendar";
import { developmentSnapshotFromAthlete } from "../../game/career/development";
import { eventEndDate, getCareerEvent } from "../../game/career/events";
import { createInitialCareerState } from "../../game/career/state";
import { simulateUniverseThroughDate } from "../../game/career/universe";
import { activeWorldSeededPlayers, advanceWorldRegistry, careerWorldPlayerMap, protectedWorldPlayerIds } from "../../game/career/world";
import { createPlayerProfileViewModel } from "../../game/selectors/player";
import { createTournament } from "../../game/tournament/tournament";

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

  it("keeps the selected setup athlete in managed profile mode before a run starts", () => {
    const managed = seededPlayers[0].player;
    const profile = createPlayerProfileViewModel({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      tournament: null
    });

    expect(profile?.context.label).toBe("Managed athlete");
    expect(profile?.context.mode).toBe("managed");
    expect(profile?.context.fifthTabLabel).toBe("Development");
    expect(profile?.overview.kind).toBe("managed");
    expect(profile?.overview.managerVerdict?.action).toBeTruthy();
    expect(profile?.performance.entries).toHaveLength(0);
    expect(profile?.performance.emptyState).toContain("No match evidence yet");
  });

  it("derives selectable scouting mode for setup candidates and keeps Select Athlete context separate", () => {
    const managed = seededPlayers[0].player;
    const candidate = seededPlayers[1].player;
    const profile = createPlayerProfileViewModel({
      playerId: candidate.id,
      selectedPlayerId: managed.id,
      tournament: null,
      canSelect: true
    });

    expect(profile?.context.label).toBe("Selectable athlete");
    expect(profile?.context.mode).toBe("selectable");
    expect(profile?.context.fifthTabLabel).toBe("Scouting");
    expect(profile?.overview.kind).toBe("scouting");
    expect(profile?.overview.scoutingVerdict?.action).toBe("Shortlist and compare");
    expect(profile?.scouting.affordanceLabel).toBe("Select Athlete");
  });

  it("promotes a single best tactic and keeps alternatives ranked with tradeoffs", () => {
    const player = seededPlayers[0].player;
    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: player.id,
      tournament: null
    });

    expect(profile?.tacticFits[0]).toMatchObject({ isRecommended: true, rank: 1 });
    expect(profile?.overview.tacticalPlan.recommended.key).toBe(profile?.tacticFits[0].key);
    expect(profile?.overview.tacticalPlan.alternatives).toHaveLength(3);
    expect(profile?.overview.tacticalPlan.alternatives.every((fit) => !fit.isRecommended)).toBe(true);
    expect(profile?.tacticFits[0].drivers.length).toBeGreaterThan(0);
    expect(profile?.tacticFits[0].risk).toBeTruthy();
  });

  it("adds contextual attribute interpretation beyond raw bars", () => {
    const managed = seededPlayers[0].player;
    const career = createInitialCareerState(managed.id, 7001);
    const profile = createPlayerProfileViewModel({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      tournament: null,
      career
    });

    const smash = profile?.attributeGroups
      .find((group) => group.title === "Technical")
      ?.rows.find((row) => row.label === "Smash");

    expect(smash?.benchmark).toMatch(/Strong|Elite|World Class|Average|Weak/);
    expect(smash?.context).toContain("Field rank #");
    expect(smash?.context).toContain("this career");
    expect(smash?.context).toContain("Rear-Court Power");
  });

  it("benchmarks generated profiles against the current active career world", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 7_011);
    const career = {
      ...initial,
      seasonId: "2027",
      date: "2027-01-01",
      world: advanceWorldRegistry({
        registry: initial.world,
        careerSeed: initial.seed,
        seasonId: "2027",
        date: "2027-01-01",
        protectedPlayerIds: protectedWorldPlayerIds(initial)
      })
    };
    const generated = career.world.players.find((record) => record.origin === "generated_intake")!;
    const activeFieldSize = activeWorldSeededPlayers(career).length;
    const profile = createPlayerProfileViewModel({
      playerId: generated.player.id,
      selectedPlayerId: career.program.managedPlayerId,
      tournament: null,
      career,
      playersById: careerWorldPlayerMap(career)
    });

    expect(profile?.attributeGroups[0]?.rows[0]?.context).toContain(`of ${activeFieldSize}`);
  });

  it("reports dated completed preparation outcomes from persisted development history", () => {
    const player = seededPlayers[0].player;
    const initial = createInitialCareerState(player.id, 7002);
    const athlete = initial.athletes[0]!;
    const trainedAthlete = {
      ...athlete,
      development: {
        ...athlete.development,
        smash: athlete.development.smash + 1.8,
        stamina: athlete.development.stamina + 0.2
      }
    };
    const career = {
      ...initial,
      athletes: [trainedAthlete],
      developmentHistory: [
        ...initial.developmentHistory,
        {
          kind: "preparation" as const,
          id: "development:preparation:completed",
          athleteId: player.id,
          date: "2026-06-02",
          blockId: "preparation:2026:2026-06-02:managed",
          outcome: "completed" as const,
          planId: "rear-court-power",
          planLabel: "Rear-Court Power",
          focus: "smash" as const,
          intensity: "heavy" as const,
          rulesVersion: 1 as const,
          cost: 2_400,
          modifierSourceIds: ["staff:assistant-1"],
          snapshot: developmentSnapshotFromAthlete(trainedAthlete),
          reason: "Rear-Court Power completed with staff:assistant-1."
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: player.id,
      tournament: null,
      career
    });

    expect(profile?.development.recentTrainingGains).toHaveLength(1);
    expect(profile?.development.recentTrainingGains[0]).toContain("2026-06-02 · Rear-Court Power completed");
    expect(profile?.development.recentTrainingGains[0]).toContain("Smash +1.8");
    expect(profile?.development.recentTrainingGains[0]).toContain("Stamina +0.2");
    expect(profile?.development.recentTrainingGains[0]).toContain("staff:assistant-1");
    expect(profile?.development.cumulativeDevelopment[0]).toContain("Smash");
    expect(profile?.development.cumulativeDevelopment[0]).toContain("+1.8 since the 2026-06-01 career baseline");
  });

  it("reports blocked preparation without claiming an attribute gain", () => {
    const player = seededPlayers[0].player;
    const initial = createInitialCareerState(player.id, 7003);
    const athlete = initial.athletes[0]!;
    const career = {
      ...initial,
      developmentHistory: [
        ...initial.developmentHistory,
        {
          kind: "preparation" as const,
          id: "development:preparation:blocked",
          athleteId: player.id,
          date: "2026-06-02",
          blockId: "preparation:2026:2026-06-02:managed",
          outcome: "blocked" as const,
          planId: "rear-court-power",
          planLabel: "Rear-Court Power",
          focus: "smash" as const,
          intensity: "heavy" as const,
          rulesVersion: 1 as const,
          cost: 0,
          modifierSourceIds: [],
          snapshot: developmentSnapshotFromAthlete(athlete),
          reason: "Insufficient cash for Rear-Court Power."
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: player.id,
      tournament: null,
      career
    });

    expect(profile?.development.recentTrainingGains).toEqual([
      "2026-06-02 · Rear-Court Power blocked · Insufficient cash for Rear-Court Power."
    ]);
    expect(profile?.development.recentTrainingGains[0]).not.toMatch(/Smash [+-]/);
  });

  it("labels a migrated legacy snapshot without inventing earlier training detail", () => {
    const player = seededPlayers[0].player;
    const initial = createInitialCareerState(player.id, 7004);
    const athlete = {
      ...initial.athletes[0]!,
      development: {
        ...initial.athletes[0]!.development,
        smash: initial.athletes[0]!.development.smash + 4
      }
    };
    const career = {
      ...initial,
      date: "2026-07-01",
      athletes: [athlete],
      developmentHistory: [
        {
          kind: "snapshot" as const,
          id: "development:legacy",
          athleteId: player.id,
          date: "2026-07-01",
          source: "legacy_snapshot" as const,
          snapshot: developmentSnapshotFromAthlete(athlete),
          note: "Current values preserved; prior development events are unavailable."
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: player.id,
      selectedPlayerId: player.id,
      tournament: null,
      career
    });

    expect(profile?.development.recentTrainingGains).toEqual([
      "2026-07-01 · Legacy development snapshot · Earlier training detail unavailable. Current values preserved; prior development events are unavailable."
    ]);
    expect(profile?.development.cumulativeDevelopment[0]).toContain("no change since the 2026-07-01 legacy snapshot");
  });

  it("summarizes managed performance telemetry when current-run evidence exists", () => {
    const managed = seededPlayers[0].player;
    const tournament = createTournament(seededPlayers, managed.id, 9001);
    const managedMatch = tournament.rounds[0]!.matches.find((match) => match.managed)!;
    const opponentId = managedMatch.sideAId === managed.id ? managedMatch.sideBId : managedMatch.sideAId;
    const opponentName = seededPlayers.find((entry) => entry.player.id === opponentId)!.player.name;
    const tournamentWithEvidence = {
      ...tournament,
      rounds: [
        {
          ...tournament.rounds[0]!,
          matches: tournament.rounds[0]!.matches.map((match) =>
            match.id === managedMatch.id
              ? {
                  ...match,
                  completed: true,
                  winnerId: managed.id,
                  scoreline: "21-10, 21-12",
                  simulationFidelity: "detailed" as const,
                  summaryEvents: [
                    {
                      kind: "attack_pressure" as const,
                      title: "Attack pressure landed",
                      detail: "The managed player converted early smash pressure."
                    }
                  ]
                }
              : match
          )
        }
      ],
      managedResults: [
        {
          round: managedMatch.round,
          opponentId,
          opponentName,
          scoreline: "21-10, 21-12",
          won: true,
          stats: {
            winners: 24,
            unforcedErrors: 8,
            totalSmashes: 19,
            peakSmashSpeed: 391,
            longestRally: 24,
            totalPoints: 64,
            staminaDrain: 9
          }
        }
      ]
    };

    const profile = createPlayerProfileViewModel({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      tournament: tournamentWithEvidence
    });

    expect(profile?.performance.formLabel).toBe("Positive");
    expect(profile?.performance.lastMatchEvidence).toContainEqual(
      expect.objectContaining({ label: "Winners / errors", value: "24/8" })
    );
    expect(profile?.performance.shotProfile.length).toBeGreaterThan(0);
    expect(profile?.performance.tacticalResults).toContainEqual(
      expect.objectContaining({ label: "Attack pressure landed" })
    );
    expect(profile?.performance.telemetryState.value).toBe("Tracked");
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
    expect(profile?.career.rivalries[0]).toMatchObject({
      opponentId: mostPlayedOpponent.id,
      rivalryLabel: "Even Rivalry"
    });
    expect(profile?.career.timeline.map((entry) => entry.eventName)).toContain("Metro Open");
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

  it("shows a non-managed champion title from a skipped simulated universe event", () => {
    const managed = seededPlayers[0].player;
    const career = createInitialCareerState(managed.id, 8128);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const simulated = simulateUniverseThroughDate({
      career,
      activeTournament: null,
      targetDate: addDays(eventEndDate(event), 1)
    }).career;
    const universeRecord = simulated.universeEvents.find((record) => record.eventId === event.id);

    if (!universeRecord?.championId) {
      throw new Error("Expected skipped universe event champion.");
    }

    const profile = createPlayerProfileViewModel({
      playerId: universeRecord.championId,
      selectedPlayerId: managed.id,
      tournament: null,
      career: simulated
    });

    expect(universeRecord.managedPlayerResult).toBe("not_entered");
    expect(profile?.career.recordCards).toContainEqual({ label: "Titles", value: "1" });
    expect(profile?.career.titles).toEqual([
      expect.objectContaining({
        eventId: event.id,
        eventName: event.name,
        result: "champion"
      })
    ]);
    expect(profile?.career.hasRecordedHistory).toBe(true);
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
