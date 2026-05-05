import { describePoint, describeSet } from "../commentary/commentary";
import { SeededRng } from "./rng";
import {
  deriveProfile,
  directiveRiskModifier,
  directiveShotModifier,
  directiveStaminaBurn,
  directiveZoneModifier,
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
  LiveDirective,
  LiveMatchSession,
  MatchFeedEvent,
  MatchInput,
  MatchResult,
  MatchSummaryEvent,
  MatchStats,
  PointSummary,
  SetSummary,
  ShotEvent,
  ShotType,
  SimulationFidelity,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function defaultCompetitorState(tactic: MatchInput["tacticA"], stamina: number): LiveCompetitorState {
  return {
    stamina,
    focusShift: 0,
    composureShift: 0,
    aggressionShift: 0,
    tactic,
    momentum: 50,
    errors: 0,
    smashPeakKph: 0,
    directivePointsRemaining: 0,
    initialStamina: stamina
  };
}

function getActiveDirective(state: LiveCompetitorState) {
  return state.directivePointsRemaining > 0 ? state.directive : undefined;
}

function shotWeights(input: {
  shotIndex: number;
  incomingBonus: number;
  aggression: number;
  tactic: LiveCompetitorState["tactic"];
  directive?: LiveDirective;
}): Array<{ item: ShotType; weight: number }> {
  const { shotIndex, incomingBonus, aggression, tactic, directive } = input;
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

    if (tactic.pressurePattern === "wide_pressure" && (shotType === "drive" || shotType === "drop")) {
      weight += 4;
    }

    if (tactic.pressurePattern === "defensive_absorb" && (shotType === "lift" || shotType === "block")) {
      weight += 5;
    }

    weight += directiveShotModifier(directive, shotType);

    return { item: shotType, weight: Math.max(1, weight) };
  });
}

function zoneWeights(input: {
  shotType: ShotType;
  directive?: LiveDirective;
  defender: MatchInput["playerA"];
}): Array<{ item: CourtZone; weight: number }> {
  const { shotType, directive, defender } = input;

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

    weight += directiveZoneModifier(directive, zone, defender);

    return { item: zone, weight };
  });
}

function fatiguePenalty(stamina: number) {
  return Math.max(0, (72 - stamina) * 0.55);
}

function quickRating(player: MatchInput["playerA"]) {
  const profile = deriveProfile(player);

  return (
    profile.attackPressure * 0.24 +
    profile.recoveryQuality * 0.2 +
    profile.frontCourtControl * 0.16 +
    profile.rallyTolerance * 0.14 +
    profile.pressureResistance * 0.14 +
    profile.judgment * 0.12
  );
}

function tacticFit(
  player: MatchInput["playerA"],
  opponent: MatchInput["playerA"],
  tactic: MatchInput["tacticA"]
) {
  const own = player.ratings;
  const answer = opponent.ratings;
  let tools = 0;
  let counters = 0;

  switch (tactic.pressurePattern) {
    case "all_out_attack":
      tools =
        own.technical.smash * 0.45 +
        own.physical.explosivenessJump * 0.25 +
        own.mental.aggression * 0.2 +
        own.technical.dropShot * 0.1;
      counters =
        answer.technical.defenseRetrieval * 0.45 +
        answer.physical.agilityBalance * 0.3 +
        answer.mental.anticipation * 0.25;
      break;
    case "front_court_control":
      tools =
        own.technical.netPlay * 0.45 +
        own.technical.serveReturn * 0.3 +
        own.mental.anticipation * 0.25;
      counters =
        answer.technical.netPlay * 0.35 +
        answer.technical.serveReturn * 0.2 +
        answer.mental.anticipation * 0.25 +
        answer.physical.footworkSpeed * 0.2;
      break;
    case "rear_court_grind":
      tools =
        own.physical.stamina * 0.35 +
        own.technical.clearLob * 0.3 +
        own.mental.focus * 0.2 +
        own.technical.defenseRetrieval * 0.15;
      counters =
        answer.physical.stamina * 0.35 +
        answer.technical.clearLob * 0.25 +
        answer.mental.focus * 0.2 +
        answer.mental.composure * 0.2;
      break;
    case "backhand_pressure": {
      const backhandTargetBonus = opponent.handedness === player.handedness ? 1.5 : 0.5;
      tools =
        own.technical.smash * 0.3 +
        own.technical.dropShot * 0.25 +
        own.technical.serveReturn * 0.25 +
        own.mental.anticipation * 0.2 +
        backhandTargetBonus * 8;
      counters =
        answer.technical.defenseRetrieval * 0.35 +
        answer.physical.agilityBalance * 0.2 +
        answer.mental.anticipation * 0.25 +
        answer.mental.focus * 0.2;
      break;
    }
    case "wide_pressure":
      tools =
        own.physical.footworkSpeed * 0.3 +
        own.technical.dropShot * 0.25 +
        own.technical.serveReturn * 0.2 +
        own.mental.anticipation * 0.15 +
        own.physical.stamina * 0.1;
      counters =
        answer.physical.agilityBalance * 0.35 +
        answer.physical.stamina * 0.25 +
        answer.physical.footworkSpeed * 0.25 +
        answer.technical.defenseRetrieval * 0.15;
      break;
    case "defensive_absorb":
      tools =
        own.technical.defenseRetrieval * 0.35 +
        own.physical.stamina * 0.25 +
        own.mental.focus * 0.2 +
        own.mental.composure * 0.2;
      counters =
        answer.mental.aggression * 0.3 +
        answer.technical.smash * 0.3 +
        answer.mental.focus * 0.2 +
        answer.physical.explosivenessJump * 0.2;
      break;
  }

  const riskAdjustment =
    tactic.riskProfile === "high_risk"
      ? (own.mental.focus + own.mental.composure - 150) / 18
      : tactic.riskProfile === "patient"
        ? (own.mental.focus + own.physical.stamina - 145) / 24
        : 0;

  return clamp((tools - counters) / 8 + riskAdjustment, -6, 6);
}

function quickExpectedRallyLoad(input: MatchInput) {
  const profileA = deriveProfile(input.playerA);
  const profileB = deriveProfile(input.playerB);
  const defensiveTilt =
    (profileA.recoveryQuality + profileB.recoveryQuality + profileA.rallyTolerance + profileB.rallyTolerance) / 80;
  const attackMismatch =
    Math.abs(profileA.attackPressure - profileB.recoveryQuality) +
    Math.abs(profileB.attackPressure - profileA.recoveryQuality);
  const tacticLoad =
    (input.tacticA.pressurePattern === "rear_court_grind" || input.tacticA.pressurePattern === "defensive_absorb" ? 1 : 0) +
    (input.tacticB.pressurePattern === "rear_court_grind" || input.tacticB.pressurePattern === "defensive_absorb" ? 1 : 0) -
    (input.tacticA.pressurePattern === "all_out_attack" ? 0.5 : 0) -
    (input.tacticB.pressurePattern === "all_out_attack" ? 0.5 : 0);

  return clamp(4.5 + defensiveTilt + tacticLoad - attackMismatch / 80, 3.5, 10.5);
}

function quickStaminaBurn(player: MatchInput["playerA"], tactic: MatchInput["tacticA"], rallyLength: number) {
  const staminaFactor = 1 - (player.ratings.physical.stamina - 50) / 170;
  const burn = (0.55 + rallyLength * 0.08) * tempoModifiers(tactic).staminaBurn * staminaFactor;
  return clamp(burn, 0.35, 1.8);
}

function createScoreboard(scoreA: number, scoreB: number) {
  return `${scoreA}-${scoreB}`;
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

function estimateSmashSpeed(player: MatchInput["playerA"], quality: number) {
  return clamp(
    Math.round(
      player.ratings.technical.smash * 2.45 +
        player.ratings.physical.explosivenessJump * 1.25 +
        Math.max(0, quality) * 1.15
    ),
    240,
    428
  );
}

function pushFeed(
  session: LiveMatchSession,
  kind: MatchFeedEvent["kind"],
  emphasis: MatchFeedEvent["emphasis"],
  title: string,
  detail?: string
) {
  session.feed.push({
    id: `${kind}-${session.feed.length + 1}-${session.clockSeconds}`,
    kind,
    emphasis,
    clockLabel: formatClock(session.clockSeconds),
    title,
    detail
  });
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
    const directive = getActiveDirective(actorState);
    const shotType =
      shotIndex === 0
        ? ("serve" as const)
        : rng.weightedPick(
            shotWeights({
              shotIndex,
              incomingBonus,
              aggression: actor.ratings.mental.aggression + actorState.aggressionShift,
              tactic: actorState.tactic,
              directive
            })
          );
    const targetZone =
      shotType === "serve"
        ? rng.pick(["mid_left", "mid_center", "mid_right"] as const)
        : rng.weightedPick(
            zoneWeights({
              shotType,
              directive,
              defender
            })
          );
    const actorPressure = activeSide === "A" ? scorePressure(scoreA, scoreB) : scorePressure(scoreB, scoreA);
    const skill =
      getRelevantShotSkill(actor, shotType) +
      actorState.focusShift * 0.3 +
      actorState.composureShift * 0.15 +
      actorProfile.attackPressure * 0.08 +
      tacticShotModifier(actorState.tactic, shotType) +
      directiveShotModifier(directive, shotType) * 0.7;
    const difficulty =
      baseDifficulty(shotType) +
      riskModifier(actorState.tactic.riskProfile) +
      directiveRiskModifier(directive) +
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
        outcome:
          rng.chance(shotType === "serve" || shotType === "drop" || shotType === "net" ? 0.72 : 0.35)
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
      tempoModifiers(actorState.tactic).attack +
      (directive === "push_pace" ? 4 : 0);
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
  const directiveBurnA = directiveStaminaBurn(getActiveDirective(session.competitorA));
  const directiveBurnB = directiveStaminaBurn(getActiveDirective(session.competitorB));
  const tempoA = tempoModifiers(session.competitorA.tactic).staminaBurn * directiveBurnA;
  const tempoB = tempoModifiers(session.competitorB.tactic).staminaBurn * directiveBurnB;

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

function consumeDirective(state: LiveCompetitorState) {
  if (state.directivePointsRemaining <= 0) {
    state.directive = undefined;
    state.directivePointsRemaining = 0;
    return;
  }

  state.directivePointsRemaining -= 1;

  if (state.directivePointsRemaining <= 0) {
    state.directive = undefined;
    state.directivePointsRemaining = 0;
  }
}

function applyMomentumShift(session: LiveMatchSession, point: PointSummary) {
  const pressureWeight = 4 + scorePressure(session.currentScoreA, session.currentScoreB) * 0.22;
  const swing = pressureWeight + point.rallyLength * 0.18;

  if (point.winner === "A") {
    session.competitorA.momentum = clamp(session.competitorA.momentum + swing, 0, 100);
    session.competitorB.momentum = clamp(session.competitorB.momentum - swing * 0.72, 0, 100);
  } else {
    session.competitorB.momentum = clamp(session.competitorB.momentum + swing, 0, 100);
    session.competitorA.momentum = clamp(session.competitorA.momentum - swing * 0.72, 0, 100);
  }
}

function updateTelemetry(session: LiveMatchSession, point: PointSummary) {
  for (const shot of point.shots) {
    if (shot.shotType !== "smash") {
      continue;
    }

    const actor = shot.actor === "A" ? session.input.playerA : session.input.playerB;
    const competitor = shot.actor === "A" ? session.competitorA : session.competitorB;
    competitor.smashPeakKph = Math.max(competitor.smashPeakKph, estimateSmashSpeed(actor, shot.quality));
  }

  const loser = point.winner === "A" ? session.competitorB : session.competitorA;
  const errorReason =
    point.reason === "unforced_error" ||
    point.reason === "net" ||
    point.reason === "out" ||
    point.reason === "left_long";

  if (errorReason) {
    loser.errors += 1;
  }
}

function createPointFeed(session: LiveMatchSession, point: PointSummary) {
  const winnerName = point.winner === "A" ? session.input.playerA.name : session.input.playerB.name;
  const loserName = point.winner === "A" ? session.input.playerB.name : session.input.playerA.name;
  const managedPressure =
    point.reason === "winner" || point.reason === "forced_error" ? "positive" : "neutral";
  const detailParts: string[] = [`Set ${session.currentSetNumber} · ${point.scoreboard}`];

  const winnerState = point.winner === "A" ? session.competitorA : session.competitorB;

  if (winnerState.smashPeakKph > 0 && point.shots.some((shot) => shot.actor === point.winner && shot.shotType === "smash")) {
    detailParts.push(`Peak smash ${winnerState.smashPeakKph} km/h`);
  }

  pushFeed(session, "point", managedPressure, point.summary, detailParts.join(" • "));

  if (point.rallyLength >= 18) {
    pushFeed(
      session,
      "warning",
      "danger",
      `Long rally (${point.rallyLength} shots). Fatigue is becoming a factor.`,
      `${winnerName} and ${loserName} are both carrying late-rally load.`
    );
  }

  if (winnerState.directive === "target_backhand" || winnerState.directivePointsRemaining > 0) {
    const targetedSide = point.winner === "A" ? session.input.playerB : session.input.playerA;
    const backhandSide = targetedSide.handedness === "right" ? "left" : "right";
    const pressedBackhand = point.shots.some(
      (shot) => shot.actor === point.winner && shot.targetZone.endsWith(backhandSide)
    );

    if (pressedBackhand) {
      pushFeed(
        session,
        "alert",
        "info",
        `${winnerName} keeps pressing the backhand channel.`,
        `Repeated pressure is forcing ${loserName} into cramped replies.`
      );
    }
  }

  const staminaWarningSide =
    session.competitorA.stamina < 54 ? "A" : session.competitorB.stamina < 54 ? "B" : undefined;

  if (staminaWarningSide) {
    const playerName = staminaWarningSide === "A" ? session.input.playerA.name : session.input.playerB.name;
    const staminaValue =
      staminaWarningSide === "A" ? Math.round(session.competitorA.stamina) : Math.round(session.competitorB.stamina);

    pushFeed(
      session,
      "warning",
      "danger",
      `${playerName} is showing clear stamina drain.`,
      `Telemetry has dropped to ${staminaValue}%.`
    );
  }
}

function createStatsFromSets(
  sets: SetSummary[],
  competitorA: LiveCompetitorState,
  competitorB: LiveCompetitorState
): MatchStats {
  const empty: MatchStats = {
    winnersA: 0,
    winnersB: 0,
    unforcedErrorsA: 0,
    unforcedErrorsB: 0,
    totalSmashesA: 0,
    totalSmashesB: 0,
    peakSmashSpeedA: Math.round(competitorA.smashPeakKph),
    peakSmashSpeedB: Math.round(competitorB.smashPeakKph),
    staminaDrainA: Math.round(competitorA.initialStamina - competitorA.stamina),
    staminaDrainB: Math.round(competitorB.initialStamina - competitorB.stamina),
    longestRally: 0,
    totalPoints: 0
  };

  return sets.reduce<MatchStats>((stats, set) => {
    for (const point of set.points) {
      stats.totalPoints += 1;
      stats.longestRally = Math.max(stats.longestRally, point.rallyLength);

      for (const shot of point.shots) {
        if (shot.shotType === "smash") {
          if (shot.actor === "A") {
            stats.totalSmashesA += 1;
          } else {
            stats.totalSmashesB += 1;
          }
        }
      }

      if (point.reason === "winner" || point.reason === "forced_error") {
        if (point.winner === "A") {
          stats.winnersA += 1;
        } else {
          stats.winnersB += 1;
        }
      }

      if (
        point.reason === "unforced_error" ||
        point.reason === "net" ||
        point.reason === "out" ||
        point.reason === "left_long"
      ) {
        const loser = point.winner === "A" ? "B" : "A";

        if (loser === "A") {
          stats.unforcedErrorsA += 1;
        } else {
          stats.unforcedErrorsB += 1;
        }
      }
    }

    return stats;
  }, empty);
}

function createQuickPointSummary(input: {
  winner: Side;
  rallyLength: number;
  scoreA: number;
  scoreB: number;
  reason: PointSummary["reason"];
  matchInput: MatchInput;
}): PointSummary {
  const winnerName = input.winner === "A" ? input.matchInput.playerA.name : input.matchInput.playerB.name;
  const loserName = input.winner === "A" ? input.matchInput.playerB.name : input.matchInput.playerA.name;
  const scoreboard = createScoreboard(input.scoreA, input.scoreB);
  const summary =
    input.reason === "winner"
      ? `${winnerName} converts the pressure pattern in ${input.rallyLength} shots.`
      : input.reason === "forced_error"
        ? `${winnerName} squeezes a rushed reply from ${loserName}.`
        : input.reason === "unforced_error"
          ? `${loserName} leaks a loose point under the scoreboard load.`
          : input.reason === "left_long"
            ? `${winnerName} judges the baseline correctly.`
            : input.reason === "net"
              ? `${loserName} catches the tape while trying to stay in the exchange.`
              : `${loserName} misses the target lane by a margin.`;

  return {
    winner: input.winner,
    rallyLength: input.rallyLength,
    shots: [],
    summary,
    scoreboard,
    reason: input.reason
  };
}

function pickQuickReason(input: {
  winner: Side;
  matchInput: MatchInput;
  staminaA: number;
  staminaB: number;
  rng: SeededRng;
}) {
  const player = input.winner === "A" ? input.matchInput.playerA : input.matchInput.playerB;
  const opponent = input.winner === "A" ? input.matchInput.playerB : input.matchInput.playerA;
  const tactic = input.winner === "A" ? input.matchInput.tacticA : input.matchInput.tacticB;
  const opponentStamina = input.winner === "A" ? input.staminaB : input.staminaA;
  const attack = deriveProfile(player).attackPressure;
  const opponentFatigue = fatiguePenalty(opponentStamina);
  const risk = tactic.riskProfile === "high_risk" ? 3 : tactic.riskProfile === "patient" ? -2 : 0;

  return input.rng.weightedPick<PointSummary["reason"]>([
    { item: "winner", weight: 4 + attack / 18 + tacticShotModifier(tactic, "smash") * 0.4 },
    { item: "forced_error", weight: 7 + attack / 22 + opponentFatigue * 0.25 },
    { item: "unforced_error", weight: 3 + (100 - opponent.ratings.mental.focus) / 18 + opponentFatigue * 0.3 },
    { item: "net", weight: 2 + (100 - opponent.ratings.technical.netPlay) / 28 - risk * 0.2 },
    { item: "out", weight: 2 + risk + (100 - opponent.ratings.mental.composure) / 32 },
    { item: "left_long", weight: 1 + deriveProfile(player).judgment / 60 }
  ]);
}

function createQuickStats(args: {
  input: MatchInput;
  sets: SetSummary[];
  staminaA: number;
  staminaB: number;
}) {
  const totalPoints = args.sets.reduce((sum, set) => sum + set.points.length, 0);
  const profileA = deriveProfile(args.input.playerA);
  const profileB = deriveProfile(args.input.playerB);
  const stats: MatchStats = {
    winnersA: 0,
    winnersB: 0,
    unforcedErrorsA: 0,
    unforcedErrorsB: 0,
    totalSmashesA: Math.round(
      totalPoints *
        clamp(
          0.16 +
            (profileA.attackPressure - profileB.recoveryQuality) / 260 +
            tacticShotModifier(args.input.tacticA, "smash") / 60,
          0.08,
          0.4
        )
    ),
    totalSmashesB: Math.round(
      totalPoints *
        clamp(
          0.16 +
            (profileB.attackPressure - profileA.recoveryQuality) / 260 +
            tacticShotModifier(args.input.tacticB, "smash") / 60,
          0.08,
          0.4
        )
    ),
    peakSmashSpeedA: estimateSmashSpeed(args.input.playerA, Math.max(0, profileA.attackPressure - 70)),
    peakSmashSpeedB: estimateSmashSpeed(args.input.playerB, Math.max(0, profileB.attackPressure - 70)),
    staminaDrainA: Math.max(0, Math.round(args.input.playerA.ratings.physical.stamina - args.staminaA)),
    staminaDrainB: Math.max(0, Math.round(args.input.playerB.ratings.physical.stamina - args.staminaB)),
    longestRally: 0,
    totalPoints
  };

  for (const set of args.sets) {
    for (const point of set.points) {
      stats.longestRally = Math.max(stats.longestRally, point.rallyLength);

      if (point.reason === "winner" || point.reason === "forced_error") {
        if (point.winner === "A") {
          stats.winnersA += 1;
        } else {
          stats.winnersB += 1;
        }
      }

      if (
        point.reason === "unforced_error" ||
        point.reason === "net" ||
        point.reason === "out" ||
        point.reason === "left_long"
      ) {
        const loser = point.winner === "A" ? "B" : "A";

        if (loser === "A") {
          stats.unforcedErrorsA += 1;
        } else {
          stats.unforcedErrorsB += 1;
        }
      }
    }
  }

  return stats;
}

function createQuickSummaryEvents(input: MatchInput, result: MatchResult, ratingA: number, ratingB: number): MatchSummaryEvent[] {
  const events: MatchSummaryEvent[] = [];
  const winnerName = result.winner === "A" ? input.playerA.name : input.playerB.name;
  const loserName = result.winner === "A" ? input.playerB.name : input.playerA.name;
  const winnerRating = result.winner === "A" ? ratingA : ratingB;
  const loserRating = result.winner === "A" ? ratingB : ratingA;

  if (winnerRating + 4 < loserRating) {
    events.push({
      kind: "upset",
      side: result.winner,
      title: `${winnerName} springs a bracket upset.`,
      detail: `${loserName} had the stronger profile, but the quick sim found enough tactical and pressure variance to flip the match.`
    });
  }

  if (result.setsWonA + result.setsWonB === 2) {
    events.push({
      kind: "straight_games",
      side: result.winner,
      title: `${winnerName} wins in straight games.`,
      detail: `The scoreline ${result.scoreline} never reached a deciding set.`
    });
  } else {
    events.push({
      kind: "decider",
      side: result.winner,
      title: `${winnerName} survives a deciding game.`,
      detail: `The match needed all three games before finishing ${result.scoreline}.`
    });
  }

  const staminaGap = Math.abs(result.stats.staminaDrainA - result.stats.staminaDrainB);

  if (staminaGap >= 5 || result.stats.longestRally >= 14) {
    events.push({
      kind: "stamina_battle",
      title: "The match carried a visible stamina tax.",
      detail: `Longest rally: ${result.stats.longestRally} shots. Stamina drain: ${result.stats.staminaDrainA}-${result.stats.staminaDrainB}.`
    });
  }

  const winnerStats = result.winner === "A"
    ? { winners: result.stats.winnersA, errors: result.stats.unforcedErrorsA }
    : { winners: result.stats.winnersB, errors: result.stats.unforcedErrorsB };

  if (winnerStats.winners >= winnerStats.errors + 8) {
    events.push({
      kind: "attack_pressure",
      side: result.winner,
      title: `${winnerName} wins through cleaner pressure.`,
      detail: `The winner generated ${winnerStats.winners} pressure points against ${winnerStats.errors} recorded errors.`
    });
  }

  return events.slice(0, 3);
}

export function createMatchSession(input: MatchInput): LiveMatchSession {
  return {
    input,
    rngState: input.seed >>> 0,
    setsWonA: 0,
    setsWonB: 0,
    setSummaries: [],
    currentSetNumber: 1,
    currentScoreA: 0,
    currentScoreB: 0,
    currentSetPoints: [],
    currentServer: (input.seed & 1) === 0 ? "A" : "B",
    competitorA: defaultCompetitorState(input.tacticA, input.playerA.ratings.physical.stamina),
    competitorB: defaultCompetitorState(input.tacticB, input.playerB.ratings.physical.stamina),
    intermission: false,
    feed: [],
    clockSeconds: 0,
    complete: false
  };
}

export function applyDirective(
  session: LiveMatchSession,
  side: Side,
  directive: LiveDirective
): LiveMatchSession {
  if (session.complete) {
    return session;
  }

  const nextSession: LiveMatchSession = {
    ...session,
    competitorA: { ...session.competitorA },
    competitorB: { ...session.competitorB },
    feed: [...session.feed]
  };

  const target = side === "A" ? nextSession.competitorA : nextSession.competitorB;
  target.directive = directive;
  target.directivePointsRemaining = 3;

  pushFeed(
    nextSession,
    "directive",
    directive === "push_pace" ? "positive" : "info",
    `${side === "A" ? nextSession.input.playerA.name : nextSession.input.playerB.name} queues ${
      directive === "target_backhand"
        ? "Target Backhand"
        : directive === "safe_play_lift"
          ? "Safe Play (Lift)"
          : "Push Pace"
    }.`
  );

  return nextSession;
}

export function applyTeamTalk(session: LiveMatchSession, side: Side, teamTalk: TeamTalk): LiveMatchSession {
  if (session.complete || !session.intermission) {
    return session;
  }

  const nextSession: LiveMatchSession = {
    ...session,
    feed: [...session.feed],
    pendingTalkA: side === "A" ? teamTalk : session.pendingTalkA,
    pendingTalkB: side === "B" ? teamTalk : session.pendingTalkB
  };

  const playerName = side === "A" ? nextSession.input.playerA.name : nextSession.input.playerB.name;
  const talkLabel =
    teamTalk === "encourage"
      ? "Encourage"
      : teamTalk === "demand_focus"
        ? "Demand Focus"
        : teamTalk === "increase_tempo"
          ? "Increase Tempo"
          : "Calm Down";

  pushFeed(
    nextSession,
    "directive",
    "positive",
    `${playerName} queues ${talkLabel} for the set break.`,
    "The adjustment will apply as the next set opens."
  );

  return nextSession;
}

export function simulateNextPoint(session: LiveMatchSession): LiveMatchSession {
  if (session.complete) {
    return session;
  }

  const nextSession: LiveMatchSession = {
    ...session,
    competitorA: { ...session.competitorA },
    competitorB: { ...session.competitorB },
    setSummaries: [...session.setSummaries],
    currentSetPoints: [...session.currentSetPoints],
    feed: [...session.feed]
  };

  if (nextSession.intermission) {
    finalizePendingTalk(nextSession.competitorA, nextSession.pendingTalkA);
    finalizePendingTalk(nextSession.competitorB, nextSession.pendingTalkB);
    nextSession.pendingTalkA = undefined;
    nextSession.pendingTalkB = undefined;
    nextSession.intermission = false;
  }

  const rng = new SeededRng(nextSession.rngState);
  const point = resolveRally({
    input: nextSession.input,
    competitorA: nextSession.competitorA,
    competitorB: nextSession.competitorB,
    scoreA: nextSession.currentScoreA,
    scoreB: nextSession.currentScoreB,
    server: nextSession.currentServer,
    rng
  });

  if (point.winner === "A") {
    nextSession.currentScoreA += 1;
    nextSession.currentServer = "A";
  } else {
    nextSession.currentScoreB += 1;
    nextSession.currentServer = "B";
  }

  const scoredPoint: PointSummary = {
    ...point,
    scoreboard: createScoreboard(nextSession.currentScoreA, nextSession.currentScoreB)
  };

  nextSession.currentSetPoints.push(scoredPoint);
  applyPointFatigue(nextSession, scoredPoint);
  applyMomentumShift(nextSession, scoredPoint);
  updateTelemetry(nextSession, scoredPoint);
  consumeDirective(nextSession.competitorA);
  consumeDirective(nextSession.competitorB);

  nextSession.clockSeconds += 10 + scoredPoint.rallyLength * 2 + rng.nextInt(0, 8);
  createPointFeed(nextSession, scoredPoint);

  const reachedCap = nextSession.currentScoreA === 30 || nextSession.currentScoreB === 30;
  const twoPointMargin = Math.abs(nextSession.currentScoreA - nextSession.currentScoreB) >= 2;
  const reachedGamePoint = nextSession.currentScoreA >= 21 || nextSession.currentScoreB >= 21;

  if (reachedCap || (reachedGamePoint && twoPointMargin)) {
    const winner: Side = nextSession.currentScoreA > nextSession.currentScoreB ? "A" : "B";
    const setSummary: SetSummary = {
      winner,
      scoreA: nextSession.currentScoreA,
      scoreB: nextSession.currentScoreB,
      points: nextSession.currentSetPoints
    };

    nextSession.setSummaries.push(setSummary);
    pushFeed(nextSession, "set", winner === "A" ? "positive" : "info", describeSet(setSummary, nextSession.input));

    if (winner === "A") {
      nextSession.setsWonA += 1;
    } else {
      nextSession.setsWonB += 1;
    }

    if (nextSession.setsWonA === 2 || nextSession.setsWonB === 2) {
      nextSession.complete = true;
      nextSession.winner = nextSession.setsWonA > nextSession.setsWonB ? "A" : "B";
    } else {
      recoverBetweenSets(nextSession);
      nextSession.currentSetNumber += 1;
      nextSession.currentScoreA = 0;
      nextSession.currentScoreB = 0;
      nextSession.currentSetPoints = [];
      nextSession.intermission = true;
    }
  }

  nextSession.rngState = rng.snapshot();
  return nextSession;
}

export function getMatchResultFromSession(session: LiveMatchSession): MatchResult {
  const stats = createStatsFromSets(session.setSummaries, session.competitorA, session.competitorB);

  return {
    winner: session.winner ?? "A",
    setsWonA: session.setsWonA,
    setsWonB: session.setsWonB,
    setSummaries: session.setSummaries,
    stats,
    scoreline: session.setSummaries.map((set) => `${set.scoreA}-${set.scoreB}`).join(", "),
    fidelity: "detailed"
  };
}

export function simulateDetailedMatch(input: MatchInput): MatchResult {
  let session = createMatchSession(input);

  while (!session.complete) {
    session = simulateNextPoint(session);
  }

  return getMatchResultFromSession(session);
}

export function simulateQuickMatch(input: MatchInput): MatchResult {
  const rng = new SeededRng(input.seed);
  const ratingA = quickRating(input.playerA);
  const ratingB = quickRating(input.playerB);
  const tacticFitA = tacticFit(input.playerA, input.playerB, input.tacticA);
  const tacticFitB = tacticFit(input.playerB, input.playerA, input.tacticB);
  const rallyLoad = quickExpectedRallyLoad(input);
  const sets: SetSummary[] = [];
  let setsWonA = 0;
  let setsWonB = 0;
  let staminaA = input.playerA.ratings.physical.stamina;
  let staminaB = input.playerB.ratings.physical.stamina;
  let server: Side = (input.seed & 1) === 0 ? "A" : "B";

  while (setsWonA < 2 && setsWonB < 2) {
    let scoreA = 0;
    let scoreB = 0;
    const points: PointSummary[] = [];

    while (true) {
      const profileA = deriveProfile(input.playerA);
      const profileB = deriveProfile(input.playerB);
      const fatigueEdge = fatiguePenalty(staminaB) - fatiguePenalty(staminaA);
      const pressurePenaltyA =
        scorePressure(scoreA, scoreB) * (100 - profileA.pressureResistance) / 70;
      const pressurePenaltyB =
        scorePressure(scoreB, scoreA) * (100 - profileB.pressureResistance) / 70;
      const serverEdge = server === "A" ? 0.55 : -0.55;
      const tempoEdge = tempoModifiers(input.tacticA).attack - tempoModifiers(input.tacticB).attack;
      const pointNoise = rng.nextNumber(-1.2, 1.2);
      const edge =
        ratingA -
        ratingB +
        tacticFitA -
        tacticFitB +
        fatigueEdge +
        pressurePenaltyB -
        pressurePenaltyA +
        tempoEdge * 0.35 +
        serverEdge +
        pointNoise;
      const pointProbabilityA = clamp(logistic(edge / 10.5), 0.14, 0.86);
      const winner: Side = rng.chance(pointProbabilityA) ? "A" : "B";
      const rallyLength = clamp(Math.round(rallyLoad + rng.nextNumber(-2.5, 4.5) - Math.abs(edge) / 12), 1, 18);

      if (winner === "A") {
        scoreA += 1;
        server = "A";
      } else {
        scoreB += 1;
        server = "B";
      }

      points.push(
        createQuickPointSummary({
          winner,
          rallyLength,
          scoreA,
          scoreB,
          reason: pickQuickReason({
            winner,
            matchInput: input,
            staminaA,
            staminaB,
            rng
          }),
          matchInput: input
        })
      );

      staminaA = Math.max(38, staminaA - quickStaminaBurn(input.playerA, input.tacticA, rallyLength));
      staminaB = Math.max(38, staminaB - quickStaminaBurn(input.playerB, input.tacticB, rallyLength));

      const reachedCap = scoreA === 30 || scoreB === 30;
      const twoPointMargin = Math.abs(scoreA - scoreB) >= 2;
      const reachedGamePoint = scoreA >= 21 || scoreB >= 21;

      if (reachedCap || (reachedGamePoint && twoPointMargin)) {
        const setWinner: Side = scoreA > scoreB ? "A" : "B";
        sets.push({
          winner: setWinner,
          scoreA,
          scoreB,
          points
        });

        if (setWinner === "A") {
          setsWonA += 1;
        } else {
          setsWonB += 1;
        }

        staminaA = Math.min(100, staminaA + 5.5);
        staminaB = Math.min(100, staminaB + 5.5);
        break;
      }
    }
  }

  const result: MatchResult = {
    winner: setsWonA > setsWonB ? "A" : "B",
    setsWonA,
    setsWonB,
    setSummaries: sets,
    stats: createQuickStats({
      input,
      sets,
      staminaA,
      staminaB
    }),
    scoreline: sets.map((set) => `${set.scoreA}-${set.scoreB}`).join(", "),
    fidelity: "quick"
  };

  return {
    ...result,
    summaryEvents: createQuickSummaryEvents(input, result, ratingA, ratingB)
  };
}

export function simulateMatchByFidelity(
  input: MatchInput,
  fidelity: SimulationFidelity
): MatchResult {
  return fidelity === "quick" ? simulateQuickMatch(input) : simulateDetailedMatch(input);
}

export function simulateMatch(input: MatchInput): MatchResult {
  return simulateDetailedMatch(input);
}
