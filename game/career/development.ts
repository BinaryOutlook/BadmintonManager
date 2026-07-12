import type { Player } from "../core/models";
import {
  clamp,
  type AthleteCareerState,
  type DevelopmentHistoryRecord,
  type DevelopmentSnapshot
} from "./models";

export function developmentSnapshotFromAthlete(athlete: AthleteCareerState): DevelopmentSnapshot {
  return {
    development: { ...athlete.development },
    fatigue: athlete.fatigue,
    injuryRisk: athlete.injuryRisk,
    readiness: athlete.readiness,
    recoveryStatus: athlete.recoveryStatus,
    injuryStatus: athlete.injury.status
  };
}

export function createDevelopmentBaseline(args: {
  athlete: AthleteCareerState;
  date: string;
  seasonId: string;
  source: "career_start" | "recruitment" | "legacy_snapshot";
  note: string;
}): DevelopmentHistoryRecord {
  return {
    kind: "snapshot",
    id: `development:${args.seasonId}:${args.date}:${args.athlete.playerId}:${args.source}`,
    athleteId: args.athlete.playerId,
    date: args.date,
    source: args.source,
    snapshot: developmentSnapshotFromAthlete(args.athlete),
    note: args.note
  };
}

/**
 * Projects persisted career development into the canonical player shape used by
 * the match engine. Condition remains a separate career concern; only trained
 * attributes with direct engine equivalents are overlaid here.
 */
export function careerPlayerForMatch(basePlayer: Player, athlete: AthleteCareerState): Player {
  if (basePlayer.id !== athlete.playerId) {
    throw new Error(`Career athlete ${athlete.playerId} does not match player ${basePlayer.id}.`);
  }

  return {
    ...basePlayer,
    ratings: {
      ...basePlayer.ratings,
      technical: {
        ...basePlayer.ratings.technical,
        smash: clamp(athlete.development.smash, 1, 100)
      },
      physical: {
        ...basePlayer.ratings.physical,
        stamina: clamp(athlete.development.stamina, 1, 100)
      },
      mental: {
        ...basePlayer.ratings.mental,
        composure: clamp(athlete.development.composure, 1, 100)
      }
    }
  };
}
