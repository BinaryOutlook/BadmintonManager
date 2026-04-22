import { z } from "zod";
import { matchTacticSchema, playerSchema, sideSchema, teamTalkSchema } from "../core/models";

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
  managedPlayerId: z.string(),
  rounds: z.array(tournamentRoundSchema),
  currentRoundIndex: z.number().int().min(0),
  rngState: z.number().int().nonnegative(),
  eliminated: z.boolean(),
  championId: z.string().optional()
});

const liveCompetitorSchema = z.object({
  stamina: z.number(),
  focusShift: z.number(),
  composureShift: z.number(),
  aggressionShift: z.number(),
  tactic: matchTacticSchema
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
  currentServer: sideSchema,
  competitorA: liveCompetitorSchema,
  competitorB: liveCompetitorSchema,
  pendingTalkA: teamTalkSchema.optional(),
  pendingTalkB: teamTalkSchema.optional(),
  complete: z.boolean(),
  winner: sideSchema.optional()
});

export const persistedSaveSchema = z.object({
  version: z.literal(1),
  selectedPlayerId: z.string(),
  plannedTacticKey: z.enum([
    "balancedControl",
    "backhandPress",
    "grindingLength",
    "allOutAttack"
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
