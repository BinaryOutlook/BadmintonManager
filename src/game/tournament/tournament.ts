import { tacticLibrary } from "../content/tactics";
import { simulateMatch } from "../core/match";
import { SeededRng } from "../core/rng";
import type { MatchInput, MatchResult, Player } from "../core/models";
import type { SeededPlayer } from "../content/players";

export type RoundName = "R16" | "QF" | "SF" | "F";

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

export interface TournamentState {
  id: string;
  name: string;
  managedPlayerId: string;
  rounds: TournamentRound[];
  currentRoundIndex: number;
  rngState: number;
  eliminated: boolean;
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

function orderedBracket(seededEntries: SeededPlayer[]) {
  const bySeed = [...seededEntries].sort((left, right) => left.seed - right.seed);
  const bySeedMap = Object.fromEntries(bySeed.map((entry) => [entry.seed, entry.player.id]));
  const openingOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
  return openingOrder.map((seed) => bySeedMap[seed]);
}

function chooseAutoplayTactic(player: Player, rng: SeededRng) {
  const { technical, mental, physical } = player.ratings;

  if (technical.smash > 84 && mental.aggression > 78) {
    return tacticLibrary.allOutAttack;
  }

  if (technical.netPlay > 83 || technical.serveReturn > 84) {
    return rng.chance(0.65) ? tacticLibrary.balancedControl : tacticLibrary.backhandPress;
  }

  if (physical.stamina > 84 || technical.clearLob > 83) {
    return tacticLibrary.grindingLength;
  }

  return rng.chance(0.5) ? tacticLibrary.balancedControl : tacticLibrary.backhandPress;
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
  const playerIds = orderedBracket(seededEntries);
  const round = createRound({
    playerIds,
    managedPlayerId,
    playerMap: Object.fromEntries(seededEntries.map((entry) => [entry.player.id, entry.player])),
    roundName: "R16",
    rng
  });

  return {
    id: "badminton-manager-open",
    name: "Badminton Manager Open",
    managedPlayerId,
    rounds: [round],
    currentRoundIndex: 0,
    rngState: rng.snapshot(),
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

  if (winners.length === 1) {
    return {
      ...args.tournament,
      rounds: updatedRounds,
      championId: winners[0],
      eliminated: winners[0] !== args.tournament.managedPlayerId
    };
  }

  if (!managedStillAlive) {
    return {
      ...args.tournament,
      rounds: updatedRounds,
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
    rngState: rng.snapshot()
  };
}
