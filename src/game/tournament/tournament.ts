import { tacticLibrary } from "../content/tactics";
import { simulateMatch } from "../core/match";
import { SeededRng } from "../core/rng";
import type { MatchInput, MatchResult, MatchStats, Player } from "../core/models";
import type { SeededPlayer } from "../content/players";

export type RoundName = "R16" | "QF" | "SF" | "F";
const TOURNAMENT_FIELD_SIZE = 16;

export interface TournamentMatch {
  id: string;
  round: RoundName;
  sideAId: string;
  sideBId: string;
  winnerId?: string;
  scoreline?: string;
  managed: boolean;
  completed: boolean;
}

export interface TournamentRound {
  name: RoundName;
  matches: TournamentMatch[];
}

export interface ManagedRunMatch {
  round: RoundName;
  opponentId: string;
  opponentName: string;
  scoreline: string;
  won: boolean;
  stats: {
    winners: number;
    unforcedErrors: number;
    totalSmashes: number;
    peakSmashSpeed: number;
    longestRally: number;
    totalPoints: number;
    staminaDrain: number;
  };
}

export interface TournamentState {
  id: string;
  name: string;
  tier: string;
  prizePoolUsd: number;
  managedPlayerId: string;
  rounds: TournamentRound[];
  currentRoundIndex: number;
  rngState: number;
  eliminated: boolean;
  managedResults: ManagedRunMatch[];
  championId?: string;
}

export interface ManagedMatchContext {
  roundName: RoundName;
  matchId: string;
  playerAId: string;
  playerBId: string;
}

function roundNameForSize(size: number): RoundName {
  switch (size) {
    case 16:
      return "R16";
    case 8:
      return "QF";
    case 4:
      return "SF";
    default:
      return "F";
  }
}

export function selectTournamentEntrants(
  seededEntries: SeededPlayer[],
  managedPlayerId: string,
  rng: SeededRng
) {
  if (seededEntries.length < TOURNAMENT_FIELD_SIZE) {
    throw new Error(`Tournament needs at least ${TOURNAMENT_FIELD_SIZE} players.`);
  }

  const managedEntry = seededEntries.find((entry) => entry.player.id === managedPlayerId);

  if (!managedEntry) {
    throw new Error(`Managed player ${managedPlayerId} is not in the player pool.`);
  }

  const candidates = seededEntries.filter((entry) => entry.player.id !== managedPlayerId);
  const selectedEntries = [managedEntry];

  while (selectedEntries.length < TOURNAMENT_FIELD_SIZE) {
    const index = rng.nextInt(0, candidates.length - 1);
    const [entry] = candidates.splice(index, 1);
    selectedEntries.push(entry);
  }

  return selectedEntries
    .sort((left, right) => left.seed - right.seed)
    .map((entry, index) => ({
      seed: index + 1,
      player: entry.player
    }));
}

function orderedBracket(seededEntries: SeededPlayer[]) {
  const bySeed = [...seededEntries].sort((left, right) => left.seed - right.seed);
  const bySeedMap = Object.fromEntries(bySeed.map((entry) => [entry.seed, entry.player.id]));
  const openingOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
  return openingOrder.map((seed) => bySeedMap[seed]);
}

function chooseAutoplayTactic(player: Player, rng: SeededRng) {
  const { technical, mental, physical } = player.ratings;

  if (technical.smash > 84 && mental.aggression > 78) {
    return tacticLibrary.aggressiveSmash;
  }

  if (technical.netPlay > 83 || technical.serveReturn > 84) {
    return rng.chance(0.65) ? tacticLibrary.balancedControl : tacticLibrary.spreadCourt;
  }

  if (physical.stamina > 84 || technical.clearLob > 83) {
    return rng.chance(0.55) ? tacticLibrary.spreadCourt : tacticLibrary.defensiveWall;
  }

  return rng.chance(0.5) ? tacticLibrary.balancedControl : tacticLibrary.defensiveWall;
}

function summarizeManagedStats(stats: MatchStats, managedSide: "A" | "B") {
  if (managedSide === "A") {
    return {
      winners: stats.winnersA,
      unforcedErrors: stats.unforcedErrorsA,
      totalSmashes: stats.totalSmashesA,
      peakSmashSpeed: stats.peakSmashSpeedA,
      longestRally: stats.longestRally,
      totalPoints: stats.totalPoints,
      staminaDrain: stats.staminaDrainA
    };
  }

  return {
    winners: stats.winnersB,
    unforcedErrors: stats.unforcedErrorsB,
    totalSmashes: stats.totalSmashesB,
    peakSmashSpeed: stats.peakSmashSpeedB,
    longestRally: stats.longestRally,
    totalPoints: stats.totalPoints,
    staminaDrain: stats.staminaDrainB
  };
}

function createRound(args: {
  playerIds: string[];
  managedPlayerId: string;
  playerMap: Record<string, Player>;
  roundName: RoundName;
  rng: SeededRng;
}): TournamentRound {
  const { playerIds, managedPlayerId, playerMap, roundName, rng } = args;
  const matches: TournamentMatch[] = [];

  for (let index = 0; index < playerIds.length; index += 2) {
    const sideAId = playerIds[index];
    const sideBId = playerIds[index + 1];
    const managed = sideAId === managedPlayerId || sideBId === managedPlayerId;
    const match: TournamentMatch = {
      id: `${roundName}-${index / 2 + 1}`,
      round: roundName,
      sideAId,
      sideBId,
      managed,
      completed: false
    };

    if (!managed) {
      const matchSeed = rng.nextInt(1, 2_147_483_000);
      const result = simulateMatch({
        seed: matchSeed,
        playerA: playerMap[sideAId],
        playerB: playerMap[sideBId],
        tacticA: chooseAutoplayTactic(playerMap[sideAId], rng),
        tacticB: chooseAutoplayTactic(playerMap[sideBId], rng)
      });
      match.winnerId = result.winner === "A" ? sideAId : sideBId;
      match.scoreline = result.scoreline;
      match.completed = true;
    }

    matches.push(match);
  }

  return {
    name: roundName,
    matches
  };
}

export function createTournament(seededEntries: SeededPlayer[], managedPlayerId: string, seed: number) {
  const rng = new SeededRng(seed);
  const entrants = selectTournamentEntrants(seededEntries, managedPlayerId, rng);
  const playerIds = orderedBracket(entrants);
  const playerMap = Object.fromEntries(entrants.map((entry) => [entry.player.id, entry.player]));
  const round = createRound({
    playerIds,
    managedPlayerId,
    playerMap,
    roundName: "R16",
    rng
  });

  return {
    id: "badminton-manager-open",
    name: "Singapore Open",
    tier: "Super 750",
    prizePoolUsd: 850_000,
    managedPlayerId,
    rounds: [round],
    currentRoundIndex: 0,
    rngState: rng.snapshot(),
    managedResults: [],
    eliminated: false
  } satisfies TournamentState;
}

export function getCurrentRound(tournament: TournamentState) {
  return tournament.rounds[tournament.currentRoundIndex];
}

export function getManagedMatchContext(tournament: TournamentState): ManagedMatchContext | undefined {
  const currentRound = getCurrentRound(tournament);
  const match = currentRound.matches.find(
    (entry) => entry.managed && !entry.completed && !entry.winnerId
  );

  if (!match) {
    return undefined;
  }

  return {
    roundName: currentRound.name,
    matchId: match.id,
    playerAId: match.sideAId,
    playerBId: match.sideBId
  };
}

export function createManagedMatchInput(args: {
  tournament: TournamentState;
  playerMap: Record<string, Player>;
  tacticA: MatchInput["tacticA"];
}) {
  const rng = new SeededRng(args.tournament.rngState);
  const context = getManagedMatchContext(args.tournament);

  if (!context) {
    return undefined;
  }

  const input: MatchInput = {
    seed: rng.nextInt(1, 2_147_483_000),
    playerA: args.playerMap[context.playerAId],
    playerB: args.playerMap[context.playerBId],
    tacticA: context.playerAId === args.tournament.managedPlayerId ? args.tacticA : chooseAutoplayTactic(args.playerMap[context.playerAId], rng),
    tacticB: context.playerBId === args.tournament.managedPlayerId ? args.tacticA : chooseAutoplayTactic(args.playerMap[context.playerBId], rng)
  };

  return {
    context,
    input,
    rngState: rng.snapshot()
  };
}

export function advanceTournament(args: {
  tournament: TournamentState;
  seededEntries: SeededPlayer[];
  managedMatchId: string;
  managedResult: MatchResult;
}) {
  const playerMap = Object.fromEntries(args.seededEntries.map((entry) => [entry.player.id, entry.player]));
  const currentRound = getCurrentRound(args.tournament);
  const matches = currentRound.matches.map((match) => {
    if (match.id !== args.managedMatchId) {
      return match;
    }

    const winnerId = args.managedResult.winner === "A" ? match.sideAId : match.sideBId;

    return {
      ...match,
      completed: true,
      winnerId,
      scoreline: args.managedResult.scoreline
    };
  });

  const updatedRounds = args.tournament.rounds.map((round, index) =>
    index === args.tournament.currentRoundIndex ? { ...round, matches } : round
  );
  const winners = matches.map((match) => match.winnerId!).filter(Boolean);
  const managedStillAlive = winners.includes(args.tournament.managedPlayerId);
  const managedMatch = currentRound.matches.find((match) => match.id === args.managedMatchId);
  const managedSide = managedMatch?.sideAId === args.tournament.managedPlayerId ? "A" : "B";
  const opponentId =
    managedSide === "A" ? managedMatch?.sideBId : managedMatch?.sideAId;
  const managedResults = managedMatch && opponentId
    ? [
        ...args.tournament.managedResults,
        {
          round: managedMatch.round,
          opponentId,
          opponentName: playerMap[opponentId].name,
          scoreline: args.managedResult.scoreline,
          won: args.managedResult.winner === managedSide,
          stats: summarizeManagedStats(args.managedResult.stats, managedSide)
        }
      ]
    : args.tournament.managedResults;

  if (winners.length === 1) {
    return {
      ...args.tournament,
      rounds: updatedRounds,
      managedResults,
      championId: winners[0],
      eliminated: winners[0] !== args.tournament.managedPlayerId
    };
  }

  if (!managedStillAlive) {
    return {
      ...args.tournament,
      rounds: updatedRounds,
      managedResults,
      eliminated: true
    };
  }

  const rng = new SeededRng(args.tournament.rngState);
  const nextRound = createRound({
    playerIds: winners,
    managedPlayerId: args.tournament.managedPlayerId,
    playerMap,
    roundName: roundNameForSize(winners.length),
    rng
  });

  return {
    ...args.tournament,
    rounds: [...updatedRounds, nextRound],
    currentRoundIndex: args.tournament.currentRoundIndex + 1,
    managedResults,
    rngState: rng.snapshot()
  };
}
