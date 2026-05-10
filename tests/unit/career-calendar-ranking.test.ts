import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { addDays } from "../../game/career/calendar";
import {
  buildEventSeedingSnapshot,
  eventDeadlineMilestones,
  eventEligibilityFor,
  eventStatusFor,
  getCareerEvent
} from "../../game/career/events";
import { awardRankingPoints } from "../../game/career/rankings";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import { migratePersistedSave, persistedSavePayloadSchema, persistedSaveSchema } from "../../game/store/save";

describe("fictional career calendar and ranking model", () => {
  it("defines ordered fictional event operations metadata for every catalog event", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 6801);

    expect(career.events.length).toBeGreaterThan(0);
    expect(career.events.every((event) => event.location.venue.length > 0)).toBe(true);
    expect(career.events.every((event) => event.drawSize === 16)).toBe(true);
    expect(career.events.every((event) => event.seedCount === 8)).toBe(true);

    for (const event of career.events) {
      const milestones = eventDeadlineMilestones(event).map((entry) => entry.date);

      expect(event.weekNumber).toBeGreaterThan(0);
      expect(milestones).toEqual([...milestones].sort());
      expect(event.entryDeadline <= event.startDate).toBe(true);
      expect(event.drawDate <= event.startDate).toBe(true);
      expect(event.name).not.toMatch(/BWF|World Tour|Yonex|HSBC/i);
    }
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
      version: 8,
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 6806,
      tournament: null,
      liveMatch: null,
      career: oldCareer
    };

    const parsed = persistedSavePayloadSchema.parse(save);
    const migrated = migratePersistedSave(parsed);

    expect(migrated.career?.events[0]?.entryDeadline).toBe("2026-06-01");
    expect(migrated.career?.events[0]?.location.venue).toBe("Harborline Fieldhouse");
    expect(migrated.career?.rankings[0]?.seasonPoints).toBe(0);
    expect(persistedSaveSchema.parse(migrated)).toEqual(migrated);
  });
});
