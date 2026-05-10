import { playerMap } from "../content/players";
import type { MatchResult } from "../core/models";
import type { ManagedRunMatch } from "../tournament/tournament";
import { getCareerEvent, roundKeyForPlacement } from "./events";
import { applyMatchLoad } from "./health";
import { psychologyReadinessModifier } from "./ecosystem";
import type { CareerState, PostMatchReport, PreMatchBrief } from "./models";
import { awardRankingPoints } from "./rankings";
import { managedAthlete, syncManagedAthleteFromRankings } from "./state";
import { recordPrizeMoney } from "./economy";
import { activeAdvancedTacticPlan, calculateTacticEffectProfile, tacticPlanToMatchTactic } from "./tactics";
import { projectTacticalViewerFromResult } from "./tacticalViewer";

export function buildPreMatchBrief(args: {
  state: CareerState;
  opponentId: string;
}): PreMatchBrief | null {
  const event = args.state.activeEventId ? getCareerEvent(args.state.events, args.state.activeEventId) : undefined;
  const athlete = managedAthlete(args.state);
  const opponent = playerMap[args.opponentId];
  const psychModifier = psychologyReadinessModifier(args.state, args.state.program.managedPlayerId);
  const latestReport = args.state.ecosystem.scouting.reports.find((report) => report.subjectId === args.opponentId);

  if (!event || !opponent) {
    return null;
  }

  const fatigueWarning =
    athlete.fatigue >= 58
      ? "Fatigue is the main risk; protect rally length early."
      : athlete.injuryRisk >= 0.18
        ? "Medical risk is elevated; recovery margin is thin."
        : "Readiness is stable enough to chase points.";
  const opponentBrief = latestReport
    ? `${opponent.name} report is ${latestReport.state} at ${latestReport.confidence}% confidence: ${latestReport.recommendation}`
    : `${opponent.name} is a ${opponent.styleLabel.toLowerCase()} with ${opponent.nationality} tempo habits.`;
  const recommendation =
    athlete.readiness + psychModifier >= 82
      ? "Open assertively, bank the tier points, and keep pressure on the back court."
      : "Start controlled, protect morale pressure, and let the first interval decide risk.";

  return {
    eventId: event.id,
    opponentId: args.opponentId,
    readiness: clampReadiness(athlete.readiness + psychModifier),
    riskNote: fatigueWarning,
    tierStakes: `${event.tier}: ${event.rankingPoints.R16} points for entry, ${event.rankingPoints.champion} for the title.`,
    recommendation,
    opponentBrief
  };
}

function clampReadiness(value: number) {
  return Math.max(0, Math.min(100, value));
}

function evidenceFromResult(result: MatchResult, managedSide: "A" | "B") {
  const stats = result.stats;
  const winners = managedSide === "A" ? stats.winnersA : stats.winnersB;
  const errors = managedSide === "A" ? stats.unforcedErrorsA : stats.unforcedErrorsB;
  const staminaDrain = managedSide === "A" ? stats.staminaDrainA : stats.staminaDrainB;
  const opponentErrors = managedSide === "A" ? stats.unforcedErrorsB : stats.unforcedErrorsA;

  return [
    `${winners} winners against ${errors} unforced errors`,
    `${staminaDrain}% stamina drain across ${stats.totalPoints} points`,
    opponentErrors > errors ? "Pressure created more opponent errors than it leaked" : "Error control needs the next training block",
    result.summaryEvents?.[0]?.title ?? "Match evidence captured from the detailed engine"
  ];
}

export function settleCareerMatch(args: {
  state: CareerState;
  matchId: string;
  opponentId: string;
  managedSide: "A" | "B";
  managedRunMatch: ManagedRunMatch;
  result: MatchResult;
}) {
  const event = args.state.activeEventId ? getCareerEvent(args.state.events, args.state.activeEventId) : undefined;

  if (!event) {
    return args.state;
  }

  const won = args.result.winner === args.managedSide;
  const placementKey = roundKeyForPlacement(args.managedRunMatch.round, won);
  const pointsDelta = event.rankingPoints[placementKey] ?? event.rankingPoints.R16;
  const cashDelta = event.prizeMoney[placementKey] ?? event.prizeMoney.R16;
  const staminaDrain =
    args.managedSide === "A" ? args.result.stats.staminaDrainA : args.result.stats.staminaDrainB;
  const athleteAfterMatch = applyMatchLoad(managedAthlete(args.state), staminaDrain, args.state.date);
  const rankings = awardRankingPoints({
    rankings: args.state.rankings,
    playerId: args.state.program.managedPlayerId,
    eventId: event.id,
    round: placementKey,
    points: pointsDelta
  });
  const economy = recordPrizeMoney({
    economy: args.state.economy,
    date: args.state.date,
    label: `${event.name} ${won ? "win" : "placement"} prize`,
    amount: cashDelta
  });
  const report: PostMatchReport = {
    eventId: event.id,
    matchId: args.matchId,
    opponentId: args.opponentId,
    result: won ? "win" : "loss",
    scoreline: args.result.scoreline,
    round: args.managedRunMatch.round,
    pointsDelta,
    cashDelta,
    fatigueDelta: athleteAfterMatch.fatigue - managedAthlete(args.state).fatigue,
    evidence: [
      ...evidenceFromResult(args.result, args.managedSide),
      ...tacticEvidence(args.state, args.opponentId)
    ],
    recommendations:
      athleteAfterMatch.injury.status !== "healthy"
        ? [
            `${athleteAfterMatch.injury.label}: protect ${athleteAfterMatch.injury.daysRemaining} day(s) before loading again`,
            "Use physio recovery and delay the next event if match day arrives early"
          ]
        : athleteAfterMatch.recoveryStatus === "red_zone" || athleteAfterMatch.recoveryStatus === "injured"
        ? ["Book physio recovery before the next event", "Reduce smash volume until readiness returns above 78"]
        : won
          ? ["Maintain rally-base work and enter the next tier if cash permits", "Add pressure-pattern reps to protect leads"]
          : ["Schedule pressure-patterns training", "Use the pre-match briefing to lower early error rate"],
    tacticalViewer: projectTacticalViewerFromResult({
      matchId: args.matchId,
      result: args.result,
      managedSide: args.managedSide,
      state: args.state
    })
  };
  const next = syncManagedAthleteFromRankings({
    ...args.state,
    stage: "post_match",
    rankings,
    economy,
    completedEventIds: args.state.completedEventIds.includes(event.id)
      ? args.state.completedEventIds
      : [...args.state.completedEventIds, event.id],
    athletes: args.state.athletes.map((athlete) =>
      athlete.playerId === args.state.program.managedPlayerId ? athleteAfterMatch : athlete
    ),
    lastMatchReport: report,
    notes: [`${event.name} settled: ${pointsDelta} points, $${cashDelta}`, ...args.state.notes].slice(0, 6)
  });

  return next;
}

function tacticEvidence(state: CareerState, opponentId: string) {
  const plan = activeAdvancedTacticPlan(state);
  const tactic = tacticPlanToMatchTactic(plan);
  const effect = calculateTacticEffectProfile({ plan, state, opponentId });

  return [
    `${plan.name} translated to ${tactic.tempo} / ${tactic.pressurePattern.replaceAll("_", " ")} / ${tactic.riskProfile.replace("_", " ")}`,
    `Tactic projection: ${effect.winnerPressure} winner pressure, ${effect.netControl} net control, ${effect.rearCourtControl} rear-court control, ${effect.strainBias} strain`
  ];
}
