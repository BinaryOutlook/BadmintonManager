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
  "system",
  "scouting",
  "staff",
  "recruitment",
  "academy"
]);
export type LedgerCategory = z.infer<typeof ledgerCategorySchema>;

export const knowledgeStateSchema = z.enum(["unknown", "estimated", "verified"]);
export type KnowledgeState = z.infer<typeof knowledgeStateSchema>;

export const staffRoleSchema = z.enum(["assistant_coach", "physio", "analyst", "scout", "mental_coach"]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const promiseStatusSchema = z.enum(["active", "kept", "missed", "failed", "withdrawn"]);
export type PromiseStatus = z.infer<typeof promiseStatusSchema>;

export const scoutAssignmentSchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  subjectType: z.enum(["candidate", "prospect", "opponent"]),
  assignedScoutId: z.string(),
  cost: z.number().int().nonnegative(),
  startedAt: z.string(),
  dueAt: z.string(),
  status: z.enum(["pending", "ready", "expired", "cancelled"]),
  scope: z.enum(["profile", "potential", "fit"])
});
export type ScoutAssignment = z.infer<typeof scoutAssignmentSchema>;

export const scoutReportSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  subjectId: z.string(),
  knownFields: z.array(z.string()),
  estimatedFields: z.record(z.string(), z.string()),
  verifiedFields: z.record(z.string(), z.string()),
  confidence: z.number().min(0).max(100),
  accuracy: z.number().min(0).max(100),
  createdAt: z.string(),
  expiresAt: z.string(),
  state: z.enum(["fresh", "verified", "expired"]),
  recommendation: z.string()
});
export type ScoutReport = z.infer<typeof scoutReportSchema>;

export const recruitmentCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().min(16).max(38),
  country: z.string(),
  source: z.string(),
  interest: z.number().min(0).max(100),
  fit: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
  knowledge: z.record(z.string(), knowledgeStateSchema),
  estimatedCost: z.number().int().nonnegative(),
  verifiedCost: z.number().int().nonnegative(),
  offerState: z.enum(["none", "drafted", "accepted", "rejected", "blocked"]),
  rosterImpact: z.enum(["senior", "rotation", "academy_bridge"]),
  promiseRequested: z.string().nullable()
});
export type RecruitmentCandidate = z.infer<typeof recruitmentCandidateSchema>;

export const programRosterSlotSchema = z.object({
  athleteId: z.string(),
  name: z.string(),
  role: z.enum(["lead", "senior", "academy"]),
  contractCost: z.number().int().nonnegative(),
  status: z.enum(["active", "prospect", "offered"]),
  joinedAt: z.string(),
  source: z.string()
});
export type ProgramRosterSlot = z.infer<typeof programRosterSlotSchema>;

export const youthProspectSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.literal(16),
  potentialRange: z.tuple([z.number().int(), z.number().int()]),
  readiness: z.number().min(0).max(100),
  developmentPlan: z.enum(["foundation", "technical", "competition"]),
  developmentTraits: z.array(z.string()),
  mentorOrStaffModifier: z.number(),
  lowerEventEligibility: z.boolean(),
  morale: z.number().min(0).max(100)
});
export type YouthProspect = z.infer<typeof youthProspectSchema>;

export const staffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: staffRoleSchema,
  level: z.number().int().min(1).max(5),
  salary: z.number().int().nonnegative(),
  modifiers: z.object({
    training: z.number(),
    recovery: z.number(),
    scouting: z.number(),
    analysis: z.number(),
    morale: z.number()
  }),
  capacity: z.number().int().positive(),
  adviceBias: z.string(),
  hiredAt: z.string().nullable()
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const athletePsychologySchema = z.object({
  athleteId: z.string(),
  form: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  personalityTraits: z.array(z.enum(["ambitious", "patient", "volatile", "loyal", "analytical"])),
  recentDrivers: z.array(z.string())
});
export type AthletePsychology = z.infer<typeof athletePsychologySchema>;

export const playerPromiseSchema = z.object({
  id: z.string(),
  athleteId: z.string(),
  targetType: z.enum(["reach_qf", "improve_stamina", "beat_top8", "lower_event_entry"]),
  targetValue: z.string(),
  deadline: z.string(),
  createdAt: z.string(),
  status: promiseStatusSchema,
  reward: z.object({
    morale: z.number(),
    confidence: z.number()
  }),
  penalty: z.object({
    morale: z.number(),
    confidence: z.number()
  }),
  resolutionLog: z.array(z.string())
});
export type PlayerPromise = z.infer<typeof playerPromiseSchema>;

export const programEventLogSchema = z.object({
  id: z.string(),
  date: z.string(),
  source: z.enum(["scouting", "recruitment", "academy", "staff", "psychology", "promise", "system"]),
  message: z.string(),
  stateDelta: z.string(),
  relatedIds: z.array(z.string())
});
export type ProgramEventLog = z.infer<typeof programEventLogSchema>;

export const programEcosystemStateSchema = z.object({
  scouting: z.object({
    assignments: z.array(scoutAssignmentSchema),
    reports: z.array(scoutReportSchema),
    capacityUsed: z.number().int().nonnegative()
  }),
  recruitment: z.object({
    candidates: z.array(recruitmentCandidateSchema),
    roster: z.array(programRosterSlotSchema),
    rosterLimit: z.number().int().positive()
  }),
  academy: z.object({
    prospects: z.array(youthProspectSchema)
  }),
  staff: z.object({
    hired: z.array(staffMemberSchema),
    candidates: z.array(staffMemberSchema)
  }),
  psychology: z.array(athletePsychologySchema),
  promises: z.array(playerPromiseSchema),
  programLog: z.array(programEventLogSchema)
});
export type ProgramEcosystemState = z.infer<typeof programEcosystemStateSchema>;

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

export const careerStateV1Schema = z.object({
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

export type CareerStateV1 = z.infer<typeof careerStateV1Schema>;

export const careerStateSchema = careerStateV1Schema.extend({
  version: z.literal(2),
  ecosystem: programEcosystemStateSchema
});
export type CareerState = z.infer<typeof careerStateSchema>;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
