import { z } from "zod";
import {
  liveDirectiveSchema,
  matchTacticSchema,
  playerSchema,
  sideSchema,
  teamTalkSchema
} from "../core/models";

const tournamentMatchSchema = z.object({
  id: z.string(),
  round: z.enum(["R16", "QF", "SF", "F"]),
  sideAId: z.string(),
  sideBId: z.string(),
  winnerId: z.string().optional(),
  scoreline: z.string().optional(),
  managed: z.boolean(),
  completed: z.boolean()
});

const tournamentRoundSchema = z.object({
  name: z.enum(["R16", "QF", "SF", "F"]),
  matches: z.array(tournamentMatchSchema)
});

export const tournamentStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.string(),
  prizePoolUsd: z.number().int().nonnegative(),
  managedPlayerId: z.string(),
  rounds: z.array(tournamentRoundSchema),
  currentRoundIndex: z.number().int().min(0),
  rngState: z.number().int().nonnegative(),
  eliminated: z.boolean(),
  managedResults: z.array(
    z.object({
      round: z.enum(["R16", "QF", "SF", "F"]),
      opponentId: z.string(),
      opponentName: z.string(),
      scoreline: z.string(),
      won: z.boolean(),
      stats: z.object({
        winners: z.number().int().nonnegative(),
        unforcedErrors: z.number().int().nonnegative(),
        totalSmashes: z.number().int().nonnegative(),
        peakSmashSpeed: z.number().int().nonnegative(),
        longestRally: z.number().int().nonnegative(),
        totalPoints: z.number().int().nonnegative(),
        staminaDrain: z.number().int().nonnegative()
      })
    })
  ),
  championId: z.string().optional()
});

const liveCompetitorSchema = z.object({
  stamina: z.number(),
  focusShift: z.number(),
  composureShift: z.number(),
  aggressionShift: z.number(),
  tactic: matchTacticSchema,
  momentum: z.number(),
  errors: z.number().int().nonnegative(),
  smashPeakKph: z.number().int().nonnegative(),
  directive: liveDirectiveSchema.optional(),
  directivePointsRemaining: z.number().int().nonnegative(),
  initialStamina: z.number()
});

const shotEventSchema = z.object({
  actor: sideSchema,
  shotType: z.enum(["serve", "clear", "drop", "smash", "net", "block", "lift", "drive"]),
  targetZone: z.enum([
    "front_left",
    "front_center",
    "front_right",
    "mid_left",
    "mid_center",
    "mid_right",
    "back_left",
    "back_center",
    "back_right"
  ]),
  targetDifficulty: z.number(),
  executionScore: z.number(),
  quality: z.number(),
  outcome: z.enum([
    "in_play",
    "winner",
    "out",
    "net",
    "forced_error",
    "unforced_error",
    "weak_return",
    "left_long"
  ])
});

const pointSummarySchema = z.object({
  winner: sideSchema,
  rallyLength: z.number().int().min(1),
  shots: z.array(shotEventSchema),
  summary: z.string(),
  scoreboard: z.string(),
  reason: z.enum(["winner", "net", "out", "forced_error", "unforced_error", "left_long"])
});

const setSummarySchema = z.object({
  winner: sideSchema,
  scoreA: z.number().int(),
  scoreB: z.number().int(),
  points: z.array(pointSummarySchema)
});

const feedEventSchema = z.object({
  id: z.string(),
  kind: z.enum(["directive", "point", "warning", "alert", "set"]),
  emphasis: z.enum(["neutral", "positive", "danger", "info"]),
  clockLabel: z.string(),
  title: z.string(),
  detail: z.string().optional()
});

const liveMatchSessionSchema = z.object({
  input: z.object({
    seed: z.number().int(),
    playerA: playerSchema,
    playerB: playerSchema,
    tacticA: matchTacticSchema,
    tacticB: matchTacticSchema
  }),
  rngState: z.number().int().nonnegative(),
  setsWonA: z.number().int(),
  setsWonB: z.number().int(),
  setSummaries: z.array(setSummarySchema),
  currentSetNumber: z.number().int().min(1),
  currentScoreA: z.number().int().nonnegative(),
  currentScoreB: z.number().int().nonnegative(),
  currentSetPoints: z.array(pointSummarySchema),
  currentServer: sideSchema,
  competitorA: liveCompetitorSchema,
  competitorB: liveCompetitorSchema,
  pendingTalkA: teamTalkSchema.optional(),
  pendingTalkB: teamTalkSchema.optional(),
  intermission: z.boolean(),
  feed: z.array(feedEventSchema),
  clockSeconds: z.number().int().nonnegative(),
  complete: z.boolean(),
  winner: sideSchema.optional()
});

export const persistedSaveSchema = z.object({
  version: z.literal(2),
  selectedPlayerId: z.string(),
  plannedTacticKey: z.enum([
    "aggressiveSmash",
    "balancedControl",
    "spreadCourt",
    "defensiveWall"
  ]),
  seed: z.number().int(),
  tournament: tournamentStateSchema.nullable(),
  liveMatch: z
    .object({
      matchId: z.string(),
      roundName: z.enum(["R16", "QF", "SF", "F"]),
      managedSide: sideSchema,
      opponentName: z.string(),
      opponentTacticLabel: z.string(),
      session: liveMatchSessionSchema
    })
    .nullable()
});

export type PersistedSave = z.infer<typeof persistedSaveSchema>;
