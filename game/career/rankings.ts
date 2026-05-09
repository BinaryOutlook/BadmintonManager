import type { SeededPlayer } from "../content/players";
import type { RankingEntry } from "./models";

export function createInitialRankings(seededEntries: SeededPlayer[], managedPlayerId: string) {
  const entries: RankingEntry[] = seededEntries.map((entry) => ({
    playerId: entry.player.id,
    rank: entry.seed,
    points: Math.max(220, 1900 - entry.seed * 32),
    eventHistory: []
  }));
  const managed = entries.find((entry) => entry.playerId === managedPlayerId);

  if (managed) {
    managed.points = Math.max(managed.points, 980);
  }

  return recalculateRanks(entries);
}

export function recalculateRanks(entries: RankingEntry[]) {
  return [...entries]
    .sort((left, right) => right.points - left.points || left.playerId.localeCompare(right.playerId))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

export function awardRankingPoints(args: {
  rankings: RankingEntry[];
  playerId: string;
  eventId: string;
  round: string;
  points: number;
}) {
  return recalculateRanks(
    args.rankings.map((entry) => {
      if (entry.playerId !== args.playerId) {
        return entry;
      }

      return {
        ...entry,
        points: entry.points + args.points,
        eventHistory: [
          ...entry.eventHistory,
          {
            eventId: args.eventId,
            round: args.round,
            points: args.points
          }
        ]
      };
    })
  );
}

export function rankingFor(rankings: RankingEntry[], playerId: string) {
  return rankings.find((entry) => entry.playerId === playerId);
}
