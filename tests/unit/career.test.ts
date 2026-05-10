import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { tacticLibrary } from "../../game/content/tactics";
import { advanceCareerCalendar, addDays } from "../../game/career/calendar";
import { canAffordEventEntry, chargeEventEntry, eventEntryCost } from "../../game/career/economy";
import {
  commissionScoutReport,
  developYouthProspect,
  enterRosterAthleteLowerEvent,
  enterYouthLowerEvent,
  expireScoutReports,
  hireStaffMember,
  makeRecruitmentOffer,
  resolveDueScoutReports,
  resolvePromises,
  setManagedAthletePromise,
  staffModifiers,
  trainRosterAthlete,
  withdrawPromise
} from "../../game/career/ecosystem";
import { getCareerEvent } from "../../game/career/events";
import { settleCareerMatch } from "../../game/career/hubs";
import { advanceRivalCircuit } from "../../game/career/rivals";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import { applyTrainingPlan, trainingPlans } from "../../game/career/training";
import { simulateMatch } from "../../game/core/match";
import { createManagedMatchInput, createTournament } from "../../game/tournament/tournament";

describe("career core slice", () => {
  it("applies training with development, readiness, fatigue, injury risk, and cashflow trade-offs", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 7001);
    const athlete = managedAthlete(career);
    const plan = trainingPlans.find((entry) => entry.id === "rear-court-power")!;

    const result = applyTrainingPlan({
      athlete,
      economy: career.economy,
      plan,
      date: career.date
    });

    expect(result.athlete.development.smash).toBeGreaterThan(athlete.development.smash);
    expect(result.athlete.fatigue).toBeGreaterThan(athlete.fatigue);
    expect(result.athlete.injuryRisk).toBeGreaterThan(athlete.injuryRisk);
    expect(result.athlete.readiness).toBeLessThan(athlete.readiness);
    expect(result.economy.cash).toBe(career.economy.cash - plan.cost);
    expect(result.economy.trainingSpend).toBe(plan.cost);
  });

  it("recovers passively while advancing the calendar into a pre-match event day", () => {
    const career = {
      ...createInitialCareerState(seededPlayers[0].player.id, 7002),
      activeEventId: "metro-open-300",
      enteredEventIds: ["metro-open-300"],
      stage: "event_entered" as const
    };
    const dayTwo = advanceCareerCalendar(career);
    const eventDay = advanceCareerCalendar(dayTwo);

    expect(dayTwo.date).toBe("2026-06-02");
    expect(eventDay.date).toBe("2026-06-03");
    expect(eventDay.stage).toBe("pre_match");
    expect(managedAthlete(eventDay).fatigue).toBeLessThan(managedAthlete(career).fatigue);
  });

  it("reconciles event entry, prize money, ranking points, and post-match readiness", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 7003);
    const event = getCareerEvent(initial.events, "metro-open-300")!;
    const economy = chargeEventEntry({
      economy: initial.economy,
      date: initial.date,
      label: event.name,
      travelCost: event.travelCost,
      entryFee: event.entryFee
    });
    const career = {
      ...initial,
      date: event.startDate,
      economy,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "pre_match" as const
    };
    const tournament = {
      ...createTournament(seededPlayers, career.program.managedPlayerId, 7003),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const prepared = createManagedMatchInput({
      tournament,
      playerMap: Object.fromEntries(seededPlayers.map((entry) => [entry.player.id, entry.player])),
      tacticA: tacticLibrary.balancedControl
    })!;
    const result = simulateMatch(prepared.input);
    const managedSide = prepared.context.playerAId === career.program.managedPlayerId ? "A" : "B";
    const opponentId = managedSide === "A" ? prepared.context.playerBId : prepared.context.playerAId;
    const settled = settleCareerMatch({
      state: career,
      matchId: prepared.context.matchId,
      opponentId,
      managedSide,
      managedRunMatch: {
        round: prepared.context.roundName,
        opponentId,
        opponentName: "Opponent",
        scoreline: result.scoreline,
        won: result.winner === managedSide,
        stats: {
          winners: managedSide === "A" ? result.stats.winnersA : result.stats.winnersB,
          unforcedErrors:
            managedSide === "A" ? result.stats.unforcedErrorsA : result.stats.unforcedErrorsB,
          totalSmashes: managedSide === "A" ? result.stats.totalSmashesA : result.stats.totalSmashesB,
          peakSmashSpeed:
            managedSide === "A" ? result.stats.peakSmashSpeedA : result.stats.peakSmashSpeedB,
          longestRally: result.stats.longestRally,
          totalPoints: result.stats.totalPoints,
          staminaDrain: managedSide === "A" ? result.stats.staminaDrainA : result.stats.staminaDrainB
        }
      },
      result
    });

    expect(settled.stage).toBe("post_match");
    expect(settled.lastMatchReport?.pointsDelta).toBeGreaterThan(0);
    expect(settled.lastMatchReport?.cashDelta).toBeGreaterThan(0);
    expect(managedAthlete(settled).rankingPoints).toBeGreaterThan(managedAthlete(initial).rankingPoints);
    expect(settled.economy.prizeIncome).toBeGreaterThan(0);
    expect(settled.economy.cash).toBeGreaterThan(career.economy.cash);
    expect(managedAthlete(settled).fatigue).toBeGreaterThan(managedAthlete(career).fatigue);
  });

  it("blocks event entry charges when program cash cannot cover travel and entry", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 7004);
    const event = getCareerEvent(initial.events, "summit-invitational-750")!;
    const entryCost = eventEntryCost({
      travelCost: event.travelCost,
      entryFee: event.entryFee
    });
    const lowCashEconomy = {
      ...initial.economy,
      cash: entryCost - 1
    };

    expect(canAffordEventEntry({
      economy: lowCashEconomy,
      travelCost: event.travelCost,
      entryFee: event.entryFee
    })).toBe(false);

    const charged = chargeEventEntry({
      economy: lowCashEconomy,
      date: initial.date,
      label: event.name,
      travelCost: event.travelCost,
      entryFee: event.entryFee
    });

    expect(charged.cash).toBe(lowCashEconomy.cash);
    expect(charged.travelSpend).toBe(lowCashEconomy.travelSpend);
    expect(charged.ledger).toHaveLength(lowCashEconomy.ledger.length);
  });
});

describe("program ecosystem depth", () => {
  it("uses scout capacity, cost, confidence, and verified fields before recruitment", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 8101);
    const withScout = hireStaffMember(initial, "staff-scout-okafor");
    const assigned = commissionScoutReport(withScout, "cand-arya-prakash", "candidate");

    expect(assigned.economy.cash).toBe(withScout.economy.cash - 3200);
    expect(assigned.ecosystem.scouting.assignments[0]?.status).toBe("pending");
    expect(staffModifiers(assigned.ecosystem).scoutCapacity).toBe(3);

    const resolved = resolveDueScoutReports({
      ...assigned,
      date: assigned.ecosystem.scouting.assignments[0]!.dueAt
    });
    const report = resolved.ecosystem.scouting.reports[0]!;
    const candidate = resolved.ecosystem.recruitment.candidates.find((entry) => entry.id === "cand-arya-prakash")!;

    expect(report.confidence).toBeGreaterThanOrEqual(80);
    expect(report.verifiedFields.cost).toContain("$");
    expect(candidate.knowledge.cost).toBe("verified");
    expect(candidate.risk).toBeLessThan(42);
  });

  it("expires scout reports through domain behavior and stales verified recruitment fields", () => {
    const resolved = resolveDueScoutReports({
      ...commissionScoutReport(createInitialCareerState(seededPlayers[0].player.id, 8111), "cand-arya-prakash", "candidate"),
      date: "2026-06-03"
    });

    expect(resolved.ecosystem.scouting.reports[0]?.state).toBe("verified");
    expect(resolved.ecosystem.recruitment.candidates.find((entry) => entry.id === "cand-arya-prakash")?.knowledge.cost).toBe("verified");

    const expired = expireScoutReports({ ...resolved, date: "2026-06-25" });

    expect(expired.ecosystem.scouting.reports[0]?.state).toBe("expired");
    expect(expired.ecosystem.recruitment.candidates.find((entry) => entry.id === "cand-arya-prakash")?.knowledge.cost).toBe("estimated");
    expect(expired.ecosystem.programLog[0]?.message).toContain("expired");
  });

  it("reconciles recruitment offers with roster, budget, and signing promises", () => {
    const withReport = resolveDueScoutReports({
      ...commissionScoutReport(createInitialCareerState(seededPlayers[0].player.id, 8102), "cand-arya-prakash", "candidate"),
      date: "2026-06-03"
    });
    const signed = makeRecruitmentOffer(withReport, "cand-arya-prakash");

    expect(signed.ecosystem.recruitment.roster.some((slot) => slot.athleteId === "cand-arya-prakash")).toBe(true);
    expect(signed.athletes.some((athlete) => athlete.playerId === "cand-arya-prakash")).toBe(true);
    expect(signed.ecosystem.recruitment.candidates.find((entry) => entry.id === "cand-arya-prakash")?.offerState).toBe("accepted");
    expect(signed.economy.cash).toBeLessThan(withReport.economy.cash);
    expect(signed.ecosystem.promises.some((promise) => promise.athleteId === "cand-arya-prakash")).toBe(true);
  });

  it("gives accepted recruits functional training and lower-event paths", () => {
    const signed = makeRecruitmentOffer(
      resolveDueScoutReports({
        ...commissionScoutReport(createInitialCareerState(seededPlayers[0].player.id, 8112), "cand-arya-prakash", "candidate"),
        date: "2026-06-03"
      }),
      "cand-arya-prakash"
    );
    const signedAthlete = signed.athletes.find((athlete) => athlete.playerId === "cand-arya-prakash")!;
    const trained = trainRosterAthlete(signed, "cand-arya-prakash");
    const trainedAthlete = trained.athletes.find((athlete) => athlete.playerId === "cand-arya-prakash")!;
    const entered = enterRosterAthleteLowerEvent(trained, "cand-arya-prakash");

    expect(trainedAthlete.development.stamina).toBeGreaterThan(signedAthlete.development.stamina);
    expect(trained.economy.cash).toBeLessThan(signed.economy.cash);
    expect(entered.ecosystem.lowerEventEntries[0]?.subjectId).toBe("cand-arya-prakash");
    expect(entered.ecosystem.lowerEventEntries[0]?.subjectType).toBe("roster_athlete");
    expect(entered.ecosystem.lowerEventEntries[0]?.resultRound).toMatch(/R16|QF|SF|champion/);
  });

  it("develops a 16-year-old prospect into lower-event eligibility with staff modifiers", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 8103);
    const withCoach = hireStaffMember(initial, "staff-assistant-ruiz");
    const developed = developYouthProspect(developYouthProspect(withCoach, "prospect-mei-sato"), "prospect-mei-sato");
    const prospect = developed.ecosystem.academy.prospects[0]!;

    expect(prospect.age).toBe(16);
    expect(prospect.readiness).toBeGreaterThan(initial.ecosystem.academy.prospects[0]!.readiness);
    expect(prospect.mentorOrStaffModifier).toBeGreaterThan(0);
    expect(prospect.lowerEventEligibility).toBe(true);
  });

  it("records a real youth lower-tier event entry after eligibility", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 8113);
    const withCoach = hireStaffMember(initial, "staff-assistant-ruiz");
    const eligible = developYouthProspect(developYouthProspect(withCoach, "prospect-mei-sato"), "prospect-mei-sato");
    const entered = enterYouthLowerEvent(eligible, "prospect-mei-sato");

    expect(entered.ecosystem.lowerEventEntries[0]).toMatchObject({
      subjectId: "prospect-mei-sato",
      subjectType: "youth_prospect",
      eventName: "National Junior Futures",
      status: "completed"
    });
    expect(entered.economy.cash).toBe(eligible.economy.cash - 900);
    expect(entered.ecosystem.programLog[0]?.message).toContain("Mei Sato entered");
  });

  it("does not let the managed athlete's match result satisfy a recruited athlete promise", () => {
    const signed = makeRecruitmentOffer(
      resolveDueScoutReports({
        ...commissionScoutReport(createInitialCareerState(seededPlayers[0].player.id, 8114), "cand-arya-prakash", "candidate"),
        date: "2026-06-03"
      }),
      "cand-arya-prakash"
    );
    const recruitPromise = signed.ecosystem.promises.find((promise) => promise.athleteId === "cand-arya-prakash")!;
    const wrongOwnerReport = resolvePromises({
      ...signed,
      lastMatchReport: {
        eventId: "metro-open-300",
        matchId: "managed-qf",
        opponentId: "opponent",
        result: "win",
        scoreline: "21-12 21-14",
        round: "QF",
        pointsDelta: 210,
        cashDelta: 1800,
        fatigueDelta: 9,
        evidence: [],
        recommendations: []
      }
    });

    expect(wrongOwnerReport.ecosystem.promises.find((promise) => promise.id === recruitPromise.id)?.status).toBe("active");

    const ownEntry = resolvePromises(enterRosterAthleteLowerEvent(wrongOwnerReport, "cand-arya-prakash"));

    expect(ownEntry.ecosystem.promises.find((promise) => promise.id === recruitPromise.id)?.status).toBe("kept");
  });

  it("tracks kept, missed, and withdrawn promise consequences against psychology", () => {
    const promised = setManagedAthletePromise(createInitialCareerState(seededPlayers[0].player.id, 8104), "improve_stamina");
    const kept = resolvePromises({
      ...promised,
      athletes: promised.athletes.map((athlete) => ({
        ...athlete,
        development: {
          ...athlete.development,
          stamina: 76
        }
      }))
    });

    expect(kept.ecosystem.promises[0]?.status).toBe("kept");
    expect(kept.ecosystem.psychology[0]?.confidence).toBeGreaterThan(promised.ecosystem.psychology[0]!.confidence);

    const missedBase = setManagedAthletePromise(createInitialCareerState(seededPlayers[0].player.id, 8105), "beat_top8");
    const missed = resolvePromises({ ...missedBase, date: "2026-07-20" });

    expect(missed.ecosystem.promises[0]?.status).toBe("missed");
    expect(missed.ecosystem.psychology[0]?.morale).toBeLessThan(missedBase.ecosystem.psychology[0]!.morale);

    const withdrawnBase = setManagedAthletePromise(createInitialCareerState(seededPlayers[0].player.id, 8106), "lower_event_entry");
    const withdrawn = withdrawPromise(withdrawnBase, withdrawnBase.ecosystem.promises[0]!.id);

    expect(withdrawn.ecosystem.promises[0]?.status).toBe("withdrawn");
    expect(withdrawn.ecosystem.psychology[0]?.recentDrivers[0]).toContain("withdrawn");
  });
});

describe("dynamic rival ecosystem", () => {
  it("seeds persistent rival programs with ranked rosters and pressure metadata", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8201);

    expect(career.version).toBe(3);
    expect(career.rivals.programs).toHaveLength(4);
    expect(career.rivals.programs[0]?.ageCurve).toMatchObject({ peakAge: 26, declineRate: 0.09 });
    expect(career.rivals.programs[0]?.roster[0]?.currentRank).toBeGreaterThan(0);
    expect(career.rivals.programs.every((program) => program.pressureScore > 0)).toBe(true);
    expect(career.rivals.circuitLog.some((entry) => entry.type === "form")).toBe(true);
  });

  it("trains rivals, records selections, and creates visible event field pressure", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8202);
    const advanced = advanceRivalCircuit(career);
    const firstProgramBefore = career.rivals.programs[0]!;
    const firstProgramAfter = advanced.rivals.programs[0]!;

    expect(firstProgramAfter.roster[0]!.rating).toBeGreaterThan(firstProgramBefore.roster[0]!.rating);
    expect(firstProgramAfter.roster[0]!.fatigue).toBeGreaterThan(firstProgramBefore.roster[0]!.fatigue);
    expect(advanced.rivals.programs.some((program) => program.eventEntries.some((entry) => entry.status === "entered"))).toBe(true);
    expect(advanced.rivals.fieldPressure.length).toBeGreaterThan(0);
    expect(advanced.rivals.circuitLog.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(["training", "selection"])
    );
    expect(advanced.notes[0]).toMatch(/Rival pressure|Rival circuit trained/);
  });

  it("does not replay rival training or results for an already simulated calendar date", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8206);
    const once = advanceRivalCircuit(career);
    const twice = advanceRivalCircuit(once);

    expect(once.rivals.lastSimulatedDate).toBe(once.date);
    expect(twice).toBe(once);
    expect(twice.rivals.programs[0]!.roster[0]!.rating).toBe(once.rivals.programs[0]!.roster[0]!.rating);
    expect(twice.rivals.programs[0]!.roster[0]!.fatigue).toBe(once.rivals.programs[0]!.roster[0]!.fatigue);
    expect(twice.rivals.circuitLog).toHaveLength(once.rivals.circuitLog.length);
    expect(twice.rankings).toEqual(once.rankings);
  });

  it("settles rival event results into rankings during deterministic batch simulation", () => {
    let career = createInitialCareerState(seededPlayers[0].player.id, 8203);
    const startingRankings = career.rankings;

    for (let day = 0; day < 14; day += 1) {
      career = advanceRivalCircuit(career);
      career = advanceCareerCalendar(career);
    }

    const completedEntries = career.rivals.programs.flatMap((program) =>
      program.eventEntries.filter((entry) => entry.status === "completed")
    );
    const completedProgram = career.rivals.programs.find((program) =>
      program.eventEntries.some((entry) => entry.status === "completed")
    )!;
    const completedLeadId = completedProgram.roster[0]!.playerId;
    const startingRanking = startingRankings.find((entry) => entry.playerId === completedLeadId)!;
    const settledRanking = career.rankings.find((entry) => entry.playerId === completedLeadId)!;

    expect(completedEntries.length).toBeGreaterThan(0);
    expect(completedEntries.some((entry) => entry.pointsAwarded > 0 && entry.resultRound)).toBe(true);
    expect(settledRanking.points).toBeGreaterThan(startingRanking.points);
    expect(settledRanking.eventHistory.length).toBeGreaterThan(startingRanking.eventHistory.length);
    expect(career.rivals.circuitLog.some((entry) => entry.type === "event_result")).toBe(true);
  });

  it("records age-curve decline when an older rival cannot offset training load", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8204);
    const aged = {
      ...career,
      rivals: {
        ...career.rivals,
        programs: career.rivals.programs.map((program, programIndex) =>
          programIndex === 0
            ? {
                ...program,
                ageCurve: { peakAge: 26, declineRate: 0.45 },
                roster: program.roster.map((athlete, athleteIndex) =>
                  athleteIndex === 0
                    ? { ...athlete, age: 35, rating: 78, form: 70, fatigue: 24 }
                    : athlete
                )
              }
            : program
        )
      }
    };
    const advanced = advanceRivalCircuit(aged);
    const declinedAthlete = advanced.rivals.programs[0]!.roster[0]!;

    expect(declinedAthlete.rating).toBeLessThan(78);
    expect(declinedAthlete.trend).toBe("sliding");
    expect(advanced.rivals.programs[0]!.progressionLog.some((entry) => entry.type === "decline")).toBe(true);
  });

  it("keeps rival simulation deterministic for the same calendar segment", () => {
    const simulateSegment = () => {
      let career = createInitialCareerState(seededPlayers[0].player.id, 8205);

      for (let day = 0; day < 24; day += 1) {
        career = advanceRivalCircuit({
          ...career,
          date: addDays("2026-06-01", day)
        });
      }

      return {
        rankings: career.rankings.map((entry) => [entry.playerId, entry.rank, entry.points]),
        entries: career.rivals.programs.map((program) =>
          program.eventEntries.map((entry) => [entry.eventId, entry.status, entry.resultRound, entry.pointsAwarded])
        ),
        pressure: career.rivals.fieldPressure
      };
    };

    expect(simulateSegment()).toEqual(simulateSegment());
  });
});
