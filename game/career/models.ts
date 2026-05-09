import { z } from "zod";

export const careerTierSchema = z.enum([
  "Super 300",
  "Super 500",
  "Super 750",
  "Super 1000",
  "National",
  "Invitational",
  "Finals"
]);
export type CareerTier = z.infer<typeof careerTierSchema>;

export const careerStageSchema = z.enum([
  "planning",
  "event_entered",
  "pre_match",
  "post_match",
  "event_complete"
]);
export type CareerStage = z.infer<typeof careerStageSchema>;

export const ledgerCategorySchema = z.enum([
  "contract",
  "training",
  "travel",
  "entry",
  "prize",
  "sponsor",
  "system"
]);
export type LedgerCategory = z.infer<typeof ledgerCategorySchema>;

export const careerEventDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: careerTierSchema,
  startDate: z.string(),
  durationDays: z.number().int().positive(),
  travelCost: z.number().int().nonnegative(),
  entryFee: z.number().int().nonnegative(),
  trainingCostModifier: z.number().positive(),
  prizeMoney: z.record(z.string(), z.number().int().nonnegative()),
  rankingPoints: z.record(z.string(), z.number().int().nonnegative()),
  prestige: z.number().int().min(1).max(100)
});
export type CareerEventDefinition = z.infer<typeof careerEventDefinitionSchema>;

export const trainingPlanSchema = z.object({
  id: z.string(),
  label: z.string(),
  focus: z.enum(["smash", "stamina", "composure", "recovery"]),
  intensity: z.enum(["light", "standard", "heavy", "recovery"]),
  cost: z.number().int().nonnegative(),
  attributeDelta: z.object({
    smash: z.number(),
    stamina: z.number(),
    composure: z.number(),
    recovery: z.number()
  }),
  fatigueDelta: z.number(),
  injuryRiskDelta: z.number(),
  recoveryDelta: z.number()
});
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;

export const athleteCareerStateSchema = z.object({
  playerId: z.string(),
  development: z.object({
    smash: z.number(),
    stamina: z.number(),
    composure: z.number(),
    recovery: z.number()
  }),
  fatigue: z.number().min(0).max(100),
  injuryRisk: z.number().min(0).max(1),
  readiness: z.number().min(0).max(100),
  recoveryStatus: z.enum(["fresh", "ready", "loaded", "red_zone", "injured"]),
  rankingPoints: z.number().int().nonnegative(),
  currentRank: z.number().int().positive()
});
export type AthleteCareerState = z.infer<typeof athleteCareerStateSchema>;

export const economyLedgerEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  category: ledgerCategorySchema,
  label: z.string(),
  amount: z.number().int(),
  balanceAfter: z.number().int()
});
export type EconomyLedgerEntry = z.infer<typeof economyLedgerEntrySchema>;

export const programEconomySchema = z.object({
  cash: z.number().int(),
  contractCostPerWeek: z.number().int().nonnegative(),
  trainingSpend: z.number().int().nonnegative(),
  travelSpend: z.number().int().nonnegative(),
  prizeIncome: z.number().int().nonnegative(),
  ledger: z.array(economyLedgerEntrySchema)
});
export type ProgramEconomy = z.infer<typeof programEconomySchema>;

export const rankingEntrySchema = z.object({
  playerId: z.string(),
  rank: z.number().int().positive(),
  points: z.number().int().nonnegative(),
  eventHistory: z.array(
    z.object({
      eventId: z.string(),
      round: z.string(),
      points: z.number().int().nonnegative()
    })
  )
});
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export const preMatchBriefSchema = z.object({
  eventId: z.string(),
  opponentId: z.string(),
  readiness: z.number().min(0).max(100),
  riskNote: z.string(),
  tierStakes: z.string(),
  recommendation: z.string(),
  opponentBrief: z.string()
});
export type PreMatchBrief = z.infer<typeof preMatchBriefSchema>;

export const postMatchReportSchema = z.object({
  eventId: z.string(),
  matchId: z.string(),
  opponentId: z.string(),
  result: z.enum(["win", "loss"]),
  scoreline: z.string(),
  round: z.string(),
  pointsDelta: z.number().int().nonnegative(),
  cashDelta: z.number().int(),
  fatigueDelta: z.number(),
  evidence: z.array(z.string()),
  recommendations: z.array(z.string())
});
export type PostMatchReport = z.infer<typeof postMatchReportSchema>;

export const careerStateSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  date: z.string(),
  seasonId: z.string(),
  stage: careerStageSchema,
  program: z.object({
    id: z.string(),
    name: z.string(),
    managedPlayerId: z.string()
  }),
  athletes: z.array(athleteCareerStateSchema),
  events: z.array(careerEventDefinitionSchema),
  enteredEventIds: z.array(z.string()),
  completedEventIds: z.array(z.string()),
  activeEventId: z.string().nullable(),
  rankings: z.array(rankingEntrySchema),
  economy: programEconomySchema,
  selectedTrainingPlanId: z.string().nullable(),
  lastPreMatchBrief: preMatchBriefSchema.nullable(),
  lastMatchReport: postMatchReportSchema.nullable(),
  notes: z.array(z.string())
});
export type CareerState = z.infer<typeof careerStateSchema>;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
