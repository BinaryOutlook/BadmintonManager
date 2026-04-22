import { describePoint } from "../commentary/commentary";
import { SeededRng } from "./rng";
import {
  deriveProfile,
  getRelevantShotSkill,
  riskModifier,
  scorePressure,
  targetZoneModifier,
  tacticShotModifier,
  teamTalkAdjustments,
  tempoModifiers
} from "./ratings";
import type {
  CourtZone,
  LiveCompetitorState,
  LiveMatchSession,
  MatchInput,
  MatchResult,
  MatchStats,
  PointSummary,
  SetSummary,
  ShotEvent,
  ShotType,
  Side,
  TeamTalk
} from "./models";

const SHOT_TYPES: ShotType[] = ["clear", "drop", "smash", "net", "block", "lift", "drive"];
const COURT_ZONES: CourtZone[] = [
  "front_left",
  "front_center",
  "front_right",
  "mid_left",
  "mid_center",
  "mid_right",
  "back_left",
  "back_center",
  "back_right"
];

function opposite(side: Side): Side {
  return side === "A" ? "B" : "A";
}

function defaultCompetitorState(tactic: MatchInput["tacticA"], stamina: number): LiveCompetitorState {
  return {
    stamina,
    focusShift: 0,
    composureShift: 0,
    aggressionShift: 0,
    tactic
  };
}

function baseDifficulty(shotType: ShotType) {
  switch (shotType) {
    case "serve":
      return 38;
    case "clear":
      return 44;
    case "drop":
      return 49;
    case "smash":
      return 58;
    case "net":
      return 52;
    case "block":
      return 42;
    case "lift":
      return 46;
    case "drive":
      return 51;
  }
}

function shotWeights(input: {
  shotIndex: number;
  incomingBonus: number;
  aggression: number;
  tactic: LiveCompetitorState["tactic"];
}): Array<{ item: ShotType; weight: number }> {
  const { shotIndex, incomingBonus, aggression, tactic } = input;
  const attackingTilt = aggression / 18 + incomingBonus / 8;

  return SHOT_TYPES.map((shotType) => {
    let weight = 4;

    if (shotType === "clear") {
      weight += shotIndex < 2 ? 3 : 1;
    }

    if (shotType === "smash") {
      weight += attackingTilt + tacticShotModifier(tactic, shotType);
    }

    if (shotType === "net" || shotType === "drop") {
      weight += 2 + tacticShotModifier(tactic, shotType);
    }

    if (shotType === "lift" || shotType === "block") {
      weight += shotIndex > 2 ? 1.5 : 0.5;
    }

    if (shotType === "drive") {
      weight += 1 + tacticShotModifier(tactic, shotType);
    }

    if (tactic.pressurePattern === "rear_court_grind" && shotType === "clear") {
      weight += 4;
    }

    if (tactic.pressurePattern === "all_out_attack" && shotType === "smash") {
      weight += 5;
    }

    return { item: shotType, weight: Math.max(1, weight) };
  });
}

function zoneWeights(shotType: ShotType): Array<{ item: CourtZone; weight: number }> {
  return COURT_ZONES.map((zone) => {
    let weight = 3;

    if (shotType === "smash" && zone.startsWith("mid")) {
      weight += 4;
    }

    if ((shotType === "drop" || shotType === "net") && zone.startsWith("front")) {
      weight += 5;
    }

    if ((shotType === "clear" || shotType === "lift") && zone.startsWith("back")) {
      weight += 5;
    }

    if (zone.endsWith("left") || zone.endsWith("right")) {
      weight += 1;
    }

    return { item: zone, weight };
  });
}

function fatiguePenalty(stamina: number) {
  return Math.max(0, (72 - stamina) * 0.55);
}

function createScoreboard(scoreA: number, scoreB: number) {
  return `${scoreA}-${scoreB}`;
}

function createStatsFromSets(sets: SetSummary[]): MatchStats {
  const empty: MatchStats = {
    winnersA: 0,
    winnersB: 0,
    unforcedErrorsA: 0,
    unforcedErrorsB: 0,
    longestRally: 0,
    totalPoints: 0
  };

  return sets.reduce<MatchStats>((stats, set) => {
    for (const point of set.points) {
      stats.totalPoints += 1;
      stats.longestRally = Math.max(stats.longestRally, point.rallyLength);

      const finalShot = point.shots.at(-1);

      if (point.reason === "winner" || point.reason === "forced_error") {
        if (point.winner === "A") {
          stats.winnersA += 1;
        } else {
          stats.winnersB += 1;
        }
      }

      if (point.reason === "unforced_error" || point.reason === "net" || point.reason === "out") {
        const loser = point.winner === "A" ? "B" : "A";

        if (loser === "A") {
          stats.unforcedErrorsA += 1;
        } else {
          stats.unforcedErrorsB += 1;
        }
      }

      if (finalShot?.outcome === "winner") {
        if (finalShot.actor === "A") {
          stats.winnersA += 0;
        } else {
          stats.winnersB += 0;
        }
      }
    }

    return stats;
  }, empty);
}

function createPointSummary(input: Omit<PointSummary, "summary">, matchInput: MatchInput): PointSummary {
  const summaryBase = {
    ...input,
    summary: ""
  };

  return {
    ...summaryBase,
    summary: describePoint(summaryBase, matchInput)
  };
}

function resolveRally(args: {
  input: MatchInput;
  competitorA: LiveCompetitorState;
  competitorB: LiveCompetitorState;
  scoreA: number;
  scoreB: number;
  server: Side;
  rng: SeededRng;
}): PointSummary {
  const { input, competitorA, competitorB, scoreA, scoreB, server, rng } = args;
  const profileA = deriveProfile(input.playerA);
  const profileB = deriveProfile(input.playerB);

  let activeSide: Side = server;
  let incomingBonus = 0;
  const shots: ShotEvent[] = [];

  for (let shotIndex = 0; shotIndex < 18; shotIndex += 1) {
    const actor = activeSide === "A" ? input.playerA : input.playerB;
    const actorProfile = activeSide === "A" ? profileA : profileB;
    const actorState = activeSide === "A" ? competitorA : competitorB;
    const defender = activeSide === "A" ? input.playerB : input.playerA;
    const defenderProfile = activeSide === "A" ? profileB : profileA;
    const defenderState = activeSide === "A" ? competitorB : competitorA;
    const shotType =
      shotIndex === 0
        ? ("serve" as const)
        : rng.weightedPick(
            shotWeights({
              shotIndex,
              incomingBonus,
              aggression: actor.ratings.mental.aggression + actorState.aggressionShift,
              tactic: actorState.tactic
            })
          );
    const targetZone =
      shotType === "serve" ? rng.pick(["mid_left", "mid_center", "mid_right"] as const) : rng.weightedPick(zoneWeights(shotType));
    const actorPressure = activeSide === "A" ? scorePressure(scoreA, scoreB) : scorePressure(scoreB, scoreA);
    const skill =
      getRelevantShotSkill(actor, shotType) +
      actorState.focusShift * 0.3 +
      actorState.composureShift * 0.15 +
      actorProfile.attackPressure * 0.08 +
      tacticShotModifier(actorState.tactic, shotType);
    const difficulty =
      baseDifficulty(shotType) +
      riskModifier(actorState.tactic.riskProfile) +
      targetZoneModifier(targetZone) +
      (shotType === "smash" ? actorState.aggressionShift * 0.18 : 0);
    const execution =
      skill +
      incomingBonus -
      fatiguePenalty(actorState.stamina) -
      actorPressure * (100 - actorProfile.pressureResistance) * 0.03 +
      rng.nextInt(-14, 14);
    const quality = Math.round(execution - difficulty);

    if (execution < difficulty - 10) {
      const finalShot: ShotEvent = {
        actor: activeSide,
        shotType,
        targetZone,
        targetDifficulty: Math.round(difficulty),
        executionScore: Math.round(execution),
        quality,
        outcome: rng.chance(shotType === "serve" || shotType === "drop" || shotType === "net" ? 0.72 : 0.35)
          ? "net"
          : "out"
      };

      shots.push(finalShot);

      return createPointSummary(
        {
          winner: opposite(activeSide),
          rallyLength: shots.length,
          shots,
          scoreboard: createScoreboard(scoreA, scoreB),
          reason: finalShot.outcome === "net" ? "net" : "out"
        },
        input
      );
    }

    const mightDriftLong =
      targetZone.startsWith("back") &&
      quality < 5 &&
      (shotType === "clear" || shotType === "smash" || shotType === "drive") &&
      rng.chance(0.35);

    if (mightDriftLong) {
      const judgmentScore =
        defenderProfile.judgment +
        defenderState.focusShift * 0.35 +
        defenderState.composureShift * 0.2 -
        (activeSide === "A" ? scorePressure(scoreB, scoreA) : scorePressure(scoreA, scoreB)) * 0.35 +
        rng.nextInt(-12, 12);

      if (judgmentScore > 66) {
        shots.push({
          actor: activeSide,
          shotType,
          targetZone,
          targetDifficulty: Math.round(difficulty),
          executionScore: Math.round(execution),
          quality,
          outcome: "left_long"
        });

        return createPointSummary(
          {
            winner: opposite(activeSide),
            rallyLength: shots.length,
            shots,
            scoreboard: createScoreboard(scoreA, scoreB),
            reason: "left_long"
          },
          input
        );
      }
    }

    const incomingPressure =
      quality +
      (shotType === "smash" ? 12 : 0) +
      (shotType === "net" || shotType === "drop" ? 6 : 0) +
      tempoModifiers(actorState.tactic).attack;
    const retrievalScore =
      defender.ratings.technical.defenseRetrieval * 0.42 +
      defender.ratings.physical.footworkSpeed * 0.24 +
      defender.ratings.physical.agilityBalance * 0.18 +
      defender.ratings.mental.anticipation * 0.16 +
      defenderState.focusShift * 0.25 +
      rng.nextInt(-14, 14) -
      fatiguePenalty(defenderState.stamina);

    if (retrievalScore + 8 < incomingPressure) {
      shots.push({
        actor: activeSide,
        shotType,
        targetZone,
        targetDifficulty: Math.round(difficulty),
        executionScore: Math.round(execution),
        quality,
        outcome: shotType === "smash" || shotType === "drop" ? "winner" : "forced_error"
      });

      return createPointSummary(
        {
          winner: activeSide,
          rallyLength: shots.length,
          shots,
          scoreboard: createScoreboard(scoreA, scoreB),
          reason: shots.at(-1)?.outcome === "winner" ? "winner" : "forced_error"
        },
        input
      );
    }

    if (retrievalScore < incomingPressure + 6) {
      shots.push({
        actor: activeSide,
        shotType,
        targetZone,
        targetDifficulty: Math.round(difficulty),
        executionScore: Math.round(execution),
        quality,
        outcome: "weak_return"
      });
      incomingBonus = 14;
      activeSide = activeSide;
      continue;
    }

    const focusScore =
      defender.ratings.mental.focus +
      defenderState.focusShift -
      fatiguePenalty(defenderState.stamina) * 0.45 +
      rng.nextInt(-14, 14);

    if (focusScore < 34) {
      shots.push({
        actor: activeSide,
        shotType,
        targetZone,
        targetDifficulty: Math.round(difficulty),
        executionScore: Math.round(execution),
        quality,
        outcome: "unforced_error"
      });

      return createPointSummary(
        {
          winner: activeSide,
          rallyLength: shots.length,
          shots,
          scoreboard: createScoreboard(scoreA, scoreB),
          reason: "unforced_error"
        },
        input
      );
    }

    shots.push({
      actor: activeSide,
      shotType,
      targetZone,
      targetDifficulty: Math.round(difficulty),
      executionScore: Math.round(execution),
      quality,
      outcome: "in_play"
    });
    incomingBonus = Math.max(-2, Math.round((retrievalScore - incomingPressure) * 0.18));
    activeSide = opposite(activeSide);
  }

  return createPointSummary(
    {
      winner: rng.chance(0.5) ? "A" : "B",
      rallyLength: shots.length,
      shots,
      scoreboard: createScoreboard(scoreA, scoreB),
      reason: "forced_error"
    },
    input
  );
}

function applyPointFatigue(session: LiveMatchSession, point: PointSummary) {
  const rallyBurn = 1.1 + point.rallyLength * 0.08;
  const tempoA = tempoModifiers(session.competitorA.tactic).staminaBurn;
  const tempoB = tempoModifiers(session.competitorB.tactic).staminaBurn;

  session.competitorA.stamina = Math.max(38, session.competitorA.stamina - rallyBurn * tempoA);
  session.competitorB.stamina = Math.max(38, session.competitorB.stamina - rallyBurn * tempoB);
}

function recoverBetweenSets(session: LiveMatchSession) {
  session.competitorA.stamina = Math.min(100, session.competitorA.stamina + 5.5);
  session.competitorB.stamina = Math.min(100, session.competitorB.stamina + 5.5);
}

function finalizePendingTalk(target: LiveCompetitorState, teamTalk?: TeamTalk) {
  if (!teamTalk) {
    return;
  }

  const adjustment = teamTalkAdjustments(teamTalk);
  target.focusShift += adjustment.focusShift;
  target.composureShift += adjustment.composureShift;
  target.aggressionShift += adjustment.aggressionShift;

  if (adjustment.tempo) {
    target.tactic = {
      ...target.tactic,
      tempo: adjustment.tempo
    };
  }
}

export function createMatchSession(input: MatchInput): LiveMatchSession {
  return {
    input,
    rngState: input.seed >>> 0,
    setsWonA: 0,
    setsWonB: 0,
    setSummaries: [],
    currentServer: (input.seed & 1) === 0 ? "A" : "B",
    competitorA: defaultCompetitorState(input.tacticA, input.playerA.ratings.physical.stamina),
    competitorB: defaultCompetitorState(input.tacticB, input.playerB.ratings.physical.stamina),
    complete: false
  };
}

export function applyTeamTalk(session: LiveMatchSession, side: Side, teamTalk: TeamTalk): LiveMatchSession {
  return {
    ...session,
    pendingTalkA: side === "A" ? teamTalk : session.pendingTalkA,
    pendingTalkB: side === "B" ? teamTalk : session.pendingTalkB
  };
}

export function simulateNextSet(session: LiveMatchSession): LiveMatchSession {
  if (session.complete) {
    return session;
  }

  const nextSession: LiveMatchSession = {
    ...session,
    competitorA: { ...session.competitorA },
    competitorB: { ...session.competitorB },
    setSummaries: [...session.setSummaries]
  };

  finalizePendingTalk(nextSession.competitorA, nextSession.pendingTalkA);
  finalizePendingTalk(nextSession.competitorB, nextSession.pendingTalkB);
  nextSession.pendingTalkA = undefined;
  nextSession.pendingTalkB = undefined;

  const rng = new SeededRng(nextSession.rngState);
  let scoreA = 0;
  let scoreB = 0;
  const points: PointSummary[] = [];

  while (true) {
    const point = resolveRally({
      input: nextSession.input,
      competitorA: nextSession.competitorA,
      competitorB: nextSession.competitorB,
      scoreA,
      scoreB,
      server: nextSession.currentServer,
      rng
    });

    points.push(point);
    applyPointFatigue(nextSession, point);

    if (point.winner === "A") {
      scoreA += 1;
      nextSession.currentServer = "A";
    } else {
      scoreB += 1;
      nextSession.currentServer = "B";
    }

    const reachedCap = scoreA === 30 || scoreB === 30;
    const twoPointMargin = Math.abs(scoreA - scoreB) >= 2;
    const reachedGamePoint = scoreA >= 21 || scoreB >= 21;

    if (reachedCap || (reachedGamePoint && twoPointMargin)) {
      break;
    }
  }

  const winner: Side = scoreA > scoreB ? "A" : "B";
  const setSummary: SetSummary = {
    winner,
    scoreA,
    scoreB,
    points
  };

  nextSession.setSummaries.push(setSummary);

  if (winner === "A") {
    nextSession.setsWonA += 1;
  } else {
    nextSession.setsWonB += 1;
  }

  recoverBetweenSets(nextSession);
  nextSession.rngState = rng.snapshot();

  if (nextSession.setsWonA === 2 || nextSession.setsWonB === 2) {
    nextSession.complete = true;
    nextSession.winner = nextSession.setsWonA > nextSession.setsWonB ? "A" : "B";
  }

  return nextSession;
}

export function simulateMatch(input: MatchInput): MatchResult {
  let session = createMatchSession(input);

  while (!session.complete) {
    session = simulateNextSet(session);
  }

  const stats = createStatsFromSets(session.setSummaries);

  return {
    winner: session.winner ?? "A",
    setsWonA: session.setsWonA,
    setsWonB: session.setsWonB,
    setSummaries: session.setSummaries,
    stats,
    scoreline: session.setSummaries.map((set) => `${set.scoreA}-${set.scoreB}`).join(", ")
  };
}
