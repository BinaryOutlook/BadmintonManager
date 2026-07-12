import { playerMap } from "../content/players";
import { trainingPlans } from "./training";
import type { MatchTactic, PressurePattern, RiskProfile, TempoSetting } from "../core/models";
import { deriveProfile } from "../core/ratings";
import { deriveTacticRuntimeProfile } from "../core/tactics";
import { getCareerEvent } from "./events";
import {
  clamp,
  type AdvicePacket,
  type AdvancedTacticPlan,
  type AthleteCareerState,
  type CareerState,
  type CareerStateV4,
  type CareerStateV3,
  type MatchPlanningState,
  type TacticEffectProfile
} from "./models";
import { staffModifiers } from "./ecosystem";
import { facilityModifiers } from "./facilitiesMedia";
import { careerWorldPlayerMap } from "./world";

const DEFAULT_PLAN_ID = "plan-command-balance";

export function createDefaultAdvancedTacticPlan(date = "2026-06-01"): AdvancedTacticPlan {
  return {
    id: DEFAULT_PLAN_ID,
    name: "Command Balance",
    tempo: 52,
    rearCourtPressure: 58,
    netPriority: 54,
    riskTolerance: 42,
    rallyLengthIntent: "balanced",
    modules: ["rear_court_lock", "net_trap"],
    createdAt: date,
    updatedAt: date
  };
}

export function createInitialMatchPlanning(date = "2026-06-01"): MatchPlanningState {
  const plan = createDefaultAdvancedTacticPlan(date);

  return {
    plans: [plan],
    activePlanId: plan.id,
    advice: [],
    overrideLog: []
  };
}

export function upgradeCareerStateV3(career: CareerStateV3): CareerStateV4 {
  return {
    ...career,
    version: 4,
    matchPlanning: createInitialMatchPlanning(career.date)
  };
}

export function activeAdvancedTacticPlan(state: CareerState): AdvancedTacticPlan {
  return (
    state.matchPlanning.plans.find((plan) => plan.id === state.matchPlanning.activePlanId) ??
    state.matchPlanning.plans[0] ??
    createDefaultAdvancedTacticPlan(state.date)
  );
}

function managedAthlete(state: CareerState): AthleteCareerState {
  return state.athletes.find((athlete) => athlete.playerId === state.program.managedPlayerId) ?? state.athletes[0]!;
}

function roleLabel(role: AdvicePacket["sourceRole"]) {
  return role.replace("_", " ");
}

function tempoSetting(value: number): TempoSetting {
  if (value >= 66) {
    return "fast";
  }

  if (value <= 36) {
    return "conserve";
  }

  return "balanced";
}

function riskProfile(value: number): RiskProfile {
  if (value >= 66) {
    return "high_risk";
  }

  if (value <= 34) {
    return "patient";
  }

  return "standard";
}

function pressurePattern(plan: AdvancedTacticPlan): PressurePattern {
  if (plan.netPriority >= 72 && plan.riskTolerance <= 58) {
    return "front_court_control";
  }

  if (plan.rearCourtPressure >= 74 && plan.riskTolerance >= 62) {
    return "all_out_attack";
  }

  if (plan.rearCourtPressure >= 68 && plan.rallyLengthIntent === "extend") {
    return "rear_court_grind";
  }

  if (plan.netPriority >= 62 && plan.rearCourtPressure >= 62) {
    return "wide_pressure";
  }

  if (plan.rallyLengthIntent === "extend" || plan.riskTolerance <= 28) {
    return "defensive_absorb";
  }

  return "backhand_pressure";
}

export function tacticPlanToMatchTactic(plan: AdvancedTacticPlan): MatchTactic {
  return {
    label: plan.name,
    tempo: tempoSetting(plan.tempo),
    pressurePattern: pressurePattern(plan),
    riskProfile: riskProfile(plan.riskTolerance),
    advancedIntent: {
      version: 1,
      tempo: plan.tempo,
      rearCourtPressure: plan.rearCourtPressure,
      netPriority: plan.netPriority,
      riskTolerance: plan.riskTolerance,
      rallyLengthIntent: plan.rallyLengthIntent,
      modules: [...plan.modules]
    }
  };
}

export function calculateTacticEffectProfile(args: {
  plan: AdvancedTacticPlan;
  state?: CareerState;
  opponentId?: string;
}): TacticEffectProfile {
  const athlete = args.state ? managedAthlete(args.state) : null;
  const opponent = args.opponentId
    ? args.state
      ? careerWorldPlayerMap(args.state)[args.opponentId]
      : playerMap[args.opponentId]
    : null;
  const tactic = tacticPlanToMatchTactic(args.plan);
  const runtime = deriveTacticRuntimeProfile(tactic);
  const readinessRelief = athlete ? (100 - athlete.readiness) * 0.18 : 0;
  const rearModule = args.plan.modules.includes("rear_court_lock") ? 6 : 0;
  const netModule = args.plan.modules.includes("net_trap") ? 7 : 0;
  const safetyModule = args.plan.modules.includes("safe_lift_release") ? -8 : 0;
  const bodySmashModule = args.plan.modules.includes("body_smash") ? 8 : 0;
  const rallyModifier =
    args.plan.rallyLengthIntent === "extend"
      ? 12
      : args.plan.rallyLengthIntent === "shorten"
        ? -8
        : 0;
  const opponentProfile = opponent ? deriveProfile(opponent) : null;
  const notes = [
    `${tactic.pressurePattern.replaceAll("_", " ")} bridge`,
    args.plan.rallyLengthIntent === "extend"
      ? "built to drag points longer"
      : args.plan.rallyLengthIntent === "shorten"
        ? "built to end rallies before fatigue compounds"
        : "balanced rally target"
  ];

  if (args.plan.modules.length > 0) {
    notes.push(`engine modules: ${args.plan.modules.map((module) => module.replaceAll("_", " ")).join(", ")}`);
  }

  if (opponentProfile) {
    notes.push(
      opponentProfile.frontCourtControl >= 82
        ? "opponent owns the tape; net priority needs margin"
        : "front court can be challenged"
    );
  }

  return {
    planId: args.plan.id,
    staminaLoad: clamp(Math.round(args.plan.tempo * 0.34 + args.plan.rearCourtPressure * 0.24 + Math.max(0, rallyModifier) + readinessRelief + (runtime.staminaBurnMultiplier - 1) * 80), 0, 100),
    errorRisk: clamp(Math.round(args.plan.riskTolerance * 0.62 + args.plan.tempo * 0.18 - netModule + safetyModule + readinessRelief + runtime.riskDifficulty * 2), 0, 100),
    winnerPressure: clamp(Math.round(args.plan.rearCourtPressure * 0.46 + args.plan.tempo * 0.24 + args.plan.riskTolerance * 0.18 + bodySmashModule + runtime.attackBonus * 2 + runtime.backhandZoneWeight * 0.5), 0, 100),
    netControl: clamp(Math.round(args.plan.netPriority * 0.72 + netModule - args.plan.riskTolerance * 0.08 + runtime.frontZoneWeight), 0, 100),
    rearCourtControl: clamp(Math.round(args.plan.rearCourtPressure * 0.72 + rearModule + args.plan.tempo * 0.08 + runtime.backZoneWeight), 0, 100),
    strainBias: clamp(Math.round(args.plan.tempo * 0.26 + args.plan.riskTolerance * 0.22 + args.plan.rearCourtPressure * 0.2 + Math.max(0, rallyModifier) + (runtime.staminaBurnMultiplier - 1) * 100), 0, 100),
    matchupNotes: notes
  };
}

function sourceRoleForTopic(state: CareerState, topic: AdvicePacket["topic"]): AdvicePacket["sourceRole"] {
  const hired = state.ecosystem.staff.hired;

  if (topic === "tactics" && hired.some((staff) => staff.role === "analyst")) {
    return "analyst";
  }

  if (topic === "training" && hired.some((staff) => staff.role === "assistant_coach")) {
    return "assistant_coach";
  }

  if (topic === "rotation" && hired.some((staff) => staff.role === "physio")) {
    return "physio";
  }

  if (topic === "scouting" && hired.some((staff) => staff.role === "scout")) {
    return "scout";
  }

  return topic === "rotation" ? "physio" : topic === "scouting" ? "scout" : topic === "tactics" ? "analyst" : "assistant_coach";
}

function adviceId(state: CareerState, topic: AdvicePacket["topic"]) {
  return `advice-${topic}-${state.date.replaceAll("-", "")}`;
}

function createAdvicePacket(args: {
  state: CareerState;
  topic: AdvicePacket["topic"];
  recommendation: string;
  rationale: string;
  confidence: number;
  inputs: string[];
  tradeoff: string;
  suggestedPlan?: AdvicePacket["suggestedPlan"];
  suggestedTrainingPlanId?: string | null;
  subjectId?: string | null;
}): AdvicePacket {
  const sourceRole = sourceRoleForTopic(args.state, args.topic);

  return {
    id: adviceId(args.state, args.topic),
    sourceRole,
    topic: args.topic,
    recommendation: args.recommendation,
    rationale: args.rationale,
    confidence: clamp(Math.round(args.confidence), 0, 100),
    inputs: args.inputs,
    tradeoff: args.tradeoff,
    suggestedPlan: args.suggestedPlan ?? null,
    suggestedTrainingPlanId: args.suggestedTrainingPlanId ?? null,
    subjectId: args.subjectId ?? null,
    createdAt: args.state.date,
    appliedAt: null,
    overrideState: "pending",
    overrideReason: null
  };
}

export function generateAssistantAdvice(state: CareerState): AdvicePacket[] {
  const athlete = managedAthlete(state);
  const modifiers = staffModifiers(state.ecosystem);
  const facilities = facilityModifiers(state.facilities);
  const plan = activeAdvancedTacticPlan(state);
  const effect = calculateTacticEffectProfile({ plan, state, opponentId: state.lastPreMatchBrief?.opponentId });
  const topPressure = [...state.rivals.fieldPressure].sort((left, right) => right.pressureScore - left.pressureScore)[0];
  const liveReports = state.ecosystem.scouting.reports.filter((report) => report.state !== "expired");
  const activePromises = state.ecosystem.promises.filter((promise) => promise.status === "active");
  const analysisBoost = modifiers.analysis * 85 + modifiers.morale * 30 + facilities.adviceQuality;
  const scoutBoost = modifiers.scouting * 70 + facilities.scoutingAccuracy;
  const recoveryBoost = modifiers.recovery * 80;
  const trainingPlan =
    athlete.fatigue >= 56 || athlete.injuryRisk >= 0.15
      ? trainingPlans.find((entry) => entry.id === "mobility-recovery")
      : trainingPlans.find((entry) => entry.id === "pressure-patterns") ?? trainingPlans[0];
  const tacticPatch =
    athlete.fatigue >= 58 || effect.errorRisk >= 58
      ? {
          riskTolerance: Math.max(24, plan.riskTolerance - 16),
          tempo: Math.max(34, plan.tempo - 10),
          rallyLengthIntent: "balanced" as const,
          modules: Array.from(new Set([...plan.modules, "safe_lift_release" as const]))
        }
      : {
          rearCourtPressure: Math.min(88, plan.rearCourtPressure + 10),
          tempo: Math.min(82, plan.tempo + 8),
          modules: Array.from(new Set([...plan.modules, "body_smash" as const]))
        };
  const scoutTarget = state.lastPreMatchBrief?.opponentId ?? topPressure?.topThreatName ?? state.ecosystem.recruitment.candidates[0]?.id ?? null;

  return [
    createAdvicePacket({
      state,
      topic: "tactics",
      recommendation:
        athlete.fatigue >= 58 || effect.errorRisk >= 58
          ? "Lower the opening risk and protect the first interval."
          : "Increase rear-court pressure before the opponent settles.",
      rationale: `The active plan projects ${effect.errorRisk} error risk, ${effect.winnerPressure} winner pressure, and ${effect.staminaLoad} stamina load.`,
      confidence: 62 + analysisBoost,
      inputs: [
        `Readiness ${athlete.readiness}`,
        `Fatigue ${Math.round(athlete.fatigue)}`,
        `Plan ${plan.name}`,
        state.lastPreMatchBrief ? `Opponent ${state.lastPreMatchBrief.opponentId}` : "Opponent pending"
      ],
      tradeoff: athlete.fatigue >= 58 ? "Safer tempo may reduce winners." : "More pressure raises strain and error exposure.",
      suggestedPlan: tacticPatch
    }),
    createAdvicePacket({
      state,
      topic: "training",
      recommendation: trainingPlan ? `Schedule ${trainingPlan.label}.` : "Hold training until staff updates the load sheet.",
      rationale:
        athlete.fatigue >= 56
          ? "Fatigue is high enough that development work should protect availability."
          : "The current match plan benefits from pressure-pattern reps before the next event.",
      confidence: 60 + modifiers.training * 90 + recoveryBoost * 0.3,
      inputs: [`Fatigue ${Math.round(athlete.fatigue)}`, `Injury risk ${Math.round(athlete.injuryRisk * 100)}%`, `Cash ${state.economy.cash}`],
      tradeoff: "Training advice selects a priority; the manager still chooses when to spend cash.",
      suggestedTrainingPlanId: trainingPlan?.id ?? null
    }),
    createAdvicePacket({
      state,
      topic: "rotation",
      recommendation:
        athlete.readiness < 74 || activePromises.length > 1
          ? "Protect the lead athlete and use lower-event minutes for the program roster."
          : "Keep the lead athlete on the event path.",
      rationale: `Readiness is ${athlete.readiness}; ${activePromises.length} active promise(s) can change morale if overloaded.`,
      confidence: 58 + recoveryBoost + modifiers.morale * 45,
      inputs: [`Recovery ${athlete.recoveryStatus}`, `Promises ${activePromises.length}`, `Roster ${state.ecosystem.recruitment.roster.length}`],
      tradeoff: "Rotation protects health but may slow ranking-point momentum."
    }),
    createAdvicePacket({
      state,
      topic: "scouting",
      recommendation:
        liveReports.length === 0
          ? "Commission one report before trusting the next match plan."
          : "Refresh scouting only if the next opponent or top rival changes.",
      rationale: topPressure
        ? `${topPressure.topThreatName} is anchoring ${Math.round(topPressure.pressureScore)} field pressure.`
        : "No rival event field has locked, so opponent-specific scouting is the best next information spend.",
      confidence: 55 + scoutBoost + analysisBoost * 0.25,
      inputs: [`Live reports ${liveReports.length}`, topPressure ? `Top pressure ${Math.round(topPressure.pressureScore)}` : "No rival pressure", `Scout capacity ${modifiers.scoutCapacity}`],
      tradeoff: "Scouting costs cash and capacity, but reduces match-plan uncertainty.",
      subjectId: scoutTarget
    })
  ];
}

export function refreshAssistantAdvice(state: CareerState): CareerState {
  return {
    ...state,
    matchPlanning: {
      ...state.matchPlanning,
      advice: generateAssistantAdvice(state)
    }
  };
}

export interface PreMatchPlanningBridge {
  planName: string;
  tacticSummary: string;
  effectSummary: string;
  adviceLabel: string;
  adviceDetail: string;
  adviceState: AdvicePacket["overrideState"] | "none";
  rivalIntel: string;
  objectiveStakes: string;
  strainWarning: string;
}

export function buildPreMatchPlanningBridge(state: CareerState): PreMatchPlanningBridge {
  const plan = activeAdvancedTacticPlan(state);
  const tactic = tacticPlanToMatchTactic(plan);
  const effect = calculateTacticEffectProfile({ plan, state, opponentId: state.lastPreMatchBrief?.opponentId });
  const activeEvent = state.activeEventId ? getCareerEvent(state.events, state.activeEventId) : undefined;
  const eventPressure = state.activeEventId
    ? state.rivals.fieldPressure.find((entry) => entry.eventId === state.activeEventId)
    : undefined;
  const tacticAdvice = state.matchPlanning.advice.find((entry) => entry.topic === "tactics");
  const latestOverride = state.matchPlanning.overrideLog[0];
  const athlete = managedAthlete(state);
  const activePromises = state.ecosystem.promises.filter((promise) => promise.status === "active");
  const adviceState = latestOverride ? "overridden" : tacticAdvice?.overrideState ?? "none";
  const adviceLabel = latestOverride
    ? `Manager override: ${latestOverride.topic}`
    : tacticAdvice
      ? `${roleLabel(tacticAdvice.sourceRole)} advice: ${tacticAdvice.overrideState}`
      : "Assistant advice: unavailable";
  const adviceDetail = latestOverride
    ? latestOverride.reason
    : tacticAdvice
      ? `${tacticAdvice.recommendation} ${tacticAdvice.tradeoff}`
      : "Refresh assistant advice before locking the match plan.";
  const objectiveStakes = activePromises.length > 0
    ? `${activePromises.length} active promise(s) can move morale before ${activeEvent?.name ?? "the next match"}.`
    : activeEvent
      ? `${activeEvent.tier} stakes: ${activeEvent.rankingPoints.R16} entry points, ${activeEvent.rankingPoints.champion} title points.`
      : "No active objective pressure attached to this draw yet.";
  const strainWarning = effect.strainBias >= 70 || athlete.fatigue >= 58
    ? `High strain watch: ${effect.strainBias} tactic strain with fatigue ${Math.round(athlete.fatigue)}.`
    : `Strain watch: ${effect.strainBias} tactic strain with readiness ${athlete.readiness}.`;

  return {
    planName: plan.name,
    tacticSummary: `${tactic.tempo} tempo / ${tactic.pressurePattern.replaceAll("_", " ")} / ${tactic.riskProfile.replace("_", " ")}`,
    effectSummary: `${effect.winnerPressure} winner pressure, ${effect.netControl} net control, ${effect.rearCourtControl} rear-court control`,
    adviceLabel,
    adviceDetail,
    adviceState,
    rivalIntel: eventPressure
      ? `${eventPressure.rivalCount} rival programs, ${Math.round(eventPressure.pressureScore)} pressure, top threat ${eventPressure.topThreatName}.`
      : "Rival field is still open; use scouting and form to narrow the matchup.",
    objectiveStakes,
    strainWarning
  };
}

export function updateAdvancedTacticPlan(
  state: CareerState,
  patch: Partial<Pick<AdvancedTacticPlan, "name" | "tempo" | "rearCourtPressure" | "netPriority" | "riskTolerance" | "rallyLengthIntent" | "modules">>
): CareerState {
  const activePlan = activeAdvancedTacticPlan(state);
  const nextPlan: AdvancedTacticPlan = {
    ...activePlan,
    ...patch,
    tempo: Math.round(clamp(patch.tempo ?? activePlan.tempo, 0, 100)),
    rearCourtPressure: Math.round(clamp(patch.rearCourtPressure ?? activePlan.rearCourtPressure, 0, 100)),
    netPriority: Math.round(clamp(patch.netPriority ?? activePlan.netPriority, 0, 100)),
    riskTolerance: Math.round(clamp(patch.riskTolerance ?? activePlan.riskTolerance, 0, 100)),
    modules: patch.modules ?? activePlan.modules,
    updatedAt: state.date
  };
  const matchPlanning = {
    ...state.matchPlanning,
    plans: state.matchPlanning.plans.map((plan) => (plan.id === activePlan.id ? nextPlan : plan))
  };

  return refreshAssistantAdvice({
    ...state,
    matchPlanning,
    ecosystem: {
      ...state.ecosystem,
      programLog: [
        {
          id: `program-log-${state.date}-tactics-${state.ecosystem.programLog.length + 1}`,
          date: state.date,
          source: "tactics" as const,
          message: `${nextPlan.name} updated`,
          stateDelta: `Tempo ${nextPlan.tempo}, rear ${nextPlan.rearCourtPressure}, net ${nextPlan.netPriority}, risk ${nextPlan.riskTolerance}, rally ${nextPlan.rallyLengthIntent}`,
          relatedIds: [nextPlan.id]
        },
        ...state.ecosystem.programLog
      ].slice(0, 18)
    },
    notes: [`Advanced tactic updated: ${nextPlan.name}`, ...state.notes].slice(0, 6)
  });
}

export function applyAssistantAdvice(state: CareerState, adviceIdToApply: string): CareerState {
  const advice = state.matchPlanning.advice.find((entry) => entry.id === adviceIdToApply);

  if (!advice || advice.overrideState !== "pending") {
    return state;
  }

  const withSuggestion = advice.suggestedPlan
    ? updateAdvancedTacticPlan(state, advice.suggestedPlan)
    : advice.suggestedTrainingPlanId
      ? { ...state, selectedTrainingPlanId: advice.suggestedTrainingPlanId }
      : state;

  return {
    ...withSuggestion,
    matchPlanning: {
      ...withSuggestion.matchPlanning,
      advice: withSuggestion.matchPlanning.advice.map((entry) =>
        entry.id === adviceIdToApply
          ? { ...entry, overrideState: "applied", appliedAt: state.date }
          : entry
      )
    },
    notes: [`${roleLabel(advice.sourceRole)} advice applied: ${advice.topic}`, ...withSuggestion.notes].slice(0, 6)
  };
}

export function overrideAssistantAdvice(state: CareerState, adviceIdToOverride: string, reason: string): CareerState {
  const advice = state.matchPlanning.advice.find((entry) => entry.id === adviceIdToOverride);

  if (!advice || advice.overrideState !== "pending") {
    return state;
  }

  const cleanReason = reason.trim() || "Manager keeps the current plan.";
  const overrideEntry = {
    id: `override-${state.date}-${state.matchPlanning.overrideLog.length + 1}`,
    date: state.date,
    adviceId: advice.id,
    topic: advice.topic,
    reason: cleanReason
  };

  return {
    ...state,
    matchPlanning: {
      ...state.matchPlanning,
      advice: state.matchPlanning.advice.map((entry) =>
        entry.id === adviceIdToOverride
          ? { ...entry, overrideState: "overridden", overrideReason: cleanReason }
          : entry
      ),
      overrideLog: [overrideEntry, ...state.matchPlanning.overrideLog].slice(0, 12)
    },
    ecosystem: {
      ...state.ecosystem,
      programLog: [
        {
          id: `program-log-${state.date}-override-${state.ecosystem.programLog.length + 1}`,
          date: state.date,
          source: "advice" as const,
          message: `Manager override: ${advice.topic}`,
          stateDelta: cleanReason,
          relatedIds: [advice.id]
        },
        ...state.ecosystem.programLog
      ].slice(0, 18)
    },
    notes: [`Advice overridden: ${advice.topic}`, ...state.notes].slice(0, 6)
  };
}
