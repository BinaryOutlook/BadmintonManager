import { playerMap } from "../content/players";
import { tacticOptions } from "../content/tactics";
import { deriveAthleteDossier, type AthleteDossier } from "../core/intel";
import type { DerivedProfile, LiveMatchSession, Player } from "../core/models";
import { deriveProfile } from "../core/ratings";
import type { TournamentState } from "../tournament/tournament";

export interface PlayerContextSummary {
  label: string;
  detail: string;
  tone: "managed" | "live" | "opponent" | "neutral" | "complete";
}

export interface TacticFitSummary {
  key: string;
  label: string;
  score: number;
  headline: string;
  risk: string;
}

export interface PlayerPerformanceEntry {
  label: string;
  detail: string;
  result: "won" | "lost" | "pending" | "context";
}

export interface PlayerPerformanceSummary {
  entries: PlayerPerformanceEntry[];
  aggregateStats: Array<{ label: string; value: string }>;
}

export interface PlayerProfileViewModel {
  player: Player;
  overall: number;
  dossier: AthleteDossier;
  derived: DerivedProfile;
  traits: string[];
  context: PlayerContextSummary;
  tacticFits: TacticFitSummary[];
  strengths: Array<{ label: string; value: number; group: string }>;
  performance: PlayerPerformanceSummary;
}

export function overallFromDossier(dossier: AthleteDossier) {
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

function activeManagedMatch(tournament: TournamentState | null) {
  if (!tournament || tournament.championId || tournament.eliminated) {
    return undefined;
  }

  return tournament.rounds[tournament.currentRoundIndex]?.matches.find(
    (match) => match.managed && !match.completed
  );
}

function isLiveCompetitor(playerId: string, liveMatch?: LiveMatchSession | null) {
  return liveMatch?.input.playerA.id === playerId || liveMatch?.input.playerB.id === playerId;
}

function tournamentContainsPlayer(tournament: TournamentState | null, playerId: string) {
  return Boolean(
    tournament?.rounds.some((round) =>
      round.matches.some((match) => match.sideAId === playerId || match.sideBId === playerId)
    )
  );
}

function playerWonCompletedMatch(playerId: string, tournament: TournamentState) {
  return tournament.rounds.some((round) =>
    round.matches.some((match) => match.completed && match.winnerId === playerId)
  );
}

function deriveContext(args: {
  playerId: string;
  selectedPlayerId: string;
  tournament: TournamentState | null;
  liveMatch?: LiveMatchSession | null;
}): PlayerContextSummary {
  const { playerId, selectedPlayerId, tournament, liveMatch } = args;
  const match = activeManagedMatch(tournament);

  if (isLiveCompetitor(playerId, liveMatch)) {
    return {
      label: "Live match competitor",
      detail: "This profile is connected to the current point-by-point match state.",
      tone: "live"
    };
  }

  if (match && (match.sideAId === playerId || match.sideBId === playerId)) {
    return {
      label: playerId === selectedPlayerId ? "Managed athlete" : "Next opponent",
      detail:
        playerId === selectedPlayerId
          ? "The current tournament path is built around this athlete."
          : "This athlete is the next bracket obstacle for the managed side.",
      tone: playerId === selectedPlayerId ? "managed" : "opponent"
    };
  }

  if (tournament?.championId === playerId) {
    return {
      label: "Tournament champion",
      detail: `${playerMap[playerId].name} closed the active event as champion.`,
      tone: "complete"
    };
  }

  if (playerId === selectedPlayerId) {
    return {
      label: tournament ? "Managed athlete" : "Selectable athlete",
      detail: tournament
        ? "This athlete is locked as the current run focus."
        : "This athlete can be selected before the tournament begins.",
      tone: "managed"
    };
  }

  if (tournament && tournamentContainsPlayer(tournament, playerId)) {
    const stillHasResult = playerWonCompletedMatch(playerId, tournament);
    return {
      label: stillHasResult ? "Tournament entrant" : "Event entrant",
      detail: stillHasResult
        ? "This athlete has already shaped the current bracket."
        : "This athlete belongs to the active event field.",
      tone: "neutral"
    };
  }

  return {
    label: "Available roster",
    detail: "This athlete is part of the local fictional player pool.",
    tone: "neutral"
  };
}

function tacticFitScore(player: Player, derived: DerivedProfile, tacticKey: string) {
  const { technical, physical, mental } = player.ratings;

  switch (tacticKey) {
    case "aggressiveSmash":
      return Math.round(
        derived.attackPressure * 0.42 +
          technical.smash * 0.24 +
          physical.explosivenessJump * 0.2 +
          mental.aggression * 0.14
      );
    case "balancedControl":
      return Math.round(
        derived.frontCourtControl * 0.34 +
          derived.judgment * 0.26 +
          derived.pressureResistance * 0.24 +
          technical.serveReturn * 0.16
      );
    case "spreadCourt":
      return Math.round(
        derived.recoveryQuality * 0.28 +
          derived.rallyTolerance * 0.28 +
          physical.footworkSpeed * 0.22 +
          technical.clearLob * 0.22
      );
    case "defensiveWall":
      return Math.round(
        derived.recoveryQuality * 0.32 +
          derived.rallyTolerance * 0.28 +
          derived.pressureResistance * 0.24 +
          technical.defenseRetrieval * 0.16
      );
    default:
      return overallFromDossier(deriveAthleteDossier(player));
  }
}

function tacticHeadline(score: number) {
  if (score >= 88) {
    return "Natural fit";
  }

  if (score >= 80) {
    return "Strong fit";
  }

  if (score >= 72) {
    return "Usable fit";
  }

  return "Specialist risk";
}

function tacticRisk(player: Player, tacticKey: string) {
  const { technical, physical, mental } = player.ratings;

  switch (tacticKey) {
    case "aggressiveSmash":
      return physical.stamina < 78 || mental.focus < 78
        ? "Watch stamina burn and cheap errors."
        : "Best when early initiative lands cleanly.";
    case "balancedControl":
      return technical.netPlay < 76 || technical.serveReturn < 76
        ? "May lack enough front-court bite."
        : "Keeps the match inside readable margins.";
    case "spreadCourt":
      return technical.clearLob < 76 || physical.agilityBalance < 76
        ? "Can leak pressure if recovery quality drops."
        : "Good for stretching slower opponents.";
    case "defensiveWall":
      return player.ratings.technical.smash < 76
        ? "May survive well without converting enough points."
        : "Invites overhit errors while preserving energy.";
    default:
      return "Fit depends on opponent context.";
  }
}

function deriveTacticFits(player: Player, derived: DerivedProfile): TacticFitSummary[] {
  return tacticOptions.map((option) => {
    const score = tacticFitScore(player, derived, option.key);

    return {
      key: option.key,
      label: option.label,
      score,
      headline: tacticHeadline(score),
      risk: tacticRisk(player, option.key)
    };
  });
}

function deriveStrengths(player: Player, derived: DerivedProfile) {
  const rawStrengths = [
    { label: "Smash", value: player.ratings.technical.smash, group: "Technical" },
    { label: "Net Play", value: player.ratings.technical.netPlay, group: "Technical" },
    { label: "Defense", value: player.ratings.technical.defenseRetrieval, group: "Technical" },
    { label: "Footwork", value: player.ratings.physical.footworkSpeed, group: "Physical" },
    { label: "Stamina", value: player.ratings.physical.stamina, group: "Physical" },
    { label: "Composure", value: player.ratings.mental.composure, group: "Mental" },
    { label: "Attack Pressure", value: Math.round(derived.attackPressure), group: "Derived" },
    { label: "Rally Tolerance", value: Math.round(derived.rallyTolerance), group: "Derived" },
    { label: "Judgment", value: Math.round(derived.judgment), group: "Derived" }
  ];

  return rawStrengths.sort((left, right) => right.value - left.value).slice(0, 5);
}

function collectPerformance(args: {
  playerId: string;
  selectedPlayerId: string;
  tournament: TournamentState | null;
  liveMatch?: LiveMatchSession | null;
}): PlayerPerformanceSummary {
  const { playerId, selectedPlayerId, tournament, liveMatch } = args;
  const entries: PlayerPerformanceEntry[] = [];
  const aggregateStats: Array<{ label: string; value: string }> = [];

  if (liveMatch && isLiveCompetitor(playerId, liveMatch)) {
    const isA = liveMatch.input.playerA.id === playerId;
    const competitor = isA ? liveMatch.competitorA : liveMatch.competitorB;

    entries.push({
      label: "Live match",
      detail: `Set ${liveMatch.currentSetNumber}, stamina ${Math.round(competitor.stamina)}%, momentum ${Math.round(competitor.momentum)}.`,
      result: "pending"
    });
  }

  if (!tournament) {
    return { entries, aggregateStats };
  }

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.sideAId !== playerId && match.sideBId !== playerId) {
        continue;
      }

      const opponentId = match.sideAId === playerId ? match.sideBId : match.sideAId;
      const opponent = playerMap[opponentId];

      if (!match.completed) {
        entries.push({
          label: `${round.name} pending`,
          detail: `Scheduled against ${opponent.name}.`,
          result: "pending"
        });
        continue;
      }

      entries.push({
        label: round.name,
        detail: `${match.winnerId === playerId ? "Won" : "Lost"} against ${opponent.name}, ${match.scoreline ?? "score pending"}.`,
        result: match.winnerId === playerId ? "won" : "lost"
      });
    }
  }

  if (playerId === selectedPlayerId && tournament.managedResults.length > 0) {
    const totals = tournament.managedResults.reduce(
      (sum, result) => ({
        winners: sum.winners + result.stats.winners,
        errors: sum.errors + result.stats.unforcedErrors,
        smashes: sum.smashes + result.stats.totalSmashes,
        staminaDrain: sum.staminaDrain + result.stats.staminaDrain,
        longestRally: Math.max(sum.longestRally, result.stats.longestRally),
        peakSmash: Math.max(sum.peakSmash, result.stats.peakSmashSpeed)
      }),
      { winners: 0, errors: 0, smashes: 0, staminaDrain: 0, longestRally: 0, peakSmash: 0 }
    );

    aggregateStats.push(
      { label: "Managed wins", value: String(tournament.managedResults.filter((result) => result.won).length) },
      { label: "Winners", value: String(totals.winners) },
      { label: "Errors", value: String(totals.errors) },
      { label: "Total smashes", value: String(totals.smashes) },
      { label: "Peak smash", value: totals.peakSmash > 0 ? `${totals.peakSmash} km/h` : "N/A" },
      { label: "Longest rally", value: totals.longestRally > 0 ? `${totals.longestRally} shots` : "N/A" },
      { label: "Stamina drain", value: String(totals.staminaDrain) }
    );
  }

  return { entries, aggregateStats };
}

export function createPlayerProfileViewModel(args: {
  playerId: string;
  selectedPlayerId: string;
  tournament: TournamentState | null;
  liveMatch?: LiveMatchSession | null;
}): PlayerProfileViewModel | null {
  const player = playerMap[args.playerId];

  if (!player) {
    return null;
  }

  const dossier = deriveAthleteDossier(player);
  const derived = deriveProfile(player);

  return {
    player,
    overall: overallFromDossier(dossier),
    dossier,
    derived,
    traits: player.traits ?? [],
    context: deriveContext(args),
    tacticFits: deriveTacticFits(player, derived),
    strengths: deriveStrengths(player, derived),
    performance: collectPerformance(args)
  };
}
