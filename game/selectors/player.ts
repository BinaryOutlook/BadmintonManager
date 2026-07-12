import { seededPlayers, playerMap } from "../content/players";
import { tacticOptions } from "../content/tactics";
import { trainingPlans } from "../career/training";
import { deriveAthleteDossier, type AthleteDossier } from "../core/intel";
import type { DerivedProfile, LiveMatchSession, Player } from "../core/models";
import { deriveProfile } from "../core/ratings";
import type {
  AthleteCareerState,
  CareerMatchRecord,
  CareerState,
  PlayerCareerAchievement,
  TrainingPlan
} from "../career/models";
import type { TournamentMatch, TournamentState } from "../tournament/tournament";

export type PlayerProfileMode = "managed" | "opponent" | "selectable" | "entrant" | "available" | "complete";
export type ProfileStatusTone = "positive" | "neutral" | "info" | "warning" | "danger";

export interface PlayerContextSummary {
  label: string;
  detail: string;
  tone: "managed" | "live" | "opponent" | "neutral" | "complete";
  mode: PlayerProfileMode;
  isManaged: boolean;
  fifthTabLabel: "Development" | "Scouting";
}

export interface TacticFitSummary {
  key: string;
  label: string;
  score: number;
  headline: string;
  fitLabel: string;
  risk: string;
  drivers: string[];
  intention: string;
  isRecommended: boolean;
  rank: number;
}

export interface PlayerPerformanceEntry {
  label: string;
  detail: string;
  result: "won" | "lost" | "pending" | "context";
}

export interface PlayerRecentMatchSummary {
  id: string;
  date: string;
  eventName: string;
  round: string;
  opponentId: string;
  opponentName: string;
  result: "W" | "L" | "Pending";
  scoreline: string;
  context: string;
}

export interface PlayerEvidenceItem {
  label: string;
  value: string;
  detail: string;
  tone: ProfileStatusTone;
}

export interface PlayerPerformanceSummary {
  entries: PlayerPerformanceEntry[];
  aggregateStats: Array<{ label: string; value: string }>;
  recentForm: string[];
  formLabel: string;
  emptyState: string;
  recentMatches: PlayerRecentMatchSummary[];
  lastMatchEvidence: PlayerEvidenceItem[];
  shotProfile: PlayerEvidenceItem[];
  tacticalResults: PlayerEvidenceItem[];
  trendSummary: PlayerEvidenceItem[];
  telemetryState: PlayerEvidenceItem;
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

export interface PlayerAttributeRow {
  label: string;
  value: number;
  benchmark: string;
  context: string;
  tone: ProfileStatusTone;
}

export interface PlayerAttributeGroup {
  title: string;
  tone: "neutral" | "cyan" | "soft";
  rows: PlayerAttributeRow[];
}

export interface PlayerDecisionItem {
  label: string;
  value: string;
  detail: string;
  tone: ProfileStatusTone;
}

export interface ManagerVerdict {
  action: string;
  tacticLabel: string;
  reason: string;
  ctaLabel: string;
  ctaDetail: string;
  tone: ProfileStatusTone;
}

export interface ScoutingVerdict {
  action: string;
  primaryThreat: string;
  recommendedCounter: string;
  confidence: number;
  reason: string;
  ctaLabel: string;
  tone: ProfileStatusTone;
}

export interface TrainingRecommendation {
  planLabel: string;
  focus: string;
  expectedGain: string;
  workload: string;
  risk: string;
  ctaLabel: string;
}

export interface ScoutingRecommendation {
  confidence: number;
  recommendation: string;
  comparison: string;
  nextFocus: string;
  affordanceLabel: string;
}

export interface TacticalPlanSummary {
  recommended: TacticFitSummary;
  alternatives: TacticFitSummary[];
  counterPlan: string;
}

export interface PlayerOverviewSummary {
  kind: "managed" | "scouting";
  managerVerdict: ManagerVerdict | null;
  scoutingVerdict: ScoutingVerdict | null;
  readinessStrip: PlayerDecisionItem[];
  threatSummary: PlayerDecisionItem[];
  tacticalPlan: TacticalPlanSummary;
  trainingRecommendation: TrainingRecommendation | null;
  scoutingRecommendation: ScoutingRecommendation | null;
  riskFlags: PlayerDecisionItem[];
  recentEvidence: PlayerDecisionItem[];
  howTheyWin: string[];
  howToBeat: string[];
  knownStrengths: string[];
  unknowns: string[];
  nextAction: PlayerDecisionItem;
}

export interface DevelopmentSummary {
  currentPlan: string;
  recommendedFocus: string;
  expectedGain: string;
  workloadImplication: string;
  potentialNote: string;
  recentTrainingGains: string[];
  cumulativeDevelopment: string[];
  coachNotes: string[];
  injuryRisk: string;
}

export interface ScoutingSummary {
  confidence: number;
  discoveredStrengths: string[];
  uncertainAreas: string[];
  recommendation: string;
  comparison: string;
  opponentPreparation: string[];
  nextFocus: string;
  affordanceLabel: string;
}

export interface CareerSummary {
  stage: string;
  trajectory: string;
  narrative: string;
  primeNote: string;
  milestones: string[];
  recordCards: Array<{ label: string; value: string }>;
  profileRecord: PlayerCareerProfileRecord;
  titles: PlayerAchievementSummary[];
  runnerUpFinishes: PlayerAchievementSummary[];
  achievements: PlayerAchievementSummary[];
  headToHead: PlayerHeadToHeadSummary[];
  rivalries: PlayerRivalrySummary[];
  managedPlayerSpotlight: PlayerHeadToHeadSummary | null;
  hasRecordedHistory: boolean;
  timeline: PlayerCareerTimelineEntry[];
  biggestWins: PlayerCareerResultSummary[];
  worstLosses: PlayerCareerResultSummary[];
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

export interface PlayerRivalrySummary extends PlayerHeadToHeadSummary {
  rivalryLabel: string;
  interpretation: string;
}

export interface PlayerCareerTimelineEntry {
  id: string;
  date: string;
  eventId: string;
  eventName: string;
  detail: string;
  tone: ProfileStatusTone;
}

export interface PlayerCareerResultSummary {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  round: string;
  opponentId: string;
  opponentName: string;
  scoreline: string;
  opponentOverall: number;
}

export interface PlayerHeaderStatus {
  ranking: string | null;
  currentRunRole: string;
  nextMatch: string | null;
  recentForm: string;
  readinessSummary: string;
}

export interface PlayerProfileViewModel {
  player: Player;
  overall: number;
  dossier: AthleteDossier;
  derived: DerivedProfile;
  traits: string[];
  context: PlayerContextSummary;
  headerStatus: PlayerHeaderStatus;
  tacticFits: TacticFitSummary[];
  strengths: Array<{ label: string; value: number; group: string }>;
  radar: PlayerRadarMetric[];
  coachReport: CoachReport;
  attributeGroups: PlayerAttributeGroup[];
  overview: PlayerOverviewSummary;
  development: DevelopmentSummary;
  scouting: ScoutingSummary;
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
  career?: CareerState | null;
  canSelect?: boolean;
}): PlayerContextSummary {
  const { playerId, selectedPlayerId, tournament, liveMatch, career } = args;
  const match = activeManagedMatch(tournament);
  const managedPlayerId = career?.program.managedPlayerId ?? tournament?.managedPlayerId ?? selectedPlayerId;
  const isManaged = playerId === managedPlayerId;

  if (isLiveCompetitor(playerId, liveMatch)) {
    return {
      label: isManaged ? "Live managed athlete" : "Live opponent",
      detail: isManaged
        ? "This profile is connected to the current point-by-point managed match state."
        : "This profile is the current live opponent dossier.",
      tone: "live",
      mode: isManaged ? "managed" : "opponent",
      isManaged,
      fifthTabLabel: isManaged ? "Development" : "Scouting"
    };
  }

  if (match && (match.sideAId === playerId || match.sideBId === playerId)) {
    return {
      label: isManaged ? "Managed athlete" : "Next opponent",
      detail: isManaged
        ? "The current tournament path is built around this athlete."
        : "This athlete is the next bracket obstacle for the managed side.",
      tone: isManaged ? "managed" : "opponent",
      mode: isManaged ? "managed" : "opponent",
      isManaged,
      fifthTabLabel: isManaged ? "Development" : "Scouting"
    };
  }

  if (isManaged) {
    return {
      label: "Managed athlete",
      detail: career
        ? "This athlete is locked as the current career program focus."
        : tournament
          ? "This athlete is locked as the current run focus."
          : "This athlete is the selected setup focus for the next run.",
      tone: "managed",
      mode: "managed",
      isManaged: true,
      fifthTabLabel: "Development"
    };
  }

  if (tournament?.championId === playerId) {
    return {
      label: "Tournament champion",
      detail: `${playerMap[playerId].name} closed the active event as champion.`,
      tone: "complete",
      mode: "complete",
      isManaged: false,
      fifthTabLabel: "Scouting"
    };
  }

  if (args.canSelect) {
    return {
      label: "Selectable athlete",
      detail: "This athlete can be selected before the tournament begins.",
      tone: "neutral",
      mode: "selectable",
      isManaged: false,
      fifthTabLabel: "Scouting"
    };
  }

  if (tournament && tournamentContainsPlayer(tournament, playerId)) {
    const stillHasResult = playerWonCompletedMatch(playerId, tournament);
    return {
      label: stillHasResult ? "Tournament entrant" : "Event entrant",
      detail: stillHasResult
        ? "This athlete has already shaped the current bracket."
        : "This athlete belongs to the active event field.",
      tone: "neutral",
      mode: "entrant",
      isManaged: false,
      fifthTabLabel: "Scouting"
    };
  }

  return {
    label: "Available roster",
    detail: "This athlete is part of the local fictional player pool.",
    tone: "neutral",
    mode: "available",
    isManaged: false,
    fifthTabLabel: "Scouting"
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
  if (value >= 95) {
    return "World Class";
  }

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
  if (score >= 90) {
    return "Best fit";
  }

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

function tacticIntention(tacticKey: string) {
  switch (tacticKey) {
    case "aggressiveSmash":
      return "Use this read in match planning when the athlete can shorten rallies before fatigue accumulates.";
    case "balancedControl":
      return "Carry this into match planning when the safest edge is clean shot selection and front-court control.";
    case "spreadCourt":
      return "Use this as a match-planning route for stretching opponents and making recovery quality decisive.";
    case "defensiveWall":
      return "Take this into preparation when the opponent is likely to overhit against repeated retrieval.";
    default:
      return "Review this fit before choosing a match plan.";
  }
}

function deriveTacticFits(player: Player, derived: DerivedProfile): TacticFitSummary[] {
  return tacticOptions
    .map((option) => {
      const score = tacticFitScore(player, derived, option.key);
      const headline = tacticHeadline(score);

      return {
        key: option.key,
        label: option.label,
        score,
        headline,
        fitLabel: headline,
        risk: tacticRisk(player, option.key),
        drivers: tacticDrivers(player, derived, option.key),
        intention: tacticIntention(option.key),
        isRecommended: false,
        rank: 0
      };
    })
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .map((fit, index) => ({ ...fit, isRecommended: index === 0, rank: index + 1 }));
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
  const bestFit = tacticFits[0];
  const secondFit = tacticFits[1];
  const archetype = deriveArchetype(player, radar, args.derived);
  const strengths = [
    `${ratingLabel(topMetric.value)} ${topMetric.label.toLowerCase()} profile at ${topMetric.value}.`,
    `${bestFit.label} is the cleanest tactical home (${bestFit.score}).`,
    `${player.styleLabel} identity gives the coach a clear match-plan starting point.`,
    `Best drivers: ${bestFit.drivers.join(", ")}.`
  ];
  const weaknesses = deriveWeaknesses(player, radar, tacticFits);
  const riskFlags = deriveRiskFlags(player, radar, tacticFits);
  const bestUse = tacticBestUse(bestFit.key);
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
        detail: performance.entries.length > 0 ? "Based on match evidence." : "No current-run evidence yet."
      },
      {
        label: "Morale",
        value: player.ratings.mental.composure >= 84 ? "Stable" : "Watch",
        detail: "Estimated from composure and pressure resistance."
      }
    ]
  };
}

function tacticBestUse(tacticKey: string) {
  switch (tacticKey) {
    case "spreadCourt":
      return "Extend rallies, stretch the court, and drain opponents through repeated recovery demands.";
    case "defensiveWall":
      return "Absorb pressure, reset safely, and invite overhit errors from impatient attackers.";
    case "aggressiveSmash":
      return "Front-load initiative and shorten points before the opponent settles into rhythm.";
    default:
      return "Control openings, protect rally stability, and win through cleaner shot selection.";
  }
}

function findCareerAthlete(career: CareerState | null | undefined, playerId: string) {
  return career?.athletes.find((athlete) => athlete.playerId === playerId) ?? null;
}

function fieldRankFor(accessor: (player: Player) => number, value: number) {
  const values = seededPlayers.map((entry) => Math.round(accessor(entry.player)));
  const higher = values.filter((candidate) => candidate > Math.round(value)).length;
  const rank = higher + 1;
  const percentile = Math.max(1, Math.round(((values.length - rank + 1) / values.length) * 100));

  return { rank, percentile, fieldSize: values.length };
}

function developmentDeltaText(delta: number) {
  if (Math.abs(delta) < 0.5) {
    return "No recorded change this career";
  }

  return `${delta > 0 ? "+" : ""}${Math.round(delta)} this career`;
}

function attributeTone(value: number): ProfileStatusTone {
  if (value >= 88) {
    return "positive";
  }

  if (value >= 76) {
    return "info";
  }

  if (value >= 68) {
    return "neutral";
  }

  return "warning";
}

function contextForAttribute(args: {
  player: Player;
  currentValue: number;
  accessor: (player: Player) => number;
  benchmark: string;
  context: PlayerContextSummary;
  careerAthlete: AthleteCareerState | null;
  baseValue?: number;
  trainingPlanLabel?: string;
  scoutingConfidence: number;
}) {
  const rank = fieldRankFor(args.accessor, args.currentValue);
  const parts = [`${args.benchmark}`, `Field rank #${rank.rank} of ${rank.fieldSize}`, `${rank.percentile}th percentile`];

  if (args.context.isManaged) {
    const delta = typeof args.baseValue === "number" ? args.currentValue - args.baseValue : 0;
    const trainingNote = args.trainingPlanLabel
      ? `${args.trainingPlanLabel} sensitivity`
      : "Monitor through match planning";

    parts.push(developmentDeltaText(delta), trainingNote);
  } else {
    parts.push(`Scouting confidence ${args.scoutingConfidence}%`, "Verify under match pressure");
  }

  return parts.join(" / ");
}

function deriveAttributeGroups(args: {
  player: Player;
  derived: DerivedProfile;
  context: PlayerContextSummary;
  career: CareerState | null | undefined;
  scoutingConfidence: number;
}): PlayerAttributeGroup[] {
  const { player, derived, context, career, scoutingConfidence } = args;
  const careerAthlete = findCareerAthlete(career, player.id);
  const technicalRows = [
    {
      label: "Smash",
      value: Math.round(careerAthlete?.development.smash ?? player.ratings.technical.smash),
      baseValue: player.ratings.technical.smash,
      accessor: (candidate: Player) => candidate.ratings.technical.smash,
      trainingPlanLabel: "Rear-Court Power"
    },
    {
      label: "Net Play",
      value: player.ratings.technical.netPlay,
      accessor: (candidate: Player) => candidate.ratings.technical.netPlay
    },
    {
      label: "Clear / Lob",
      value: player.ratings.technical.clearLob,
      accessor: (candidate: Player) => candidate.ratings.technical.clearLob
    },
    {
      label: "Drop Shot",
      value: player.ratings.technical.dropShot,
      accessor: (candidate: Player) => candidate.ratings.technical.dropShot
    },
    {
      label: "Defense / Retrieval",
      value: player.ratings.technical.defenseRetrieval,
      accessor: (candidate: Player) => candidate.ratings.technical.defenseRetrieval
    },
    {
      label: "Serve / Return",
      value: player.ratings.technical.serveReturn,
      accessor: (candidate: Player) => candidate.ratings.technical.serveReturn
    }
  ];
  const physicalRows = [
    {
      label: "Stamina",
      value: Math.round(careerAthlete?.development.stamina ?? player.ratings.physical.stamina),
      baseValue: player.ratings.physical.stamina,
      accessor: (candidate: Player) => candidate.ratings.physical.stamina,
      trainingPlanLabel: "Rally Base"
    },
    {
      label: "Footwork Speed",
      value: player.ratings.physical.footworkSpeed,
      accessor: (candidate: Player) => candidate.ratings.physical.footworkSpeed
    },
    {
      label: "Explosiveness / Jump",
      value: player.ratings.physical.explosivenessJump,
      accessor: (candidate: Player) => candidate.ratings.physical.explosivenessJump
    },
    {
      label: "Agility / Balance",
      value: player.ratings.physical.agilityBalance,
      accessor: (candidate: Player) => candidate.ratings.physical.agilityBalance
    }
  ];
  const mentalRows = [
    {
      label: "Anticipation",
      value: player.ratings.mental.anticipation,
      accessor: (candidate: Player) => candidate.ratings.mental.anticipation
    },
    {
      label: "Composure",
      value: Math.round(careerAthlete?.development.composure ?? player.ratings.mental.composure),
      baseValue: player.ratings.mental.composure,
      accessor: (candidate: Player) => candidate.ratings.mental.composure,
      trainingPlanLabel: "Pressure Patterns"
    },
    {
      label: "Focus",
      value: player.ratings.mental.focus,
      accessor: (candidate: Player) => candidate.ratings.mental.focus
    },
    {
      label: "Aggression",
      value: player.ratings.mental.aggression,
      accessor: (candidate: Player) => candidate.ratings.mental.aggression
    }
  ];
  const derivedRows = [
    {
      label: "Attack",
      value: Math.round(derived.attackPressure),
      accessor: (candidate: Player) => deriveProfile(candidate).attackPressure
    },
    {
      label: "Front Court",
      value: Math.round(derived.frontCourtControl),
      accessor: (candidate: Player) => deriveProfile(candidate).frontCourtControl
    },
    {
      label: "Recovery",
      value: Math.round(derived.recoveryQuality),
      baseValue: Math.round(derived.recoveryQuality),
      accessor: (candidate: Player) => deriveProfile(candidate).recoveryQuality,
      trainingPlanLabel: "Physio Recovery"
    },
    {
      label: "Rally",
      value: Math.round(derived.rallyTolerance),
      accessor: (candidate: Player) => deriveProfile(candidate).rallyTolerance
    },
    {
      label: "Pressure",
      value: Math.round(derived.pressureResistance),
      accessor: (candidate: Player) => deriveProfile(candidate).pressureResistance
    },
    {
      label: "Judgment",
      value: Math.round(derived.judgment),
      accessor: (candidate: Player) => deriveProfile(candidate).judgment
    }
  ];

  const toRows = (rows: typeof technicalRows): PlayerAttributeRow[] =>
    rows.map((row) => {
      const benchmark = ratingLabel(row.value);

      return {
        label: row.label,
        value: row.value,
        benchmark,
        context: contextForAttribute({
          player,
          currentValue: row.value,
          accessor: row.accessor,
          benchmark,
          context,
          careerAthlete,
          baseValue: row.baseValue,
          trainingPlanLabel: row.trainingPlanLabel,
          scoutingConfidence
        }),
        tone: attributeTone(row.value)
      };
    });

  return [
    { title: "Technical", tone: "neutral", rows: toRows(technicalRows) },
    { title: "Physical", tone: "cyan", rows: toRows(physicalRows) },
    { title: "Mental", tone: "soft", rows: toRows(mentalRows) },
    { title: "Derived Profile", tone: "neutral", rows: toRows(derivedRows) }
  ];
}

function matchOpponentId(match: TournamentMatch | CareerMatchRecord, playerId: string) {
  if ("sideAId" in match) {
    return match.sideAId === playerId ? match.sideBId : match.sideAId;
  }

  return match.playerAId === playerId ? match.playerBId : match.playerAId;
}

function tournamentMatchToRecent(match: TournamentMatch, eventName: string, playerId: string): PlayerRecentMatchSummary {
  const opponentId = matchOpponentId(match, playerId);
  const opponent = playerMap[opponentId];

  return {
    id: `tournament:${match.id}`,
    date: "Current run",
    eventName,
    round: match.round,
    opponentId,
    opponentName: opponent?.name ?? opponentId,
    result: match.completed ? (match.winnerId === playerId ? "W" : "L") : "Pending",
    scoreline: match.scoreline ?? "Scheduled",
    context: match.completed
      ? `${match.simulationFidelity ?? "match"} result`
      : "Pending bracket match"
  };
}

function careerMatchToRecent(match: CareerMatchRecord, playerId: string): PlayerRecentMatchSummary {
  const opponentId = matchOpponentId(match, playerId);
  const opponent = playerMap[opponentId];

  return {
    id: `career:${match.id}`,
    date: match.date,
    eventName: match.eventName,
    round: match.round,
    opponentId,
    opponentName: opponent?.name ?? opponentId,
    result: match.winnerId === playerId ? "W" : "L",
    scoreline: match.scoreline,
    context: match.source.replace(/_/g, " ")
  };
}

function collectPerformance(args: {
  playerId: string;
  selectedPlayerId: string;
  tournament: TournamentState | null;
  liveMatch?: LiveMatchSession | null;
  career?: CareerState | null;
}): PlayerPerformanceSummary {
  const { playerId, selectedPlayerId, tournament, liveMatch, career } = args;
  const entries: PlayerPerformanceEntry[] = [];
  const aggregateStats: Array<{ label: string; value: string }> = [];
  const recentMatches: PlayerRecentMatchSummary[] = [];
  const lastMatchEvidence: PlayerEvidenceItem[] = [];
  const shotProfile: PlayerEvidenceItem[] = [];
  const tacticalResults: PlayerEvidenceItem[] = [];
  const trendSummary: PlayerEvidenceItem[] = [];

  if (liveMatch && isLiveCompetitor(playerId, liveMatch)) {
    const isA = liveMatch.input.playerA.id === playerId;
    const competitor = isA ? liveMatch.competitorA : liveMatch.competitorB;

    entries.push({
      label: "Live match",
      detail: `Set ${liveMatch.currentSetNumber}, stamina ${Math.round(competitor.stamina)}%, momentum ${Math.round(competitor.momentum)}.`,
      result: "pending"
    });
    lastMatchEvidence.push(
      {
        label: "Live stamina",
        value: `${Math.round(competitor.stamina)}%`,
        detail: "Point-by-point stamina is active for this competitor.",
        tone: competitor.stamina >= 70 ? "positive" : competitor.stamina >= 50 ? "warning" : "danger"
      },
      {
        label: "Live momentum",
        value: `${Math.round(competitor.momentum)}`,
        detail: "Current match momentum from live engine state.",
        tone: competitor.momentum >= 55 ? "positive" : competitor.momentum <= 45 ? "warning" : "neutral"
      }
    );
  }

  if (tournament) {
    for (const round of tournament.rounds) {
      for (const match of round.matches) {
        if (match.sideAId !== playerId && match.sideBId !== playerId) {
          continue;
        }

        const recent = tournamentMatchToRecent(match, tournament.name, playerId);
        recentMatches.push(recent);

        if (!match.completed) {
          entries.push({
            label: `${round.name} pending`,
            detail: `Scheduled against ${recent.opponentName}.`,
            result: "pending"
          });
          continue;
        }

        entries.push({
          label: round.name,
          detail: `${match.winnerId === playerId ? "Won" : "Lost"} against ${recent.opponentName}, ${match.scoreline ?? "score pending"}.`,
          result: match.winnerId === playerId ? "won" : "lost"
        });

        if (match.summaryEvents?.[0]) {
          tacticalResults.push({
            label: match.summaryEvents[0].title,
            value: round.name,
            detail: match.summaryEvents[0].detail,
            tone: match.winnerId === playerId ? "positive" : "warning"
          });
        }
      }
    }
  }

  const careerRecentMatches = uniqueCareerMatchRecords(career?.matchHistory ?? [])
    .filter(isMatchForPlayer(playerId))
    .map((match) => careerMatchToRecent(match, playerId));
  const existingRecentIds = new Set(recentMatches.map((match) => `${match.eventName}:${match.round}:${match.opponentId}:${match.scoreline}`));

  for (const recent of careerRecentMatches) {
    const key = `${recent.eventName}:${recent.round}:${recent.opponentId}:${recent.scoreline}`;

    if (!existingRecentIds.has(key)) {
      recentMatches.push(recent);
    }
  }

  if (!tournament) {
    for (const recent of careerRecentMatches.slice(-5)) {
      entries.push({
        label: `${recent.eventName} ${recent.round}`,
        detail: `${recent.result === "W" ? "Won" : "Lost"} against ${recent.opponentName}, ${recent.scoreline}.`,
        result: recent.result === "W" ? "won" : "lost"
      });
    }
  }

  if (playerId === selectedPlayerId && tournament?.managedResults.length) {
    const totals = tournament.managedResults.reduce(
      (sum, result) => ({
        winners: sum.winners + result.stats.winners,
        errors: sum.errors + result.stats.unforcedErrors,
        smashes: sum.smashes + result.stats.totalSmashes,
        staminaDrain: sum.staminaDrain + result.stats.staminaDrain,
        longestRally: Math.max(sum.longestRally, result.stats.longestRally),
        peakSmash: Math.max(sum.peakSmash, result.stats.peakSmashSpeed),
        totalPoints: sum.totalPoints + result.stats.totalPoints
      }),
      { winners: 0, errors: 0, smashes: 0, staminaDrain: 0, longestRally: 0, peakSmash: 0, totalPoints: 0 }
    );
    const lastResult = tournament.managedResults[tournament.managedResults.length - 1];

    aggregateStats.push(
      { label: "Managed wins", value: String(tournament.managedResults.filter((result) => result.won).length) },
      { label: "Winners", value: String(totals.winners) },
      { label: "Errors", value: String(totals.errors) },
      { label: "Total smashes", value: String(totals.smashes) },
      { label: "Peak smash", value: totals.peakSmash > 0 ? `${totals.peakSmash} km/h` : "N/A" },
      { label: "Longest rally", value: totals.longestRally > 0 ? `${totals.longestRally} shots` : "N/A" },
      { label: "Stamina drain", value: String(totals.staminaDrain) }
    );
    lastMatchEvidence.push(
      {
        label: "Last result",
        value: lastResult.won ? "Won" : "Lost",
        detail: `${lastResult.round} against ${lastResult.opponentName}, ${lastResult.scoreline}.`,
        tone: lastResult.won ? "positive" : "danger"
      },
      {
        label: "Winners / errors",
        value: `${lastResult.stats.winners}/${lastResult.stats.unforcedErrors}`,
        detail: "Last managed match shot conversion evidence.",
        tone: lastResult.stats.winners >= lastResult.stats.unforcedErrors ? "positive" : "warning"
      },
      {
        label: "Stamina drain",
        value: String(lastResult.stats.staminaDrain),
        detail: "Load cost from the latest managed match.",
        tone: lastResult.stats.staminaDrain <= 10 ? "positive" : "warning"
      },
      {
        label: "Longest rally",
        value: `${lastResult.stats.longestRally} shots`,
        detail: "Best available rally-length evidence from the current run.",
        tone: "info"
      },
      {
        label: "Peak smash",
        value: `${lastResult.stats.peakSmashSpeed} km/h`,
        detail: "Peak power evidence from the latest managed match.",
        tone: "info"
      }
    );
    shotProfile.push(
      {
        label: "Smash pressure",
        value: totals.totalPoints > 0 ? `${Math.round((totals.smashes / totals.totalPoints) * 100)}%` : "N/A",
        detail: `${totals.smashes} smashes across ${totals.totalPoints} tracked points.`,
        tone: "info"
      },
      {
        label: "Winner balance",
        value: `${totals.winners - totals.errors >= 0 ? "+" : ""}${totals.winners - totals.errors}`,
        detail: `${totals.winners} winners versus ${totals.errors} unforced errors.`,
        tone: totals.winners >= totals.errors ? "positive" : "warning"
      },
      {
        label: "Rally load",
        value: `${totals.longestRally} shots`,
        detail: "Longest tracked rally in the managed run.",
        tone: "neutral"
      }
    );
    trendSummary.push(
      {
        label: "Recent winners",
        value: String(totals.winners),
        detail: "Total managed-run winners from available telemetry.",
        tone: "positive"
      },
      {
        label: "Recent errors",
        value: String(totals.errors),
        detail: "Total unforced errors from available telemetry.",
        tone: totals.errors <= totals.winners ? "neutral" : "warning"
      },
      {
        label: "Stamina trend",
        value: String(totals.staminaDrain),
        detail: "Total stamina drain across tracked managed matches.",
        tone: totals.staminaDrain <= 24 ? "neutral" : "warning"
      }
    );
  }

  const orderedRecentMatches = recentMatches.sort((left, right) => {
    if (left.date === "Current run" && right.date !== "Current run") {
      return 1;
    }
    if (right.date === "Current run" && left.date !== "Current run") {
      return -1;
    }
    return left.date.localeCompare(right.date) || left.eventName.localeCompare(right.eventName);
  });
  const completedRecentMatches = orderedRecentMatches.filter((match) => match.result === "W" || match.result === "L");
  const recentForm = completedRecentMatches.slice(-5).map((match) => match.result);

  if (lastMatchEvidence.length === 0 && completedRecentMatches.length > 0) {
    const last = completedRecentMatches[completedRecentMatches.length - 1];
    lastMatchEvidence.push({
      label: "Last match",
      value: last.result === "W" ? "Won" : "Lost",
      detail: `${last.eventName} ${last.round} against ${last.opponentName}, ${last.scoreline}.`,
      tone: last.result === "W" ? "positive" : "warning"
    });
  }

  if (trendSummary.length === 0 && recentForm.length > 0) {
    const wins = recentForm.filter((result) => result === "W").length;
    trendSummary.push({
      label: "Result trend",
      value: `${wins}-${recentForm.length - wins}`,
      detail: "Recent completed match results from persisted records.",
      tone: wins >= Math.ceil(recentForm.length / 2) ? "positive" : "warning"
    });
  }

  const hasTelemetry = aggregateStats.length > 0 || lastMatchEvidence.length > 0 || liveMatch;
  const telemetryState: PlayerEvidenceItem = hasTelemetry
    ? {
        label: "Telemetry state",
        value: aggregateStats.length > 0 ? "Tracked" : "Partial",
        detail: aggregateStats.length > 0
          ? "Managed match telemetry is available for winners, errors, smashes, stamina, and rally load."
          : "Result evidence exists, but detailed shot telemetry is not available for this profile state.",
        tone: aggregateStats.length > 0 ? "positive" : "info"
      }
    : {
        label: "Telemetry state",
        value: "Locked",
        detail: "Match telemetry unlocks through managed play or persisted career match records; no blank dossier is fabricated.",
        tone: "neutral"
      };

  return {
    entries,
    aggregateStats,
    recentForm,
    formLabel:
      recentForm.length === 0
        ? "No evidence"
        : recentForm.filter((result) => result === "W").length >= Math.ceil(recentForm.length / 2)
          ? "Positive"
          : "Volatile",
    emptyState:
      completedRecentMatches.length > 0
        ? "Detailed telemetry is locked for this profile state, but persisted result evidence is available."
        : "No match evidence yet. Select this athlete for a managed match or let the career universe produce persisted records to unlock performance analysis.",
    recentMatches: orderedRecentMatches.slice(-5).reverse(),
    lastMatchEvidence,
    shotProfile,
    tacticalResults,
    trendSummary,
    telemetryState
  };
}

function chooseTrainingPlan(args: {
  player: Player;
  derived: DerivedProfile;
  tacticFits: TacticFitSummary[];
  careerAthlete: AthleteCareerState | null;
}) {
  const { player, derived, careerAthlete } = args;

  if (careerAthlete && (careerAthlete.fatigue >= 62 || careerAthlete.injuryRisk >= 0.16 || careerAthlete.injury.status !== "healthy")) {
    return trainingPlans.find((plan) => plan.id === "physio-recovery") ?? trainingPlans[0];
  }

  const priorities = [
    { focus: "smash", score: player.ratings.technical.smash, planId: "rear-court-power" },
    { focus: "stamina", score: player.ratings.physical.stamina, planId: "rally-base" },
    { focus: "composure", score: player.ratings.mental.composure, planId: "pressure-patterns" },
    { focus: "recovery", score: Math.round(derived.recoveryQuality), planId: "mobility-recovery" }
  ].sort((left, right) => left.score - right.score);

  return trainingPlans.find((plan) => plan.id === priorities[0].planId) ?? trainingPlans[0];
}

function trainingGain(plan: TrainingPlan) {
  switch (plan.focus) {
    case "smash":
      return `+${plan.attributeDelta.smash} smash over the next block`;
    case "stamina":
      return `+${plan.attributeDelta.stamina} stamina with recovery support`;
    case "composure":
      return `+${plan.attributeDelta.composure} composure under pressure`;
    case "recovery":
      return `+${Math.max(plan.attributeDelta.recovery, plan.recoveryDelta)} recovery impact`;
  }
}

function workloadLabel(plan: TrainingPlan) {
  const fatigue = plan.fatigueDelta >= 0 ? `+${plan.fatigueDelta}` : String(plan.fatigueDelta);
  const risk = plan.injuryRiskDelta >= 0 ? `+${Math.round(plan.injuryRiskDelta * 100)} pts` : `${Math.round(plan.injuryRiskDelta * 100)} pts`;

  return `${plan.intensity} load / fatigue ${fatigue} / injury risk ${risk}`;
}

function deriveTrainingRecommendation(args: {
  player: Player;
  derived: DerivedProfile;
  tacticFits: TacticFitSummary[];
  career: CareerState | null | undefined;
}): TrainingRecommendation {
  const careerAthlete = findCareerAthlete(args.career, args.player.id);
  const plan = chooseTrainingPlan({
    player: args.player,
    derived: args.derived,
    tacticFits: args.tacticFits,
    careerAthlete
  });

  return {
    planLabel: plan.label,
    focus: plan.focus,
    expectedGain: trainingGain(plan),
    workload: workloadLabel(plan),
    risk: plan.intensity === "recovery"
      ? "Recovery block lowers accumulated fatigue before the next commitment."
      : "Avoid stacking this block on top of heavy tournament load.",
    ctaLabel: "Open Training"
  };
}

function counterForTactic(tacticKey: string) {
  switch (tacticKey) {
    case "aggressiveSmash":
      return {
        label: "Defensive Wall",
        notes: [
          "Absorb first-wave smash pressure and make the attacker play one extra shot.",
          "Keep lifts safer until their error rate rises."
        ]
      };
    case "balancedControl":
      return {
        label: "Spread Court",
        notes: [
          "Move them off the tidy front-court rhythm with width and length changes.",
          "Avoid feeding comfortable serve-return patterns."
        ]
      };
    case "spreadCourt":
      return {
        label: "Aggressive Smash",
        notes: [
          "Shorten rallies before their recovery engine becomes decisive.",
          "Attack loose clears and stop them resetting the exchange."
        ]
      };
    case "defensiveWall":
      return {
        label: "Balanced Control",
        notes: [
          "Use patience, not desperation, to draw them forward before attacking space.",
          "Win the serve-return phase so they cannot sit in pure retrieval."
        ]
      };
    default:
      return {
        label: "Balanced Control",
        notes: ["Start from a stable plan and adjust after early rally evidence."]
      };
  }
}

function scoutingConfidence(args: {
  context: PlayerContextSummary;
  performance: PlayerPerformanceSummary;
  career: CareerSummary;
}) {
  const base = args.context.mode === "opponent" ? 72 : args.context.mode === "selectable" ? 64 : 58;
  const evidenceBonus = args.performance.recentMatches.length > 0 ? 8 : 0;
  const careerBonus = args.career.hasRecordedHistory ? 10 : 0;

  return Math.min(92, base + evidenceBonus + careerBonus);
}

function deriveReadinessStrip(args: {
  player: Player;
  careerAthlete: AthleteCareerState | null;
  performance: PlayerPerformanceSummary;
  radar: PlayerRadarMetric[];
}) {
  const endurance = args.radar.find((metric) => metric.label === "Endurance")?.value ?? args.player.ratings.physical.stamina;
  const fatigue = args.careerAthlete ? Math.round(args.careerAthlete.fatigue) : Math.max(8, 100 - endurance);
  const injuryRisk = args.careerAthlete ? Math.round(args.careerAthlete.injuryRisk * 100) : Math.max(4, Math.round((100 - endurance) / 3));
  const readiness = args.careerAthlete ? Math.round(args.careerAthlete.readiness) : endurance;
  const injuryLabel = args.careerAthlete?.injury.label ?? "No active injury episode";

  return [
    {
      label: "Fitness",
      value: `${readiness}`,
      detail: args.careerAthlete ? "Career readiness from health state." : "Estimated from endurance profile.",
      tone: readiness >= 78 ? "positive" : readiness >= 62 ? "warning" : "danger"
    },
    {
      label: "Form",
      value: args.performance.formLabel,
      detail: args.performance.recentForm.length > 0 ? "Last five completed results." : "No result trend yet.",
      tone: args.performance.formLabel === "Positive" ? "positive" : args.performance.formLabel === "Volatile" ? "warning" : "neutral"
    },
    {
      label: "Morale",
      value: args.player.ratings.mental.composure >= 84 ? "Stable" : "Watch",
      detail: "Estimated from composure and pressure resistance.",
      tone: args.player.ratings.mental.composure >= 84 ? "positive" : "warning"
    },
    {
      label: "Fatigue",
      value: `${fatigue}`,
      detail: args.careerAthlete ? args.careerAthlete.recoveryStatus : "Estimated from endurance gap.",
      tone: fatigue <= 34 ? "positive" : fatigue <= 60 ? "warning" : "danger"
    },
    {
      label: "Injury Risk",
      value: `${injuryRisk}%`,
      detail: injuryLabel,
      tone: injuryRisk <= 10 ? "positive" : injuryRisk <= 22 ? "warning" : "danger"
    },
    {
      label: "Sharpness",
      value: args.performance.recentMatches.length > 0 ? "Match fit" : "Unproven",
      detail: args.performance.recentMatches.length > 0 ? "Recent match data exists." : "Needs current-run evidence.",
      tone: args.performance.recentMatches.length > 0 ? "info" : "neutral"
    }
  ] satisfies PlayerDecisionItem[];
}

function deriveManagerVerdict(args: {
  player: Player;
  tacticFits: TacticFitSummary[];
  readinessStrip: PlayerDecisionItem[];
  training: TrainingRecommendation;
  careerAthlete: AthleteCareerState | null;
}) {
  const bestFit = args.tacticFits[0];
  const fitness = Number(args.readinessStrip[0].value);
  const fatigue = Number(args.readinessStrip[3].value);
  const injuryRiskText = args.readinessStrip[4].value.replace("%", "");
  const injuryRisk = Number(injuryRiskText);

  if (args.careerAthlete?.injury.status === "out" || fitness < 55 || fatigue >= 70 || injuryRisk >= 30) {
    return {
      action: "Rest and review load",
      tacticLabel: bestFit.label,
      reason: `Readiness ${fitness}, fatigue ${fatigue}, and injury risk ${injuryRisk}% make selection expensive.`,
      ctaLabel: "Open Training",
      ctaDetail: `${args.training.planLabel} is the safer next workflow before forcing another match.`,
      tone: "danger"
    } satisfies ManagerVerdict;
  }

  if (bestFit.score >= 88 && fitness >= 70) {
    return {
      action: "Start next match",
      tacticLabel: bestFit.label,
      reason: `${ratingLabel(bestFit.score)} tactical fit, stable readiness, and ${args.player.styleLabel.toLowerCase()} identity point toward selection.`,
      ctaLabel: "Open Match Planning",
      ctaDetail: `Use ${bestFit.label} as the first planning lens; no direct tactic change is made here.`,
      tone: "positive"
    } satisfies ManagerVerdict;
  }

  if (bestFit.score >= 80) {
    return {
      action: "Prepare with constraints",
      tacticLabel: bestFit.label,
      reason: `${bestFit.label} is strong, but the profile still needs matchup discipline before committing.`,
      ctaLabel: "Open Match Planning",
      ctaDetail: "Review opponent fit and protect the weakest tactical phase.",
      tone: "info"
    } satisfies ManagerVerdict;
  }

  return {
    action: "Train before starring role",
    tacticLabel: bestFit.label,
    reason: `Best tactic is only ${bestFit.score}; development should sharpen the role before overcommitting.`,
    ctaLabel: "Open Training",
    ctaDetail: `${args.training.planLabel} is the recommended improvement route.`,
    tone: "warning"
  } satisfies ManagerVerdict;
}

function threatSummary(args: {
  player: Player;
  tacticFits: TacticFitSummary[];
  overall: number;
  context: PlayerContextSummary;
  selectedPlayerId: string;
}) {
  const bestFit = args.tacticFits[0];
  const managedPlayer = playerMap[args.selectedPlayerId];
  const managedOverall = managedPlayer ? overallFromDossier(deriveAthleteDossier(managedPlayer)) : args.overall;
  const overallGap = args.overall - managedOverall;

  return [
    {
      label: args.context.mode === "selectable" ? "Selection fit" : "Primary threat",
      value: bestFit.label,
      detail: `${bestFit.score} fit score with ${bestFit.drivers.join(", ")}.`,
      tone: bestFit.score >= 88 ? "danger" : bestFit.score >= 80 ? "warning" : "neutral"
    },
    {
      label: "OVR comparison",
      value: overallGap === 0 ? "Level" : `${overallGap > 0 ? "+" : ""}${overallGap}`,
      detail: managedPlayer
        ? `Compared with current managed athlete ${managedPlayer.name}.`
        : "No managed athlete comparison available.",
      tone: overallGap > 3 ? "danger" : overallGap < -3 ? "positive" : "info"
    },
    {
      label: "Identity",
      value: args.player.styleLabel,
      detail: tacticBestUse(bestFit.key),
      tone: "info"
    }
  ] satisfies PlayerDecisionItem[];
}

function deriveRiskDecisionItems(args: {
  coachReport: CoachReport;
  readinessStrip: PlayerDecisionItem[];
  tacticFits: TacticFitSummary[];
}): PlayerDecisionItem[] {
  const items = args.coachReport.riskFlags.map((flag) => ({
    label: "Risk flag",
    value: flag,
    detail: "Derived from ratings, tactical fit, or current availability.",
    tone: flag.toLowerCase().includes("fatigue") || flag.toLowerCase().includes("weakest") ? "warning" : "neutral"
  })) satisfies PlayerDecisionItem[];
  const fatigue = args.readinessStrip.find((entry) => entry.label === "Fatigue");
  const lowestFit = args.tacticFits[args.tacticFits.length - 1];

  const combined: PlayerDecisionItem[] = [
    ...items,
    ...(fatigue && fatigue.tone !== "positive" ? [fatigue] : []),
    {
      label: "Tradeoff",
      value: lowestFit.label,
      detail: `${lowestFit.label} is the least comfortable plan at ${lowestFit.score}.`,
      tone: "warning"
    }
  ];

  return combined.slice(0, 5);
}

function recentEvidenceItems(performance: PlayerPerformanceSummary): PlayerDecisionItem[] {
  if (performance.lastMatchEvidence.length > 0) {
    return performance.lastMatchEvidence.slice(0, 4).map((entry) => ({
      label: entry.label,
      value: entry.value,
      detail: entry.detail,
      tone: entry.tone
    }));
  }

  if (performance.recentMatches.length > 0) {
    return performance.recentMatches.slice(0, 3).map((match) => ({
      label: `${match.eventName} ${match.round}`,
      value: match.result,
      detail: `${match.opponentName}, ${match.scoreline}.`,
      tone: match.result === "W" ? "positive" : match.result === "L" ? "warning" : "neutral"
    }));
  }

  return [
    {
      label: "Evidence",
      value: "Locked",
      detail: performance.emptyState,
      tone: "neutral"
    }
  ] satisfies PlayerDecisionItem[];
}

type DevelopmentHistoryEntry = CareerState["developmentHistory"][number];
type DevelopmentValues = AthleteCareerState["development"];

const developmentFields = [
  ["smash", "Smash"],
  ["stamina", "Stamina"],
  ["composure", "Composure"],
  ["recovery", "Recovery"]
] as const satisfies ReadonlyArray<readonly [keyof DevelopmentValues, string]>;

function formatDevelopmentValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatDevelopmentChange(value: number) {
  const rounded = Math.round(value * 10) / 10;

  if (Math.abs(rounded) < 0.05) {
    return "no change";
  }

  return `${rounded > 0 ? "+" : ""}${formatDevelopmentValue(rounded)}`;
}

function retainedDevelopmentHistory(career: CareerState | null | undefined, athleteId: string) {
  return (career?.developmentHistory ?? [])
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.athleteId === athleteId)
    .sort(
      (left, right) =>
        left.entry.date.localeCompare(right.entry.date) || left.index - right.index
    )
    .map(({ entry }) => entry);
}

function developmentChangeList(current: DevelopmentValues, previous: DevelopmentValues) {
  const changes = developmentFields.flatMap(([key, label]) => {
    const delta = current[key] - previous[key];
    return Math.abs(delta) < 0.05 ? [] : [`${label} ${formatDevelopmentChange(delta)}`];
  });

  return changes.length > 0 ? changes.join(", ") : "No development rating change";
}

function developmentSnapshotList(values: DevelopmentValues) {
  return developmentFields
    .map(([key, label]) => `${label} ${formatDevelopmentValue(values[key])}`)
    .join(", ");
}

function persistedPreparationHistory(history: DevelopmentHistoryEntry[]) {
  const rows: string[] = [];
  let previousDevelopment: DevelopmentValues | null = null;

  for (const entry of history) {
    if (entry.kind === "snapshot") {
      if (entry.source === "legacy_snapshot") {
        rows.push(
          `${entry.date} · Legacy development snapshot · Earlier training detail unavailable. ${entry.note}`
        );
      }

      previousDevelopment = entry.snapshot.development;
      continue;
    }

    if (entry.outcome === "blocked") {
      rows.push(`${entry.date} · ${entry.planLabel} blocked · ${entry.reason}`);
      previousDevelopment = entry.snapshot.development;
      continue;
    }

    const outcome = previousDevelopment
      ? developmentChangeList(entry.snapshot.development, previousDevelopment)
      : `Development after block: ${developmentSnapshotList(entry.snapshot.development)}; earlier comparison unavailable`;
    rows.push(`${entry.date} · ${entry.planLabel} completed · ${outcome}. ${entry.reason}`);
    previousDevelopment = entry.snapshot.development;
  }

  return rows.reverse().slice(0, 6);
}

function cumulativeDevelopmentSummary(args: {
  player: Player;
  careerAthlete: AthleteCareerState | null;
  history: DevelopmentHistoryEntry[];
}) {
  if (!args.careerAthlete) {
    return ["Career development tracking unlocks when this athlete is in the managed program."];
  }

  const earliest = args.history[0];
  const baseline = earliest?.snapshot.development ?? {
    smash: args.player.ratings.technical.smash,
    stamina: args.player.ratings.physical.stamina,
    composure: args.player.ratings.mental.composure,
    recovery: args.careerAthlete.development.recovery
  };
  const baselineLabel = earliest
    ? earliest.kind === "snapshot"
      ? earliest.source === "legacy_snapshot"
        ? `since the ${earliest.date} legacy snapshot`
        : `since the ${earliest.date} ${earliest.source === "career_start" ? "career" : "recruitment"} baseline`
      : `since the earliest retained record on ${earliest.date}`
    : "versus the catalog baseline; persisted baseline unavailable";

  return developmentFields.map(([key, label]) => {
    const current = args.careerAthlete!.development[key];
    const change = formatDevelopmentChange(current - baseline[key]);
    return `${label} ${formatDevelopmentValue(current)} (${change} ${baselineLabel})`;
  });
}

function deriveDevelopmentSummary(args: {
  player: Player;
  career: CareerState | null | undefined;
  training: TrainingRecommendation;
  careerAthlete: AthleteCareerState | null;
  tacticFits: TacticFitSummary[];
}): DevelopmentSummary {
  const scheduledBlock = [...(args.career?.preparationSchedule ?? [])]
    .filter(
      (block) =>
        block.athleteId === args.player.id &&
        (!args.career || block.scheduledDate >= args.career.date)
    )
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.id.localeCompare(right.id))[0];
  const careerAthlete = args.careerAthlete;
  const history = retainedDevelopmentHistory(args.career, args.player.id);
  const currentPlan = scheduledBlock
    ? `${scheduledBlock.planSnapshot.label} / ${scheduledBlock.scheduledDate}`
    : "No scheduled preparation block";
  const recentTrainingGains = persistedPreparationHistory(history);
  const cumulativeDevelopment = cumulativeDevelopmentSummary({
    player: args.player,
    careerAthlete,
    history
  });

  return {
    currentPlan,
    recommendedFocus: args.training.planLabel,
    expectedGain: args.training.expectedGain,
    workloadImplication: args.training.workload,
    potentialNote:
      args.player.age <= 23
        ? "Age curve still supports meaningful development blocks."
        : args.player.age <= 30
          ? "Prime-age gains should be targeted, not scattered."
          : "Veteran profile: prioritize recovery and role preservation.",
    recentTrainingGains,
    cumulativeDevelopment,
    coachNotes: [
      `${args.tacticFits[0].label} remains the tactical north star.`,
      args.training.risk,
      careerAthlete ? `Recovery status: ${careerAthlete.recoveryStatus}.` : "No career workload state is attached yet."
    ],
    injuryRisk: careerAthlete
      ? `${Math.round(careerAthlete.injuryRisk * 100)}% / ${careerAthlete.injury.label}`
      : "Estimated only until career health state exists"
  };
}

function deriveScoutingSummary(args: {
  player: Player;
  selectedPlayerId: string;
  confidence: number;
  tacticFits: TacticFitSummary[];
  coachReport: CoachReport;
  context: PlayerContextSummary;
  performance: PlayerPerformanceSummary;
}) {
  const bestFit = args.tacticFits[0];
  const counter = counterForTactic(bestFit.key);
  const managedPlayer = playerMap[args.selectedPlayerId];
  const managedOverall = managedPlayer ? overallFromDossier(deriveAthleteDossier(managedPlayer)) : 0;
  const playerOverall = overallFromDossier(deriveAthleteDossier(args.player));
  const comparison = managedPlayer
    ? `${playerOverall >= managedOverall ? "+" : ""}${playerOverall - managedOverall} OVR versus ${managedPlayer.name}`
    : "No managed athlete comparison available";
  const uncertainAreas = [
    ...(args.performance.aggregateStats.length === 0 ? ["Detailed winners/errors split is not verified."] : []),
    ...(args.performance.shotProfile.length === 0 ? ["Shot profile under pressure is still incomplete."] : []),
    ...(args.performance.recentMatches.length === 0 ? ["No recent persisted match sample yet."] : []),
    "Training trajectory is hidden unless this athlete joins the managed program."
  ];
  const recommendation =
    args.context.mode === "opponent"
      ? `Prepare ${counter.label} counterplan before the match.`
      : args.context.mode === "selectable"
        ? (playerOverall >= managedOverall ? "Select or shortlist: profile compares well with the current setup choice." : "Compare carefully before replacing the current setup choice.")
        : args.context.mode === "entrant"
          ? "Monitor bracket path and compare against the managed athlete."
          : "Scout again before making a commitment.";

  return {
    confidence: args.confidence,
    discoveredStrengths: args.coachReport.strengths.slice(0, 4),
    uncertainAreas: uncertainAreas.slice(0, 4),
    recommendation,
    comparison,
    opponentPreparation: counter.notes,
    nextFocus:
      bestFit.key === "aggressiveSmash"
        ? "Verify stamina and pressure resistance after early attacking bursts."
        : bestFit.key === "defensiveWall"
          ? "Measure conversion after long defensive rallies."
          : "Watch one more match for late-set decision quality.",
    affordanceLabel: args.context.mode === "selectable" ? "Select Athlete" : args.context.mode === "opponent" ? "View Head-To-Head" : "Compare"
  } satisfies ScoutingSummary;
}

function deriveOverview(args: {
  player: Player;
  overall: number;
  selectedPlayerId: string;
  context: PlayerContextSummary;
  tacticFits: TacticFitSummary[];
  coachReport: CoachReport;
  performance: PlayerPerformanceSummary;
  training: TrainingRecommendation;
  scouting: ScoutingSummary;
  careerAthlete: AthleteCareerState | null;
  radar: PlayerRadarMetric[];
}): PlayerOverviewSummary {
  const readinessStrip = deriveReadinessStrip({
    player: args.player,
    careerAthlete: args.careerAthlete,
    performance: args.performance,
    radar: args.radar
  });
  const tacticalPlan = {
    recommended: args.tacticFits[0],
    alternatives: args.tacticFits.slice(1),
    counterPlan: counterForTactic(args.tacticFits[0].key).label
  } satisfies TacticalPlanSummary;
  const risks = deriveRiskDecisionItems({
    coachReport: args.coachReport,
    readinessStrip,
    tacticFits: args.tacticFits
  });
  const evidence = recentEvidenceItems(args.performance);

  if (args.context.isManaged) {
    const managerVerdict = deriveManagerVerdict({
      player: args.player,
      tacticFits: args.tacticFits,
      readinessStrip,
      training: args.training,
      careerAthlete: args.careerAthlete
    });

    return {
      kind: "managed",
      managerVerdict,
      scoutingVerdict: null,
      readinessStrip,
      threatSummary: [],
      tacticalPlan,
      trainingRecommendation: args.training,
      scoutingRecommendation: null,
      riskFlags: risks,
      recentEvidence: evidence,
      howTheyWin: [args.coachReport.bestUse, `${args.tacticFits[0].label} works because ${args.tacticFits[0].drivers.join(", ")}.`],
      howToBeat: [],
      knownStrengths: args.coachReport.strengths,
      unknowns: [],
      nextAction: {
        label: "Next workflow",
        value: managerVerdict.ctaLabel,
        detail: managerVerdict.ctaDetail,
        tone: managerVerdict.tone
      }
    };
  }

  const threat = threatSummary({
    player: args.player,
    tacticFits: args.tacticFits,
    overall: args.overall,
    context: args.context,
    selectedPlayerId: args.selectedPlayerId
  });
  const scoutingVerdict = {
    action:
      args.context.mode === "opponent"
        ? "Prepare counterplan"
        : args.context.mode === "selectable"
          ? "Shortlist and compare"
          : args.context.mode === "entrant"
            ? "Monitor threat"
            : "Scout before commitment",
    primaryThreat: args.tacticFits[0].label,
    recommendedCounter: tacticalPlan.counterPlan,
    confidence: args.scouting.confidence,
    reason: `${args.tacticFits[0].label} is the clearest identity at ${args.tacticFits[0].score}; confidence is ${args.scouting.confidence}% because available evidence is ${args.performance.recentMatches.length > 0 ? "partly verified" : "mostly profile-derived"}.`,
    ctaLabel: args.scouting.affordanceLabel,
    tone: args.context.mode === "opponent" ? "warning" : args.context.mode === "selectable" ? "info" : "neutral"
  } satisfies ScoutingVerdict;

  return {
    kind: "scouting",
    managerVerdict: null,
    scoutingVerdict,
    readinessStrip: [],
    threatSummary: threat,
    tacticalPlan,
    trainingRecommendation: null,
    scoutingRecommendation: {
      confidence: args.scouting.confidence,
      recommendation: args.scouting.recommendation,
      comparison: args.scouting.comparison,
      nextFocus: args.scouting.nextFocus,
      affordanceLabel: args.scouting.affordanceLabel
    },
    riskFlags: risks,
    recentEvidence: evidence,
    howTheyWin: [args.coachReport.bestUse, `${args.tacticFits[0].label} works through ${args.tacticFits[0].drivers.join(", ")}.`],
    howToBeat: args.scouting.opponentPreparation,
    knownStrengths: args.scouting.discoveredStrengths,
    unknowns: args.scouting.uncertainAreas,
    nextAction: {
      label: "Next scout action",
      value: args.scouting.affordanceLabel,
      detail: args.scouting.nextFocus,
      tone: scoutingVerdict.tone
    }
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
  const rivalries = headToHead.map(interpretRivalry);
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
    primeNote: `${stage}: ${player.age <= 29 ? "growth and peak performance can still align" : "preserve role clarity and recovery windows"}.`,
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
    rivalries,
    managedPlayerSpotlight,
    hasRecordedHistory,
    timeline: deriveCareerTimeline(player.id, recordedMatches, achievements),
    biggestWins: notableResults(player.id, recordedMatches, "win"),
    worstLosses: notableResults(player.id, recordedMatches, "loss")
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

function interpretRivalry(entry: PlayerHeadToHeadSummary): PlayerRivalrySummary {
  if (entry.played >= 2 && entry.losses > entry.wins) {
    return {
      ...entry,
      rivalryLabel: "Problem Rival",
      interpretation: `${entry.opponentName} currently creates an unfavorable ${entry.wins}-${entry.losses} matchup.`
    };
  }

  if (entry.played >= 2 && entry.wins > entry.losses && entry.losses === 0) {
    return {
      ...entry,
      rivalryLabel: "Dominated Opponent",
      interpretation: `${entry.opponentName} has not solved this profile across ${entry.played} recorded meetings.`
    };
  }

  if (entry.played >= 2 && entry.wins > entry.losses) {
    return {
      ...entry,
      rivalryLabel: "Edge Rival",
      interpretation: `The matchup is favorable, but ${entry.opponentName} has taken games or matches before.`
    };
  }

  if (entry.played >= 2) {
    return {
      ...entry,
      rivalryLabel: "Even Rivalry",
      interpretation: `The record with ${entry.opponentName} is still balanced enough to demand matchup preparation.`
    };
  }

  return {
    ...entry,
    rivalryLabel: entry.wins > entry.losses ? "Early Edge" : "Early Warning",
    interpretation: `Only one recorded match exists against ${entry.opponentName}; treat the label as provisional.`
  };
}

function deriveCareerTimeline(
  playerId: string,
  matches: CareerMatchRecord[],
  achievements: PlayerAchievementSummary[]
): PlayerCareerTimelineEntry[] {
  const matchEntries = matches.map((match) => {
    const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
    const opponentName = playerMap[opponentId]?.name ?? opponentId;
    const won = match.winnerId === playerId;

    return {
      id: `match:${match.id}`,
      date: match.date,
      eventId: match.eventId,
      eventName: match.eventName,
      detail: `${won ? "Won" : "Lost"} ${match.round} vs ${opponentName}, ${match.scoreline}`,
      tone: won ? "positive" : "warning"
    } satisfies PlayerCareerTimelineEntry;
  });
  const achievementEntries = achievements.map((achievement) => ({
    id: `achievement:${achievement.eventId}:${achievement.result}`,
    date: achievement.date,
    eventId: achievement.eventId,
    eventName: achievement.eventName,
    detail: achievement.label,
    tone: achievement.result === "champion" ? "positive" : "info"
  })) satisfies PlayerCareerTimelineEntry[];

  return [...matchEntries, ...achievementEntries].sort(
    (left, right) => left.date.localeCompare(right.date) || left.eventName.localeCompare(right.eventName)
  );
}

function toCareerResultSummary(playerId: string, match: CareerMatchRecord): PlayerCareerResultSummary {
  const opponentId = match.playerAId === playerId ? match.playerBId : match.playerAId;
  const opponent = playerMap[opponentId];
  const opponentOverall = opponent ? overallFromDossier(deriveAthleteDossier(opponent)) : 0;

  return {
    id: match.id,
    eventId: match.eventId,
    eventName: match.eventName,
    date: match.date,
    round: match.round,
    opponentId,
    opponentName: opponent?.name ?? opponentId,
    scoreline: match.scoreline,
    opponentOverall
  };
}

function notableResults(playerId: string, matches: CareerMatchRecord[], result: "win" | "loss") {
  const filtered = matches.filter((match) => (result === "win" ? match.winnerId === playerId : match.winnerId !== playerId));

  return filtered
    .map((match) => toCareerResultSummary(playerId, match))
    .sort((left, right) =>
      result === "win"
        ? right.opponentOverall - left.opponentOverall || right.date.localeCompare(left.date)
        : left.opponentOverall - right.opponentOverall || right.date.localeCompare(left.date)
    )
    .slice(0, 3);
}

function deriveHeaderStatus(args: {
  player: Player;
  context: PlayerContextSummary;
  career: CareerState | null | undefined;
  tournament: TournamentState | null;
  performance: PlayerPerformanceSummary;
  careerAthlete: AthleteCareerState | null;
}) {
  const ranking = args.career?.rankings.find((entry) => entry.playerId === args.player.id);
  const activeMatch = activeManagedMatch(args.tournament);
  const nextMatch = activeMatch && (activeMatch.sideAId === args.player.id || activeMatch.sideBId === args.player.id)
    ? `${activeMatch.round} vs ${playerMap[matchOpponentId(activeMatch, args.player.id)]?.name ?? "TBD"}`
    : null;

  return {
    ranking: ranking ? `#${ranking.rank}` : args.careerAthlete ? `#${args.careerAthlete.currentRank}` : null,
    currentRunRole: args.context.label,
    nextMatch,
    recentForm: args.performance.recentForm.length > 0 ? args.performance.recentForm.join(" ") : "No form line",
    readinessSummary: args.careerAthlete
      ? `${Math.round(args.careerAthlete.readiness)} readiness / ${Math.round(args.careerAthlete.fatigue)} fatigue`
      : args.context.isManaged
        ? "Setup readiness estimated from profile"
        : "Scouting readiness unknown"
  } satisfies PlayerHeaderStatus;
}

export function createPlayerProfileViewModel(args: {
  playerId: string;
  selectedPlayerId: string;
  tournament: TournamentState | null;
  liveMatch?: LiveMatchSession | null;
  career?: CareerState | null;
  canSelect?: boolean;
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
  const context = deriveContext(args);
  const career = deriveCareerSummary({
    player,
    overall,
    performance,
    career: args.career,
    selectedPlayerId: args.selectedPlayerId
  });
  const confidence = scoutingConfidence({ context, performance, career });
  const coachReport = deriveCoachReport({
    player,
    radar,
    derived,
    tacticFits,
    performance
  });
  const careerAthlete = findCareerAthlete(args.career, player.id);
  const training = deriveTrainingRecommendation({
    player,
    derived,
    tacticFits,
    career: args.career
  });
  const scouting = deriveScoutingSummary({
    player,
    selectedPlayerId: args.selectedPlayerId,
    confidence,
    tacticFits,
    coachReport,
    context,
    performance
  });

  return {
    player,
    overall,
    dossier,
    derived,
    traits: player.traits ?? [],
    context,
    headerStatus: deriveHeaderStatus({
      player,
      context,
      career: args.career,
      tournament: args.tournament,
      performance,
      careerAthlete
    }),
    tacticFits,
    strengths: deriveStrengths(player, derived),
    radar,
    coachReport,
    attributeGroups: deriveAttributeGroups({
      player,
      derived,
      context,
      career: args.career,
      scoutingConfidence: confidence
    }),
    overview: deriveOverview({
      player,
      overall,
      selectedPlayerId: args.selectedPlayerId,
      context,
      tacticFits,
      coachReport,
      performance,
      training,
      scouting,
      careerAthlete,
      radar
    }),
    development: deriveDevelopmentSummary({
      player,
      career: args.career,
      training,
      careerAthlete,
      tacticFits
    }),
    scouting,
    performance,
    career
  };
}
