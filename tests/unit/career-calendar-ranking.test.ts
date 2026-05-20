import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { addDays } from "../../game/career/calendar";
import {
  calendarCommitmentsForCareer,
  buildEventSeedingSnapshot,
  careerEventCatalog,
  eventDeadlineMilestones,
  eventEndDate,
  eventEligibilityFor,
  eventStatusFor,
  getCareerEvent,
  groupCalendarCommitmentsByDate,
  paginateCalendarItems,
  pastCalendarRecords,
  recordPastCareerEvents,
  scheduleCalendarEntriesForCareer,
  scheduleCalendarMonthForCareer,
  timelineCommitmentsForCareer,
  upcomingCalendarEvents
} from "../../game/career/events";
import { scheduledDateForRound } from "../../game/career/matchSchedule";
import {
  appendRankingResultsAndRebuild,
  buildRankingSnapshot,
  createBootstrapRankingResults,
  createRankingResult,
  isWithinRankingWindow,
  rankingResultsForPlayer,
  rankingsByCurrentRank
} from "../../game/career/rankings";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import {
  createEventFieldSnapshot,
  deterministicUniverseEntrants,
  simulateUniverseThroughDate
} from "../../game/career/universe";
import { defaultRankingSettings, type CareerEventDefinition, type RankingResult } from "../../game/career/models";
import type { MatchResult, Side } from "../../game/core/models";
import { migratePersistedSave, persistedSavePayloadSchema, persistedSaveSchema } from "../../game/store/save";
import { advanceTournament, createTournament, getManagedMatchContext } from "../../game/tournament/tournament";

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
    summaryEvents: []
  };
}

function testRankingResult(args: {
  playerId: string;
  eventId: string;
  date: string;
  points: number;
  resultRound?: RankingResult["resultRound"];
  source?: RankingResult["source"];
  artificial?: boolean;
}): RankingResult {
  return createRankingResult({
    seasonId: args.date.slice(0, 4),
    playerId: args.playerId,
    eventId: args.eventId,
    eventName: args.eventId,
    tier: "Circuit 300",
    date: args.date,
    resultRound: args.resultRound ?? "R16",
    points: args.points,
    source: args.source ?? "universe_sim",
    artificial: args.artificial ?? false
  });
}

function testStrength(playerId: string) {
  const player = seededPlayers.find((entry) => entry.player.id === playerId)!.player;
  const { technical, physical, mental } = player.ratings;

  return (
    technical.smash +
    technical.netPlay +
    technical.defenseRetrieval +
    physical.stamina +
    physical.footworkSpeed +
    mental.composure +
    mental.focus
  ) / 7;
}

describe("fictional career calendar and ranking model", () => {
  it("builds rolling snapshots from dated results inside the 364-day window", () => {
    const playerId = seededPlayers[0].player.id;
    const results = [
      testRankingResult({ playerId, eventId: "inside-edge", date: "2025-06-02", points: 300 }),
      testRankingResult({ playerId, eventId: "outside-window", date: "2025-06-01", points: 900 })
    ];

    expect(isWithinRankingWindow({ resultDate: "2025-06-02", asOfDate: "2026-06-01", windowDays: 364 })).toBe(true);
    expect(isWithinRankingWindow({ resultDate: "2025-06-01", asOfDate: "2026-06-01", windowDays: 364 })).toBe(false);

    const snapshot = buildRankingSnapshot({
      players: seededPlayers.slice(0, 2),
      results,
      asOfDate: "2026-06-01",
      settings: defaultRankingSettings
    });
    const row = snapshot.find((entry) => entry.playerId === playerId)!;

    expect(row.points).toBe(300);
    expect(row.eligibleResults).toBe(1);
    expect(row.countedResults).toBe(1);
    expect(row.nextExpiryDate).toBe("2026-06-02");
    expect(row.countedResultIds).toEqual([results[0]!.id]);
  });

  it("counts all eligible results up to ten and only the best ten after that", () => {
    const playerId = seededPlayers[0].player.id;
    const tenResults = Array.from({ length: 10 }, (_, index) =>
      testRankingResult({
        playerId,
        eventId: `ten-${index}`,
        date: addDays("2026-01-01", index),
        points: 100 + index
      })
    );
    const elevenResults = [
      testRankingResult({ playerId, eventId: "low", date: "2026-01-20", points: 5 }),
      ...tenResults
    ];

    expect(rankingResultsForPlayer({
      results: tenResults,
      playerId,
      asOfDate: "2026-06-01",
      windowDays: 364,
      maxCountedResults: 10
    }).counted).toHaveLength(10);

    const snapshot = buildRankingSnapshot({
      players: seededPlayers.slice(0, 2),
      results: elevenResults,
      asOfDate: "2026-06-01",
      settings: defaultRankingSettings
    });
    const row = snapshot.find((entry) => entry.playerId === playerId)!;

    expect(row.eligibleResults).toBe(11);
    expect(row.countedResults).toBe(10);
    expect(row.points).toBe(tenResults.reduce((total, result) => total + result.points, 0));
    expect(row.countedResultIds).not.toContain(elevenResults[0]!.id);
  });

  it("creates deterministic bootstrap ranking rows that expire without entering match history", () => {
    const first = createInitialCareerState(seededPlayers[0].player.id, 6800);
    const second = createInitialCareerState(seededPlayers[0].player.id, 6800);
    const bootstrap = createBootstrapRankingResults({
      players: seededPlayers,
      careerStartDate: first.date,
      seed: 6800,
      settings: first.rankingSettings,
      eventTemplates: careerEventCatalog
    });
    const expiredSnapshot = buildRankingSnapshot({
      players: seededPlayers,
      results: first.rankingResults,
      asOfDate: addDays(first.date, 370),
      previousRankings: first.rankings,
      settings: first.rankingSettings
    });

    expect(first.rankingResults).toEqual(second.rankingResults);
    expect(first.rankingResults).toEqual(bootstrap);
    expect(first.rankingResults.length).toBeGreaterThanOrEqual(26 * 16);
    expect(first.rankingResults.every((result) => result.source === "bootstrap_sim" && result.artificial)).toBe(true);
    expect(first.matchHistory).toEqual([]);
    expect(expiredSnapshot.every((entry) => entry.points === 0 && entry.countedResults === 0)).toBe(true);
  });

  it("starts new saves with skill-correlated but imperfect bootstrap ranks", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6801);
    const ordered = rankingsByCurrentRank(career.rankings);
    const topEightAverage = ordered.slice(0, 8).reduce((total, entry) => total + testStrength(entry.playerId), 0) / 8;
    const bottomEightAverage = ordered.slice(-8).reduce((total, entry) => total + testStrength(entry.playerId), 0) / 8;

    expect(topEightAverage).toBeGreaterThan(bottomEightAverage);
    expect(ordered.map((entry) => entry.playerId)).not.toEqual(seededPlayers.map((entry) => entry.player.id));
  });

  it("publishes a deterministic draw for skipped events without creating match records early", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6820);
    const event = getCareerEvent(career.events, "metro-open-300")!;

    const first = simulateUniverseThroughDate({
      career,
      activeTournament: null,
      targetDate: event.drawDate
    });
    const second = simulateUniverseThroughDate({
      career,
      activeTournament: null,
      targetDate: event.drawDate
    });
    const record = first.career.universeEvents.find((entry) => entry.eventId === event.id);

    expect(record).toMatchObject({
      eventId: event.id,
      source: "unentered_sim",
      status: "drawn",
      championId: null,
      runnerUpId: null,
      managedPlayerResult: "not_entered"
    });
    expect(record?.entrants).toHaveLength(event.drawSize);
    expect(new Set(record?.entrants).size).toBe(event.drawSize);
    expect(record?.entrants).not.toContain(career.program.managedPlayerId);
    expect(record?.entrants).toEqual(deterministicUniverseEntrants({ career, event }));
    expect(first.career.matchHistory).toEqual([]);
    expect(first.career.universeEvents).toEqual(second.career.universeEvents);
  });

  it("builds event fields through non-entry, alternates, and final rank-based seeding", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6822);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const snapshot = createEventFieldSnapshot({ career, event });
    const replayed = createEventFieldSnapshot({ career, event });
    const finalRanks = snapshot.seeds.map((seed) => seed.rank);

    expect(snapshot).toEqual(replayed);
    expect(snapshot.invitedPlayerIds).toHaveLength(16);
    expect(snapshot.nonEntries.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.alternateEntries).toHaveLength(snapshot.nonEntries.length);
    expect(snapshot.finalPlayerIds).toHaveLength(16);
    expect(new Set(snapshot.finalPlayerIds).size).toBe(16);
    expect(snapshot.nonEntries.every((entry) => entry.playerId !== career.program.managedPlayerId)).toBe(true);
    expect(snapshot.alternateEntries.some((entry) => {
      const rank = career.rankings.find((ranking) => ranking.playerId === entry.playerId)?.rank ?? 0;

      return rank > event.drawSize;
    })).toBe(true);
    expect(finalRanks).toEqual([...finalRanks].sort((left, right) => left - right));
    for (const alternate of snapshot.alternateEntries) {
      expect(snapshot.finalPlayerIds).toContain(alternate.playerId);
      expect(snapshot.finalPlayerIds).not.toContain(alternate.replacedPlayerId);
    }
  });

  it("guarantees five non-managed non-entries for 32-player selection tests", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6824);
    const event = {
      ...getCareerEvent(career.events, "coastline-classic-300")!,
      id: "test-32-field",
      drawSize: 32,
      seedCount: 16
    } satisfies CareerEventDefinition;
    const snapshot = createEventFieldSnapshot({ career, event });

    expect(snapshot.invitedPlayerIds).toHaveLength(32);
    expect(snapshot.nonEntries.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.alternateEntries).toHaveLength(snapshot.nonEntries.length);
    expect(snapshot.finalPlayerIds).toHaveLength(32);
    expect(new Set(snapshot.finalPlayerIds).size).toBe(32);
  });

  it("keeps an entered managed athlete in the field while resolving non-managed dropouts", () => {
    const career = {
      ...createInitialCareerState(seededPlayers[0].player.id, 6825),
      enteredEventIds: ["metro-open-300"]
    };
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const snapshot = createEventFieldSnapshot({ career, event, includeManagedEntry: true });

    expect(snapshot.finalPlayerIds).toContain(career.program.managedPlayerId);
    expect(snapshot.nonEntries.map((entry) => entry.playerId)).not.toContain(career.program.managedPlayerId);
  });

  it("completes an overdue non-entered universe event with records, rankings, achievements, and idempotency", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6821);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const targetDate = addDays(eventEndDate(event), 1);

    const first = simulateUniverseThroughDate({
      career,
      activeTournament: null,
      targetDate
    });
    const replayed = simulateUniverseThroughDate({
      career: first.career,
      activeTournament: first.activeTournament,
      targetDate
    });
    const record = first.career.universeEvents.find((entry) => entry.eventId === event.id);
    const championRanking = record?.championId
      ? first.career.rankings.find((entry) => entry.playerId === record.championId)
      : null;
    const runnerUpRanking = record?.runnerUpId
      ? first.career.rankings.find((entry) => entry.playerId === record.runnerUpId)
      : null;

    expect(first.eventsSimulated).toContain(event.id);
    expect(record).toMatchObject({
      eventId: event.id,
      source: "unentered_sim",
      status: "completed",
      completedAt: targetDate,
      managedPlayerResult: "not_entered"
    });
    expect(record?.entrants).toHaveLength(event.drawSize);
    expect(record?.championId).toBeTruthy();
    expect(record?.runnerUpId).toBeTruthy();
    expect(record?.matchIds).toHaveLength(15);
    expect(record?.placements).toHaveLength(event.drawSize);
    expect(first.career.completedEventIds).toContain(event.id);
    expect(first.career.matchHistory.filter((entry) => entry.eventId === event.id)).toHaveLength(15);
    expect(first.career.matchHistory.every((entry) => entry.seasonId === career.seasonId)).toBe(true);
    expect(first.career.matchHistory.every((entry) => entry.source === "universe_sim")).toBe(true);
    expect(first.career.matchHistory.map((entry) => entry.id)).toEqual(record?.matchIds);
    expect(championRanking?.eventHistory).toContainEqual(
      expect.objectContaining({
        eventId: event.id,
        round: "champion",
        points: event.rankingPoints.champion
      })
    );
    expect(runnerUpRanking?.eventHistory).toContainEqual(
      expect.objectContaining({
        eventId: event.id,
        round: "F",
        points: event.rankingPoints.F
      })
    );
    expect(first.career.playerAchievements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: record?.championId,
          eventId: event.id,
          result: "champion"
        }),
        expect.objectContaining({
          playerId: record?.runnerUpId,
          eventId: event.id,
          result: "runner_up"
        })
      ])
    );
    expect(replayed.eventsSimulated).toEqual([]);
    expect(replayed.career.matchHistory.filter((entry) => entry.eventId === event.id)).toHaveLength(15);
    expect(replayed.career.playerAchievements.filter((entry) => entry.eventId === event.id)).toHaveLength(2);
    expect(replayed.career.rankings).toEqual(first.career.rankings);
    expect(replayed.career.rankingResults.filter((entry) => entry.eventId === event.id)).toHaveLength(event.drawSize);
    expect(replayed.career.universeEvents).toEqual(first.career.universeEvents);
  });

  it("does not backfill-complete an entered overdue event from played-match-only evidence", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 6823);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, baseCareer.program.managedPlayerId, 6823),
      id: event.id,
      name: event.name,
      tier: event.tier,
      prizePoolUsd: event.prizeMoney.champion * 2
    };
    const managedContext = getManagedMatchContext(tournament)!;
    const opponentId =
      managedContext.playerAId === baseCareer.program.managedPlayerId
        ? managedContext.playerBId
        : managedContext.playerAId;
    const playedRecord = {
      id: `${baseCareer.seasonId}:${event.id}:played-managed-r16`,
      seasonId: baseCareer.seasonId,
      eventId: event.id,
      eventName: event.name,
      date: event.startDate,
      round: "R16" as const,
      playerAId: managedContext.playerAId,
      playerBId: managedContext.playerBId,
      winnerId: opponentId,
      scoreline: "18-21, 19-21",
      source: "played" as const
    };
    const overdueEnteredCareer = {
      ...baseCareer,
      date: addDays(eventEndDate(event), 2),
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "post_match" as const,
      matchHistory: [playedRecord]
    };

    const result = simulateUniverseThroughDate({
      career: overdueEnteredCareer,
      activeTournament: null,
      targetDate: overdueEnteredCareer.date
    });
    const replayed = simulateUniverseThroughDate({
      career: result.career,
      activeTournament: null,
      targetDate: overdueEnteredCareer.date
    });
    const record = result.career.universeEvents.find((entry) => entry.eventId === event.id);

    expect(record).toMatchObject({
      eventId: event.id,
      source: "live_progression",
      status: "in_progress",
      completedAt: null,
      championId: null,
      runnerUpId: null,
      matchIds: [playedRecord.id],
      managedPlayerResult: "R16"
    });
    expect(record?.entrants).toEqual(expect.arrayContaining([baseCareer.program.managedPlayerId, opponentId]));
    expect(result.career.completedEventIds).not.toContain(event.id);
    expect(result.career.matchHistory).toEqual([playedRecord]);
    expect(result.career.matchHistory.some((entry) => entry.source === "backfill_sim")).toBe(false);
    expect(replayed.career.matchHistory).toEqual(result.career.matchHistory);
    expect(replayed.career.universeEvents).toEqual(result.career.universeEvents);
  });

  it("does not auto-complete an overdue active event that is waiting for managed play", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6822);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, career.program.managedPlayerId, 6822),
      id: event.id,
      name: event.name,
      tier: event.tier,
      prizePoolUsd: event.prizeMoney.champion * 2
    };
    const result = simulateUniverseThroughDate({
      career: {
        ...career,
        date: addDays(eventEndDate(event), 2),
        activeEventId: event.id,
        enteredEventIds: [event.id],
        stage: "pre_match"
      },
      activeTournament: tournament,
      targetDate: addDays(eventEndDate(event), 2)
    });
    const record = result.career.universeEvents.find((entry) => entry.eventId === event.id);

    expect(getManagedMatchContext(tournament)).toBeTruthy();
    expect(record).toMatchObject({
      eventId: event.id,
      status: "in_progress",
      source: "live_progression",
      championId: null,
      runnerUpId: null,
      managedPlayerResult: null
    });
    expect(result.career.completedEventIds).not.toContain(event.id);
    expect(result.career.matchHistory.filter((entry) => entry.eventId === event.id)).toEqual([]);
  });

  it("defines ordered fictional event operations metadata for every catalog event", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6801);

    expect(career.events.length).toBeGreaterThan(5);
    expect(career.events.every((event) => event.location.venue.length > 0)).toBe(true);
    expect(career.events.every((event) => event.drawSize === 16)).toBe(true);
    expect(career.events.every((event) => event.seedCount === 8)).toBe(true);
    expect(new Set(careerEventCatalog.map((event) => event.id)).size).toBe(careerEventCatalog.length);
    expect(careerEventCatalog.map((event) => event.startDate)).toEqual(
      [...careerEventCatalog.map((event) => event.startDate)].sort()
    );

    for (const event of career.events) {
      const milestones = eventDeadlineMilestones(event).map((entry) => entry.date);

      expect(event.weekNumber).toBeGreaterThan(0);
      expect(milestones).toEqual([...milestones].sort());
      expect(event.durationDays).toBeGreaterThanOrEqual(4);
      expect(event.entryDeadline <= event.withdrawalDeadline).toBe(true);
      expect(event.withdrawalDeadline <= event.drawDate).toBe(true);
      expect(event.drawDate < event.startDate).toBe(true);
      expect(event.rankingCutoffDate <= event.seedingDate).toBe(true);
      expect(event.seedingDate <= event.entryDeadline).toBe(true);
      expect(event.seedingDate <= event.drawDate).toBe(true);
      expect(addDays(event.startDate, 3) <= addDays(event.startDate, event.durationDays - 1)).toBe(true);
      expect(event.name).not.toMatch(/BWF|World Tour|Yonex|HSBC/i);
    }

    expect(career.events[0]?.startDate).toBe("2026-06-03");
    expect(getCareerEvent(career.events, "season-finals")).toMatchObject({
      weekNumber: 52,
      startDate: "2026-12-23"
    });
    expect(
      career.events
        .filter(
          (event) =>
            event.eligibility.minRank !== null ||
            event.eligibility.minPoints !== null ||
            event.eligibility.readinessFloor > 0 ||
            event.eligibility.minCompletedEvents !== null
        )
        .map((event) => event.id)
        .sort()
    ).toEqual(["continental-premier-1000", "summit-invitational-750"]);
  });

  it("separates upcoming events from archived history and paginates calendar records", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6811);
    const metro = getCareerEvent(career.events, "metro-open-300")!;
    const afterMetro = {
      ...career,
      date: addDays(eventEndDate(metro), 1),
      activeEventId: metro.id,
      enteredEventIds: [metro.id],
      stage: "event_entered" as const
    };
    const recorded = recordPastCareerEvents(afterMetro);

    expect(upcomingCalendarEvents(afterMetro).map((event) => event.id)).not.toContain(metro.id);
    expect(recorded.eventHistory.find((record) => record.eventId === metro.id)).toMatchObject({
      status: "skipped",
      entered: true
    });
    expect(recorded.activeEventId).toBeNull();

    const historyCareer = {
      ...career,
      eventHistory: career.events.slice(0, 6).map((event, index) => ({
        eventId: event.id,
        eventName: event.name,
        tier: event.tier,
        startDate: event.startDate,
        endDate: eventEndDate(event),
        status: "missed_deadline" as const,
        entered: false,
        resultRound: null,
        pointsAwarded: 0,
        prizeMoney: 0,
        entryCost: 0,
        travelCost: 0,
        netCash: 0,
        completedAt: addDays(eventEndDate(event), index),
        matchIds: [],
        scorelines: [],
        achievements: []
      }))
    };
    const past = pastCalendarRecords(historyCareer);
    const firstPage = paginateCalendarItems(past, 0);
    const secondPage = paginateCalendarItems(past, 1);

    expect(past[0]?.endDate >= past[1]!.endDate).toBe(true);
    expect(firstPage.items).toHaveLength(5);
    expect(firstPage.hasNext).toBe(true);
    expect(secondPage.items).toHaveLength(1);
  });

  it("builds confirmed calendar commitments while preserving broader timeline commitments", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 6812);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, baseCareer.program.managedPlayerId, 6812),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const context = getManagedMatchContext(tournament)!;
    const opponentId =
      context.playerAId === baseCareer.program.managedPlayerId ? context.playerBId : context.playerAId;
    const career = {
      ...baseCareer,
      date: event.startDate,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "pre_match" as const,
      matchHistory: [
        {
          id: `${event.id}:background-R16-1`,
          eventId: event.id,
          eventName: event.name,
          date: event.startDate,
          round: "R16" as const,
          playerAId: seededPlayers[6].player.id,
          playerBId: seededPlayers[7].player.id,
          winnerId: seededPlayers[6].player.id,
          scoreline: "21-15, 21-18",
          source: "quick_sim" as const
        },
        {
          id: "background-classic:QF-1",
          eventId: "background-classic",
          eventName: "Background Classic",
          date: "2026-06-20",
          round: "QF" as const,
          playerAId: seededPlayers[8].player.id,
          playerBId: seededPlayers[9].player.id,
          winnerId: seededPlayers[9].player.id,
          scoreline: "19-21, 21-16, 21-18",
          source: "quick_sim" as const
        },
        {
          id: "harbor-masters-500:R16-1",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-12",
          round: "R16" as const,
          playerAId: baseCareer.program.managedPlayerId,
          playerBId: seededPlayers[3].player.id,
          winnerId: seededPlayers[3].player.id,
          scoreline: "18-21, 21-19, 17-21",
          source: "played" as const
        }
      ]
    };

    const commitments = calendarCommitmentsForCareer({ career, tournament });
    const timelineCommitments = timelineCommitmentsForCareer({ career, tournament });
    const activeCommitment = commitments.find((commitment) => commitment.eventId === event.id && commitment.round === "R16");
    const futureCommitment = commitments.find((commitment) => commitment.eventId === event.id && commitment.round === "QF");
    const timelineFutureCommitment = timelineCommitments.find((commitment) => commitment.eventId === event.id && commitment.round === "QF");
    const completedCommitment = commitments.find((commitment) => commitment.eventId === "harbor-masters-500");
    const groups = groupCalendarCommitmentsByDate(commitments);
    const calendarEntries = scheduleCalendarEntriesForCareer({ career, tournament });

    expect(commitments.map((commitment) => commitment.eventName)).not.toContain("Background Classic");
    expect(activeCommitment).toEqual({
      date: scheduledDateForRound(event, "R16"),
      eventId: event.id,
      eventName: event.name,
      round: "R16",
      opponentId,
      opponentLabel: seededPlayers.find((entry) => entry.player.id === opponentId)!.player.name,
      result: null
    });
    expect(futureCommitment).toBeUndefined();
    expect(timelineFutureCommitment).toMatchObject({
      date: scheduledDateForRound(event, "QF"),
      opponentId: null,
      opponentLabel: "TBD",
      result: null
    });
    expect(completedCommitment).toMatchObject({
      eventName: "Harbor Masters",
      round: "R16",
      opponentId: seededPlayers[3].player.id,
      opponentLabel: seededPlayers[3].player.name,
      result: "L"
    });
    expect(groups.map((group) => group.date)).toEqual([...groups.map((group) => group.date)].sort());
    expect(calendarEntries.some((entry) => entry.kind === "match" && entry.eventId === event.id && entry.round === "QF")).toBe(false);
  });

  it("shows the next knockout round once the managed player has qualified", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 6813);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, baseCareer.program.managedPlayerId, 6813),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const openingContext = getManagedMatchContext(tournament)!;
    const managedSide = openingContext.playerAId === baseCareer.program.managedPlayerId ? "A" : "B";
    const advancedTournament = advanceTournament({
      tournament,
      seededEntries: seededPlayers,
      managedMatchId: openingContext.matchId,
      managedResult: straightGamesResult(managedSide)
    });
    const nextContext = getManagedMatchContext(advancedTournament)!;
    const nextOpponentId =
      nextContext.playerAId === baseCareer.program.managedPlayerId ? nextContext.playerBId : nextContext.playerAId;
    const career = {
      ...baseCareer,
      date: event.startDate,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "between_rounds" as const,
      matchHistory: [
        {
          id: `${event.id}:R16-1`,
          eventId: event.id,
          eventName: event.name,
          date: event.startDate,
          round: "R16" as const,
          playerAId: openingContext.playerAId,
          playerBId: openingContext.playerBId,
          winnerId: baseCareer.program.managedPlayerId,
          scoreline: "21-14, 21-16",
          source: "played" as const
        }
      ]
    };

    const commitments = calendarCommitmentsForCareer({ career, tournament: advancedTournament });
    const qualifiedCommitment = commitments.find((commitment) => commitment.eventId === event.id && commitment.round === "QF");

    expect(qualifiedCommitment).toMatchObject({
      date: scheduledDateForRound(event, "QF"),
      opponentId: nextOpponentId,
      opponentLabel: seededPlayers.find((entry) => entry.player.id === nextOpponentId)!.player.name,
      result: null
    });
  });

  it("builds a single visible calendar month view without speculative future rounds", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 6814);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, baseCareer.program.managedPlayerId, 6814),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const career = {
      ...baseCareer,
      date: event.startDate,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "pre_match" as const
    };

    const month = scheduleCalendarMonthForCareer({
      career,
      tournament,
      monthCursor: "2026-06-18"
    });

    expect(month.cursor).toBe("2026-06-01");
    expect(month.label).toBe("June 2026");
    expect(month.visibleRange).toEqual({
      startDate: "2026-06-01",
      endDateExclusive: "2026-07-01"
    });
    expect(month.weeks).toHaveLength(5);
    expect(month.weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(month.entries.every((entry) => entry.date >= "2026-06-01" && entry.date < "2026-07-01")).toBe(true);
    expect(month.entries.some((entry) => entry.kind === "match" && entry.eventId === event.id && entry.round === "R16")).toBe(true);
    expect(month.entries.some((entry) => entry.kind === "match" && entry.eventId === event.id && entry.round === "QF")).toBe(false);
    expect(month.weeks.flatMap((week) => week.days).filter((day) => day.isCareerToday).map((day) => day.date)).toEqual([
      event.startDate
    ]);
  });

  it("returns deterministic missed-deadline states before charging entry costs", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6802);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const afterDeadline = {
      ...career,
      date: addDays(event.entryDeadline, 1)
    };
    const gate = eventEligibilityFor(afterDeadline, event);

    expect(eventStatusFor(afterDeadline, event)).toBe("missed_deadline");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("entry deadline passed");
    expect(gate.daysUntilEntryDeadline).toBe(-1);
  });

  it("keeps entered events active after the entry deadline and publishes the draw on draw day", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6803);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const entered = {
      ...career,
      date: event.drawDate,
      activeEventId: event.id,
      enteredEventIds: [event.id]
    };

    expect(eventStatusFor(entered, event)).toBe("draw_published");
    expect(eventEligibilityFor(entered, event).allowed).toBe(true);
  });

  it("gives lower-third players measurable post-save appearances across fixed-season simulations", () => {
    const seeds = [7101, 7102, 7103, 7104, 7105, 7106, 7107, 7108, 7109, 7110];
    const bottomThirdIds = new Set(
      rankingsByCurrentRank(createInitialCareerState(seededPlayers[0].player.id, seeds[0]!).rankings)
        .slice(Math.floor(seededPlayers.length * 2 / 3))
        .map((entry) => entry.playerId)
    );
    const appeared = new Set<string>();
    const bottomAppeared = new Set<string>();

    for (const seed of seeds) {
      const career = createInitialCareerState(seededPlayers[0].player.id, seed);
      const result = simulateUniverseThroughDate({
        career,
        activeTournament: null,
        targetDate: addDays(eventEndDate(career.events.at(-1)!), 1)
      });
      const postSavePlayerIds = new Set(
        result.career.rankingResults
          .filter((entry) => !entry.artificial)
          .map((entry) => entry.playerId)
      );

      for (const record of result.career.universeEvents.filter((entry) => entry.status === "completed")) {
        expect(record.entrants).toHaveLength(getCareerEvent(result.career.events, record.eventId)?.drawSize ?? 16);
        expect(new Set(record.entrants).size).toBe(record.entrants.length);
      }

      for (const playerId of postSavePlayerIds) {
        appeared.add(playerId);
        if (bottomThirdIds.has(playerId)) {
          bottomAppeared.add(playerId);
        }
      }
    }

    expect(appeared.size / seededPlayers.length).toBeGreaterThanOrEqual(0.85);
    expect(bottomAppeared.size / bottomThirdIds.size).toBeGreaterThanOrEqual(0.6);
  });

  it("appends a played ranking result and rebuilds rolling ranking history deterministically", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6804);
    const event = getCareerEvent(career.events, "harbor-masters-500")!;
    const beforeCareer = appendRankingResultsAndRebuild({
      career,
      results: [],
      asOfDate: event.startDate
    });
    const before = beforeCareer.rankings.find((entry) => entry.playerId === career.program.managedPlayerId)!;
    const rankingResult = createRankingResult({
      seasonId: career.seasonId,
      playerId: career.program.managedPlayerId,
      eventId: event.id,
      eventName: event.name,
      tier: event.tier,
      date: event.startDate,
      resultRound: "SF",
      points: event.rankingPoints.SF,
      source: "played",
      artificial: false
    });
    const updated = appendRankingResultsAndRebuild({
      career: beforeCareer,
      results: [rankingResult],
      asOfDate: event.startDate
    });
    const after = updated.rankings.find((entry) => entry.playerId === career.program.managedPlayerId)!;

    expect(updated.rankingResults).toContainEqual(rankingResult);
    expect(after.points).toBe(before.points + event.rankingPoints.SF);
    expect(after.seasonPoints).toBe(before.seasonPoints + event.rankingPoints.SF);
    expect(after.eventHistory).toEqual(
      expect.arrayContaining([
        {
          eventId: event.id,
          round: "SF",
          points: event.rankingPoints.SF,
          date: event.startDate,
          seasonId: career.seasonId,
          tier: event.tier
        }
      ])
    );
    expect(
      appendRankingResultsAndRebuild({
        career: updated,
        results: [rankingResult],
        asOfDate: event.startDate
      })
    ).toEqual(updated);
  });

  it("sorts persisted ranking entries by current rank without recalculating from points", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6812);
    const rankOne = career.rankings.find((entry) => entry.rank === 1)!;
    const rankTwo = career.rankings.find((entry) => entry.rank === 2)!;
    const rankThree = career.rankings.find((entry) => entry.rank === 3)!;
    const outOfOrderRankings = [
      { ...rankThree, points: 99_999 },
      { ...rankOne, points: 1 },
      { ...rankTwo, points: 2 }
    ];

    const sorted = rankingsByCurrentRank(outOfOrderRankings);

    expect(sorted.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(sorted.map((entry) => entry.playerId)).toEqual([rankOne.playerId, rankTwo.playerId, rankThree.playerId]);
    expect(sorted[0]?.points).toBe(1);
  });

  it("builds an honest ranking-based seeding snapshot without claiming bracket seeding is changed", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6805);
    const event = getCareerEvent(career.events, "summit-invitational-750")!;
    const snapshot = buildEventSeedingSnapshot({
      state: {
        ...career,
        date: event.seedingDate
      },
      event
    });

    expect(snapshot.status).toBe("locked");
    expect(snapshot.source).toBe("fictional circuit ranking at seeding snapshot");
    expect(snapshot.seeds).toHaveLength(event.seedCount);
    expect(snapshot.seeds.map((entry) => entry.rank)).toEqual([...snapshot.seeds.map((entry) => entry.rank)].sort((a, b) => a - b));
    if (snapshot.managedSeed) {
      expect(snapshot.managedSeed.playerId).toBe(career.program.managedPlayerId);
    } else {
      expect(snapshot.seeds.every((entry) => entry.playerId !== career.program.managedPlayerId)).toBe(true);
    }
  });

  it("hydrates older current saves that predate event operations fields and season race points", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6806);
    const oldCareer = {
      ...career,
      version: 8 as const,
      events: career.events.map(({
        weekNumber: _weekNumber,
        location: _location,
        entryDeadline: _entryDeadline,
        rankingCutoffDate: _rankingCutoffDate,
        seedingDate: _seedingDate,
        withdrawalDeadline: _withdrawalDeadline,
        drawDate: _drawDate,
        drawSize: _drawSize,
        seedCount: _seedCount,
        status: _status,
        eligibility: _eligibility,
        stakesLabel: _stakesLabel,
        ...event
      }) => event),
      rankings: career.rankings.map(({ seasonPoints: _seasonPoints, ...entry }) => entry),
      athletes: career.athletes.map((athlete) =>
        athlete.playerId === career.program.managedPlayerId
          ? {
              ...athlete,
              currentRank: managedAthlete(career).currentRank
            }
          : athlete
      )
    };
    const save = {
      version: 10,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 6806,
      tournament: null,
      liveMatch: null,
      career: oldCareer
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.events).toHaveLength(careerEventCatalog.length);
    expect(migrated.career?.events[0]?.entryDeadline).toBe("2026-06-01");
    expect(migrated.career?.events[0]?.location.venue).toBe("Harborline Fieldhouse");
    expect(getCareerEvent(migrated.career?.events ?? [], "season-finals")?.startDate).toBe("2026-12-23");
    expect(migrated.career?.rankings[0]?.seasonPoints).toBe(0);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });

  it("loads legacy match records without a source as safe archive imports", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6807);
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const save = {
      version: 11,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 6807,
      tournament: null,
      liveMatch: null,
      career: {
        ...career,
        matchHistory: [
          {
            id: `${event.id}:legacy-R16-1`,
            eventId: event.id,
            eventName: event.name,
            date: event.startDate,
            round: "R16" as const,
            playerAId: seededPlayers[0].player.id,
            playerBId: seededPlayers[1].player.id,
            winnerId: seededPlayers[0].player.id,
            scoreline: "21-16, 21-18"
          }
        ]
      }
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.matchHistory[0]).toMatchObject({
      id: `${event.id}:legacy-R16-1`,
      source: "archive_import"
    });
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });
});
