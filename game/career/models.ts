import { z } from "zod";

const circuitPointTiers = ["300", "500", "750", "1000"] as const;
const legacyTierPrefix = "Super";
const circuitTierLabels = circuitPointTiers.map((points) => `Circuit ${points}`) as [
  "Circuit 300",
  "Circuit 500",
  "Circuit 750",
  "Circuit 1000"
];

export function normalizeCareerTierLabel(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const legacyPointTier = circuitPointTiers.find((points) => value === `${legacyTierPrefix} ${points}`);

  return legacyPointTier ? `Circuit ${legacyPointTier}` : value;
}

export const careerTierSchema = z.preprocess(
  normalizeCareerTierLabel,
  z.enum([...circuitTierLabels, "National", "Invitational", "Finals"])
);
export type CareerTier = z.infer<typeof careerTierSchema>;

export type TournamentAddress = {
  seasonId: string;
  eventId: string;
};

export const careerEventStatusSchema = z.enum([
  "scheduled",
  "entry_open",
  "entry_closed",
  "draw_published",
  "in_progress",
  "completed"
]);
export type CareerEventStatus = z.infer<typeof careerEventStatusSchema>;

export const careerStageSchema = z.enum([
  "planning",
  "event_entered",
  "between_rounds",
  "pre_match",
  "post_match",
  "event_complete"
]);
export type CareerStage = z.infer<typeof careerStageSchema>;

export const careerEventHistoryStatusSchema = z.enum([
  "champion",
  "runner_up",
  "semi_final",
  "quarter_final",
  "round_of_16",
  "skipped",
  "missed_deadline",
  "withdrawn"
]);
export type CareerEventHistoryStatus = z.infer<typeof careerEventHistoryStatusSchema>;

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
  "academy",
  "facility",
  "media",
  "federation"
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

export const programLowerEventEntrySchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  subjectType: z.enum(["youth_prospect", "roster_athlete"]),
  subjectName: z.string(),
  eventName: z.string(),
  tier: z.preprocess(normalizeCareerTierLabel, z.enum(["National", "Invitational", "Circuit 300"])),
  enteredAt: z.string(),
  cost: z.number().int().nonnegative(),
  readinessAtEntry: z.number().min(0).max(100),
  resultRound: z.enum(["R16", "QF", "SF", "F", "champion"]),
  status: z.enum(["entered", "completed"])
});
export type ProgramLowerEventEntry = z.infer<typeof programLowerEventEntrySchema>;

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
  source: z.enum(["scouting", "recruitment", "academy", "staff", "psychology", "promise", "tactics", "advice", "system"]),
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
  lowerEventEntries: z.array(programLowerEventEntrySchema).default([]),
  psychology: z.array(athletePsychologySchema),
  promises: z.array(playerPromiseSchema),
  programLog: z.array(programEventLogSchema)
});
export type ProgramEcosystemState = z.infer<typeof programEcosystemStateSchema>;

export const rivalTrainingBiasSchema = z.enum(["attack", "endurance", "control", "balanced"]);
export type RivalTrainingBias = z.infer<typeof rivalTrainingBiasSchema>;

export const rivalStrategySchema = z.enum(["points_chaser", "prestige_hunter", "developmental", "selective"]);
export type RivalStrategy = z.infer<typeof rivalStrategySchema>;

export const rivalAthleteStateSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  age: z.number().int().min(16).max(42),
  rating: z.number().min(1).max(100),
  form: z.number().min(0).max(100),
  fatigue: z.number().min(0).max(100),
  rankingPoints: z.number().int().nonnegative(),
  currentRank: z.number().int().positive(),
  trend: z.enum(["surging", "steady", "sliding"])
});
export type RivalAthleteState = z.infer<typeof rivalAthleteStateSchema>;

export const rivalEventEntrySchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  tier: careerTierSchema,
  selectedAt: z.string(),
  status: z.enum(["selected", "entered", "completed", "withdrawn"]),
  fieldStrength: z.number().min(0).max(100),
  projectedRound: z.enum(["R16", "QF", "SF", "F", "champion"]),
  resultRound: z.enum(["R16", "QF", "SF", "F", "champion"]).nullable(),
  pointsAwarded: z.number().int().nonnegative()
});
export type RivalEventEntry = z.infer<typeof rivalEventEntrySchema>;

export const rivalProgressionEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  rivalId: z.string(),
  type: z.enum(["training", "event_entry", "event_result", "decline", "form", "selection"]),
  stateDelta: z.string(),
  reason: z.string(),
  visibility: z.enum(["public", "scouted", "internal"])
});
export type RivalProgressionEvent = z.infer<typeof rivalProgressionEventSchema>;

export const rivalProgramStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  strategy: rivalStrategySchema,
  budgetTier: z.enum(["lean", "stable", "elite"]),
  trainingBias: rivalTrainingBiasSchema,
  ageCurve: z.object({
    peakAge: z.number().int().min(18).max(32),
    declineRate: z.number().min(0).max(1)
  }),
  roster: z.array(rivalAthleteStateSchema),
  eventEntries: z.array(rivalEventEntrySchema),
  form: z.number().min(0).max(100),
  reputation: z.number().min(0).max(100),
  pressureScore: z.number().min(0).max(100),
  progressionLog: z.array(rivalProgressionEventSchema)
});
export type RivalProgramState = z.infer<typeof rivalProgramStateSchema>;

export const rivalEventPressureSchema = z.object({
  eventId: z.string(),
  rivalCount: z.number().int().nonnegative(),
  averageThreat: z.number().min(0).max(100),
  pressureScore: z.number().min(0).max(100),
  topThreatName: z.string()
});
export type RivalEventPressure = z.infer<typeof rivalEventPressureSchema>;

export const rivalCircuitStateSchema = z.object({
  programs: z.array(rivalProgramStateSchema),
  fieldPressure: z.array(rivalEventPressureSchema),
  circuitLog: z.array(rivalProgressionEventSchema),
  lastSimulatedDate: z.string()
});
export type RivalCircuitState = z.infer<typeof rivalCircuitStateSchema>;

export const tacticModuleSchema = z.enum([
  "target_backhand",
  "net_trap",
  "rear_court_lock",
  "body_smash",
  "safe_lift_release"
]);
export type TacticModule = z.infer<typeof tacticModuleSchema>;

export const rallyLengthIntentSchema = z.enum(["shorten", "balanced", "extend"]);
export type RallyLengthIntent = z.infer<typeof rallyLengthIntentSchema>;

export const advancedTacticPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  tempo: z.number().int().min(0).max(100),
  rearCourtPressure: z.number().int().min(0).max(100),
  netPriority: z.number().int().min(0).max(100),
  riskTolerance: z.number().int().min(0).max(100),
  rallyLengthIntent: rallyLengthIntentSchema,
  modules: z.array(tacticModuleSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type AdvancedTacticPlan = z.infer<typeof advancedTacticPlanSchema>;

export const tacticEffectProfileSchema = z.object({
  planId: z.string(),
  staminaLoad: z.number().min(0).max(100),
  errorRisk: z.number().min(0).max(100),
  winnerPressure: z.number().min(0).max(100),
  netControl: z.number().min(0).max(100),
  rearCourtControl: z.number().min(0).max(100),
  strainBias: z.number().min(0).max(100),
  matchupNotes: z.array(z.string())
});
export type TacticEffectProfile = z.infer<typeof tacticEffectProfileSchema>;

export const adviceTopicSchema = z.enum(["tactics", "training", "rotation", "scouting"]);
export type AdviceTopic = z.infer<typeof adviceTopicSchema>;

export const advicePacketSchema = z.object({
  id: z.string(),
  sourceRole: staffRoleSchema,
  topic: adviceTopicSchema,
  recommendation: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(100),
  inputs: z.array(z.string()),
  tradeoff: z.string(),
  suggestedPlan: advancedTacticPlanSchema.partial().nullable(),
  suggestedTrainingPlanId: z.string().nullable(),
  subjectId: z.string().nullable(),
  createdAt: z.string(),
  appliedAt: z.string().nullable(),
  overrideState: z.enum(["pending", "applied", "overridden"]),
  overrideReason: z.string().nullable()
});
export type AdvicePacket = z.infer<typeof advicePacketSchema>;

export const matchPlanningStateSchema = z.object({
  plans: z.array(advancedTacticPlanSchema),
  activePlanId: z.string(),
  advice: z.array(advicePacketSchema),
  overrideLog: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      adviceId: z.string(),
      topic: adviceTopicSchema,
      reason: z.string()
    })
  )
});
export type MatchPlanningState = z.infer<typeof matchPlanningStateSchema>;

export const facilityTypeSchema = z.enum([
  "training_hall",
  "recovery_center",
  "analytics_lab",
  "youth_academy",
  "travel_quality"
]);
export type FacilityType = z.infer<typeof facilityTypeSchema>;

export const facilityModifierSchema = z.object({
  trainingDevelopment: z.number(),
  recoveryFatigue: z.number(),
  injuryMitigation: z.number(),
  scoutingAccuracy: z.number(),
  adviceQuality: z.number(),
  youthReadiness: z.number(),
  travelCostReduction: z.number(),
  travelFatigueReduction: z.number(),
  pressureResistance: z.number()
});
export type FacilityModifier = z.infer<typeof facilityModifierSchema>;

export const facilityStateSchema = z.object({
  id: z.string(),
  type: facilityTypeSchema,
  label: z.string(),
  level: z.number().int().min(0).max(3),
  maxLevel: z.number().int().min(1).max(3),
  nextUpgradeCost: z.number().int().nonnegative(),
  maintenanceCost: z.number().int().nonnegative(),
  buildTimeDays: z.number().int().nonnegative(),
  buildCompleteDate: z.string().nullable().optional(),
  status: z.enum(["ready", "building", "maxed"]),
  modifiers: facilityModifierSchema,
  history: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      level: z.number().int().min(0).max(3),
      cost: z.number().int().nonnegative(),
      note: z.string()
    })
  )
});
export type FacilityState = z.infer<typeof facilityStateSchema>;

export const sponsorObjectiveStatusSchema = z.enum(["active", "fulfilled", "failed", "expired", "withdrawn"]);
export type SponsorObjectiveStatus = z.infer<typeof sponsorObjectiveStatusSchema>;

export const sponsorObjectiveSchema = z.object({
  id: z.string(),
  sponsorId: z.string(),
  sponsorName: z.string(),
  target: z.enum(["reach_qf", "win_match", "enter_tier", "maintain_reputation", "readiness_floor"]),
  description: z.string(),
  deadline: z.string(),
  reward: z.object({
    cash: z.number().int(),
    reputation: z.number(),
    morale: z.number()
  }),
  penalty: z.object({
    cash: z.number().int(),
    reputation: z.number(),
    morale: z.number()
  }),
  status: sponsorObjectiveStatusSchema,
  progress: z.number().min(0).max(100),
  relatedEventIds: z.array(z.string()),
  resolutionLog: z.array(z.string())
});
export type SponsorObjective = z.infer<typeof sponsorObjectiveSchema>;

export const pressEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  headline: z.string(),
  pressure: z.number().min(0).max(100),
  reputationDelta: z.number(),
  moraleDelta: z.number(),
  status: z.enum(["active", "answered", "settled"])
});
export type PressEvent = z.infer<typeof pressEventSchema>;

export const mediaReactionLogSchema = z.object({
  id: z.string(),
  date: z.string(),
  source: z.enum(["sponsor", "press", "federation", "facility", "system"]),
  message: z.string(),
  stateDelta: z.string(),
  relatedIds: z.array(z.string())
});
export type MediaReactionLog = z.infer<typeof mediaReactionLogSchema>;

export const mediaSponsorStateSchema = z.object({
  sponsors: z.array(sponsorObjectiveSchema),
  federationObjectives: z.array(sponsorObjectiveSchema),
  pressEvents: z.array(pressEventSchema),
  reputation: z.number().min(0).max(100),
  reactionLog: z.array(mediaReactionLogSchema)
});
export type MediaSponsorState = z.infer<typeof mediaSponsorStateSchema>;

export const careerEventDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: careerTierSchema,
  weekNumber: z.number().int().positive().default(1),
  startDate: z.string(),
  durationDays: z.number().int().positive(),
  location: z
    .object({
      city: z.string(),
      country: z.string(),
      venue: z.string()
    })
    .default({
      city: "Local Circuit",
      country: "Fictional Circuit",
      venue: "Training Hall"
    }),
  entryDeadline: z.string().default("2026-06-01"),
  rankingCutoffDate: z.string().default("2026-06-01"),
  seedingDate: z.string().default("2026-06-01"),
  withdrawalDeadline: z.string().default("2026-06-01"),
  drawDate: z.string().default("2026-06-01"),
  drawSize: z.number().int().positive().default(16),
  seedCount: z.number().int().nonnegative().default(8),
  status: careerEventStatusSchema.default("scheduled"),
  eligibility: z
    .object({
      minRank: z.number().int().positive().nullable(),
      minPoints: z.number().int().nonnegative().nullable(),
      readinessFloor: z.number().int().min(0).max(100),
      minCompletedEvents: z.number().int().nonnegative().nullable()
    })
    .default({
      minRank: null,
      minPoints: null,
      readinessFloor: 0,
      minCompletedEvents: null
    }),
  stakesLabel: z.string().default("Circuit points and program funding"),
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

export const injuryEpisodeSchema = z.object({
  status: z.enum(["healthy", "managed", "out"]),
  label: z.string(),
  daysRemaining: z.number().int().nonnegative(),
  triggeredAt: z.string().nullable(),
  returnDate: z.string().nullable(),
  notes: z.array(z.string())
});
export type InjuryEpisode = z.infer<typeof injuryEpisodeSchema>;

export function createHealthyInjuryState(): InjuryEpisode {
  return {
    status: "healthy",
    label: "Available",
    daysRemaining: 0,
    triggeredAt: null,
    returnDate: null,
    notes: ["No active injury episode"]
  };
}

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
  injury: injuryEpisodeSchema.default(createHealthyInjuryState),
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

export const careerEventBracketSnapshotSchema = z.object({
  championId: z.string().nullable(),
  managedPlayerId: z.string(),
  rounds: z.array(
    z.object({
      name: z.enum(["R16", "QF", "SF", "F"]),
      matches: z.array(
        z.object({
          id: z.string(),
          sideAId: z.string(),
          sideBId: z.string(),
          winnerId: z.string().nullable(),
          scoreline: z.string().nullable(),
          managed: z.boolean()
        })
      )
    })
  )
});
export type CareerEventBracketSnapshot = z.infer<typeof careerEventBracketSnapshotSchema>;

export const careerEventHistoryRecordSchema = z.object({
  eventId: z.string(),
  eventName: z.string(),
  tier: careerTierSchema,
  startDate: z.string(),
  endDate: z.string(),
  status: careerEventHistoryStatusSchema,
  entered: z.boolean(),
  resultRound: z.string().nullable(),
  pointsAwarded: z.number().int().nonnegative(),
  prizeMoney: z.number().int().nonnegative(),
  entryCost: z.number().int().nonnegative(),
  travelCost: z.number().int().nonnegative(),
  netCash: z.number().int(),
  completedAt: z.string(),
  matchIds: z.array(z.string()),
  scorelines: z.array(z.string()),
  achievements: z.array(z.string()),
  bracketSnapshot: careerEventBracketSnapshotSchema.nullable().optional()
});
export type CareerEventHistoryRecord = z.infer<typeof careerEventHistoryRecordSchema>;

export const careerMatchRecordSchema = z.object({
  id: z.string(),
  seasonId: z.string().optional(),
  eventId: z.string(),
  eventName: z.string(),
  date: z.string(),
  round: z.enum(["R16", "QF", "SF", "F"]),
  playerAId: z.string(),
  playerBId: z.string(),
  winnerId: z.string(),
  scoreline: z.string(),
  source: z.enum(["played", "quick_sim", "universe_sim", "backfill_sim", "archive_import"]).default("archive_import")
});
export type CareerMatchRecord = z.infer<typeof careerMatchRecordSchema>;
export type CareerMatchRecordSource = CareerMatchRecord["source"];

export const universeEventRecordSourceSchema = z.enum([
  "live_progression",
  "post_elimination",
  "unentered_sim",
  "backfill_sim",
  "archive_import",
  "legacy_unavailable"
]);
export type UniverseEventRecordSource = z.infer<typeof universeEventRecordSourceSchema>;

export const universeEventRecordStatusSchema = z.enum([
  "scheduled",
  "drawn",
  "in_progress",
  "completed",
  "legacy_unavailable"
]);
export type UniverseEventRecordStatus = z.infer<typeof universeEventRecordStatusSchema>;

export const universeManagedPlayerResultSchema = z
  .enum(["not_entered", "R16", "QF", "SF", "F", "champion"])
  .nullable();
export type UniverseManagedPlayerResult = z.infer<typeof universeManagedPlayerResultSchema>;

export const careerUniverseTournamentPlacementSchema = z.object({
  playerId: z.string(),
  resultRound: z.enum(["R16", "QF", "SF", "F", "champion"]),
  pointsAwarded: z.number().int().nonnegative()
});
export type CareerUniverseTournamentPlacement = z.infer<typeof careerUniverseTournamentPlacementSchema>;

export const careerUniverseTournamentRecordSchema = z.object({
  seasonId: z.string(),
  eventId: z.string(),
  source: universeEventRecordSourceSchema,
  status: universeEventRecordStatusSchema,
  drawDate: z.string(),
  startDate: z.string(),
  completedAt: z.string().nullable(),
  entrants: z.array(z.string()),
  matchIds: z.array(z.string()),
  championId: z.string().nullable(),
  runnerUpId: z.string().nullable(),
  placements: z.array(careerUniverseTournamentPlacementSchema),
  managedPlayerResult: universeManagedPlayerResultSchema
});
export type CareerUniverseTournamentRecord = z.infer<typeof careerUniverseTournamentRecordSchema>;

export const playerCareerAchievementSchema = z.object({
  playerId: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  date: z.string(),
  result: z.enum(["champion", "runner_up"])
});
export type PlayerCareerAchievement = z.infer<typeof playerCareerAchievementSchema>;

export const rankingEntrySchema = z.object({
  playerId: z.string(),
  rank: z.number().int().positive(),
  points: z.number().int().nonnegative(),
  seasonPoints: z.number().int().nonnegative().default(0),
  eventHistory: z.array(
    z.object({
      eventId: z.string(),
      round: z.string(),
      points: z.number().int().nonnegative(),
      date: z.string().optional(),
      seasonId: z.string().optional(),
      tier: careerTierSchema.optional()
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
  recommendations: z.array(z.string()),
  tacticalViewer: z
    .object({
      matchId: z.string(),
      sequence: z.number().int().nonnegative(),
      zones: z.array(
        z.object({
          zone: z.enum([
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
          shots: z.number().int().nonnegative(),
          managedShots: z.number().int().nonnegative(),
          opponentShots: z.number().int().nonnegative(),
          winners: z.number().int().nonnegative(),
          errors: z.number().int().nonnegative(),
          pressure: z.number().min(0).max(100),
          strain: z.number().min(0).max(100),
          momentumSwing: z.number().min(-100).max(100)
        })
      ),
      pressure: z.number().min(0).max(100),
      movementStrain: z.number().min(0).max(100),
      momentum: z.number().min(0).max(100),
      tacticMarkers: z.array(z.string()),
      momentumTimeline: z.array(
        z.object({
          sequence: z.number().int().positive(),
          score: z.string(),
          momentum: z.number().min(0).max(100),
          pressure: z.number().min(0).max(100),
          strain: z.number().min(0).max(100),
          turningPoint: z.string().nullable()
        })
      ),
      turningPoint: z.string().nullable(),
      summary: z.string()
    })
    .nullable()
    .default(null)
});
export type PostMatchReport = z.infer<typeof postMatchReportSchema>;
export type TacticalViewerFrame = NonNullable<PostMatchReport["tacticalViewer"]>;
export type TacticalViewerZone = TacticalViewerFrame["zones"][number];

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

export const careerStateV2Schema = careerStateV1Schema.extend({
  version: z.literal(2),
  ecosystem: programEcosystemStateSchema
});
export type CareerStateV2 = z.infer<typeof careerStateV2Schema>;

export const careerStateV3Schema = careerStateV2Schema.extend({
  version: z.literal(3),
  rivals: rivalCircuitStateSchema
});
export type CareerStateV3 = z.infer<typeof careerStateV3Schema>;

export const careerStateV4Schema = careerStateV3Schema.extend({
  version: z.literal(4),
  matchPlanning: matchPlanningStateSchema
});
export type CareerStateV4 = z.infer<typeof careerStateV4Schema>;

export const careerStateV5Schema = careerStateV4Schema.extend({
  version: z.literal(5),
  facilities: z.array(facilityStateSchema),
  media: mediaSponsorStateSchema
});
export type CareerStateV5 = z.infer<typeof careerStateV5Schema>;

export const careerStateV6Schema = careerStateV5Schema.extend({
  version: z.literal(6)
});
export type CareerStateV6 = z.infer<typeof careerStateV6Schema>;

export const careerStateV7Schema = careerStateV5Schema.extend({
  version: z.literal(7),
  eventHistory: z.array(careerEventHistoryRecordSchema),
  matchHistory: z.array(careerMatchRecordSchema).default([]),
  playerAchievements: z.array(playerCareerAchievementSchema).default([])
});
export type CareerStateV7 = z.infer<typeof careerStateV7Schema>;

export const careerStateSchema = careerStateV7Schema.extend({
  version: z.literal(8),
  universeEvents: z.array(careerUniverseTournamentRecordSchema).default([])
});
export type CareerState = z.infer<typeof careerStateSchema>;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
