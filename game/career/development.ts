import type { Player } from "../core/models";
import { clamp, type AthleteCareerState } from "./models";

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
