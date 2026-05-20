import { seededPlayers } from "../content/players";
import { daysBetween } from "./calendar";
import { tierOrder } from "./events";
import type {
  CareerEventDefinition,
  CareerState,
  RankingEntry,
  RivalAthleteState,
  RivalCircuitState,
  RivalEventEntry,
  RivalEventPressure,
  RivalProgramState,
  RivalProgressionEvent,
  RivalStrategy,
  RivalTrainingBias
} from "./models";
import { clamp } from "./models";
import { appendRankingResultsAndRebuild, createRankingResult, rebuildCareerRankingSnapshot, recalculateRanks } from "./rankings";

type RoundKey = "R16" | "QF" | "SF" | "F" | "champion";

const roundOrder: RoundKey[] = ["R16", "QF", "SF", "F", "champion"];

const rivalSeeds: Array<{
  id: string;
  name: string;
  strategy: RivalStrategy;
  budgetTier: RivalProgramState["budgetTier"];
  trainingBias: RivalTrainingBias;
  playerIds: string[];
}> = [
  {
    id: "rival-tokyo-vector",
    name: "Tokyo Vector Lab",
    strategy: "selective",
    budgetTier: "elite",
    trainingBias: "control",
    playerIds: ["player-2", "player-3"]
  },
  {
    id: "rival-delhi-smash",
    name: "Delhi Smash Forge",
    strategy: "prestige_hunter",
    budgetTier: "stable",
    trainingBias: "attack",
    playerIds: ["player-4", "player-7"]
  },
  {
    id: "rival-euro-endurance",
    name: "Euro Endurance Bloc",
    strategy: "points_chaser",
    budgetTier: "stable",
    trainingBias: "endurance",
    playerIds: ["player-6", "player-8"]
  },
  {
    id: "rival-youth-wave",
    name: "Youth Wave Academy",
    strategy: "developmental",
    budgetTier: "lean",
    trainingBias: "balanced",
    playerIds: ["player-5", "player-11"]
  }
];

function stableNoise(seed: string, min: number, max: number) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const normalized = (hash >>> 0) / 4_294_967_295;

  return min + normalized * (max - min);
}

function baseRating(playerId: string) {
  const seeded = seededPlayers.find((entry) => entry.player.id === playerId) ?? seededPlayers[0];
  const ratings = seeded.player.ratings;

  return Math.round(
    (
      ratings.technical.smash +
      ratings.technical.netPlay +
      ratings.technical.defenseRetrieval +
      ratings.physical.stamina +
      ratings.physical.footworkSpeed +
      ratings.mental.composure +
      ratings.mental.focus
    ) / 7
  );
}

function makeRivalAthlete(playerId: string, rank: number, points: number): RivalAthleteState {
  const seeded = seededPlayers.find((entry) => entry.player.id === playerId) ?? seededPlayers[0];

  return {
    playerId,
    name: seeded.player.name,
    age: seeded.player.age,
    rating: baseRating(playerId),
    form: clamp(60 + stableNoise(`${playerId}-form`, -5, 8), 0, 100),
    fatigue: clamp(18 + stableNoise(`${playerId}-fatigue`, -4, 8), 0, 100),
    rankingPoints: points,
    currentRank: rank,
    trend: "steady"
  };
}

function pressureForProgram(program: RivalProgramState) {
  const lead = program.roster[0];

  if (!lead) {
    return 0;
  }

  const budgetBoost = program.budgetTier === "elite" ? 8 : program.budgetTier === "stable" ? 4 : 1;

  return clamp(lead.rating * 0.55 + program.form * 0.25 + program.reputation * 0.15 + budgetBoost - lead.fatigue * 0.08, 0, 100);
}

function progressionEvent(args: {
  date: string;
  rivalId: string;
  index: number;
  type: RivalProgressionEvent["type"];
  stateDelta: string;
  reason: string;
  visibility?: RivalProgressionEvent["visibility"];
}): RivalProgressionEvent {
  return {
    id: `rival-log-${args.date}-${args.rivalId}-${args.type}-${args.index}`,
    date: args.date,
    rivalId: args.rivalId,
    type: args.type,
    stateDelta: args.stateDelta,
    reason: args.reason,
    visibility: args.visibility ?? "public"
  };
}

function syncRivalRosterFromRankings(program: RivalProgramState, rankings: RankingEntry[]) {
  return {
    ...program,
    roster: program.roster.map((athlete) => {
      const ranking = rankings.find((entry) => entry.playerId === athlete.playerId);

      return ranking
        ? { ...athlete, rankingPoints: ranking.points, currentRank: ranking.rank }
        : athlete;
    })
  };
}

function eventFit(program: RivalProgramState, event: CareerEventDefinition) {
  const tierValue = tierOrder[event.tier];
  const lead = program.roster[0];
  const rank = lead?.currentRank ?? 99;

  if (program.strategy === "prestige_hunter") {
    return tierValue >= 4 || event.prestige >= 65;
  }

  if (program.strategy === "points_chaser") {
    return tierValue <= 5 || rank > 4;
  }

  if (program.strategy === "developmental") {
    return tierValue <= 4 || event.prestige < 72;
  }

  return event.prestige >= 60 && rank <= 8;
}

function projectedRound(threat: number, event: CareerEventDefinition): RoundKey {
  const pressure = threat + event.prestige * 0.12;

  if (pressure >= 82) {
    return "champion";
  }

  if (pressure >= 75) {
    return "F";
  }

  if (pressure >= 66) {
    return "SF";
  }

  if (pressure >= 55) {
    return "QF";
  }

  return "R16";
}

function shouldSelectEvent(program: RivalProgramState, event: CareerEventDefinition, date: string) {
  const daysUntil = daysBetween(date, event.startDate);
  const alreadySelected = program.eventEntries.some((entry) => entry.eventId === event.id);
  const lead = program.roster[0];

  return (
    !alreadySelected &&
    daysUntil >= 0 &&
    daysUntil <= 10 &&
    eventFit(program, event) &&
    (!lead || lead.fatigue < 78)
  );
}

function selectEvent(program: RivalProgramState, event: CareerEventDefinition, date: string, logIndex: number) {
  const threat = pressureForProgram(program);
  const entry: RivalEventEntry = {
    id: `${program.id}-${event.id}`,
    eventId: event.id,
    eventName: event.name,
    tier: event.tier,
    selectedAt: date,
    status: "entered",
    fieldStrength: clamp(threat + event.prestige * 0.22, 0, 100),
    projectedRound: projectedRound(threat, event),
    resultRound: null,
    pointsAwarded: 0
  };
  const log = progressionEvent({
    date,
    rivalId: program.id,
    index: logIndex,
    type: "selection",
    stateDelta: `${program.name} selected ${event.name}`,
    reason: `${program.strategy.replace("_", " ")} fit ${event.tier} pressure at ${Math.round(entry.fieldStrength)}`,
    visibility: "public"
  });

  return {
    ...program,
    eventEntries: [entry, ...program.eventEntries].slice(0, 16),
    progressionLog: [log, ...program.progressionLog].slice(0, 18)
  };
}

function trainingDelta(program: RivalProgramState, date: string) {
  const budget = program.budgetTier === "elite" ? 1.35 : program.budgetTier === "stable" ? 1.05 : 0.78;
  const bias = program.trainingBias === "balanced" ? 0.18 : 0.28;
  const noise = stableNoise(`${program.id}-${date}-training`, -0.12, 0.16);

  return (0.34 + bias + noise) * budget;
}

function progressProgram(program: RivalProgramState, date: string, logIndex: number) {
  const delta = trainingDelta(program, date);
  const logs: RivalProgressionEvent[] = [];
  const roster: RivalAthleteState[] = program.roster.map((athlete) => {
    const ageDecline = Math.max(0, athlete.age - program.ageCurve.peakAge) * program.ageCurve.declineRate;
    const fatigueGain = program.trainingBias === "endurance" ? 1.1 : program.trainingBias === "attack" ? 1.9 : 1.4;
    const nextRating = clamp(athlete.rating + delta - ageDecline, 1, 100);
    const nextForm = clamp(athlete.form + delta * 0.85 - athlete.fatigue * 0.015 - ageDecline * 0.4, 0, 100);
    const trend: RivalAthleteState["trend"] =
      nextRating > athlete.rating + 0.15 ? "surging" : nextRating < athlete.rating - 0.15 ? "sliding" : "steady";

    if (ageDecline > delta) {
      logs.push(
        progressionEvent({
          date,
          rivalId: program.id,
          index: logIndex + logs.length,
          type: "decline",
          stateDelta: `${athlete.name} rating ${athlete.rating.toFixed(1)} -> ${nextRating.toFixed(1)}`,
          reason: `Age curve outweighed ${program.trainingBias} training block`,
          visibility: "scouted"
        })
      );
    }

    return {
      ...athlete,
      rating: nextRating,
      form: nextForm,
      fatigue: clamp(athlete.fatigue + fatigueGain - (program.trainingBias === "endurance" ? 0.7 : 0.2), 0, 100),
      trend
    };
  });
  const trainingLog = progressionEvent({
    date,
    rivalId: program.id,
    index: logIndex + logs.length,
    type: "training",
    stateDelta: `Training delta +${delta.toFixed(2)} before age/fatigue modifiers`,
    reason: `${program.budgetTier} budget / ${program.trainingBias} bias`,
    visibility: "public"
  });
  const form = clamp(program.form + delta * 0.5 - (program.roster[0]?.fatigue ?? 0) * 0.01, 0, 100);
  const progressed = {
    ...program,
    roster,
    form,
    pressureScore: 0,
    progressionLog: [trainingLog, ...logs, ...program.progressionLog].slice(0, 18)
  };

  return {
    ...progressed,
    pressureScore: pressureForProgram(progressed)
  };
}

function resultForEntry(program: RivalProgramState, event: CareerEventDefinition, entry: RivalEventEntry, date: string) {
  const lead = program.roster[0];
  const base = pressureForProgram(program) + stableNoise(`${entry.id}-${date}-result`, -7, 8);
  const fatigueDrag = lead ? lead.fatigue * 0.14 : 0;
  const score = base + event.prestige * 0.08 - fatigueDrag;

  return projectedRound(score, event);
}

function settleEvent(program: RivalProgramState, event: CareerEventDefinition, date: string, logIndex: number) {
  const entry = program.eventEntries.find((candidate) => candidate.eventId === event.id && candidate.status !== "completed");

  if (!entry || event.startDate !== date) {
    return { program, rankingAwards: [] as Array<{ playerId: string; round: RoundKey; points: number }> };
  }

  const resultRound = resultForEntry(program, event, entry, date);
  const points = event.rankingPoints[resultRound];
  const lead = program.roster[0];
  const reputationDelta = resultRound === "champion" ? 4 : resultRound === "F" ? 3 : resultRound === "SF" ? 2 : 1;
  const log = progressionEvent({
    date,
    rivalId: program.id,
    index: logIndex,
    type: "event_result",
    stateDelta: `${program.name} reached ${resultRound} at ${event.name} for ${points} pts`,
    reason: `Threat ${Math.round(pressureForProgram(program))}, field ${Math.round(entry.fieldStrength)}, fatigue ${Math.round(lead?.fatigue ?? 0)}`,
    visibility: "public"
  });
  const nextProgram = {
    ...program,
    reputation: clamp(program.reputation + reputationDelta, 0, 100),
    roster: program.roster.map((athlete, index) =>
      index === 0
        ? {
            ...athlete,
            rankingPoints: athlete.rankingPoints + points,
            fatigue: clamp(athlete.fatigue + (resultRound === "champion" ? 16 : resultRound === "F" ? 13 : 9), 0, 100),
            form: clamp(athlete.form + reputationDelta * 1.8, 0, 100)
          }
        : athlete
    ),
    eventEntries: program.eventEntries.map((candidate) =>
      candidate.id === entry.id
        ? {
            ...candidate,
            status: "completed" as const,
            resultRound,
            pointsAwarded: points
          }
        : candidate
    ),
    progressionLog: [log, ...program.progressionLog].slice(0, 18)
  };

  return {
    program: {
      ...nextProgram,
      pressureScore: pressureForProgram(nextProgram)
    },
    rankingAwards: lead ? [{ playerId: lead.playerId, round: resultRound, points }] : []
  };
}

function updateRankings(args: {
  rankings: RankingEntry[];
  event: CareerEventDefinition;
  date: string;
  seasonId: string;
  awards: Array<{ playerId: string; round: RoundKey; points: number }>;
}) {
  const { awards, event, rankings } = args;

  if (awards.length === 0) {
    return rankings;
  }

  return recalculateRanks(
    rankings.map((entry) => {
      const award = awards.find((candidate) => candidate.playerId === entry.playerId);

      return award
        ? {
            ...entry,
            points: entry.points + award.points,
            seasonPoints: entry.seasonPoints + award.points,
            eventHistory: [
              ...entry.eventHistory,
              {
                eventId: event.id,
                round: award.round,
                points: award.points,
                date: args.date,
                seasonId: args.seasonId,
                tier: event.tier
              }
            ]
          }
        : entry;
    })
  );
}

export function calculateRivalFieldPressure(programs: RivalProgramState[], events: CareerEventDefinition[]): RivalEventPressure[] {
  return events
    .map((event) => {
      const entries = programs.flatMap((program) =>
        program.eventEntries
          .filter((entry) => entry.eventId === event.id && entry.status !== "withdrawn")
          .map((entry) => ({ entry, program }))
      );
      const top = [...entries].sort((left, right) => right.entry.fieldStrength - left.entry.fieldStrength)[0];
      const averageThreat =
        entries.length === 0
          ? 0
          : entries.reduce((total, item) => total + item.entry.fieldStrength, 0) / entries.length;

      return {
        eventId: event.id,
        rivalCount: entries.length,
        averageThreat: clamp(averageThreat, 0, 100),
        pressureScore: clamp(averageThreat + entries.length * 4 + event.prestige * 0.1, 0, 100),
        topThreatName: top?.program.name ?? "Open field"
      };
    })
    .filter((entry) => entry.rivalCount > 0);
}

export function createInitialRivalCircuit(date = "2026-06-01", rankings: RankingEntry[] = []): RivalCircuitState {
  const programs = rivalSeeds.map((seed, index) => {
    const roster = seed.playerIds.map((playerId) => {
      const existingRanking = rankings.find((entry) => entry.playerId === playerId);

      return makeRivalAthlete(playerId, existingRanking?.rank ?? index + 2, existingRanking?.points ?? 1400 - index * 80);
    });
    const program = {
      id: seed.id,
      name: seed.name,
      strategy: seed.strategy,
      budgetTier: seed.budgetTier,
      trainingBias: seed.trainingBias,
      ageCurve: {
        peakAge: 26,
        declineRate: 0.09
      },
      roster,
      eventEntries: [],
      form: 62 + index * 4,
      reputation: 58 + index * 5,
      pressureScore: 0,
      progressionLog: [
        progressionEvent({
          date,
          rivalId: seed.id,
          index: 1,
          type: "form",
          stateDelta: `${seed.name} entered the season circuit`,
          reason: `${seed.strategy.replace("_", " ")} / ${seed.trainingBias} training bias`,
          visibility: "public"
        })
      ]
    };

    return {
      ...program,
      pressureScore: pressureForProgram(program)
    };
  });

  return {
    programs,
    fieldPressure: [],
    circuitLog: programs.flatMap((program) => program.progressionLog).slice(0, 24),
    lastSimulatedDate: ""
  };
}

export function advanceRivalCircuit(state: CareerState): CareerState {
  if (state.rivals.lastSimulatedDate === state.date) {
    return state;
  }

  let rankings = state.rankings;
  const rankingResultAdditions: CareerState["rankingResults"] = [];
  let logIndex = state.rivals.circuitLog.length + 1;
  let programs = state.rivals.programs.map((program) => progressProgram(syncRivalRosterFromRankings(program, rankings), state.date, logIndex++));
  const trainingEvents = programs.map((program) => program.progressionLog[0]).filter(Boolean) as RivalProgressionEvent[];
  const circuitEvents: RivalProgressionEvent[] = [];

  for (const event of state.events) {
    programs = programs.map((program) => {
      let nextProgram = program;

      if (shouldSelectEvent(program, event, state.date)) {
        nextProgram = selectEvent(program, event, state.date, logIndex++);
        circuitEvents.push(nextProgram.progressionLog[0]!);
      }

      const settled = settleEvent(nextProgram, event, state.date, logIndex++);
      if (settled.program !== nextProgram) {
        circuitEvents.push(settled.program.progressionLog[0]!);
        rankingResultAdditions.push(
          ...settled.rankingAwards.map((award) =>
            createRankingResult({
              seasonId: state.seasonId,
              playerId: award.playerId,
              eventId: event.id,
              eventName: event.name,
              tier: event.tier,
              date: state.date,
              resultRound: award.round,
              points: award.points,
              source: "quick_sim",
              artificial: false
            })
          )
        );
        rankings = updateRankings({
          rankings,
          event,
          date: state.date,
          seasonId: state.seasonId,
          awards: settled.rankingAwards
        });
        return syncRivalRosterFromRankings(settled.program, rankings);
      }

      return syncRivalRosterFromRankings(nextProgram, rankings);
    });
  }

  const fieldPressure = calculateRivalFieldPressure(programs, state.events);
  const peakPressure = [...fieldPressure].sort((left, right) => right.pressureScore - left.pressureScore)[0];
  const rankedState = appendRankingResultsAndRebuild({
    career: {
      ...state,
      rankings
    },
    results: rankingResultAdditions,
    asOfDate: state.date
  });

  return rebuildCareerRankingSnapshot({
    ...state,
    rankings: rankedState.rankings,
    rankingResults: rankedState.rankingResults,
    rivals: {
      programs,
      fieldPressure,
      circuitLog: [...circuitEvents, ...trainingEvents, ...state.rivals.circuitLog].slice(0, 36),
      lastSimulatedDate: state.date
    },
    notes: [
      peakPressure
        ? `Rival pressure: ${peakPressure.topThreatName} anchors ${Math.round(peakPressure.pressureScore)} pressure`
        : "Rival circuit trained; no event field pressure yet",
      ...state.notes
    ].slice(0, 6)
  }, state.date);
}
