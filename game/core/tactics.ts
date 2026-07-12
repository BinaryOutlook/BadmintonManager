import type { CourtZone, MatchTactic, Player, ShotType } from "./models";

const SHOT_TYPES: ShotType[] = ["serve", "clear", "drop", "smash", "net", "block", "lift", "drive"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function centered(value: number) {
  return (value - 50) / 50;
}

function emptyShotWeights() {
  return Object.fromEntries(SHOT_TYPES.map((shotType) => [shotType, 0])) as Record<ShotType, number>;
}

export interface TacticRuntimeProfile {
  advanced: boolean;
  attackBonus: number;
  staminaBurnMultiplier: number;
  riskDifficulty: number;
  rallyStressMultiplier: number;
  expectedRallyDelta: number;
  quickPointEdge: number;
  shotWeightDeltas: Record<ShotType, number>;
  frontZoneWeight: number;
  backZoneWeight: number;
  bodyZoneWeight: number;
  wideZoneWeight: number;
  backhandZoneWeight: number;
  frontPlacementPressure: number;
  backPlacementPressure: number;
  bodyPlacementPressure: number;
}

const LEGACY_RUNTIME_PROFILE: TacticRuntimeProfile = {
  advanced: false,
  attackBonus: 0,
  staminaBurnMultiplier: 1,
  riskDifficulty: 0,
  rallyStressMultiplier: 1,
  expectedRallyDelta: 0,
  quickPointEdge: 0,
  shotWeightDeltas: emptyShotWeights(),
  frontZoneWeight: 0,
  backZoneWeight: 0,
  bodyZoneWeight: 0,
  wideZoneWeight: 0,
  backhandZoneWeight: 0,
  frontPlacementPressure: 0,
  backPlacementPressure: 0,
  bodyPlacementPressure: 0
};

export function deriveTacticRuntimeProfile(tactic: MatchTactic): TacticRuntimeProfile {
  const intent = tactic.advancedIntent;

  if (!intent) {
    return LEGACY_RUNTIME_PROFILE;
  }

  const tempo = centered(intent.tempo);
  const rear = centered(intent.rearCourtPressure);
  const net = centered(intent.netPriority);
  const risk = centered(intent.riskTolerance);
  const shorten = intent.rallyLengthIntent === "shorten" ? 1 : 0;
  const extend = intent.rallyLengthIntent === "extend" ? 1 : 0;
  const modules = new Set(intent.modules);
  const targetBackhand = modules.has("target_backhand") ? 1 : 0;
  const netTrap = modules.has("net_trap") ? 1 : 0;
  const rearCourtLock = modules.has("rear_court_lock") ? 1 : 0;
  const bodySmash = modules.has("body_smash") ? 1 : 0;
  const safeLift = modules.has("safe_lift_release") ? 1 : 0;
  const frontPlacementPressure = net * 1.3 + netTrap * 1.2;
  const backPlacementPressure = rear * 1.3 + rearCourtLock * 1.2;
  const bodyPlacementPressure = bodySmash * 2;
  const attackBonus = clamp(
    tempo * 1.8 + rear * 1.2 + shorten - extend * 0.4 + bodySmash * 0.8,
    -4,
    4.5
  );
  const riskDifficulty = clamp(risk * 2.6 + bodySmash * 0.8 - safeLift * 1.8, -3.5, 4);

  return {
    advanced: true,
    attackBonus,
    staminaBurnMultiplier: clamp(
      1 + tempo * 0.035 + Math.max(0, rear) * 0.018 + extend * 0.025 + shorten * 0.012 + bodySmash * 0.015 - safeLift * 0.02,
      0.93,
      1.12
    ),
    riskDifficulty,
    rallyStressMultiplier: clamp(1 + tempo * 0.03 + shorten * 0.12 - extend * 0.14 - safeLift * 0.04, 0.78, 1.18),
    expectedRallyDelta: clamp(extend * 1.6 - shorten * 1.3 + safeLift * 0.6 + rearCourtLock * 0.25 - bodySmash * 0.3, -2, 2.5),
    quickPointEdge: clamp(
      attackBonus + (frontPlacementPressure + backPlacementPressure + bodyPlacementPressure) * 0.25 - Math.max(0, riskDifficulty) * 0.35,
      -5,
      5
    ),
    shotWeightDeltas: {
      serve: 0,
      clear: rear * 1.1 + extend * 1.7 + safeLift * 2.6,
      drop: net * 1.4 + rear * 0.3 + netTrap * 1.8 + targetBackhand * 0.4,
      smash: rear * 2.2 + tempo * 1.1 + risk * 0.65 + bodySmash * 3 + shorten * 0.8 + targetBackhand * 0.5,
      net: net * 2.4 + netTrap * 3,
      block: extend * 1.4 + safeLift * 2.7 - risk * 0.35,
      lift: extend * 1.7 + safeLift * 3.2 - risk * 0.3,
      drive: tempo * 1.2 + rear * 0.6 + targetBackhand * 1.2
    },
    frontZoneWeight: net * 2 + netTrap * 2.4,
    backZoneWeight: rear * 2 + rearCourtLock * 2.4,
    bodyZoneWeight: bodySmash * 3,
    wideZoneWeight: Math.max(0, risk) * 1.2,
    backhandZoneWeight: targetBackhand * 4,
    frontPlacementPressure,
    backPlacementPressure,
    bodyPlacementPressure
  };
}

export function runtimeZoneWeight(
  profile: TacticRuntimeProfile,
  zone: CourtZone,
  defender: Player
) {
  const backhandSide = defender.handedness === "right" ? "left" : "right";

  return (
    (zone.startsWith("front") ? profile.frontZoneWeight : 0) +
    (zone.startsWith("back") ? profile.backZoneWeight : 0) +
    (zone === "mid_center" ? profile.bodyZoneWeight : 0) +
    (zone.endsWith("left") || zone.endsWith("right") ? profile.wideZoneWeight : 0) +
    (zone.endsWith(backhandSide) ? profile.backhandZoneWeight : 0)
  );
}

export function runtimePlacementPressure(profile: TacticRuntimeProfile, zone: CourtZone) {
  return (
    (zone.startsWith("front") ? profile.frontPlacementPressure : 0) +
    (zone.startsWith("back") ? profile.backPlacementPressure : 0) +
    (zone === "mid_center" ? profile.bodyPlacementPressure : 0)
  );
}
