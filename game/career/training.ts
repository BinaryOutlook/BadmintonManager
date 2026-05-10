import type { AthleteCareerState, ProgramEconomy, TrainingPlan } from "./models";
import { clamp } from "./models";
import { addLedgerEntry } from "./economy";
import {
  applyMedicalRecoveryBlock,
  canTrainWithInjury,
  evaluateLoadInjury,
  refreshAthleteReadiness
} from "./health";

export const trainingPlans: TrainingPlan[] = [
  {
    id: "rear-court-power",
    label: "Rear-Court Power",
    focus: "smash",
    intensity: "heavy",
    cost: 2400,
    attributeDelta: { smash: 1.8, stamina: 0.2, composure: 0.1, recovery: 0 },
    fatigueDelta: 15,
    injuryRiskDelta: 0.045,
    recoveryDelta: -2
  },
  {
    id: "rally-base",
    label: "Rally Base",
    focus: "stamina",
    intensity: "standard",
    cost: 1800,
    attributeDelta: { smash: 0.2, stamina: 1.5, composure: 0.3, recovery: 0.4 },
    fatigueDelta: 10,
    injuryRiskDelta: 0.028,
    recoveryDelta: 0
  },
  {
    id: "pressure-patterns",
    label: "Pressure Patterns",
    focus: "composure",
    intensity: "standard",
    cost: 1500,
    attributeDelta: { smash: 0.3, stamina: 0.1, composure: 1.7, recovery: 0.2 },
    fatigueDelta: 7,
    injuryRiskDelta: 0.018,
    recoveryDelta: 1
  },
  {
    id: "physio-recovery",
    label: "Physio Recovery",
    focus: "recovery",
    intensity: "recovery",
    cost: 1300,
    attributeDelta: { smash: 0, stamina: 0.2, composure: 0.4, recovery: 1.4 },
    fatigueDelta: -14,
    injuryRiskDelta: -0.052,
    recoveryDelta: 12
  },
  {
    id: "mobility-recovery",
    label: "Mobility Recovery",
    focus: "recovery",
    intensity: "recovery",
    cost: 900,
    attributeDelta: { smash: 0, stamina: 0, composure: 0.2, recovery: 0.9 },
    fatigueDelta: -10,
    injuryRiskDelta: -0.038,
    recoveryDelta: 18
  }
];

export function getTrainingPlan(planId: string) {
  return trainingPlans.find((plan) => plan.id === planId);
}

export function applyTrainingPlan(args: {
  athlete: AthleteCareerState;
  economy: ProgramEconomy;
  plan: TrainingPlan;
  date: string;
}) {
  const gate = canTrainWithInjury(args.athlete, args.plan.intensity);

  if (!gate.allowed) {
    return {
      athlete: refreshAthleteReadiness(args.athlete),
      economy: args.economy,
      blockedReason: gate.reason
    };
  }

  const trained = refreshAthleteReadiness({
    ...args.athlete,
    development: {
      smash: clamp(args.athlete.development.smash + args.plan.attributeDelta.smash, 1, 100),
      stamina: clamp(args.athlete.development.stamina + args.plan.attributeDelta.stamina, 1, 100),
      composure: clamp(args.athlete.development.composure + args.plan.attributeDelta.composure, 1, 100),
      recovery: clamp(args.athlete.development.recovery + args.plan.attributeDelta.recovery, 1, 100)
    },
    fatigue: clamp(args.athlete.fatigue + args.plan.fatigueDelta - args.plan.recoveryDelta * 0.35, 0, 100),
    injuryRisk: clamp(args.athlete.injuryRisk + args.plan.injuryRiskDelta, 0.02, 1)
  });
  const athlete =
    args.plan.intensity === "recovery"
      ? applyMedicalRecoveryBlock(trained, Math.max(8, args.plan.recoveryDelta))
      : evaluateLoadInjury({
          athlete: trained,
          date: args.date,
          source: args.plan.label,
          loadScore: args.plan.fatigueDelta + args.plan.injuryRiskDelta * 500
        });
  const economy = addLedgerEntry({
    economy: args.economy,
    date: args.date,
    category: "training",
    label: args.plan.label,
    amount: -args.plan.cost
  });

  return {
    athlete,
    economy: {
      ...economy,
      trainingSpend: economy.trainingSpend + args.plan.cost
    },
    blockedReason: null
  };
}
