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
import { awardRankingPoints, rankingsByCurrentRank } from "../../game/career/rankings";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
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

describe("fictional career calendar and ranking model", () => {
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

  it("updates total circuit points, season race points, and ranking history deterministically", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6804);
    const event = getCareerEvent(career.events, "harbor-masters-500")!;
    const before = career.rankings.find((entry) => entry.playerId === career.program.managedPlayerId)!;
    const updated = awardRankingPoints({
      rankings: career.rankings,
      playerId: career.program.managedPlayerId,
      eventId: event.id,
      round: "SF",
      points: event.rankingPoints.SF,
      date: event.startDate,
      seasonId: career.seasonId,
      tier: event.tier
    });
    const after = updated.find((entry) => entry.playerId === career.program.managedPlayerId)!;

    expect(after.points).toBe(before.points + event.rankingPoints.SF);
    expect(after.seasonPoints).toBe(before.seasonPoints + event.rankingPoints.SF);
    expect(after.eventHistory.at(-1)).toEqual({
      eventId: event.id,
      round: "SF",
      points: event.rankingPoints.SF,
      date: event.startDate,
      seasonId: career.seasonId,
      tier: event.tier
    });
    expect(awardRankingPoints({
      rankings: career.rankings,
      playerId: career.program.managedPlayerId,
      eventId: event.id,
      round: "SF",
      points: event.rankingPoints.SF,
      date: event.startDate,
      seasonId: career.seasonId,
      tier: event.tier
    })).toEqual(updated);
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
    expect(snapshot.managedSeed?.playerId).toBe(career.program.managedPlayerId);
  });

  it("hydrates older current saves that predate event operations fields and season race points", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6806);
    const oldCareer = {
      ...career,
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
      version: 9,
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
      version: 9,
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
