import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { addDays } from "../../game/career/calendar";
import { chargeEventEntry } from "../../game/career/economy";
import { getCareerEvent } from "../../game/career/events";
import { effectiveEventEntryCosts } from "../../game/career/facilitiesMedia";
import type {
  CareerState,
  DevelopmentHistoryRecord,
  ScoutAssignment
} from "../../game/career/models";
import {
  groupManagerScheduleEntriesByDate,
  managerScheduleEntriesBetween,
  managerScheduleEntriesForCareer,
  managerScheduleMonthForCareer
} from "../../game/career/schedule";
import { createInitialCareerState } from "../../game/career/state";
import { trainingPlans } from "../../game/career/training";
import {
  createTournament,
  getManagedMatchContext,
  type TournamentState
} from "../../game/tournament/tournament";

function compositeScheduleState(seed = 9901): {
  career: CareerState;
  tournament: TournamentState;
  event: CareerState["events"][number];
} {
  const initial = createInitialCareerState(seededPlayers[0].player.id, seed);
  const event = getCareerEvent(initial.events, "metro-open-300")!;
  const date = addDays(event.startDate, -1);
  const plan = trainingPlans[0];
  const athlete = initial.athletes[0];
  const assignment: ScoutAssignment = {
    id: "assignment-composite",
    subjectId: initial.ecosystem.recruitment.candidates[0]!.id,
    subjectType: "candidate",
    assignedScoutId: "baseline-network",
    cost: 3_200,
    startedAt: initial.date,
    dueAt: date,
    status: "pending",
    scope: "fit"
  };
  const career: CareerState = {
    ...initial,
    date,
    activeEventId: event.id,
    enteredEventIds: [event.id],
    athletes: initial.athletes.map((entry) =>
      entry.playerId === athlete.playerId
        ? {
            ...entry,
            recoveryStatus: "injured",
            injury: {
              status: "managed",
              label: "Shoulder load",
              daysRemaining: 0,
              triggeredAt: initial.date,
              returnDate: date,
              notes: ["Medical team monitoring the return."]
            }
          }
        : entry
    ),
    preparationSchedule: [
      {
        id: "block-composite",
        athleteId: athlete.playerId,
        scheduledDate: date,
        scheduledOn: initial.date,
        source: "manager",
        rulesVersion: 1,
        planSnapshot: {
          ...plan,
          attributeDelta: { ...plan.attributeDelta }
        }
      }
    ],
    ecosystem: {
      ...initial.ecosystem,
      scouting: {
        ...initial.ecosystem.scouting,
        assignments: [assignment]
      }
    },
    facilities: initial.facilities.map((facility, index) =>
      index === 0
        ? {
            ...facility,
            level: 1,
            status: "building",
            buildCompleteDate: date
          }
        : facility
    )
  };
  const tournament = {
    ...createTournament(seededPlayers, career.program.managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier
  };

  return { career, tournament, event };
}

function reverseScheduleSources(career: CareerState): CareerState {
  return {
    ...career,
    athletes: [...career.athletes].reverse(),
    events: [...career.events].reverse(),
    enteredEventIds: [...career.enteredEventIds].reverse(),
    matchHistory: [...career.matchHistory].reverse(),
    preparationSchedule: [...career.preparationSchedule].reverse(),
    developmentHistory: [...career.developmentHistory].reverse(),
    facilities: [...career.facilities]
      .reverse()
      .map((facility) => ({ ...facility, history: [...facility.history].reverse() })),
    ecosystem: {
      ...career.ecosystem,
      scouting: {
        ...career.ecosystem.scouting,
        assignments: [...career.ecosystem.scouting.assignments].reverse()
      },
      recruitment: {
        ...career.ecosystem.recruitment,
        candidates: [...career.ecosystem.recruitment.candidates].reverse(),
        roster: [...career.ecosystem.recruitment.roster].reverse()
      },
      academy: {
        prospects: [...career.ecosystem.academy.prospects].reverse()
      }
    }
  };
}

describe("unified manager schedule", () => {
  it("aggregates every manager-facing category with semantic destinations and honest travel copy", () => {
    const { career, tournament } = compositeScheduleState();
    const entries = managerScheduleEntriesForCareer({ career, tournament });
    const today = entries.filter((entry) => entry.date === career.date);

    expect(new Set(entries.map((entry) => entry.category))).toEqual(
      new Set(["event", "medical", "travel", "training", "scouting", "facility"])
    );
    expect(today.map((entry) => entry.category)).toEqual([
      "event",
      "medical",
      "travel",
      "training",
      "scouting",
      "facility"
    ]);
    expect(today.every((entry) => entry.status === "due")).toBe(true);
    expect(entries.find((entry) => entry.category === "event" && entry.eventKind === "match")?.destination)
      .toEqual({ kind: "scheduled_match", eventId: "metro-open-300" });
    expect(entries.find((entry) => entry.category === "medical")?.destination)
      .toMatchObject({ kind: "training", athleteId: career.program.managedPlayerId });
    expect(entries.find((entry) => entry.category === "travel")).toMatchObject({
      destination: { kind: "tournament", seasonId: career.seasonId, eventId: "metro-open-300" },
      bookingState: "committed",
      detail: expect.stringMatching(/already committed.*no additional charge/i)
    });
    expect(entries.find((entry) => entry.category === "scouting")?.title).toContain("Arya Prakash");
  });

  it("uses confirmed event truth, hides speculative knockout rounds, and keeps match identity stable after completion", () => {
    const { career, tournament, event } = compositeScheduleState(9902);
    const confirmedEntries = managerScheduleEntriesForCareer({ career, tournament });
    const confirmedMatches = confirmedEntries.filter(
      (entry) => entry.category === "event" && entry.eventKind === "match" && entry.eventId === event.id
    );
    const context = getManagedMatchContext(tournament)!;
    const completedCareer: CareerState = {
      ...career,
      matchHistory: [
        {
          id: `${event.id}:${context.roundName}:managed`,
          eventId: event.id,
          eventName: event.name,
          date: addDays(event.startDate, 1),
          round: context.roundName,
          playerAId: context.playerAId,
          playerBId: context.playerBId,
          winnerId: career.program.managedPlayerId,
          scoreline: "21-16, 21-18",
          source: "played"
        }
      ]
    };
    const completedMatch = managerScheduleEntriesForCareer({
      career: completedCareer,
      tournament: null
    }).find(
      (entry) => entry.category === "event" && entry.eventKind === "match" && entry.eventId === event.id
    );

    const confirmedRounds = confirmedMatches.flatMap((entry) =>
      entry.category === "event" && entry.eventKind === "match" ? [entry.round] : []
    );

    expect(confirmedRounds).toEqual(["R16"]);
    expect(confirmedRounds.some((round) => ["QF", "SF", "F"].includes(round))).toBe(false);
    expect(completedMatch).toMatchObject({ status: "completed", result: "W" });
    expect(completedMatch?.id).toBe(confirmedMatches[0]?.id);
  });

  it("reports the persisted discounted travel charge instead of the catalog price", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 9907);
    const event = getCareerEvent(initial.events, "metro-open-300")!;
    const discountedFacilities = initial.facilities.map((facility, index) =>
      index === 0
        ? {
            ...facility,
            modifiers: {
              ...facility.modifiers,
              travelCostReduction: 0.2
            }
          }
        : facility
    );
    const discountedCosts = effectiveEventEntryCosts(event, discountedFacilities);
    const economy = chargeEventEntry({
      economy: initial.economy,
      date: initial.date,
      label: event.name,
      travelCost: discountedCosts.travelCost,
      entryFee: discountedCosts.entryFee
    });
    const career: CareerState = {
      ...initial,
      enteredEventIds: [event.id],
      economy
    };
    const travel = managerScheduleEntriesForCareer({ career, tournament: null }).find(
      (entry) => entry.category === "travel" && entry.eventId === event.id
    );

    expect(discountedCosts.travelCost).toBeLessThan(event.travelCost);
    expect(travel).toMatchObject({ travelCostCommitted: discountedCosts.travelCost });
  });

  it("is byte-deterministic under source reversal and uses code-unit ordering for final ties", () => {
    const { career, tournament } = compositeScheduleState(9903);
    const assignment = career.ecosystem.scouting.assignments[0]!;
    const withTieIds: CareerState = {
      ...career,
      ecosystem: {
        ...career.ecosystem,
        scouting: {
          ...career.ecosystem.scouting,
          assignments: [
            { ...assignment, id: "a" },
            { ...assignment, id: "Z" }
          ]
        }
      }
    };
    const forward = managerScheduleEntriesForCareer({ career: withTieIds, tournament });
    const reversed = managerScheduleEntriesForCareer({
      career: reverseScheduleSources(withTieIds),
      tournament
    });
    const scoutIds = forward
      .filter((entry) => entry.category === "scouting" && entry.date === career.date)
      .map((entry) => entry.id);

    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
    expect(scoutIds).toEqual(["scouting:Z:due", "scouting:a:due"]);
  });

  it("deduplicates canonical ids and lets terminal truth replace stale pending truth", () => {
    const { career, tournament } = compositeScheduleState(9904);
    const athlete = career.athletes[0]!;
    const block = career.preparationSchedule[0]!;
    const facility = career.facilities[0]!;
    const assignment = career.ecosystem.scouting.assignments[0]!;
    const blockedRecord: DevelopmentHistoryRecord = {
      kind: "preparation",
      id: `development:${block.id}:resolution`,
      athleteId: block.athleteId,
      date: block.scheduledDate,
      blockId: block.id,
      outcome: "blocked",
      planId: block.planSnapshot.id,
      planLabel: block.planSnapshot.label,
      focus: block.planSnapshot.focus,
      intensity: block.planSnapshot.intensity,
      rulesVersion: 1,
      cost: 0,
      modifierSourceIds: [],
      snapshot: {
        development: { ...athlete.development },
        fatigue: athlete.fatigue,
        injuryRisk: athlete.injuryRisk,
        readiness: athlete.readiness,
        recoveryStatus: athlete.recoveryStatus,
        injuryStatus: athlete.injury.status
      },
      reason: "Medical gate blocked the session."
    };
    const inconsistentCareer: CareerState = {
      ...career,
      developmentHistory: [...career.developmentHistory, blockedRecord],
      ecosystem: {
        ...career.ecosystem,
        scouting: {
          ...career.ecosystem.scouting,
          assignments: [assignment, { ...assignment, status: "ready" }]
        }
      },
      facilities: career.facilities.map((entry) =>
        entry.id === facility.id
          ? {
              ...entry,
              history: [
                {
                  id: `${entry.id}-${career.date}-complete-${entry.level}`,
                  date: career.date,
                  level: entry.level,
                  cost: 0,
                  note: `${entry.label} construction complete`
                },
                ...entry.history
              ]
            }
          : entry
      )
    };
    const entries = managerScheduleEntriesForCareer({ career: inconsistentCareer, tournament });

    expect(entries.filter((entry) => entry.id === `training:${block.id}`)).toEqual([
      expect.objectContaining({ status: "blocked", outcome: "blocked" })
    ]);
    expect(entries.filter((entry) => entry.id === `scouting:${assignment.id}:due`)).toEqual([
      expect.objectContaining({ status: "completed", assignmentStatus: "ready" })
    ]);
    expect(entries.filter((entry) => entry.id === `facility:${facility.id}:level:${facility.level}:complete`)).toEqual([
      expect.objectContaining({ status: "completed", source: "history" })
    ]);
  });

  it("uses inclusive start and exclusive end boundaries and returns sorted groups and month metadata", () => {
    const fixture = compositeScheduleState(9905);
    const assignment = fixture.career.ecosystem.scouting.assignments[0]!;
    const career: CareerState = {
      ...fixture.career,
      ecosystem: {
        ...fixture.career.ecosystem,
        scouting: {
          ...fixture.career.ecosystem.scouting,
          assignments: [{ ...assignment, dueAt: "2026-06-04" }]
        }
      }
    };
    const ranged = managerScheduleEntriesBetween({
      career,
      tournament: fixture.tournament,
      startDate: "2026-06-02",
      endDateExclusive: "2026-06-04"
    });
    const groups = groupManagerScheduleEntriesByDate([...ranged].reverse());
    const month = managerScheduleMonthForCareer({
      career,
      tournament: fixture.tournament,
      monthCursor: "2026-06-18"
    });

    expect(ranged.some((entry) => entry.category === "travel" && entry.date === "2026-06-02")).toBe(true);
    expect(ranged.some((entry) => entry.date === "2026-06-04")).toBe(false);
    expect(groups.map((group) => group.date)).toEqual([...groups.map((group) => group.date)].sort());
    expect(groups.flatMap((group) => group.entries)).toEqual(ranged);
    expect(month).toMatchObject({
      cursor: "2026-06-01",
      label: "June 2026",
      visibleRange: { startDate: "2026-06-01", endDateExclusive: "2026-07-01" }
    });
    expect(month.entries.every((entry) => entry.date >= "2026-06-01" && entry.date < "2026-07-01"))
      .toBe(true);
  });

  it("does not mutate career or tournament inputs", () => {
    const { career, tournament } = compositeScheduleState(9906);
    const careerBefore = structuredClone(career);
    const tournamentBefore = structuredClone(tournament);

    managerScheduleEntriesForCareer({ career, tournament });

    expect(career).toEqual(careerBefore);
    expect(tournament).toEqual(tournamentBefore);
  });
});
