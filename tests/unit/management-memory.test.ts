import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { addDays } from "../../game/career/calendar";
import { resolveCareerDay } from "../../game/career/dayResolution";
import {
  commissionScoutReport,
  expireScoutReports,
  makeRecruitmentOffer,
  resolveDueScoutReports
} from "../../game/career/ecosystem";
import {
  careerArchiveReports,
  careerInboxItems
} from "../../game/career/managementMemory";
import type { CareerState, PostMatchReport } from "../../game/career/models";
import { scheduleRosterPreparation } from "../../game/career/program";
import { createInitialCareerState } from "../../game/career/state";

const RECRUIT_ID = "cand-arya-prakash";

function careerWithAcceptedRotationRecruit(seed: number) {
  const initial = createInitialCareerState(seededPlayers[0].player.id, seed);
  const assigned = commissionScoutReport(initial, RECRUIT_ID, "candidate");
  const assignment = assigned.ecosystem.scouting.assignments.find(
    (entry) => entry.subjectId === RECRUIT_ID
  );

  if (!assignment) {
    throw new Error("Expected the recruitment scout assignment to be commissioned.");
  }

  const reported = resolveDueScoutReports({ ...assigned, date: assignment.dueAt });
  const signed = makeRecruitmentOffer(reported, RECRUIT_ID);
  const accepted = signed.ecosystem.recruitment.candidates.find(
    (candidate) => candidate.id === RECRUIT_ID
  )?.offerState;

  if (accepted !== "accepted") {
    throw new Error("Expected the fully scouted rotation recruit to accept the offer.");
  }

  return signed;
}

function savedPostMatchReport(args: {
  eventId: string;
  matchId: string;
  opponentId: string;
  evidence?: string[];
}): PostMatchReport {
  return {
    eventId: args.eventId,
    matchId: args.matchId,
    opponentId: args.opponentId,
    result: "win",
    scoreline: "21-18, 21-16",
    round: "R16",
    pointsDelta: 0,
    cashDelta: 0,
    fatigueDelta: 7,
    evidence: args.evidence ?? ["Latest detailed evidence"],
    recommendations: ["Keep the next preparation block controlled."],
    tacticalViewer: null
  };
}

function matchHistoryFixture(state: CareerState) {
  const event = state.events[0]!;
  const managedPlayerId = state.program.managedPlayerId;
  const opponentId = seededPlayers[1].player.id;
  const unrelatedAId = seededPlayers[2].player.id;
  const unrelatedBId = seededPlayers[3].player.id;

  return {
    event,
    managedPlayerId,
    opponentId,
    managed: {
      id: `${event.id}:managed-r16`,
      seasonId: state.seasonId,
      eventId: event.id,
      eventName: event.name,
      date: state.date,
      round: "R16" as const,
      playerAId: managedPlayerId,
      playerBId: opponentId,
      winnerId: managedPlayerId,
      scoreline: "21-18, 21-16",
      source: "played" as const
    },
    unrelated: {
      id: `${event.id}:background-r16`,
      seasonId: state.seasonId,
      eventId: event.id,
      eventName: event.name,
      date: state.date,
      round: "R16" as const,
      playerAId: unrelatedAId,
      playerBId: unrelatedBId,
      winnerId: unrelatedAId,
      scoreline: "21-12, 21-14",
      source: "quick_sim" as const
    }
  };
}

describe("management memory read models", () => {
  it("projects stable deterministic Inbox IDs and ordering independent of source-array order", () => {
    const signed = careerWithAcceptedRotationRecruit(9961);
    const event = signed.events[0]!;
    const opponentId = seededPlayers[1].player.id;
    const career: CareerState = {
      ...signed,
      stage: "post_match",
      lastMatchReport: savedPostMatchReport({
        eventId: event.id,
        matchId: "managed-r16",
        opponentId
      }),
      athletes: signed.athletes.map((athlete) =>
        athlete.playerId === signed.program.managedPlayerId
          ? { ...athlete, fatigue: 70, recoveryStatus: "loaded" as const }
          : athlete
      ),
      facilities: signed.facilities.map((facility, index) =>
        index === 0
          ? {
              ...facility,
              level: 1,
              status: "building" as const,
              buildCompleteDate: addDays(signed.date, 2)
            }
          : facility
      )
    };
    const reversed: CareerState = {
      ...career,
      athletes: [...career.athletes].reverse(),
      facilities: [...career.facilities].reverse(),
      ecosystem: {
        ...career.ecosystem,
        recruitment: {
          ...career.ecosystem.recruitment,
          roster: [...career.ecosystem.recruitment.roster].reverse()
        },
        scouting: {
          ...career.ecosystem.scouting,
          assignments: [...career.ecosystem.scouting.assignments].reverse()
        },
        promises: [...career.ecosystem.promises].reverse()
      }
    };

    const first = careerInboxItems(career);
    const replay = careerInboxItems(career);
    const reordered = careerInboxItems(reversed);

    expect(replay).toEqual(first);
    expect(reordered).toEqual(first);
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
    expect(first[0]).toMatchObject({
      id: "inbox:match-review:managed-r16",
      priority: "required",
      destination: { kind: "review" }
    });
    expect(first.map((item) => item.priority)).toEqual(
      [...first]
        .sort((left, right) => {
          const priority = { required: 0, urgent: 1, scheduled: 2, information: 3 } as const;
          return priority[left.priority] - priority[right.priority] ||
            left.date.localeCompare(right.date) ||
            left.id.localeCompare(right.id);
        })
        .map((item) => item.priority)
    );
  });

  it("changes an unscheduled recruit task to scheduled, then replaces it after day resolution", () => {
    const signed = careerWithAcceptedRotationRecruit(9962);
    const unscheduled = careerInboxItems(signed).find(
      (item) => item.id.includes(RECRUIT_ID) && item.id.endsWith(":unscheduled")
    );

    expect(unscheduled).toMatchObject({ priority: "urgent", destination: { kind: "program" } });

    const scheduledCareer = scheduleRosterPreparation({ state: signed, athleteId: RECRUIT_ID });
    const scheduled = careerInboxItems(scheduledCareer).find(
      (item) => item.id.includes(RECRUIT_ID) && item.id.endsWith(":scheduled")
    );

    expect(scheduled).toMatchObject({ priority: "scheduled", destination: { kind: "program" } });
    expect(careerInboxItems(scheduledCareer).some((item) => item.id === unscheduled?.id)).toBe(false);

    const block = scheduledCareer.preparationSchedule.find((entry) => entry.athleteId === RECRUIT_ID)!;
    const resolved = resolveCareerDay({ career: scheduledCareer, tournament: null });
    const afterResolution = careerInboxItems(resolved);
    const resolutionRecord = resolved.developmentHistory.find(
      (record) => record.kind === "preparation" && record.blockId === block.id
    );

    expect(afterResolution.some((item) => item.id === scheduled?.id)).toBe(false);
    expect(afterResolution).toContainEqual(
      expect.objectContaining({
        id: `program-task:${resolved.date}:${RECRUIT_ID}:unscheduled`,
        priority: "urgent"
      })
    );
    expect(resolutionRecord).toBeDefined();
    expect(careerArchiveReports(resolved)).toContainEqual(
      expect.objectContaining({
        id: `report:development:${resolutionRecord?.id}`,
        category: "development"
      })
    );
  });

  it("includes only managed matches in Reports", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 9963);
    const fixtures = matchHistoryFixture(initial);
    const career: CareerState = {
      ...initial,
      matchHistory: [fixtures.unrelated, fixtures.managed]
    };

    const matchReports = careerArchiveReports(career).filter((report) => report.category === "match");

    expect(matchReports).toHaveLength(1);
    expect(matchReports[0]).toMatchObject({
      id: `report:match:${fixtures.managed.id}`,
      destination: {
        kind: "tournament",
        seasonId: initial.seasonId,
        eventId: fixtures.event.id
      }
    });
    expect(matchReports.some((report) => report.id.includes(fixtures.unrelated.id))).toBe(false);
  });

  it("keeps expired scout reports readable", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 9964);
    const assigned = commissionScoutReport(initial, RECRUIT_ID, "candidate");
    const assignment = assigned.ecosystem.scouting.assignments.find(
      (entry) => entry.subjectId === RECRUIT_ID
    )!;
    const reported = resolveDueScoutReports({ ...assigned, date: assignment.dueAt });
    const liveReport = reported.ecosystem.scouting.reports.find(
      (report) => report.subjectId === RECRUIT_ID
    )!;
    const expired = expireScoutReports({ ...reported, date: addDays(liveReport.expiresAt, 1) });
    const archived = careerArchiveReports(expired).find(
      (report) => report.id === `report:scouting:${liveReport.id}`
    );

    expect(expired.ecosystem.scouting.reports.find((report) => report.id === liveReport.id)?.state).toBe("expired");
    expect(archived).toMatchObject({
      category: "scouting",
      detail: expect.stringContaining("expired"),
      destination: { kind: "scouting" }
    });
    expect(archived?.evidence).toContain(`Expires ${liveReport.expiresAt}`);
  });

  it("builds Reports from durable match history without a lastMatchReport", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 9965);
    const fixtures = matchHistoryFixture(initial);
    const career: CareerState = {
      ...initial,
      lastMatchReport: null,
      matchHistory: [fixtures.managed]
    };

    const archived = careerArchiveReports(career);

    expect(career.lastMatchReport).toBeNull();
    expect(archived).toContainEqual(
      expect.objectContaining({
        id: `report:match:${fixtures.managed.id}`,
        category: "match",
        detail: expect.stringContaining(fixtures.managed.scoreline)
      })
    );
  });

  it("does not copy the latest detailed evidence onto older match rows", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 9966);
    const fixtures = matchHistoryFixture(initial);
    const olderMatch = {
      ...fixtures.managed,
      id: `${fixtures.event.id}:managed-older`,
      date: addDays(initial.date, -1),
      scoreline: "19-21, 21-17, 18-21"
    };
    const uniqueLatestEvidence = "Latest-only rear-court pressure trace";
    const career: CareerState = {
      ...initial,
      matchHistory: [olderMatch, fixtures.managed],
      lastMatchReport: savedPostMatchReport({
        eventId: fixtures.event.id,
        matchId: "managed-r16",
        opponentId: fixtures.opponentId,
        evidence: [uniqueLatestEvidence]
      })
    };

    const archivedOlderMatch = careerArchiveReports(career).find(
      (report) => report.id === `report:match:${olderMatch.id}`
    );

    expect(archivedOlderMatch).toBeDefined();
    expect(archivedOlderMatch?.evidence).not.toContain(uniqueLatestEvidence);
  });
});
