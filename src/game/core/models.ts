import { z } from "zod";

export const sideSchema = z.enum(["A", "B"]);
export type Side = z.infer<typeof sideSchema>;

export const handednessSchema = z.enum(["right", "left"]);
export type Handedness = z.infer<typeof handednessSchema>;

export const tempoSchema = z.enum(["fast", "balanced", "conserve"]);
export type TempoSetting = z.infer<typeof tempoSchema>;

export const pressurePatternSchema = z.enum([
  "backhand_pressure",
  "front_court_control",
  "rear_court_grind",
  "all_out_attack",
  "wide_pressure",
  "defensive_absorb"
]);
export type PressurePattern = z.infer<typeof pressurePatternSchema>;

export const riskProfileSchema = z.enum(["patient", "standard", "high_risk"]);
export type RiskProfile = z.infer<typeof riskProfileSchema>;

export const teamTalkSchema = z.enum([
  "encourage",
  "demand_focus",
  "increase_tempo",
  "calm_down"
]);
export type TeamTalk = z.infer<typeof teamTalkSchema>;

export const liveDirectiveSchema = z.enum([
  "target_backhand",
  "safe_play_lift",
  "push_pace"
]);
export type LiveDirective = z.infer<typeof liveDirectiveSchema>;

export const simulationFidelitySchema = z.enum(["detailed", "quick"]);
export type SimulationFidelity = z.infer<typeof simulationFidelitySchema>;

export const shotTypeSchema = z.enum([
  "serve",
  "clear",
  "drop",
  "smash",
  "net",
  "block",
  "lift",
  "drive"
]);
export type ShotType = z.infer<typeof shotTypeSchema>;

export const courtZoneSchema = z.enum([
  "front_left",
  "front_center",
  "front_right",
  "mid_left",
  "mid_center",
  "mid_right",
  "back_left",
  "back_center",
  "back_right"
]);
export type CourtZone = z.infer<typeof courtZoneSchema>;

const ratingsSchema = z.object({
  technical: z.object({
    smash: z.number().min(1).max(100),
    netPlay: z.number().min(1).max(100),
    clearLob: z.number().min(1).max(100),
    dropShot: z.number().min(1).max(100),
    defenseRetrieval: z.number().min(1).max(100),
    serveReturn: z.number().min(1).max(100)
  }),
  physical: z.object({
    stamina: z.number().min(1).max(100),
    footworkSpeed: z.number().min(1).max(100),
    explosivenessJump: z.number().min(1).max(100),
    agilityBalance: z.number().min(1).max(100)
  }),
  mental: z.object({
    anticipation: z.number().min(1).max(100),
    composure: z.number().min(1).max(100),
    focus: z.number().min(1).max(100),
    aggression: z.number().min(1).max(100)
  })
});

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  nationality: z.string(),
  age: z.number().int().min(15).max(45),
  handedness: handednessSchema,
  styleLabel: z.string(),
  traits: z.array(z.string()).optional(),
  ratings: ratingsSchema
});
export type Player = z.infer<typeof playerSchema>;

export const matchTacticSchema = z.object({
  label: z.string(),
  tempo: tempoSchema,
  pressurePattern: pressurePatternSchema,
  riskProfile: riskProfileSchema
});
export type MatchTactic = z.infer<typeof matchTacticSchema>;

export interface ShotEvent {
  actor: Side;
  shotType: ShotType;
  targetZone: CourtZone;
  targetDifficulty: number;
  executionScore: number;
  quality: number;
  outcome:
    | "in_play"
    | "winner"
    | "out"
    | "net"
    | "forced_error"
    | "unforced_error"
    | "weak_return"
    | "left_long";
}

export interface PointSummary {
  winner: Side;
  rallyLength: number;
  shots: ShotEvent[];
  summary: string;
  scoreboard: string;
  reason:
    | "winner"
    | "net"
    | "out"
    | "forced_error"
    | "unforced_error"
    | "left_long";
}

export interface SetSummary {
  winner: Side;
  scoreA: number;
  scoreB: number;
  points: PointSummary[];
}

export interface MatchStats {
  winnersA: number;
  winnersB: number;
  unforcedErrorsA: number;
  unforcedErrorsB: number;
  totalSmashesA: number;
  totalSmashesB: number;
  peakSmashSpeedA: number;
  peakSmashSpeedB: number;
  staminaDrainA: number;
  staminaDrainB: number;
  longestRally: number;
  totalPoints: number;
}

export interface MatchSummaryEvent {
  kind:
    | "upset"
    | "straight_games"
    | "decider"
    | "stamina_battle"
    | "attack_pressure"
    | "error_collapse";
  side?: Side;
  title: string;
  detail: string;
}

export interface MatchResult {
  winner: Side;
  setsWonA: number;
  setsWonB: number;
  setSummaries: SetSummary[];
  stats: MatchStats;
  scoreline: string;
  fidelity?: SimulationFidelity;
  summaryEvents?: MatchSummaryEvent[];
}

export interface MatchInput {
  seed: number;
  playerA: Player;
  playerB: Player;
  tacticA: MatchTactic;
  tacticB: MatchTactic;
}

export interface LiveCompetitorState {
  stamina: number;
  focusShift: number;
  composureShift: number;
  aggressionShift: number;
  tactic: MatchTactic;
  momentum: number;
  errors: number;
  smashPeakKph: number;
  directive?: LiveDirective;
  directivePointsRemaining: number;
  initialStamina: number;
}

export interface MatchFeedEvent {
  id: string;
  kind: "directive" | "point" | "warning" | "alert" | "set";
  emphasis: "neutral" | "positive" | "danger" | "info";
  clockLabel: string;
  title: string;
  detail?: string;
}

export interface LiveMatchSession {
  input: MatchInput;
  rngState: number;
  setsWonA: number;
  setsWonB: number;
  setSummaries: SetSummary[];
  currentSetNumber: number;
  currentScoreA: number;
  currentScoreB: number;
  currentSetPoints: PointSummary[];
  currentServer: Side;
  competitorA: LiveCompetitorState;
  competitorB: LiveCompetitorState;
  pendingTalkA?: TeamTalk;
  pendingTalkB?: TeamTalk;
  intermission: boolean;
  feed: MatchFeedEvent[];
  clockSeconds: number;
  complete: boolean;
  winner?: Side;
}

export interface DerivedProfile {
  attackPressure: number;
  frontCourtControl: number;
  recoveryQuality: number;
  rallyTolerance: number;
  pressureResistance: number;
  judgment: number;
}
