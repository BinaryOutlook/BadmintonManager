import type {
  CourtZone,
  DerivedProfile,
  MatchTactic,
  Player,
  RiskProfile,
  ShotType,
  TeamTalk
} from "./models";

export function deriveProfile(player: Player): DerivedProfile {
  const { technical, physical, mental } = player.ratings;

  return {
    attackPressure:
      technical.smash * 0.45 +
      physical.explosivenessJump * 0.2 +
      physical.footworkSpeed * 0.15 +
      mental.aggression * 0.2,
    frontCourtControl:
      technical.netPlay * 0.5 +
      technical.serveReturn * 0.25 +
      mental.anticipation * 0.25,
    recoveryQuality:
      technical.defenseRetrieval * 0.45 +
      physical.agilityBalance * 0.25 +
      physical.footworkSpeed * 0.3,
    rallyTolerance:
      physical.stamina * 0.4 + mental.focus * 0.3 + technical.clearLob * 0.3,
    pressureResistance: mental.composure * 0.6 + mental.focus * 0.4,
    judgment: mental.anticipation * 0.55 + mental.focus * 0.45
  };
}

export function getRelevantShotSkill(player: Player, shotType: ShotType) {
  const { technical, physical } = player.ratings;

  switch (shotType) {
    case "serve":
      return technical.serveReturn;
    case "clear":
      return technical.clearLob;
    case "drop":
      return technical.dropShot;
    case "smash":
      return technical.smash * 0.7 + physical.explosivenessJump * 0.3;
    case "net":
      return technical.netPlay;
    case "block":
      return technical.defenseRetrieval;
    case "lift":
      return technical.defenseRetrieval * 0.55 + technical.clearLob * 0.45;
    case "drive":
      return technical.serveReturn * 0.55 + physical.footworkSpeed * 0.45;
  }
}

export function riskModifier(riskProfile: RiskProfile) {
  switch (riskProfile) {
    case "patient":
      return -6;
    case "standard":
      return 0;
    case "high_risk":
      return 8;
  }
}

export function targetZoneModifier(zone: CourtZone) {
  if (zone === "back_center" || zone === "mid_center" || zone === "front_center") {
    return -3;
  }

  if (zone.endsWith("left") || zone.endsWith("right")) {
    return 5;
  }

  return 0;
}

export function tacticShotModifier(tactic: MatchTactic, shotType: ShotType) {
  switch (tactic.pressurePattern) {
    case "backhand_pressure":
      return shotType === "smash" || shotType === "drive" ? 4 : 0;
    case "front_court_control":
      return shotType === "net" || shotType === "drop" ? 6 : -1;
    case "rear_court_grind":
      return shotType === "clear" || shotType === "lift" ? 5 : -1;
    case "all_out_attack":
      return shotType === "smash" ? 8 : shotType === "drop" ? 2 : -2;
  }
}

export function tempoModifiers(tactic: MatchTactic) {
  switch (tactic.tempo) {
    case "fast":
      return { attack: 5, staminaBurn: 1.12 };
    case "balanced":
      return { attack: 0, staminaBurn: 1 };
    case "conserve":
      return { attack: -4, staminaBurn: 0.88 };
  }
}

export function teamTalkAdjustments(teamTalk: TeamTalk) {
  switch (teamTalk) {
    case "encourage":
      return { focusShift: 2, composureShift: 6, aggressionShift: 0, tempo: null };
    case "demand_focus":
      return { focusShift: 7, composureShift: -3, aggressionShift: 0, tempo: null };
    case "increase_tempo":
      return { focusShift: 0, composureShift: -1, aggressionShift: 6, tempo: "fast" as const };
    case "calm_down":
      return {
        focusShift: 3,
        composureShift: 4,
        aggressionShift: -6,
        tempo: "conserve" as const
      };
  }
}

export function scorePressure(scoreFor: number, scoreAgainst: number) {
  const highScore = Math.max(scoreFor, scoreAgainst);
  let pressure = 0;

  if (highScore >= 17) {
    pressure += 6;
  }

  if (highScore >= 19) {
    pressure += 8;
  }

  if (Math.abs(scoreFor - scoreAgainst) <= 1 && highScore >= 18) {
    pressure += 8;
  }

  return pressure;
}
