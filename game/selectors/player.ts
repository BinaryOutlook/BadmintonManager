import { playerMap } from "../content/players";
import { tacticOptions } from "../content/tactics";
import { deriveAthleteDossier, type AthleteDossier } from "../core/intel";
import type { DerivedProfile, LiveMatchSession, Player } from "../core/models";
import { deriveProfile } from "../core/ratings";
import type { CareerMatchRecord, CareerState, PlayerCareerAchievement } from "../career/models";
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
  drivers: string[];
}

export interface PlayerPerformanceEntry {
  label: string;
  detail: string;
  result: "won" | "lost" | "pending" | "context";
}

export interface PlayerPerformanceSummary {
  entries: PlayerPerformanceEntry[];
  aggregateStats: Array<{ label: string; value: string }>;
  recentForm: string[];
  formLabel: string;
  emptyState: string;
}

export interface PlayerRadarMetric {
  label: string;
  value: number;
}

export interface CoachReport {
  archetype: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  bestUse: string;
  selectionRecommendation: string;
  riskFlags: string[];
  readiness: Array<{ label: string; value: string; detail: string }>;
}

export interface CareerSummary {
  stage: string;
  trajectory: string;
  narrative: string;
  milestones: string[];
  recordCards: Array<{ label: string; value: string }>;
  profileRecord: PlayerCareerProfileRecord;
  titles: PlayerAchievementSummary[];
  runnerUpFinishes: PlayerAchievementSummary[];
  achievements: PlayerAchievementSummary[];
  headToHead: PlayerHeadToHeadSummary[];
  managedPlayerSpotlight: PlayerHeadToHeadSummary | null;
  hasRecordedHistory: boolean;
}

export interface PlayerCareerProfileRecord {
  playerId: string;
  wins: number;
  losses: number;
  winPercentage: number | null;
  titles: number;
  runnerUps: number;
  finals: number;
  headToHeads: PlayerHeadToHeadSummary[];
  managedPlayerSpotlight: PlayerHeadToHeadSummary | null;
}

export interface PlayerAchievementSummary {
  eventId: string;
  eventName: string;
  date: string;
  result: "champion" | "runner_up";
  label: string;
}

export interface PlayerHeadToHeadSummary {
  opponentId: string;
  opponentName: string;
  played: number;
  wins: number;
  losses: number;
  winPercentage: number | null;
  winPercentageLabel: string;
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
  radar: PlayerRadarMetric[];
  coachReport: CoachReport;
  performance: PlayerPerformanceSummary;
  career: CareerSummary;
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

function ratingLabel(value: number) {
  if (value >= 88) {
    return "Elite";
  }

  if (value >= 80) {
    return "Strong";
  }

  if (value >= 70) {
    return "Average";
  }

  return "Weak";
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

function tacticDrivers(player: Player, derived: DerivedProfile, tacticKey: string) {
  const { technical, physical, mental } = player.ratings;

  switch (tacticKey) {
    case "aggressiveSmash":
      return [
        `smash ${technical.smash}`,
        `attack pressure ${Math.round(derived.attackPressure)}`,
        `aggression ${mental.aggression}`
      ];
    case "balancedControl":
      return [
        `front-court control ${Math.round(derived.frontCourtControl)}`,
        `judgment ${Math.round(derived.judgment)}`,
        `serve / return ${technical.serveReturn}`
      ];
    case "spreadCourt":
      return [
        `stamina ${physical.stamina}`,
        `recovery ${Math.round(derived.recoveryQuality)}`,
        `rally tolerance ${Math.round(derived.rallyTolerance)}`
      ];
    case "defensiveWall":
      return [
        `defense / retrieval ${technical.defenseRetrieval}`,
        `pressure resistance ${Math.round(derived.pressureResistance)}`,
        `rally tolerance ${Math.round(derived.rallyTolerance)}`
      ];
    default:
      return ["overall balance"];
  }
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
      risk: tacticRisk(player, option.key),
      drivers: tacticDrivers(player, derived, option.key)
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

function deriveRadar(player: Player, derived: DerivedProfile): PlayerRadarMetric[] {
  const { technical, physical, mental } = player.ratings;

  return [
    {
      label: "Attack",
      value: Math.round(
        technical.smash * 0.32 +
          technical.dropShot * 0.16 +
          derived.attackPressure * 0.36 +
          mental.aggression * 0.16
      )
    },
    {
      label: "Defense",
      value: Math.round(
        technical.defenseRetrieval * 0.4 + derived.recoveryQuality * 0.3 + derived.judgment * 0.3
      )
    },
    {
      label: "Movement",
      value: Math.round(
        physical.footworkSpeed * 0.34 +
          physical.agilityBalance * 0.26 +
          physical.explosivenessJump * 0.2 +
          derived.recoveryQuality * 0.2
      )
    },
    {
      label: "Control",
      value: Math.round(
        technical.netPlay * 0.24 +
          technical.clearLob * 0.2 +
          technical.serveReturn * 0.2 +
          mental.focus * 0.16 +
          derived.frontCourtControl * 0.2
      )
    },
    {
      label: "Mentality",
      value: Math.round(
        mental.anticipation * 0.24 +
          mental.composure * 0.24 +
          mental.focus * 0.24 +
          derived.judgment * 0.28
      )
    },
    {
      label: "Endurance",
      value: Math.round(
        physical.stamina * 0.44 + derived.rallyTolerance * 0.36 + derived.recoveryQuality * 0.2
      )
    }
  ];
}

function bestRadarMetric(radar: PlayerRadarMetric[]) {
  return [...radar].sort((left, right) => right.value - left.value)[0];
}

function lowestRadarMetric(radar: PlayerRadarMetric[]) {
  return [...radar].sort((left, right) => left.value - right.value)[0];
}

function deriveArchetype(player: Player, radar: PlayerRadarMetric[], derived: DerivedProfile) {
  const radarMap = Object.fromEntries(radar.map((metric) => [metric.label, metric.value]));
  const { technical, physical, mental } = player.ratings;

  if (radarMap.Endurance >= 91 && radarMap.Defense >= 88) {
    return "Relentless Rally Controller";
  }

  if (radarMap.Attack >= 90 && mental.aggression >= 84) {
    return "Explosive Smasher";
  }

  if (derived.frontCourtControl >= 88 && technical.netPlay >= 86) {
    return "Front-Court Technician";
  }

  if (radarMap.Defense >= 88 && radarMap.Mentality >= 86) {
    return "Pressure Absorber";
  }

  if (physical.footworkSpeed >= 88 && radarMap.Movement >= 88) {
    return "Tempo Disruptor";
  }

  if (radar.every((metric) => metric.value >= 80)) {
    return "Balanced All-Rounder";
  }

  return `${player.styleLabel} Specialist`;
}

function deriveWeaknesses(player: Player, radar: PlayerRadarMetric[], tacticFits: TacticFitSummary[]) {
  const { technical, physical, mental } = player.ratings;
  const weaknesses: string[] = [];
  const lowRadar = lowestRadarMetric(radar);
  const attackFit = tacticFits.find((fit) => fit.key === "aggressiveSmash");

  if (technical.smash < 84) {
    weaknesses.push("Instant kill threat is useful, but not a guaranteed primary weapon.");
  }

  if (mental.aggression < 76) {
    weaknesses.push("Lower aggression can limit quick attacking conversion.");
  }

  if (physical.stamina < 78) {
    weaknesses.push("Long match load can become expensive if the plan stretches too far.");
  }

  if (mental.composure < 78) {
    weaknesses.push("Score pressure may affect late-set choices.");
  }

  if (attackFit && attackFit.score < 80) {
    weaknesses.push("All-out attacking systems are situational rather than natural.");
  }

  weaknesses.push(`${lowRadar.label} is the least dominant radar category at ${lowRadar.value}.`);

  return [...new Set(weaknesses)].slice(0, 4);
}

function deriveRiskFlags(player: Player, radar: PlayerRadarMetric[], tacticFits: TacticFitSummary[]) {
  const { technical, physical, mental } = player.ratings;
  const flags: string[] = [];
  const lowestFit = [...tacticFits].sort((left, right) => left.score - right.score)[0];

  if (mental.aggression < 76) {
    flags.push("Lower aggression");
  }

  if (technical.smash < 84) {
    flags.push("Moderate smash ceiling");
  }

  if (physical.stamina < 78) {
    flags.push("Long-rally fatigue exposure");
  }

  if ((radar.find((metric) => metric.label === "Defense")?.value ?? 0) < 78) {
    flags.push("Can be pressured by repeated attacks");
  }

  flags.push(`${lowestFit.label} is the weakest tactical fit`);

  return [...new Set(flags)].slice(0, 4);
}

function deriveCoachReport(args: {
  player: Player;
  radar: PlayerRadarMetric[];
  derived: DerivedProfile;
  tacticFits: TacticFitSummary[];
  performance: PlayerPerformanceSummary;
}): CoachReport {
  const { player, radar, tacticFits, performance } = args;
  const topMetric = bestRadarMetric(radar);
  const bestFit = [...tacticFits].sort((left, right) => right.score - left.score)[0];
  const secondFit = [...tacticFits].sort((left, right) => right.score - left.score)[1];
  const archetype = deriveArchetype(player, radar, args.derived);
  const strengths = [
    `${ratingLabel(topMetric.value)} ${topMetric.label.toLowerCase()} profile at ${topMetric.value}.`,
    `${bestFit.label} is the cleanest tactical home (${bestFit.score}).`,
    `${player.styleLabel} identity gives the coach a clear match-plan starting point.`,
    `Best drivers: ${bestFit.drivers.join(", ")}.`
  ];
  const weaknesses = deriveWeaknesses(player, radar, tacticFits);
  const riskFlags = deriveRiskFlags(player, radar, tacticFits);
  const bestUse =
    bestFit.key === "spreadCourt"
      ? "Extend rallies, stretch the court, and drain opponents through repeated recovery demands."
      : bestFit.key === "defensiveWall"
        ? "Absorb pressure, reset safely, and invite overhit errors from impatient attackers."
        : bestFit.key === "aggressiveSmash"
          ? "Front-load initiative and shorten points before the opponent settles into rhythm."
          : "Control openings, protect rally stability, and win through cleaner shot selection.";
  const selectionRecommendation =
    bestFit.score >= 88
      ? `Start in matchups where ${bestFit.label} can define the rally shape.`
      : bestFit.score >= 80
        ? `Selectable, but pair with ${bestFit.label} or ${secondFit.label} rather than forcing a poor role.`
        : "Use selectively until the matchup gives this athlete a clear tactical advantage.";

  return {
    archetype,
    summary: `${player.name} profiles as a ${archetype.toLowerCase()} who is best understood through ${topMetric.label.toLowerCase()} and ${bestFit.label.toLowerCase()} usage rather than raw OVR alone.`,
    strengths,
    weaknesses,
    bestUse,
    selectionRecommendation,
    riskFlags,
    readiness: [
      {
        label: "Fitness",
        value: radar.find((metric) => metric.label === "Endurance")!.value >= 86 ? "Excellent" : "Managed",
        detail: "Read from stamina, recovery quality, and rally tolerance."
      },
      {
        label: "Form",
        value: performance.formLabel,
        detail: performance.entries.length > 0 ? "Based on current-run match evidence." : "No current-run evidence yet."
      },
      {
        label: "Morale",
        value: player.ratings.mental.composure >= 84 ? "Stable" : "Watch",
        detail: "Estimated from composure and pressure resistance."
      }
    ]
  };
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
  const recentForm: string[] = [];

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
    return {
      entries,
      aggregateStats,
      recentForm,
      formLabel: "No evidence",
      emptyState:
        "No match evidence yet. Select this athlete for a managed match to unlock performance telemetry, form trends, and opponent-specific analysis."
    };
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
      recentForm.push(match.winnerId === playerId ? "W" : "L");
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

  const latestFive = recentForm.slice(-5);

  return {
    entries,
    aggregateStats,
    recentForm: latestFive,
    formLabel:
      latestFive.length === 0
        ? "No evidence"
        : latestFive.filter((result) => result === "W").length >= Math.ceil(latestFive.length / 2)
          ? "Positive"
          : "Volatile",
    emptyState:
      "No match evidence yet. Select this athlete for a managed match to unlock performance telemetry, form trends, and opponent-specific analysis."
  };
}

function deriveCareerSummary(args: {
  player: Player;
  overall: number;
  performance: PlayerPerformanceSummary;
  career?: CareerState | null;
  selectedPlayerId: string;
}): CareerSummary {
  const { player, overall, career } = args;
  const stage =
    player.age <= 22
      ? "Developing years"
      : player.age <= 29
        ? "Prime years"
        : player.age <= 33
          ? "Late prime"
          : "Veteran phase";
  const trajectory =
    player.age <= 23 && overall >= 82
      ? "Rising"
      : player.age >= 31
        ? "Monitor decline"
        : "Stable";
  const recordedMatches = uniqueCareerMatchRecords(career?.matchHistory ?? []).filter(isMatchForPlayer(player.id));
  const achievements = uniquePlayerCareerAchievements(career?.playerAchievements ?? [])
    .filter((achievement) => achievement.playerId === player.id)
    .map(toAchievementSummary)
    .sort((left, right) => right.date.localeCompare(left.date) || left.eventName.localeCompare(right.eventName));
  const titles = achievements.filter((achievement) => achievement.result === "champion");
  const runnerUpFinishes = achievements.filter((achievement) => achievement.result === "runner_up");
  const finals = titles.length + runnerUpFinishes.length;
  const wins = recordedMatches.filter((match) => match.winnerId === player.id).length;
  const losses = recordedMatches.length - wins;
  const played = wins + losses;
  const hasRecordedHistory = played > 0 || achievements.length > 0;
  const headToHead = deriveHeadToHead(player.id, recordedMatches);
  const winPercentage = formatWinPercentage(wins, played);
  const managedPlayerId = career?.program.managedPlayerId ?? args.selectedPlayerId;
  const managedPlayerSpotlight = deriveManagedPlayerSpotlight({
    playerId: player.id,
    managedPlayerId,
    headToHead
  });
  const profileRecord: PlayerCareerProfileRecord = {
    playerId: player.id,
    wins,
    losses,
    winPercentage: winPercentage.value,
    titles: titles.length,
    runnerUps: runnerUpFinishes.length,
    finals,
    headToHeads: headToHead,
    managedPlayerSpotlight
  };

  return {
    stage,
    trajectory,
    narrative: hasRecordedHistory
      ? `${player.name} has ${wins} win${wins === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"} in recorded universe matches, with ${titles.length} title${titles.length === 1 ? "" : "s"}, ${runnerUpFinishes.length} runner-up finish${runnerUpFinishes.length === 1 ? "" : "es"}, and ${finals} final${finals === 1 ? "" : "s"} recorded.`
      : `${player.name} has no persisted universe match history yet. This archive only counts completed career matches and final results saved by the career system.`,
    milestones: [
      titles.length > 0 ? `${titles.length} title${titles.length === 1 ? "" : "s"} recorded` : "No titles recorded yet",
      runnerUpFinishes.length > 0
        ? `${runnerUpFinishes.length} runner-up finish${runnerUpFinishes.length === 1 ? "" : "es"} recorded`
        : "No runner-up finishes recorded yet",
      finals > 0 ? `${finals} final${finals === 1 ? "" : "s"} reached` : "No finals reached yet",
      played > 0 ? `${played} universe match${played === 1 ? "" : "es"} logged` : "No completed universe matches recorded yet",
      overall >= 88 ? "Profiles as an elite event-level option" : "Profiles as a selectable tour-level option"
    ],
    recordCards: [
      { label: "W-L", value: `${wins}-${losses}` },
      { label: "Win %", value: winPercentage.label },
      { label: "Titles", value: String(titles.length) },
      { label: "Runner-up", value: String(runnerUpFinishes.length) },
      { label: "Finals", value: String(finals) }
    ],
    profileRecord,
    titles,
    runnerUpFinishes,
    achievements,
    headToHead,
    managedPlayerSpotlight,
    hasRecordedHistory
  };
}

export function selectPlayerCareerProfileRecord(args: {
  playerId: string;
  career?: CareerState | null;
  managedPlayerId?: string | null;
}): PlayerCareerProfileRecord {
  const recordedMatches = uniqueCareerMatchRecords(args.career?.matchHistory ?? []).filter(isMatchForPlayer(args.playerId));
  const achievements = uniquePlayerCareerAchievements(args.career?.playerAchievements ?? []).filter(
    (achievement) => achievement.playerId === args.playerId
  );
  const titles = achievements.filter((achievement) => achievement.result === "champion").length;
  const runnerUps = achievements.filter((achievement) => achievement.result === "runner_up").length;
  const wins = recordedMatches.filter((match) => match.winnerId === args.playerId).length;
  const losses = recordedMatches.length - wins;
  const winPercentage = formatWinPercentage(wins, wins + losses);
  const headToHeads = deriveHeadToHead(args.playerId, recordedMatches);
  const managedPlayerSpotlight = deriveManagedPlayerSpotlight({
    playerId: args.playerId,
    managedPlayerId: args.managedPlayerId ?? args.career?.program.managedPlayerId ?? null,
    headToHead: headToHeads
  });

  return {
    playerId: args.playerId,
    wins,
    losses,
    winPercentage: winPercentage.value,
    titles,
    runnerUps,
    finals: titles + runnerUps,
    headToHeads,
    managedPlayerSpotlight
  };
}

function isMatchForPlayer(playerId: string) {
  return (match: CareerMatchRecord) => match.playerAId === playerId || match.playerBId === playerId;
}

function careerMatchDeduplicationKeys(match: CareerMatchRecord) {
  return [
    `id:${match.id}`,
    `signature:${match.eventId}:${match.date}:${match.round}:${match.playerAId}:${match.playerBId}:${match.winnerId}:${match.scoreline}`
  ];
}

function uniqueCareerMatchRecords(matches: CareerMatchRecord[]) {
  const seen = new Set<string>();
  const unique: CareerMatchRecord[] = [];

  for (const match of matches) {
    const keys = careerMatchDeduplicationKeys(match);

    if (keys.some((key) => seen.has(key))) {
      continue;
    }

    for (const key of keys) {
      seen.add(key);
    }
    unique.push(match);
  }

  return unique;
}

function uniquePlayerCareerAchievements(achievements: PlayerCareerAchievement[]) {
  const seen = new Set<string>();
  const unique: PlayerCareerAchievement[] = [];

  for (const achievement of achievements) {
    const key = `${achievement.playerId}:${achievement.eventId}:${achievement.result}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(achievement);
  }

  return unique;
}

function deriveManagedPlayerSpotlight(args: {
  playerId: string;
  managedPlayerId?: string | null;
  headToHead: PlayerHeadToHeadSummary[];
}) {
  if (!args.managedPlayerId || args.managedPlayerId === args.playerId) {
    return null;
  }

  return args.headToHead.find((entry) => entry.opponentId === args.managedPlayerId) ?? null;
}

function toAchievementSummary(achievement: PlayerCareerAchievement): PlayerAchievementSummary {
  return {
    ...achievement,
    label: achievement.result === "champion" ? "Champion" : "Runner-up"
  };
}

function formatWinPercentage(wins: number, played: number) {
  if (played === 0) {
    return {
      value: null,
      label: "N/A"
    };
  }

  const value = Math.round((wins / played) * 100);

  return {
    value,
    label: `${value}%`
  };
}

function deriveHeadToHead(
  playerId: string,
  matches: CareerState["matchHistory"]
): PlayerHeadToHeadSummary[] {
  const groups = new Map<string, { opponentId: string; played: number; wins: number; losses: number }>();

  for (const match of matches) {
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    const group = groups.get(opponentId) ?? { opponentId, played: 0, wins: 0, losses: 0 };

    group.played += 1;
    if (match.winnerId === playerId) {
      group.wins += 1;
    } else {
      group.losses += 1;
    }
    groups.set(opponentId, group);
  }

  return [...groups.values()]
    .map((group) => {
      const winPercentage = formatWinPercentage(group.wins, group.played);

      return {
        opponentId: group.opponentId,
        opponentName: playerMap[group.opponentId]?.name ?? group.opponentId,
        played: group.played,
        wins: group.wins,
        losses: group.losses,
        winPercentage: winPercentage.value,
        winPercentageLabel: winPercentage.label
      };
    })
    .sort(
      (left, right) =>
        right.played - left.played ||
        right.wins - left.wins ||
        left.opponentName.localeCompare(right.opponentName)
    )
    .slice(0, 10);
}

export function createPlayerProfileViewModel(args: {
  playerId: string;
  selectedPlayerId: string;
  tournament: TournamentState | null;
  liveMatch?: LiveMatchSession | null;
  career?: CareerState | null;
}): PlayerProfileViewModel | null {
  const player = playerMap[args.playerId];

  if (!player) {
    return null;
  }

  const dossier = deriveAthleteDossier(player);
  const derived = deriveProfile(player);
  const tacticFits = deriveTacticFits(player, derived);
  const radar = deriveRadar(player, derived);
  const performance = collectPerformance(args);
  const overall = overallFromDossier(dossier);

  return {
    player,
    overall,
    dossier,
    derived,
    traits: player.traits ?? [],
    context: deriveContext(args),
    tacticFits,
    strengths: deriveStrengths(player, derived),
    radar,
    coachReport: deriveCoachReport({
      player,
      radar,
      derived,
      tacticFits,
      performance
    }),
    performance,
    career: deriveCareerSummary({
      player,
      overall,
      performance,
      career: args.career,
      selectedPlayerId: args.selectedPlayerId
    })
  };
}
