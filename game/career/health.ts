import { addDays } from "./calendar";
import type { AthleteCareerState, InjuryEpisode } from "./models";
import { clamp, createHealthyInjuryState } from "./models";

export function calculateReadiness(args: {
  fatigue: number;
  injuryRisk: number;
  recovery: number;
  stamina: number;
  composure: number;
  injury?: InjuryEpisode;
}) {
  const recoveryBuffer = args.recovery * 0.22 + args.stamina * 0.12 + args.composure * 0.08;
  const fatiguePenalty = args.fatigue * 0.62;
  const injuryPenalty = args.injuryRisk * 42;
  const activeInjuryPenalty =
    args.injury?.status === "out"
      ? 46
      : args.injury?.status === "managed"
        ? 18
        : 0;

  return Math.round(clamp(76 + recoveryBuffer - fatiguePenalty - activeInjuryPenalty - injuryPenalty, 0, 100));
}

export function recoveryStatusFor(
  fatigue: number,
  injuryRisk: number,
  injury: InjuryEpisode = createHealthyInjuryState()
): AthleteCareerState["recoveryStatus"] {
  if (injury.status === "out" || injuryRisk >= 0.42) {
    return "injured";
  }

  if (injury.status === "managed" || fatigue >= 72 || injuryRisk >= 0.28) {
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

function injuryFor(athlete: AthleteCareerState): InjuryEpisode {
  return athlete.injury ?? createHealthyInjuryState();
}

export function refreshAthleteReadiness(athlete: AthleteCareerState): AthleteCareerState {
  const injury = injuryFor(athlete);
  const readiness = calculateReadiness({
    fatigue: athlete.fatigue,
    injuryRisk: athlete.injuryRisk,
    recovery: athlete.development.recovery,
    stamina: athlete.development.stamina,
    composure: athlete.development.composure,
    injury
  });

  return {
    ...athlete,
    injury,
    readiness,
    recoveryStatus: recoveryStatusFor(athlete.fatigue, athlete.injuryRisk, injury)
  };
}

function dailyInjuryRecovery(athlete: AthleteCareerState): AthleteCareerState {
  const injury = injuryFor(athlete);

  if (injury.status === "healthy" || injury.daysRemaining <= 0) {
    return {
      ...athlete,
      injury: injury.status === "healthy" ? injury : createHealthyInjuryState()
    };
  }

  const daysRemaining = Math.max(0, injury.daysRemaining - 1);
  const recovered = daysRemaining === 0;

  return {
    ...athlete,
    injury: recovered
      ? {
          ...createHealthyInjuryState(),
          notes: [`Cleared from ${injury.label}`]
        }
      : {
          ...injury,
          daysRemaining,
          notes: [`Recovery day logged for ${injury.label}`, ...injury.notes].slice(0, 4)
        },
    fatigue: clamp(athlete.fatigue - (injury.status === "out" ? 7 : 4), 0, 100),
    injuryRisk: clamp(athlete.injuryRisk - (injury.status === "out" ? 0.035 : 0.024), 0.02, 1)
  };
}

export function applyPassiveRecovery(athlete: AthleteCareerState): AthleteCareerState {
  const recovered = dailyInjuryRecovery(athlete);

  return refreshAthleteReadiness({
    ...recovered,
    fatigue: clamp(recovered.fatigue - 5 - recovered.development.recovery * 0.03, 0, 100),
    injuryRisk: clamp(recovered.injuryRisk - 0.018 - recovered.development.recovery * 0.0004, 0.02, 1)
  });
}

function stableLoadRoll(input: string) {
  return Array.from(input).reduce((hash, char) => (hash * 33 + char.charCodeAt(0)) % 10_000, 5381) % 100;
}

export function evaluateLoadInjury(args: {
  athlete: AthleteCareerState;
  date: string;
  source: string;
  loadScore: number;
  mitigation?: number;
}): AthleteCareerState {
  const currentInjury = injuryFor(args.athlete);

  if (currentInjury.status === "out") {
    return refreshAthleteReadiness(args.athlete);
  }

  const mitigation = args.mitigation ?? 0;
  const adjustedLoad = Math.max(0, args.loadScore - mitigation);
  const chance = clamp(
    Math.round(adjustedLoad / 9 + args.athlete.injuryRisk * 45 + args.athlete.fatigue / 18 - args.athlete.development.recovery / 22),
    1,
    18
  );
  const roll = stableLoadRoll(`${args.athlete.playerId}:${args.date}:${args.source}:${Math.round(adjustedLoad)}`);

  if (roll >= chance) {
    return refreshAthleteReadiness(args.athlete);
  }

  const severe = adjustedLoad >= 88 || args.athlete.injuryRisk >= 0.28 || args.athlete.fatigue >= 78;
  const status = severe ? "out" : "managed";
  const daysRemaining = severe ? 5 : 2;
  const label = severe ? "Load-related ankle flare" : "Managed knee soreness";
  const injury: InjuryEpisode = {
    status,
    label,
    daysRemaining,
    triggeredAt: args.date,
    returnDate: addDays(args.date, daysRemaining),
    notes: [
      `${args.source} triggered ${label} (${roll}/${chance} load roll)`,
      status === "out" ? "Competition and heavy training should be paused." : "Recovery work can keep the athlete available."
    ]
  };

  return refreshAthleteReadiness({
    ...args.athlete,
    injury,
    fatigue: clamp(args.athlete.fatigue + (severe ? 8 : 4), 0, 100),
    injuryRisk: clamp(args.athlete.injuryRisk + (severe ? 0.09 : 0.04), 0.02, 1)
  });
}

export function applyMatchLoad(athlete: AthleteCareerState, staminaDrain: number, date = "match-day"): AthleteCareerState {
  const fatigueDelta = clamp(10 + staminaDrain * 0.28, 8, 28);
  const injuryDelta = clamp(0.02 + fatigueDelta / 520, 0.02, 0.08);

  return evaluateLoadInjury({
    athlete: refreshAthleteReadiness({
      ...athlete,
      fatigue: clamp(athlete.fatigue + fatigueDelta, 0, 100),
      injuryRisk: clamp(athlete.injuryRisk + injuryDelta, 0, 1)
    }),
    date,
    source: "match load",
    loadScore: fatigueDelta + staminaDrain * 0.65
  });
}

export function canTrainWithInjury(athlete: AthleteCareerState, intensity: string) {
  const injury = injuryFor(athlete);

  if (injury.status !== "out" || intensity === "recovery") {
    return { allowed: true, reason: "Available" };
  }

  return {
    allowed: false,
    reason: `${injury.label} clears in ${injury.daysRemaining} day(s)`
  };
}

export function canCompeteWithInjury(athlete: AthleteCareerState) {
  const injury = injuryFor(athlete);

  if (injury.status !== "out") {
    return { allowed: true, reason: "Available" };
  }

  return {
    allowed: false,
    reason: `${injury.label} keeps the athlete out until ${injury.returnDate ?? "medical clearance"}`
  };
}

export function applyMedicalRecoveryBlock(athlete: AthleteCareerState, recoveryBoost: number): AthleteCareerState {
  const injury = injuryFor(athlete);

  if (injury.status === "healthy") {
    return refreshAthleteReadiness({
      ...athlete,
      fatigue: clamp(athlete.fatigue - recoveryBoost * 0.4, 0, 100),
      injuryRisk: clamp(athlete.injuryRisk - recoveryBoost * 0.003, 0.02, 1)
    });
  }

  const daysRemaining = Math.max(0, injury.daysRemaining - Math.max(1, Math.round(recoveryBoost / 12)));
  const cleared = daysRemaining === 0;

  return refreshAthleteReadiness({
    ...athlete,
    injury: cleared
      ? {
          ...createHealthyInjuryState(),
          notes: [`Medical recovery cleared ${injury.label}`]
        }
      : {
          ...injury,
          daysRemaining,
          returnDate: injury.triggeredAt ? addDays(injury.triggeredAt, daysRemaining) : injury.returnDate,
          notes: [`Medical recovery shortened ${injury.label}`, ...injury.notes].slice(0, 4)
        },
    fatigue: clamp(athlete.fatigue - recoveryBoost, 0, 100),
    injuryRisk: clamp(athlete.injuryRisk - recoveryBoost * 0.004, 0.02, 1)
  });
}
