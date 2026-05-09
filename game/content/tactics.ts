import type {
  LiveDirective,
  MatchTactic,
  PressurePattern,
  RiskProfile,
  TempoSetting
} from "../core/models";

export interface TacticDefinition {
  label: string;
  summary: string;
  cue: string;
  accent: "lime" | "cyan" | "slate" | "rose";
  tactic: MatchTactic;
}

export interface LiveDirectiveOption {
  id: LiveDirective;
  label: string;
  summary: string;
  accent: "lime" | "cyan" | "slate";
}

function createTactic(
  label: string,
  tempo: TempoSetting,
  pressurePattern: PressurePattern,
  riskProfile: RiskProfile
): MatchTactic {
  return { label, tempo, pressurePattern, riskProfile };
}

function defineTactic(
  label: string,
  summary: string,
  cue: string,
  accent: TacticDefinition["accent"],
  tempo: TempoSetting,
  pressurePattern: PressurePattern,
  riskProfile: RiskProfile
): TacticDefinition {
  return {
    label,
    summary,
    cue,
    accent,
    tactic: createTactic(label, tempo, pressurePattern, riskProfile)
  };
}

export const tacticDefinitions = {
  aggressiveSmash: defineTactic(
    "Aggressive Smash",
    "Prioritize power attacks from the rear court and accept faster stamina burn.",
    "High initiative",
    "lime",
    "fast",
    "all_out_attack",
    "high_risk"
  ),
  balancedControl: defineTactic(
    "Balanced Control",
    "Play for placement, rally stability, and pressure management across long passages.",
    "Moderate pace",
    "cyan",
    "balanced",
    "front_court_control",
    "standard"
  ),
  spreadCourt: defineTactic(
    "Spread Court",
    "Use width and repeated corner pressure to stretch the opponent and tax recovery.",
    "Endurance squeeze",
    "slate",
    "balanced",
    "wide_pressure",
    "standard"
  ),
  defensiveWall: defineTactic(
    "Defensive Wall",
    "Absorb hard exchanges, extend rallies, and wait for the other side to overreach.",
    "Risk control",
    "rose",
    "conserve",
    "defensive_absorb",
    "patient"
  )
} satisfies Record<string, TacticDefinition>;

export const tacticLibrary = Object.fromEntries(
  Object.entries(tacticDefinitions).map(([key, definition]) => [key, definition.tactic])
) as Record<keyof typeof tacticDefinitions, MatchTactic>;

export const tacticOptions = Object.entries(tacticDefinitions).map(([key, definition]) => ({
  key: key as keyof typeof tacticDefinitions,
  ...definition
}));

export const liveDirectiveOptions: LiveDirectiveOption[] = [
  {
    id: "target_backhand",
    label: "Target Backhand",
    summary: "Press the weaker shoulder lane and look for cramped replies.",
    accent: "cyan"
  },
  {
    id: "safe_play_lift",
    label: "Safe Play (Lift)",
    summary: "Take heat out of the rally and reset with higher-margin shots.",
    accent: "slate"
  },
  {
    id: "push_pace",
    label: "Push Pace",
    summary: "Increase tempo now and try to seize the next scoring burst.",
    accent: "lime"
  }
];
