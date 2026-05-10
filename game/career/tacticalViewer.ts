import type { LiveMatchSession, MatchResult, PointSummary, Side, ShotEvent } from "../core/models";
import type { CareerState, TacticalViewerFrame, TacticalViewerZone } from "./models";
import { activeAdvancedTacticPlan, calculateTacticEffectProfile } from "./tactics";

const COURT_ZONES: TacticalViewerZone["zone"][] = [
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

type ZoneAccumulator = Omit<TacticalViewerZone, "pressure" | "strain" | "momentumSwing"> & {
  pressureTotal: number;
  strainTotal: number;
  momentumTotal: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function opposite(side: Side): Side {
  return side === "A" ? "B" : "A";
}

function emptyZone(zone: TacticalViewerZone["zone"]): ZoneAccumulator {
  return {
    zone,
    shots: 0,
    managedShots: 0,
    opponentShots: 0,
    winners: 0,
    errors: 0,
    pressureTotal: 0,
    strainTotal: 0,
    momentumTotal: 0
  };
}

function pointPressure(point: PointSummary) {
  const terminal = point.shots.at(-1);
  const qualityPressure = point.shots.reduce((total, shot) => total + Math.max(0, shot.quality), 0);
  const terminalPressure =
    terminal?.outcome === "winner" || terminal?.outcome === "forced_error"
      ? 18
      : terminal?.outcome === "weak_return"
        ? 10
        : 6;

  return clamp(Math.round(point.rallyLength * 2.7 + qualityPressure / Math.max(1, point.shots.length) + terminalPressure), 0, 100);
}

function shotPressure(shot: ShotEvent) {
  const outcomeBonus =
    shot.outcome === "winner"
      ? 24
      : shot.outcome === "forced_error" || shot.outcome === "weak_return"
        ? 18
        : shot.outcome === "in_play"
          ? 8
          : 4;

  return clamp(Math.round(Math.max(0, shot.quality) * 1.2 + outcomeBonus + shot.targetDifficulty * 0.18), 0, 100);
}

function shotStrain(shot: ShotEvent, shotIndex: number, rallyLength: number) {
  const widthLoad = shot.targetZone.endsWith("left") || shot.targetZone.endsWith("right") ? 10 : 4;
  const depthLoad = shot.targetZone.startsWith("front") || shot.targetZone.startsWith("back") ? 9 : 5;
  const rallyLoad = Math.max(0, rallyLength - 5) * 1.7;
  const executionGap = Math.max(0, shot.targetDifficulty - shot.executionScore) * 0.38;

  return clamp(Math.round(widthLoad + depthLoad + rallyLoad + executionGap + shotIndex * 0.35), 0, 100);
}

function pointStrain(point: PointSummary) {
  if (point.shots.length === 0) {
    return 0;
  }

  const total = point.shots.reduce((sum, shot, index) => sum + shotStrain(shot, index, point.rallyLength), 0);
  return clamp(Math.round(total / point.shots.length), 0, 100);
}

function allPointsFromResult(result: MatchResult) {
  return result.setSummaries.flatMap((set) => set.points);
}

function allPointsFromSession(session: LiveMatchSession) {
  return [...session.setSummaries.flatMap((set) => set.points), ...session.currentSetPoints];
}

function tacticMarkersFromState(state?: CareerState, fallbackLabel?: string) {
  if (!state) {
    return fallbackLabel ? [fallbackLabel] : [];
  }

  const plan = activeAdvancedTacticPlan(state);
  const effect = calculateTacticEffectProfile({ plan, state, opponentId: state.lastPreMatchBrief?.opponentId });

  return [
    plan.name,
    `${effect.winnerPressure} winner pressure`,
    `${effect.strainBias} strain bias`
  ];
}

function projectFrame(args: {
  matchId: string;
  points: PointSummary[];
  managedSide: Side;
  state?: CareerState;
  fallbackTacticLabel?: string;
}): TacticalViewerFrame {
  const zones = new Map<TacticalViewerZone["zone"], ZoneAccumulator>(
    COURT_ZONES.map((zone) => [zone, emptyZone(zone)])
  );
  let momentum = 50;
  let pressureTotal = 0;
  let strainTotal = 0;
  let turningPoint: TacticalViewerFrame["turningPoint"] = null;

  const momentumTimeline = args.points.map((point, index) => {
    const pressure = pointPressure(point);
    const strain = pointStrain(point);
    const wonByManaged = point.winner === args.managedSide;
    const rallySwing = clamp(Math.round(4 + point.rallyLength * 0.28 + pressure / 18), 3, 13);

    momentum = clamp(momentum + (wonByManaged ? rallySwing : -rallySwing), 0, 100);
    pressureTotal += pressure;
    strainTotal += strain;

    if (!turningPoint && Math.abs(momentum - 50) >= 22) {
      turningPoint = `${wonByManaged ? "Managed surge" : "Opponent surge"} after ${point.scoreboard}`;
    }

    for (const [shotIndex, shot] of point.shots.entries()) {
      const target = zones.get(shot.targetZone) ?? emptyZone(shot.targetZone);
      const shotBelongsToManaged = shot.actor === args.managedSide;
      const winnerShot = shot.outcome === "winner" || shot.outcome === "forced_error";
      const errorShot = shot.outcome === "net" || shot.outcome === "out" || shot.outcome === "unforced_error" || shot.outcome === "left_long";
      const movementSide = opposite(shot.actor);

      target.shots += 1;
      target.managedShots += shotBelongsToManaged ? 1 : 0;
      target.opponentShots += shotBelongsToManaged ? 0 : 1;
      target.winners += winnerShot ? 1 : 0;
      target.errors += errorShot ? 1 : 0;
      target.pressureTotal += shotPressure(shot);
      target.strainTotal += shotStrain(shot, shotIndex, point.rallyLength) * (movementSide === args.managedSide ? 1.08 : 0.92);
      target.momentumTotal += shotBelongsToManaged ? pressure / 10 : -pressure / 10;
      zones.set(shot.targetZone, target);
    }

    return {
      sequence: index + 1,
      score: point.scoreboard,
      momentum,
      pressure,
      strain,
      turningPoint: Math.abs(momentum - 50) >= 24 ? (wonByManaged ? "managed pressure" : "opponent pressure") : null
    };
  });

  const zoneRows = [...zones.values()].map((zone) => ({
    zone: zone.zone,
    shots: zone.shots,
    managedShots: zone.managedShots,
    opponentShots: zone.opponentShots,
    winners: zone.winners,
    errors: zone.errors,
    pressure: zone.shots > 0 ? clamp(Math.round(zone.pressureTotal / zone.shots), 0, 100) : 0,
    strain: zone.shots > 0 ? clamp(Math.round(zone.strainTotal / zone.shots), 0, 100) : 0,
    momentumSwing: clamp(Math.round(zone.momentumTotal), -100, 100)
  }));
  const sortedHotZones = [...zoneRows].sort((left, right) => right.pressure + right.strain - (left.pressure + left.strain));
  const hotZone = sortedHotZones[0];
  const pressure = args.points.length > 0 ? clamp(Math.round(pressureTotal / args.points.length), 0, 100) : 0;
  const movementStrain = args.points.length > 0 ? clamp(Math.round(strainTotal / args.points.length), 0, 100) : 0;

  return {
    matchId: args.matchId,
    sequence: args.points.length,
    zones: zoneRows,
    pressure,
    movementStrain,
    momentum,
    tacticMarkers: tacticMarkersFromState(args.state, args.fallbackTacticLabel),
    momentumTimeline: momentumTimeline.slice(-18),
    turningPoint,
    summary: hotZone && hotZone.shots > 0
      ? `${hotZone.zone.replaceAll("_", " ")} carried ${hotZone.pressure} pressure and ${hotZone.strain} strain`
      : "No tactical evidence captured yet"
  };
}

export function projectTacticalViewerFromResult(args: {
  matchId: string;
  result: MatchResult;
  managedSide: Side;
  state?: CareerState;
}): TacticalViewerFrame {
  return projectFrame({
    matchId: args.matchId,
    points: allPointsFromResult(args.result),
    managedSide: args.managedSide,
    state: args.state
  });
}

export function projectTacticalViewerFromSession(args: {
  session: LiveMatchSession;
  managedSide: Side;
  matchId?: string;
}): TacticalViewerFrame {
  const fallbackTacticLabel =
    args.managedSide === "A" ? args.session.input.tacticA.label : args.session.input.tacticB.label;

  return projectFrame({
    matchId: args.matchId ?? "live-match",
    points: allPointsFromSession(args.session),
    managedSide: args.managedSide,
    fallbackTacticLabel
  });
}
