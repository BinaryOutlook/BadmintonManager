import type { MatchTactic, PressurePattern, RiskProfile, TempoSetting } from "../core/models";

function createTactic(
  label: string,
  tempo: TempoSetting,
  pressurePattern: PressurePattern,
  riskProfile: RiskProfile
): MatchTactic {
  return { label, tempo, pressurePattern, riskProfile };
}

export const tacticLibrary = {
  balancedControl: createTactic("Balanced Control", "balanced", "front_court_control", "standard"),
  backhandPress: createTactic("Backhand Press", "balanced", "backhand_pressure", "standard"),
  grindingLength: createTactic("Grinding Length", "conserve", "rear_court_grind", "patient"),
  allOutAttack: createTactic("All-Out Attack", "fast", "all_out_attack", "high_risk")
};

export const tacticOptions = Object.values(tacticLibrary);
