import type { AthleteCareerState } from "./models";
import { clamp } from "./models";

export function calculateReadiness(args: {
  fatigue: number;
  injuryRisk: number;
  recovery: number;
  stamina: number;
  composure: number;
}) {
  const recoveryBuffer = args.recovery * 0.22 + args.stamina * 0.12 + args.composure * 0.08;
  const fatiguePenalty = args.fatigue * 0.62;
  const injuryPenalty = args.injuryRisk * 42;

  return Math.round(clamp(76 + recoveryBuffer - fatiguePenalty - injuryPenalty, 0, 100));
}

export function recoveryStatusFor(fatigue: number, injuryRisk: number): AthleteCareerState["recoveryStatus"] {
  if (injuryRisk >= 0.42) {
    return "injured";
  }

  if (fatigue >= 72 || injuryRisk >= 0.28) {
    return "red_zone";
  }

  if (fatigue >= 48 || injuryRisk >= 0.18) {
    return "loaded";
  }

  if (fatigue <= 18 && injuryRisk <= 0.08) {
    return "fresh";
  }

  return "ready";
}

export function refreshAthleteReadiness(athlete: AthleteCareerState): AthleteCareerState {
  const readiness = calculateReadiness({
    fatigue: athlete.fatigue,
    injuryRisk: athlete.injuryRisk,
    recovery: athlete.development.recovery,
    stamina: athlete.development.stamina,
    composure: athlete.development.composure
  });

  return {
    ...athlete,
    readiness,
    recoveryStatus: recoveryStatusFor(athlete.fatigue, athlete.injuryRisk)
  };
}

export function applyPassiveRecovery(athlete: AthleteCareerState): AthleteCareerState {
  return refreshAthleteReadiness({
    ...athlete,
    fatigue: clamp(athlete.fatigue - 5 - athlete.development.recovery * 0.03, 0, 100),
    injuryRisk: clamp(athlete.injuryRisk - 0.018 - athlete.development.recovery * 0.0004, 0.02, 1)
  });
}

export function applyMatchLoad(athlete: AthleteCareerState, staminaDrain: number): AthleteCareerState {
  const fatigueDelta = clamp(10 + staminaDrain * 0.28, 8, 28);
  const injuryDelta = clamp(0.02 + fatigueDelta / 520, 0.02, 0.08);

  return refreshAthleteReadiness({
    ...athlete,
    fatigue: clamp(athlete.fatigue + fatigueDelta, 0, 100),
    injuryRisk: clamp(athlete.injuryRisk + injuryDelta, 0, 1)
  });
}
