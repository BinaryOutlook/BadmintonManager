import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { tacticLibrary } from "../../game/content/tactics";
import { advanceCareerCalendar, addDays } from "../../game/career/calendar";
import { canAffordEventEntry, chargeEventEntry, eventEntryCost } from "../../game/career/economy";
import {
  advanceFacilityBuilds,
  applyFacilitiesToTraining,
  applyTravelPressureForEvent,
  chargeFacilityUpkeep,
  effectiveEventEntryCosts,
  facilityModifiers,
  resolveMediaObjectives,
  upgradeFacility
} from "../../game/career/facilitiesMedia";
import { canCompeteWithInjury, canTrainWithInjury } from "../../game/career/health";
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
import { eventEligibilityFor, getCareerEvent } from "../../game/career/events";
import { settleCareerMatch } from "../../game/career/hubs";
import { rankingFor } from "../../game/career/rankings";
import { advanceRivalCircuit } from "../../game/career/rivals";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import { projectTacticalViewerFromResult, projectTacticalViewerFromSession } from "../../game/career/tacticalViewer";
import {
  activeAdvancedTacticPlan,
  applyAssistantAdvice,
  buildPreMatchPlanningBridge,
  calculateTacticEffectProfile,
  overrideAssistantAdvice,
  refreshAssistantAdvice,
  tacticPlanToMatchTactic,
  updateAdvancedTacticPlan
} from "../../game/career/tactics";
import { applyTrainingPlan, trainingPlans } from "../../game/career/training";
import { createMatchSession, simulateMatch, simulateNextPoint } from "../../game/core/match";
import type { LiveMatchSession, MatchResult, Side } from "../../game/core/models";
import { loadPersistedFromStorage, STORAGE_KEY, useTournamentStore } from "../../game/store/store";
import {
  advanceTournament,
  createManagedMatchInput,
  createTournament,
  getManagedMatchContext,
  type TournamentState
} from "../../game/tournament/tournament";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function installWindowStorage() {
  if (typeof window === "undefined") {
    return;
  }

  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true
  });
}

function resetStoreForCareerFlow(selectedPlayerId = seededPlayers[0].player.id) {
  installWindowStorage();
  useTournamentStore.setState({
    phase: "setup",
    selectedPlayerId,
    plannedTacticKey: "balancedControl",
    seed: 9001,
    tournament: null,
    liveMatch: null,
    career: null,
    saveRecovery: null,
    activeSavePresent: false,
    corruptSavePresent: false
  });
}

function straightGamesResult(winner: Side): MatchResult {
  return {
    winner,
    setsWonA: winner === "A" ? 2 : 0,
    setsWonB: winner === "B" ? 2 : 0,
    setSummaries: [
      {
        winner,
        scoreA: winner === "A" ? 21 : 13,
        scoreB: winner === "B" ? 21 : 13,
        points: []
      },
      {
        winner,
        scoreA: winner === "A" ? 21 : 15,
        scoreB: winner === "B" ? 21 : 15,
        points: []
      }
    ],
    stats: {
      winnersA: winner === "A" ? 24 : 11,
      winnersB: winner === "B" ? 24 : 11,
      unforcedErrorsA: winner === "A" ? 7 : 18,
      unforcedErrorsB: winner === "B" ? 7 : 18,
      totalSmashesA: 18,
      totalSmashesB: 16,
      peakSmashSpeedA: 391,
      peakSmashSpeedB: 384,
      staminaDrainA: 9,
      staminaDrainB: 11,
      longestRally: 28,
      totalPoints: 70
    },
    scoreline: winner === "A" ? "21-13, 21-15" : "13-21, 15-21",
    fidelity: "detailed",
    summaryEvents: [
      {
        kind: "straight_games",
        side: winner,
        title: "Forced deterministic result",
        detail: "State-flow regression proof supplies the result instead of relying on match luck."
      }
    ]
  };
}

function completedSession(session: LiveMatchSession, winner: Side): LiveMatchSession {
  const result = straightGamesResult(winner);

  return {
    ...session,
    complete: true,
    winner,
    setsWonA: result.setsWonA,
    setsWonB: result.setsWonB,
    setSummaries: result.setSummaries
  };
}

function careerOnMetroEvent(managedPlayerId: string, seed = 9101) {
  const initial = createInitialCareerState(managedPlayerId, seed);
  const event = getCareerEvent(initial.events, "metro-open-300")!;
  const career = {
    ...initial,
    date: event.startDate,
    activeEventId: event.id,
    enteredEventIds: [event.id],
    stage: "pre_match" as const
  };
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };

  return { career, event, tournament };
}

function startForcedStoreMatch(winnerForManagedSide: boolean) {
  useTournamentStore.getState().startManagedMatch();
  const liveMatch = useTournamentStore.getState().liveMatch;

  if (!liveMatch) {
    throw new Error("Expected live match to start.");
  }

  const forcedWinner =
    winnerForManagedSide
      ? liveMatch.managedSide
      : liveMatch.managedSide === "A"
        ? "B"
        : "A";

  useTournamentStore.setState({
    liveMatch: {
      ...liveMatch,
      session: completedSession(liveMatch.session, forcedWinner)
    }
  });
}

function advanceManagedPlayerToFinal(tournament: TournamentState, managedPlayerId: string) {
  let current = tournament;

  while (getManagedMatchContext(current)?.roundName !== "F") {
    const context = getManagedMatchContext(current);

    if (!context) {
      throw new Error("Expected managed match context before the final.");
    }

    const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
    current = advanceTournament({
      tournament: current,
      seededEntries: seededPlayers,
      managedMatchId: context.matchId,
      managedResult: straightGamesResult(managedSide)
    });
  }

  return current;
}

function eventCompletionCount(eventIds: string[], eventId: string) {
  return eventIds.filter((entry) => entry === eventId).length;
}

describe("career athlete identity lock", () => {
  it("starts with an explicit managed athlete and ignores active-career selection after reload", () => {
    const draftPlayerId = seededPlayers[0].player.id;
    const lockedPlayerId = seededPlayers[2].player.id;
    const attemptedSwitchId = seededPlayers[3].player.id;
    resetStoreForCareerFlow(draftPlayerId);

    (useTournamentStore.getState().startCareer as (managedPlayerId: string) => void)(lockedPlayerId);

    expect(useTournamentStore.getState().career?.program.managedPlayerId).toBe(lockedPlayerId);
    expect(useTournamentStore.getState().selectedPlayerId).toBe(lockedPlayerId);

    useTournamentStore.getState().selectPlayer(attemptedSwitchId);

    expect(useTournamentStore.getState().career?.program.managedPlayerId).toBe(lockedPlayerId);
    expect(useTournamentStore.getState().selectedPlayerId).toBe(lockedPlayerId);

    const save = useTournamentStore.getState().exportActiveSave();
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(save));
    const reloaded = loadPersistedFromStorage(storage, () => 9201);
    useTournamentStore.setState(reloaded);

    useTournamentStore.getState().selectPlayer(attemptedSwitchId);

    expect(useTournamentStore.getState().career?.program.managedPlayerId).toBe(lockedPlayerId);
    expect(useTournamentStore.getState().selectedPlayerId).toBe(lockedPlayerId);
  });
});

describe("career tournament state flow", () => {
  it("keeps a career event active after a forced non-final managed win and builds the next briefing", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const { career, event, tournament } = careerOnMetroEvent(managedPlayerId);
    resetStoreForCareerFlow(managedPlayerId);
    useTournamentStore.setState({
      selectedPlayerId: managedPlayerId,
      career,
      tournament,
      phase: "overview"
    });

    startForcedStoreMatch(true);
    useTournamentStore.getState().advanceAfterMatch();

    const afterWin = useTournamentStore.getState();
    const nextContext = afterWin.tournament ? getManagedMatchContext(afterWin.tournament) : undefined;
    const nextOpponentId =
      nextContext?.playerAId === managedPlayerId ? nextContext.playerBId : nextContext?.playerAId;

    expect(afterWin.tournament).not.toBeNull();
    expect(afterWin.tournament?.currentRoundIndex).toBe(1);
    expect(afterWin.career?.activeEventId).toBe(event.id);
    expect(afterWin.career?.completedEventIds).not.toContain(event.id);
    expect(afterWin.career?.lastMatchReport?.pointsDelta).toBe(0);
    expect(afterWin.career?.lastMatchReport?.cashDelta).toBe(0);
    expect(nextOpponentId).toBeTruthy();

    useTournamentStore.getState().continueCareerAfterPostMatch();

    const betweenRounds = useTournamentStore.getState();
    expect(betweenRounds.tournament).not.toBeNull();
    expect(betweenRounds.career?.stage).toBe("pre_match");
    expect(betweenRounds.career?.activeEventId).toBe(event.id);
    expect(betweenRounds.career?.completedEventIds).not.toContain(event.id);
    expect(betweenRounds.career?.lastPreMatchBrief?.opponentId).toBe(nextOpponentId);
  });

  it("marks a managed loss and a managed final win complete exactly once", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const lossSetup = careerOnMetroEvent(managedPlayerId, 9301);
    resetStoreForCareerFlow(managedPlayerId);
    useTournamentStore.setState({
      selectedPlayerId: managedPlayerId,
      career: lossSetup.career,
      tournament: lossSetup.tournament,
      phase: "overview"
    });

    startForcedStoreMatch(false);
    useTournamentStore.getState().advanceAfterMatch();

    const afterLoss = useTournamentStore.getState();
    expect(afterLoss.tournament?.eliminated).toBe(true);
    expect(eventCompletionCount(afterLoss.career?.completedEventIds ?? [], lossSetup.event.id)).toBe(1);

    useTournamentStore.getState().continueCareerAfterPostMatch();

    expect(useTournamentStore.getState().tournament).toBeNull();
    expect(useTournamentStore.getState().career?.stage).toBe("event_complete");
    expect(useTournamentStore.getState().career?.activeEventId).toBeNull();
    expect(eventCompletionCount(useTournamentStore.getState().career?.completedEventIds ?? [], lossSetup.event.id)).toBe(1);

    const finalSetup = careerOnMetroEvent(managedPlayerId, 9302);
    const finalTournament = advanceManagedPlayerToFinal(finalSetup.tournament, managedPlayerId);
    resetStoreForCareerFlow(managedPlayerId);
    useTournamentStore.setState({
      selectedPlayerId: managedPlayerId,
      career: finalSetup.career,
      tournament: finalTournament,
      phase: "overview"
    });

    startForcedStoreMatch(true);
    useTournamentStore.getState().advanceAfterMatch();

    const afterTitle = useTournamentStore.getState();
    expect(afterTitle.tournament?.championId).toBe(managedPlayerId);
    expect(eventCompletionCount(afterTitle.career?.completedEventIds ?? [], finalSetup.event.id)).toBe(1);

    useTournamentStore.getState().continueCareerAfterPostMatch();

    expect(useTournamentStore.getState().tournament).toBeNull();
    expect(useTournamentStore.getState().career?.stage).toBe("event_complete");
    expect(useTournamentStore.getState().career?.activeEventId).toBeNull();
    expect(eventCompletionCount(useTournamentStore.getState().career?.completedEventIds ?? [], finalSetup.event.id)).toBe(1);
  });

  it("settles final placement rewards only once when a completed event is replayed after reload", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const { career, event, tournament } = careerOnMetroEvent(managedPlayerId, 9303);
    const context = getManagedMatchContext(tournament);

    if (!context) {
      throw new Error("Expected managed match context.");
    }

    const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
    const opponentId = managedSide === "A" ? context.playerBId : context.playerAId;
    const result = straightGamesResult(managedSide === "A" ? "B" : "A");
    const initialRanking = rankingFor(career.rankings, managedPlayerId)!;
    const managedRunMatch = {
      round: context.roundName,
      opponentId,
      opponentName: seededPlayers.find((entry) => entry.player.id === opponentId)!.player.name,
      scoreline: result.scoreline,
      won: false,
      stats: {
        winners: 10,
        unforcedErrors: 19,
        totalSmashes: 14,
        peakSmashSpeed: 379,
        longestRally: 25,
        totalPoints: 70,
        staminaDrain: 11
      }
    };
    const first = settleCareerMatch({
      state: career,
      matchId: context.matchId,
      opponentId,
      managedSide,
      managedRunMatch,
      result,
      eventComplete: true
    });
    const replayed = settleCareerMatch({
      state: first,
      matchId: context.matchId,
      opponentId,
      managedSide,
      managedRunMatch,
      result,
      eventComplete: true
    });
    const firstRanking = rankingFor(first.rankings, managedPlayerId)!;
    const replayedRanking = rankingFor(replayed.rankings, managedPlayerId)!;
    const firstPrizeLedger = first.economy.ledger.filter(
      (entry) => entry.category === "prize" && entry.label.includes(event.name)
    );
    const replayedPrizeLedger = replayed.economy.ledger.filter(
      (entry) => entry.category === "prize" && entry.label.includes(event.name)
    );

    expect(firstRanking.points).toBe(initialRanking.points + event.rankingPoints.R16);
    expect(replayedRanking.points).toBe(firstRanking.points);
    expect(replayedRanking.eventHistory.filter((entry) => entry.eventId === event.id)).toHaveLength(1);
    expect(first.economy.prizeIncome).toBe(career.economy.prizeIncome + event.prizeMoney.R16);
    expect(replayed.economy.prizeIncome).toBe(first.economy.prizeIncome);
    expect(firstPrizeLedger).toHaveLength(1);
    expect(replayedPrizeLedger).toHaveLength(1);
    expect(eventCompletionCount(replayed.completedEventIds, event.id)).toBe(1);
    expect(replayed.lastMatchReport?.pointsDelta).toBe(0);
    expect(replayed.lastMatchReport?.cashDelta).toBe(0);
  });
});

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

  it("turns high load into a persisted injury episode and gates unsafe training", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 7011);
    const athlete = {
      ...managedAthlete(career),
      fatigue: 70,
      injuryRisk: 0.27
    };
    const plan = trainingPlans.find((entry) => entry.id === "rear-court-power")!;
    const injured = applyTrainingPlan({
      athlete,
      economy: career.economy,
      plan,
      date: "2026-07-07"
    });

    expect(injured.athlete.injury.status).toBe("out");
    expect(injured.athlete.injury.daysRemaining).toBeGreaterThan(0);
    expect(injured.athlete.recoveryStatus).toBe("injured");
    expect(canTrainWithInjury(injured.athlete, "heavy").allowed).toBe(false);
    expect(canCompeteWithInjury(injured.athlete).allowed).toBe(false);

    const recoveryPlan = trainingPlans.find((entry) => entry.id === "mobility-recovery")!;
    const recovery = applyTrainingPlan({
      athlete: injured.athlete,
      economy: injured.economy,
      plan: recoveryPlan,
      date: "2026-07-08"
    });

    expect(recovery.blockedReason).toBeNull();
    expect(recovery.athlete.injury.daysRemaining).toBeLessThan(injured.athlete.injury.daysRemaining);
    expect(recovery.athlete.fatigue).toBeLessThan(injured.athlete.fatigue);
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
    expect(settled.lastMatchReport?.tacticalViewer?.zones).toHaveLength(9);
    expect(settled.lastMatchReport?.tacticalViewer?.pressure).toBeGreaterThan(0);
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

  it("uses all requested tier families and gates elite events by ranking-season qualification", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 7012);

    expect(new Set(career.events.map((event) => event.tier))).toEqual(
      new Set(["Circuit 300", "Circuit 500", "Circuit 750", "Circuit 1000", "National", "Invitational", "Finals"])
    );

    const super1000 = getCareerEvent(career.events, "continental-premier-1000")!;
    const finals = getCareerEvent(career.events, "season-finals")!;
    const lowQualified = {
      ...career,
      rankings: career.rankings.map((entry) =>
        entry.playerId === career.program.managedPlayerId
          ? { ...entry, rank: 19, points: 980 }
          : entry
      ),
      athletes: career.athletes.map((athlete) =>
        athlete.playerId === career.program.managedPlayerId
          ? { ...athlete, currentRank: 19, rankingPoints: 980, readiness: 66 }
          : athlete
      )
    };
    const finalsQualified = {
      ...career,
      completedEventIds: ["metro-open-300", "harbor-masters-500", "summit-invitational-750", "continental-premier-1000"],
      rankings: career.rankings.map((entry) =>
        entry.playerId === career.program.managedPlayerId
          ? { ...entry, rank: 4, points: 2550 }
          : entry
      )
    };

    expect(eventEligibilityFor(career, super1000).allowed).toBe(true);
    expect(eventEligibilityFor(lowQualified, super1000).allowed).toBe(false);
    expect(eventEligibilityFor(career, finals).allowed).toBe(false);
    expect(eventEligibilityFor(finalsQualified, finals).allowed).toBe(true);
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
        recommendations: [],
        tacticalViewer: null
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

    expect(career.version).toBe(6);
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

describe("advanced tactics and assistant advice", () => {
  it("seeds a persistent advanced match plan and explainable advice packets", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8301);
    const plan = activeAdvancedTacticPlan(career);

    expect(career.version).toBe(6);
    expect(plan).toMatchObject({
      tempo: 52,
      rearCourtPressure: 58,
      netPriority: 54,
      riskTolerance: 42,
      rallyLengthIntent: "balanced"
    });
    expect(career.matchPlanning.advice.map((entry) => entry.topic)).toEqual([
      "tactics",
      "training",
      "rotation",
      "scouting"
    ]);
    expect(career.matchPlanning.advice.every((entry) => entry.rationale.length > 20 && entry.inputs.length > 0)).toBe(true);
  });

  it("converts slider edits into match tactic inputs and effect projections", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8302);
    const updated = updateAdvancedTacticPlan(career, {
      name: "Rear Court Blitz",
      tempo: 82,
      rearCourtPressure: 88,
      netPriority: 48,
      riskTolerance: 76,
      rallyLengthIntent: "shorten",
      modules: ["rear_court_lock", "body_smash"]
    });
    const plan = activeAdvancedTacticPlan(updated);
    const tactic = tacticPlanToMatchTactic(plan);
    const effect = calculateTacticEffectProfile({ plan, state: updated });

    expect(tactic).toMatchObject({
      label: "Rear Court Blitz",
      tempo: "fast",
      pressurePattern: "all_out_attack",
      riskProfile: "high_risk"
    });
    expect(effect.winnerPressure).toBeGreaterThan(70);
    expect(effect.rearCourtControl).toBeGreaterThan(effect.netControl);
    expect(effect.errorRisk).toBeGreaterThan(45);
    expect(updated.ecosystem.programLog[0]?.source).toBe("tactics");
  });

  it("produces different seeded match outcomes when advanced plans change match inputs", () => {
    const base = createInitialCareerState(seededPlayers[0].player.id, 8303);
    const event = getCareerEvent(base.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, base.program.managedPlayerId, 8303),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const playerMapById = Object.fromEntries(seededPlayers.map((entry) => [entry.player.id, entry.player]));
    const safePlan = updateAdvancedTacticPlan(base, {
      tempo: 28,
      rearCourtPressure: 36,
      netPriority: 64,
      riskTolerance: 18,
      rallyLengthIntent: "extend",
      modules: ["safe_lift_release", "net_trap"]
    });
    const pressurePlan = updateAdvancedTacticPlan(base, {
      tempo: 86,
      rearCourtPressure: 92,
      netPriority: 44,
      riskTolerance: 82,
      rallyLengthIntent: "shorten",
      modules: ["rear_court_lock", "body_smash"]
    });
    const safePrepared = createManagedMatchInput({
      tournament,
      playerMap: playerMapById,
      tacticA: tacticPlanToMatchTactic(activeAdvancedTacticPlan(safePlan))
    })!;
    const pressurePrepared = createManagedMatchInput({
      tournament,
      playerMap: playerMapById,
      tacticA: tacticPlanToMatchTactic(activeAdvancedTacticPlan(pressurePlan))
    })!;
    const safeResult = simulateMatch(safePrepared.input);
    const pressureResult = simulateMatch(pressurePrepared.input);
    const managedSide = safePrepared.context.playerAId === base.program.managedPlayerId ? "A" : "B";
    const safeErrors = managedSide === "A" ? safeResult.stats.unforcedErrorsA : safeResult.stats.unforcedErrorsB;
    const pressureErrors = managedSide === "A" ? pressureResult.stats.unforcedErrorsA : pressureResult.stats.unforcedErrorsB;
    const safeSmashes = managedSide === "A" ? safeResult.stats.totalSmashesA : safeResult.stats.totalSmashesB;
    const pressureSmashes = managedSide === "A" ? pressureResult.stats.totalSmashesA : pressureResult.stats.totalSmashesB;

    expect(safePrepared.input.tacticA).not.toEqual(pressurePrepared.input.tacticA);
    expect(`${pressureResult.scoreline}|${pressureErrors}|${pressureSmashes}`).not.toBe(
      `${safeResult.scoreline}|${safeErrors}|${safeSmashes}`
    );
  });

  it("applies assistant tactic advice without hiding manager override behavior", () => {
    const career = updateAdvancedTacticPlan(createInitialCareerState(seededPlayers[0].player.id, 8304), {
      tempo: 78,
      rearCourtPressure: 84,
      riskTolerance: 82,
      rallyLengthIntent: "shorten"
    });
    const tacticAdvice = career.matchPlanning.advice.find((entry) => entry.topic === "tactics")!;
    const scoutingAdvice = career.matchPlanning.advice.find((entry) => entry.topic === "scouting")!;
    const applied = applyAssistantAdvice(career, tacticAdvice.id);
    const overridden = overrideAssistantAdvice(applied, scoutingAdvice.id, "Saving scout capacity for the semifinal opponent.");

    expect(applied.matchPlanning.advice.find((entry) => entry.id === tacticAdvice.id)?.overrideState).toBe("applied");
    expect(activeAdvancedTacticPlan(applied).riskTolerance).toBeLessThan(activeAdvancedTacticPlan(career).riskTolerance);
    expect(overridden.matchPlanning.advice.find((entry) => entry.id === scoutingAdvice.id)?.overrideState).toBe("overridden");
    expect(overridden.matchPlanning.overrideLog[0]).toMatchObject({
      adviceId: scoutingAdvice.id,
      topic: "scouting",
      reason: "Saving scout capacity for the semifinal opponent."
    });
  });

  it("builds a pre-match planning bridge from active tactic and override context", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 8305);
    const event = getCareerEvent(initial.events, "metro-open-300")!;
    const pressured = advanceRivalCircuit({
      ...initial,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      date: event.startDate,
      stage: "pre_match" as const
    });
    const tacticUpdated = updateAdvancedTacticPlan(pressured, {
      name: "Rear Court Blitz",
      tempo: 82,
      rearCourtPressure: 88,
      riskTolerance: 76,
      rallyLengthIntent: "shorten",
      modules: ["rear_court_lock", "body_smash"]
    });
    const scoutingAdvice = tacticUpdated.matchPlanning.advice.find((entry) => entry.topic === "scouting")!;
    const overridden = overrideAssistantAdvice(tacticUpdated, scoutingAdvice.id, "Manager override kept Rear Court Blitz.");
    const bridge = buildPreMatchPlanningBridge(overridden);

    expect(bridge.planName).toBe("Rear Court Blitz");
    expect(bridge.tacticSummary).toContain("all out attack");
    expect(bridge.effectSummary).toContain("winner pressure");
    expect(bridge.adviceLabel).toBe("Manager override: scouting");
    expect(bridge.adviceDetail).toBe("Manager override kept Rear Court Blitz.");
    expect(bridge.rivalIntel).toContain("rival programs");
    expect(bridge.objectiveStakes).toContain(event.tier);
    expect(bridge.strainWarning).toContain("strain");
  });
});

describe("tactical viewer evidence projection", () => {
  function preparedCareerMatch(seed: number) {
    const career = updateAdvancedTacticPlan(createInitialCareerState(seededPlayers[0].player.id, seed), {
      tempo: 82,
      rearCourtPressure: 88,
      netPriority: 61,
      riskTolerance: 72,
      rallyLengthIntent: "shorten",
      modules: ["rear_court_lock", "body_smash"]
    });
    const event = getCareerEvent(career.events, "metro-open-300")!;
    const state = {
      ...career,
      date: event.startDate,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "pre_match" as const
    };
    const tournament = {
      ...createTournament(seededPlayers, state.program.managedPlayerId, seed),
      id: event.id,
      name: event.name,
      tier: event.tier
    };
    const prepared = createManagedMatchInput({
      tournament,
      playerMap: Object.fromEntries(seededPlayers.map((entry) => [entry.player.id, entry.player])),
      tacticA: tacticPlanToMatchTactic(activeAdvancedTacticPlan(state))
    })!;
    const managedSide = prepared.context.playerAId === state.program.managedPlayerId ? ("A" as const) : ("B" as const);

    return { state, prepared, managedSide };
  }

  it("projects deterministic court zones, pressure, strain, and momentum from match result evidence", () => {
    const { state, prepared, managedSide } = preparedCareerMatch(8501);
    const result = simulateMatch(prepared.input);
    const frame = projectTacticalViewerFromResult({
      matchId: prepared.context.matchId,
      result,
      managedSide,
      state
    });
    const replay = projectTacticalViewerFromResult({
      matchId: prepared.context.matchId,
      result,
      managedSide,
      state
    });

    expect(frame).toEqual(replay);
    expect(frame.zones).toHaveLength(9);
    expect(frame.zones.reduce((total, zone) => total + zone.shots, 0)).toBeGreaterThan(0);
    expect(frame.zones.some((zone) => zone.pressure > 0 && zone.strain > 0)).toBe(true);
    expect(frame.pressure).toBeGreaterThan(0);
    expect(frame.movementStrain).toBeGreaterThan(0);
    expect(frame.momentumTimeline.length).toBeGreaterThan(0);
    expect(frame.tacticMarkers.join(" ")).toContain("winner pressure");
  });

  it("updates live viewer state as match points are simulated", () => {
    const { prepared, managedSide } = preparedCareerMatch(8502);
    const emptySession = createMatchSession(prepared.input);
    const emptyFrame = projectTacticalViewerFromSession({
      session: emptySession,
      managedSide,
      matchId: prepared.context.matchId
    });
    const firstPointSession = simulateNextPoint(emptySession);
    const firstFrame = projectTacticalViewerFromSession({
      session: firstPointSession,
      managedSide,
      matchId: prepared.context.matchId
    });

    expect(emptyFrame.sequence).toBe(0);
    expect(emptyFrame.summary).toBe("No tactical evidence captured yet");
    expect(firstFrame.sequence).toBe(1);
    expect(firstFrame.zones.reduce((total, zone) => total + zone.shots, 0)).toBeGreaterThan(0);
    expect(firstFrame.pressure).toBeGreaterThan(0);
  });
});

describe("facilities, media, sponsors, and reputation", () => {
  it("starts facility builds through the program budget and activates modifiers on the build date", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8401);
    const upgraded = upgradeFacility(career, "training_hall");
    const trainingHall = upgraded.facilities.find((entry) => entry.type === "training_hall")!;

    expect(upgraded.economy.cash).toBe(career.economy.cash - 18000);
    expect(upgraded.economy.ledger.at(-1)).toMatchObject({
      category: "facility",
      label: "Training Hall level 1",
      amount: -18000
    });
    expect(trainingHall.level).toBe(1);
    expect(trainingHall.status).toBe("building");
    expect(trainingHall.buildCompleteDate).toBe("2026-06-06");
    expect(trainingHall.nextUpgradeCost).toBe(27000);
    expect(facilityModifiers(upgraded.facilities).trainingDevelopment).toBe(0);
    expect(upgraded.media.reactionLog[0]?.message).toContain("Training Hall level 1 build started");

    const completed = advanceFacilityBuilds({ ...upgraded, date: trainingHall.buildCompleteDate! });
    const completedHall = completed.facilities.find((entry) => entry.type === "training_hall")!;

    expect(completedHall.status).toBe("ready");
    expect(completedHall.buildCompleteDate).toBeNull();
    expect(facilityModifiers(completed.facilities).trainingDevelopment).toBeGreaterThan(0);
    expect(completed.media.reactionLog[0]?.message).toContain("Training Hall build completed");
  });

  it("facility modifiers affect training and recovery outcomes", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8402);
    const trainingBuild = upgradeFacility(career, "training_hall");
    const trainingComplete = advanceFacilityBuilds({ ...trainingBuild, date: "2026-06-06" });
    const recoveryBuild = upgradeFacility(trainingComplete, "recovery_center");
    const withFacilities = advanceFacilityBuilds({ ...recoveryBuild, date: "2026-06-11" });
    const plan = trainingPlans.find((entry) => entry.id === "rear-court-power")!;
    const baseTraining = applyTrainingPlan({
      athlete: managedAthlete(career),
      economy: career.economy,
      plan,
      date: career.date
    });
    const facilityTraining = applyFacilitiesToTraining(baseTraining.athlete, withFacilities.facilities);

    expect(facilityTraining.development.smash).toBeGreaterThan(baseTraining.athlete.development.smash);
    expect(facilityTraining.fatigue).toBeLessThan(baseTraining.athlete.fatigue);
    expect(facilityTraining.injuryRisk).toBeLessThan(baseTraining.athlete.injuryRisk);
  });

  it("travel quality reduces event travel cost and event pressure", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8403);
    const event = getCareerEvent(career.events, "summit-invitational-750")!;
    const baselineCosts = effectiveEventEntryCosts(event, career.facilities);
    const upgraded = advanceFacilityBuilds({ ...upgradeFacility(career, "travel_quality"), date: "2026-06-05" });
    const upgradedCosts = effectiveEventEntryCosts(event, upgraded.facilities);
    const pressuredBaseline = applyTravelPressureForEvent(career, event);
    const pressuredUpgrade = applyTravelPressureForEvent(upgraded, event);

    expect(upgradedCosts.travelCost).toBeLessThan(baselineCosts.travelCost);
    expect(upgradedCosts.travelFatigue).toBeLessThan(baselineCosts.travelFatigue);
    expect(managedAthlete(pressuredUpgrade).fatigue - managedAthlete(upgraded).fatigue).toBeLessThan(
      managedAthlete(pressuredBaseline).fatigue - managedAthlete(career).fatigue
    );
  });

  it("analytics and academy upgrades improve scouting, advice, and prospect development", () => {
    const base = createInitialCareerState(seededPlayers[0].player.id, 8404);
    const baseReport = resolveDueScoutReports({
      ...commissionScoutReport(base, "cand-arya-prakash", "candidate"),
      date: "2026-06-03"
    });
    const analyticsComplete = advanceFacilityBuilds({ ...upgradeFacility(base, "analytics_lab"), date: "2026-06-07" });
    const upgraded = refreshAssistantAdvice(
      advanceFacilityBuilds({ ...upgradeFacility(analyticsComplete, "youth_academy"), date: "2026-06-15" })
    );
    const upgradedReport = resolveDueScoutReports({
      ...commissionScoutReport(upgraded, "cand-arya-prakash", "candidate"),
      date: "2026-06-16"
    });
    const baseYouth = developYouthProspect(base, "prospect-mei-sato");
    const upgradedYouth = developYouthProspect(upgraded, "prospect-mei-sato");

    expect(upgradedReport.ecosystem.scouting.reports[0]!.confidence).toBeGreaterThan(
      baseReport.ecosystem.scouting.reports[0]!.confidence
    );
    expect(upgradedReport.matchPlanning.advice[0]!.confidence).toBeGreaterThan(base.matchPlanning.advice[0]!.confidence);
    expect(upgradedYouth.ecosystem.academy.prospects[0]!.readiness).toBeGreaterThan(
      baseYouth.ecosystem.academy.prospects[0]!.readiness
    );
  });

  it("analytics lab accuracy uses the same one-day scouting duration as scout staff", () => {
    const base = createInitialCareerState(seededPlayers[0].player.id, 8406);
    const analyticsComplete = advanceFacilityBuilds({ ...upgradeFacility(base, "analytics_lab"), date: "2026-06-07" });
    const assigned = commissionScoutReport(analyticsComplete, "cand-arya-prakash", "candidate");

    expect(staffModifiers(assigned.ecosystem).scouting).toBe(0);
    expect(facilityModifiers(assigned.facilities).scoutingAccuracy).toBeGreaterThanOrEqual(5);
    expect(assigned.ecosystem.scouting.assignments[0]?.startedAt).toBe("2026-06-07");
    expect(assigned.ecosystem.scouting.assignments[0]?.dueAt).toBe("2026-06-08");
  });

  it("charges recurring facility upkeep once per day and records depleted-budget pressure", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8407);
    const trainingComplete = advanceFacilityBuilds({ ...upgradeFacility(career, "training_hall"), date: "2026-06-06" });
    const nextDay = { ...trainingComplete, date: "2026-06-07" };
    const charged = chargeFacilityUpkeep(nextDay);
    const chargedAgain = chargeFacilityUpkeep(charged);

    expect(charged.economy.ledger.at(-1)).toMatchObject({
      category: "facility",
      label: "Facility upkeep",
      amount: -1200,
      date: "2026-06-07"
    });
    expect(chargedAgain.economy.cash).toBe(charged.economy.cash);

    const depleted = chargeFacilityUpkeep({
      ...nextDay,
      economy: { ...nextDay.economy, cash: 500 }
    });
    const psychology = depleted.ecosystem.psychology.find((entry) => entry.athleteId === depleted.program.managedPlayerId)!;

    expect(depleted.economy.cash).toBe(0);
    expect(depleted.economy.ledger.at(-1)?.amount).toBe(-500);
    expect(depleted.media.reactionLog[0]?.message).toBe("Facility upkeep underfunded");
    expect(psychology.morale).toBeLessThan(nextDay.ecosystem.psychology[0]!.morale);
  });

  it("resolves sponsor and federation objectives into cash, reputation, morale, and reactions", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8405);
    const withReport = {
      ...career,
      lastMatchReport: {
        eventId: "metro-open-300",
        matchId: "managed-r16",
        opponentId: "opponent",
        result: "win" as const,
        scoreline: "21-17 21-19",
        round: "R16",
        pointsDelta: 210,
        cashDelta: 1500,
        fatigueDelta: 8,
        evidence: [],
        recommendations: [],
        tacticalViewer: null
      }
    };
    const resolved = resolveMediaObjectives(withReport);
    const psychology = resolved.ecosystem.psychology.find((entry) => entry.athleteId === resolved.program.managedPlayerId)!;

    expect(resolved.media.sponsors[0]?.status).toBe("fulfilled");
    expect(resolved.media.federationObjectives[0]?.status).toBe("fulfilled");
    expect(resolved.economy.cash).toBe(career.economy.cash + 10500);
    expect(resolved.media.reputation).toBeGreaterThan(career.media.reputation);
    expect(psychology.morale).toBeGreaterThan(career.ecosystem.psychology[0]!.morale);
    expect(resolved.media.reactionLog.map((entry) => entry.source)).toEqual(
      expect.arrayContaining(["sponsor", "federation"])
    );
  });

  it("settles press events by applying displayed reputation and morale deltas once", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8408);
    const pressReady = {
      ...career,
      date: addDays(career.media.pressEvents[0]!.date, 15),
      media: {
        ...career.media,
        sponsors: career.media.sponsors.map((objective) => ({ ...objective, status: "fulfilled" as const })),
        federationObjectives: career.media.federationObjectives.map((objective) => ({
          ...objective,
          status: "fulfilled" as const
        })),
        pressEvents: [
          {
            ...career.media.pressEvents[0]!,
            reputationDelta: -3,
            moraleDelta: -4
          }
        ]
      }
    };
    const resolved = resolveMediaObjectives(pressReady);
    const resolvedAgain = resolveMediaObjectives(resolved);
    const psychology = resolved.ecosystem.psychology.find((entry) => entry.athleteId === resolved.program.managedPlayerId)!;

    expect(resolved.media.pressEvents[0]?.status).toBe("settled");
    expect(resolved.media.reputation).toBe(pressReady.media.reputation - 3);
    expect(psychology.morale).toBe(pressReady.ecosystem.psychology[0]!.morale - 4);
    expect(resolved.media.reactionLog[0]).toMatchObject({
      source: "press",
      relatedIds: ["press-launch-scrutiny"]
    });
    expect(resolvedAgain.media.reputation).toBe(resolved.media.reputation);
    expect(resolvedAgain.ecosystem.psychology[0]!.morale).toBe(psychology.morale);
    expect(resolvedAgain.media.reactionLog.filter((entry) => entry.source === "press")).toHaveLength(1);
  });
});
