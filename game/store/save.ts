import { z } from "zod";
import {
  liveDirectiveSchema,
  matchTacticSchema,
  playerSchema,
  sideSchema,
  simulationFidelitySchema,
  teamTalkSchema
} from "../core/models";
import { upgradeCareerStateV1, upgradeCareerStateV2 } from "../career/ecosystem";
import { hydrateCareerEvents } from "../career/events";
import {
  careerStateSchema,
  careerStateV1Schema,
  careerStateV2Schema,
  careerStateV3Schema,
  careerStateV4Schema,
  careerStateV5Schema,
  careerStateV6Schema,
  normalizeCareerTierLabel,
  type CareerState
} from "../career/models";
import { upgradeCareerStateV3 } from "../career/tactics";
import { refreshAssistantAdvice } from "../career/tactics";
import { upgradeCareerStateV4 } from "../career/facilitiesMedia";
import { normalizeTournamentName } from "../tournament/metadata";

const matchSummaryEventSchema = z.object({
  kind: z.enum([
    "upset",
    "straight_games",
    "decider",
    "stamina_battle",
    "attack_pressure",
    "error_collapse"
  ]),
  side: sideSchema.optional(),
  title: z.string(),
  detail: z.string()
});

const tournamentMatchSchema = z.object({
  id: z.string(),
  round: z.enum(["R16", "QF", "SF", "F"]),
  sideAId: z.string(),
  sideBId: z.string(),
  winnerId: z.string().optional(),
  scoreline: z.string().optional(),
  simulationFidelity: simulationFidelitySchema.optional(),
  summaryEvents: z.array(matchSummaryEventSchema).optional(),
  managed: z.boolean(),
  completed: z.boolean()
});

const tournamentRoundSchema = z.object({
  name: z.enum(["R16", "QF", "SF", "F"]),
  matches: z.array(tournamentMatchSchema)
});

export const tournamentStateSchema = z.object({
  id: z.string(),
  name: z.preprocess(normalizeTournamentName, z.string()),
  tier: z.preprocess(normalizeCareerTierLabel, z.string()),
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

export const legacyPersistedSaveSchema = z.object({
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

export const phase1PersistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(3),
  career: careerStateV1Schema.nullable()
});

export const phase2PersistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(4),
  career: careerStateV2Schema.nullable()
});

export const phase3RivalPersistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(5),
  career: careerStateV3Schema.nullable()
});

export const phase3TacticsPersistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(6),
  career: careerStateV4Schema.nullable()
});

export const phase3FacilitiesPersistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(7),
  career: careerStateV5Schema.nullable()
});

export const phase4CareerHistoryPersistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(8),
  career: careerStateV6Schema.nullable()
});

export const persistedSaveSchema = legacyPersistedSaveSchema.extend({
  version: z.literal(9),
  career: careerStateSchema.nullable()
});

export const persistedSavePayloadSchema = z.union([
  persistedSaveSchema,
  phase4CareerHistoryPersistedSaveSchema,
  phase3FacilitiesPersistedSaveSchema,
  phase3TacticsPersistedSaveSchema,
  phase3RivalPersistedSaveSchema,
  phase2PersistedSaveSchema,
  phase1PersistedSaveSchema,
  legacyPersistedSaveSchema
]);

export type PersistedSave = z.infer<typeof persistedSaveSchema>;
export type PersistedSavePayload = z.infer<typeof persistedSavePayloadSchema>;

export type SaveImportValidationResult =
  | {
      ok: true;
      save: PersistedSave;
    }
  | {
      ok: false;
      reason: "malformed_json" | "invalid_schema";
      message: string;
      issues?: string[];
    };

type MigratableCurrentCareer = Omit<CareerState, "matchHistory" | "playerAchievements"> &
  Partial<Pick<CareerState, "matchHistory" | "playerAchievements">>;

function withCareerHistoryDefaults(career: MigratableCurrentCareer): CareerState {
  return {
    ...career,
    matchHistory: career.matchHistory ?? [],
    playerAchievements: career.playerAchievements ?? []
  };
}

function refreshMigratedCareer(career: MigratableCurrentCareer | null) {
  return career
    ? refreshAssistantAdvice(
        withCareerHistoryDefaults({
          ...career,
          events: hydrateCareerEvents(career.events)
        })
      )
    : null;
}

export function migratePersistedSave(payload: PersistedSavePayload): PersistedSave {
  if (payload.version === 8) {
    return {
      ...payload,
      version: 9,
      career: payload.career ? refreshMigratedCareer({ ...payload.career, version: 7, eventHistory: [] }) : null
    };
  }

  if (payload.version === 7) {
    return {
      ...payload,
      version: 9,
      career: payload.career ? refreshMigratedCareer({ ...payload.career, version: 7, eventHistory: [] }) : null
    };
  }

  if (payload.version === 9) {
    return {
      ...payload,
      career: refreshMigratedCareer(payload.career)
    };
  }

  if (payload.version === 3) {
    return {
      ...payload,
      version: 9,
      career: payload.career
        ? refreshMigratedCareer({
            ...upgradeCareerStateV4(upgradeCareerStateV3(upgradeCareerStateV1(payload.career))),
            version: 7,
            eventHistory: []
          })
        : null
    };
  }

  if (payload.version === 4) {
    return {
      ...payload,
      version: 9,
      career: payload.career
        ? refreshMigratedCareer({
            ...upgradeCareerStateV4(upgradeCareerStateV3(upgradeCareerStateV2(payload.career))),
            version: 7,
            eventHistory: []
          })
        : null
    };
  }

  if (payload.version === 5) {
    return {
      ...payload,
      version: 9,
      career: payload.career
        ? refreshMigratedCareer({
            ...upgradeCareerStateV4(upgradeCareerStateV3(payload.career)),
            version: 7,
            eventHistory: []
          })
        : null
    };
  }

  if (payload.version === 6) {
    return {
      ...payload,
      version: 9,
      career: payload.career
        ? refreshMigratedCareer({ ...upgradeCareerStateV4(payload.career), version: 7, eventHistory: [] })
        : null
    };
  }

  return {
    ...payload,
    version: 9,
    career: null
  };
}

export function validateImportedSaveText(raw: string): SaveImportValidationResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: "malformed_json",
      message: "That file is not valid JSON. The active local save was not changed."
    };
  }

  const parsed = persistedSavePayloadSchema.safeParse(json);

  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_schema",
      message: "That JSON does not match any supported Badminton Manager save schema. The active local save was not changed.",
      issues: parsed.error.issues.slice(0, 4).map((issue) => issue.message)
    };
  }

  const migrated = migratePersistedSave(parsed.data);
  const current = persistedSaveSchema.safeParse(migrated);

  if (!current.success) {
    return {
      ok: false,
      reason: "invalid_schema",
      message: "The save parsed, but could not be migrated to the current save format. The active local save was not changed.",
      issues: current.error.issues.slice(0, 4).map((issue) => issue.message)
    };
  }

  return {
    ok: true,
    save: current.data
  };
}
