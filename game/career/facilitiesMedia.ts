import { addDays, daysBetween } from "./calendar";
import { addLedgerEntry } from "./economy";
import { refreshAthleteReadiness } from "./health";
import type {
  AthleteCareerState,
  CareerEventDefinition,
  CareerState,
  CareerStateV4,
  CareerStateV5,
  FacilityModifier,
  FacilityState,
  FacilityType,
  MediaReactionLog,
  MediaSponsorState,
  SponsorObjective
} from "./models";
import { clamp } from "./models";

const emptyModifier: FacilityModifier = {
  trainingDevelopment: 0,
  recoveryFatigue: 0,
  injuryMitigation: 0,
  scoutingAccuracy: 0,
  adviceQuality: 0,
  youthReadiness: 0,
  travelCostReduction: 0,
  travelFatigueReduction: 0,
  pressureResistance: 0
};

const facilityCatalog: Record<FacilityType, Omit<FacilityState, "level" | "nextUpgradeCost" | "maintenanceCost" | "buildCompleteDate" | "status" | "modifiers" | "history"> & {
  baseCost: number;
  costStep: number;
  maintenanceBase: number;
  perLevel: FacilityModifier;
}> = {
  training_hall: {
    id: "facility-training-hall",
    type: "training_hall",
    label: "Training Hall",
    maxLevel: 3,
    buildTimeDays: 5,
    baseCost: 18_000,
    costStep: 9_000,
    maintenanceBase: 1_200,
    perLevel: { ...emptyModifier, trainingDevelopment: 0.08 }
  },
  recovery_center: {
    id: "facility-recovery-center",
    type: "recovery_center",
    label: "Recovery Center",
    maxLevel: 3,
    buildTimeDays: 5,
    baseCost: 16_500,
    costStep: 8_500,
    maintenanceBase: 1_050,
    perLevel: { ...emptyModifier, recoveryFatigue: 4, injuryMitigation: 0.012 }
  },
  analytics_lab: {
    id: "facility-analytics-lab",
    type: "analytics_lab",
    label: "Analytics Lab",
    maxLevel: 3,
    buildTimeDays: 6,
    baseCost: 19_500,
    costStep: 10_000,
    maintenanceBase: 1_300,
    perLevel: { ...emptyModifier, scoutingAccuracy: 5, adviceQuality: 6 }
  },
  youth_academy: {
    id: "facility-youth-academy",
    type: "youth_academy",
    label: "Youth Academy",
    maxLevel: 3,
    buildTimeDays: 8,
    baseCost: 17_000,
    costStep: 9_500,
    maintenanceBase: 1_150,
    perLevel: { ...emptyModifier, youthReadiness: 5, pressureResistance: 1 }
  },
  travel_quality: {
    id: "facility-travel-quality",
    type: "travel_quality",
    label: "Travel Quality",
    maxLevel: 3,
    buildTimeDays: 4,
    baseCost: 14_000,
    costStep: 7_500,
    maintenanceBase: 900,
    perLevel: { ...emptyModifier, travelCostReduction: 0.06, travelFatigueReduction: 3, pressureResistance: 2 }
  }
};

function nextCost(type: FacilityType, level: number) {
  const catalog = facilityCatalog[type];
  return level >= catalog.maxLevel ? 0 : catalog.baseCost + catalog.costStep * level;
}

function modifiersFor(type: FacilityType, level: number): FacilityModifier {
  const perLevel = facilityCatalog[type].perLevel;

  return Object.fromEntries(
    Object.entries(perLevel).map(([key, value]) => [key, value * level])
  ) as FacilityModifier;
}

function createFacility(type: FacilityType, date: string): FacilityState {
  const catalog = facilityCatalog[type];

  return {
    id: catalog.id,
    type,
    label: catalog.label,
    level: 0,
    maxLevel: catalog.maxLevel,
    nextUpgradeCost: nextCost(type, 0),
    maintenanceCost: 0,
    buildTimeDays: catalog.buildTimeDays,
    buildCompleteDate: null,
    status: "ready",
    modifiers: modifiersFor(type, 0),
    history: [
      {
        id: `${catalog.id}-seed`,
        date,
        level: 0,
        cost: 0,
        note: `${catalog.label} baseline established`
      }
    ]
  };
}

export function createInitialFacilities(date = "2026-06-01"): FacilityState[] {
  return [
    createFacility("training_hall", date),
    createFacility("recovery_center", date),
    createFacility("analytics_lab", date),
    createFacility("youth_academy", date),
    createFacility("travel_quality", date)
  ];
}

export function facilityModifiers(facilities: FacilityState[]): FacilityModifier {
  return facilities.reduce(
    (total, facility) => ({
      trainingDevelopment: total.trainingDevelopment + facility.modifiers.trainingDevelopment,
      recoveryFatigue: total.recoveryFatigue + facility.modifiers.recoveryFatigue,
      injuryMitigation: total.injuryMitigation + facility.modifiers.injuryMitigation,
      scoutingAccuracy: total.scoutingAccuracy + facility.modifiers.scoutingAccuracy,
      adviceQuality: total.adviceQuality + facility.modifiers.adviceQuality,
      youthReadiness: total.youthReadiness + facility.modifiers.youthReadiness,
      travelCostReduction: total.travelCostReduction + facility.modifiers.travelCostReduction,
      travelFatigueReduction: total.travelFatigueReduction + facility.modifiers.travelFatigueReduction,
      pressureResistance: total.pressureResistance + facility.modifiers.pressureResistance
    }),
    emptyModifier
  );
}

function maintenanceDue(facilities: FacilityState[]) {
  return facilities.reduce((total, facility) => total + facility.maintenanceCost, 0);
}

export function applyFacilitiesToTraining(athlete: AthleteCareerState, facilities: FacilityState[]) {
  const modifiers = facilityModifiers(facilities);

  return refreshAthleteReadiness({
    ...athlete,
    development: {
      smash: clamp(athlete.development.smash + modifiers.trainingDevelopment * 1.8, 1, 100),
      stamina: clamp(athlete.development.stamina + modifiers.trainingDevelopment * 1.4, 1, 100),
      composure: clamp(athlete.development.composure + modifiers.adviceQuality * 0.025, 1, 100),
      recovery: clamp(athlete.development.recovery + modifiers.recoveryFatigue * 0.12, 1, 100)
    },
    fatigue: clamp(athlete.fatigue - modifiers.recoveryFatigue * 0.55, 0, 100),
    injuryRisk: clamp(athlete.injuryRisk - modifiers.injuryMitigation, 0.02, 1)
  });
}

export function applyFacilityDailyRecovery(state: CareerState): CareerState {
  const modifiers = facilityModifiers(state.facilities);

  if (modifiers.recoveryFatigue === 0 && modifiers.injuryMitigation === 0) {
    return state;
  }

  return {
    ...state,
    athletes: state.athletes.map((athlete) =>
      athlete.playerId === state.program.managedPlayerId
        ? refreshAthleteReadiness({
            ...athlete,
            fatigue: clamp(athlete.fatigue - modifiers.recoveryFatigue, 0, 100),
            injuryRisk: clamp(athlete.injuryRisk - modifiers.injuryMitigation, 0.02, 1)
          })
        : athlete
    ),
    notes: [`Recovery Center removed ${Math.round(modifiers.recoveryFatigue)} fatigue pressure`, ...state.notes].slice(0, 6)
  };
}

export function advanceFacilityBuilds(state: CareerState): CareerState {
  const completed = state.facilities.filter(
    (facility) =>
      facility.status === "building" &&
      facility.buildCompleteDate &&
      daysBetween(facility.buildCompleteDate, state.date) >= 0
  );

  if (completed.length === 0) {
    return state;
  }

  const completedIds = new Set(completed.map((facility) => facility.id));
  const facilities = state.facilities.map((facility) => {
    if (!completedIds.has(facility.id)) {
      return facility;
    }

    return {
      ...facility,
      buildCompleteDate: null,
      status: facility.level >= facility.maxLevel ? "maxed" as const : "ready" as const,
      modifiers: modifiersFor(facility.type, facility.level),
      history: [
        {
          id: `${facility.id}-${state.date}-complete-${facility.level}`,
          date: state.date,
          level: facility.level,
          cost: 0,
          note: `${facility.label} level ${facility.level} construction complete`
        },
        ...facility.history
      ].slice(0, 8)
    };
  });
  const reactionLog = completed.reduce(
    (log, facility) =>
      mediaLog({
        state: { ...state.media, reactionLog: log },
        date: state.date,
        source: "facility",
        message: `${facility.label} build completed`,
        stateDelta: `Level ${facility.level} modifiers are now live`,
        relatedIds: [facility.id]
      }),
    state.media.reactionLog
  );

  return {
    ...state,
    facilities,
    media: {
      ...state.media,
      reactionLog
    },
    notes: [`${completed.map((facility) => facility.label).join(", ")} build complete`, ...state.notes].slice(0, 6)
  };
}

export function chargeFacilityUpkeep(state: CareerState): CareerState {
  const due = maintenanceDue(state.facilities);

  if (due <= 0 || state.economy.ledger.some((entry) => entry.date === state.date && entry.label === "Facility upkeep")) {
    return state;
  }

  const amount = -Math.min(state.economy.cash, due);
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "facility",
    label: "Facility upkeep",
    amount
  });

  if (Math.abs(amount) >= due) {
    return {
      ...state,
      economy,
      notes: [`Facility upkeep paid ${Math.abs(amount).toLocaleString()}`, ...state.notes].slice(0, 6)
    };
  }

  const shortage = due - Math.abs(amount);
  const withMedia = {
    ...state,
    economy,
    media: {
      ...state.media,
      reputation: clamp(state.media.reputation - 2, 0, 100),
      reactionLog: mediaLog({
        state: state.media,
        date: state.date,
        source: "facility",
        message: "Facility upkeep underfunded",
        stateDelta: `Short ${shortage} budget, reputation -2, morale -2`,
        relatedIds: state.facilities.filter((facility) => facility.maintenanceCost > 0).map((facility) => facility.id)
      })
    }
  };

  return updateManagedPsychology(withMedia, -2, "Facility upkeep underfunded");
}

export function effectiveEventEntryCosts(event: CareerEventDefinition, facilities: FacilityState[]) {
  const modifiers = facilityModifiers(facilities);
  const reduction = clamp(modifiers.travelCostReduction, 0, 0.3);
  const travelCost = Math.round(event.travelCost * (1 - reduction));

  return {
    travelCost,
    entryFee: event.entryFee,
    savedTravelCost: event.travelCost - travelCost,
    travelFatigue: Math.max(0, Math.round(event.prestige / 18 - modifiers.travelFatigueReduction))
  };
}

export function applyTravelPressureForEvent(state: CareerState, event: CareerEventDefinition): CareerState {
  const costs = effectiveEventEntryCosts(event, state.facilities);

  if (costs.travelFatigue <= 0) {
    return state;
  }

  return {
    ...state,
    athletes: state.athletes.map((athlete) =>
      athlete.playerId === state.program.managedPlayerId
        ? refreshAthleteReadiness({
            ...athlete,
            fatigue: clamp(athlete.fatigue + costs.travelFatigue, 0, 100),
            injuryRisk: clamp(athlete.injuryRisk + costs.travelFatigue * 0.002, 0.02, 1)
          })
        : athlete
    )
  };
}

function mediaLog(args: {
  state: MediaSponsorState;
  date: string;
  source: MediaReactionLog["source"];
  message: string;
  stateDelta: string;
  relatedIds: string[];
}) {
  const entry: MediaReactionLog = {
    id: `media-log-${args.date}-${args.state.reactionLog.length + 1}`,
    date: args.date,
    source: args.source,
    message: args.message,
    stateDelta: args.stateDelta,
    relatedIds: args.relatedIds
  };

  return [entry, ...args.state.reactionLog].slice(0, 18);
}

export function createInitialMediaState(date = "2026-06-01"): MediaSponsorState {
  return {
    reputation: 58,
    sponsors: [
      {
        id: "sponsor-metro-qf",
        sponsorId: "aero-string-labs",
        sponsorName: "Aero String Labs",
        target: "reach_qf",
        description: "Reach the Metro Open quarterfinal for broadcast exposure.",
        deadline: "2026-06-04",
        reward: { cash: 8_000, reputation: 5, morale: 3 },
        penalty: { cash: -4_000, reputation: -6, morale: -4 },
        status: "active",
        progress: 35,
        relatedEventIds: ["metro-open-300"],
        resolutionLog: []
      }
    ],
    federationObjectives: [
      {
        id: "federation-readiness-floor",
        sponsorId: "national-federation",
        sponsorName: "National Federation",
        target: "readiness_floor",
        description: "Keep the lead athlete at 72+ readiness before the opening event.",
        deadline: "2026-06-03",
        reward: { cash: 2_500, reputation: 4, morale: 2 },
        penalty: { cash: -1_500, reputation: -5, morale: -5 },
        status: "active",
        progress: 50,
        relatedEventIds: ["metro-open-300"],
        resolutionLog: []
      }
    ],
    pressEvents: [
      {
        id: "press-launch-scrutiny",
        date,
        headline: "Circuit desk questions whether the new program can handle sponsor pressure.",
        pressure: 64,
        reputationDelta: 0,
        moraleDelta: -1,
        status: "active"
      }
    ],
    reactionLog: [
      {
        id: `media-log-${date}-1`,
        date,
        source: "system",
        message: "Media and sponsor desk initialized",
        stateDelta: "Sponsor goals, federation expectations, reputation, and press pressure are now tracked.",
        relatedIds: []
      }
    ]
  };
}

function updateManagedPsychology(state: CareerState, moraleDelta: number, reason: string): CareerState {
  if (moraleDelta === 0) {
    return state;
  }

  return {
    ...state,
    ecosystem: {
      ...state.ecosystem,
      psychology: state.ecosystem.psychology.map((entry) =>
        entry.athleteId === state.program.managedPlayerId
          ? {
              ...entry,
              morale: clamp(entry.morale + moraleDelta, 0, 100),
              confidence: clamp(entry.confidence + Math.round(moraleDelta * 0.45), 0, 100),
              recentDrivers: [reason, ...entry.recentDrivers].slice(0, 5)
            }
          : entry
      )
    }
  };
}

function objectiveProgress(state: CareerState, objective: SponsorObjective) {
  const report = state.lastMatchReport;
  const athlete = state.athletes.find((entry) => entry.playerId === state.program.managedPlayerId);

  if (objective.target === "reach_qf" && report && objective.relatedEventIds.includes(report.eventId)) {
    return report.result === "win" || ["QF", "SF", "F"].includes(report.round) ? 100 : 45;
  }

  if (objective.target === "win_match" && report && objective.relatedEventIds.includes(report.eventId)) {
    return report.result === "win" ? 100 : 20;
  }

  if (objective.target === "enter_tier") {
    return state.enteredEventIds.some((eventId) => objective.relatedEventIds.includes(eventId)) ? 100 : 40;
  }

  if (objective.target === "maintain_reputation") {
    return state.media.reputation >= 60 ? 100 : Math.max(15, state.media.reputation);
  }

  if (objective.target === "readiness_floor") {
    return athlete && athlete.readiness >= 72 ? 100 : Math.max(10, athlete?.readiness ?? 10);
  }

  return objective.progress;
}

function shouldResolveObjective(state: CareerState, objective: SponsorObjective, progress: number) {
  if (progress >= 100) {
    return "fulfilled" as const;
  }

  return daysBetween(objective.deadline, state.date) > 0 ? "failed" as const : "active" as const;
}

function resolveObjectiveList(args: {
  state: CareerState;
  objectives: SponsorObjective[];
  source: "sponsor" | "federation";
}) {
  let nextState = args.state;
  const original = args.objectives;
  const objectives = args.objectives.map((objective) => {
    if (objective.status !== "active") {
      return objective;
    }

    const progress = objectiveProgress(nextState, objective);
    const resolution = shouldResolveObjective(nextState, objective, progress);

    if (resolution === "active") {
      return { ...objective, progress };
    }

    const consequence = resolution === "fulfilled" ? objective.reward : objective.penalty;
    const economy = addLedgerEntry({
      economy: nextState.economy,
      date: nextState.date,
      category: args.source === "sponsor" ? "sponsor" : "federation",
      label: `${objective.sponsorName} ${resolution}`,
      amount: consequence.cash
    });
    const resistance = facilityModifiers(nextState.facilities).pressureResistance;
    const reputationDelta = resolution === "failed"
      ? Math.min(0, consequence.reputation + resistance)
      : consequence.reputation;
    const moraleDelta = resolution === "failed"
      ? Math.min(0, consequence.morale + Math.round(resistance * 0.5))
      : consequence.morale;
    nextState = updateManagedPsychology(
      {
        ...nextState,
        economy,
        media: {
          ...nextState.media,
          reputation: clamp(nextState.media.reputation + reputationDelta, 0, 100)
        }
      },
      moraleDelta,
      `${objective.sponsorName} objective ${resolution}`
    );

    return {
      ...objective,
      status: resolution,
      progress,
      resolutionLog: [
        `${nextState.date}: ${resolution}, cash ${consequence.cash}, reputation ${reputationDelta}, morale ${moraleDelta}`,
        ...objective.resolutionLog
      ]
    };
  });
  const reactionLog = objectives.reduce((log, objective) => {
    const before = original.find((entry) => entry.id === objective.id);

    if (!before || before.status === objective.status || objective.status === "active") {
      return log;
    }

    return mediaLog({
      state: { ...nextState.media, reactionLog: log },
      date: nextState.date,
      source: args.source,
      message: `${objective.sponsorName} objective ${objective.status}`,
      stateDelta: objective.resolutionLog[0] ?? "Objective resolved",
      relatedIds: [objective.id, ...objective.relatedEventIds]
    });
  }, nextState.media.reactionLog);

  return {
    state: {
      ...nextState,
      media: {
        ...nextState.media,
        reactionLog
      }
    },
    objectives
  };
}

export function resolveMediaObjectives(state: CareerState): CareerState {
  const sponsorResolved = resolveObjectiveList({
    state,
    objectives: state.media.sponsors,
    source: "sponsor"
  });
  const federationResolved = resolveObjectiveList({
    state: {
      ...sponsorResolved.state,
      media: {
        ...sponsorResolved.state.media,
        sponsors: sponsorResolved.objectives
      }
    },
    objectives: sponsorResolved.state.media.federationObjectives,
    source: "federation"
  });
  let withPress = federationResolved.state;
  const pressEvents = withPress.media.pressEvents.map((event) => {
    if (event.status !== "active" || daysBetween(addDays(event.date, 14), withPress.date) <= 0) {
      return event;
    }

    withPress = updateManagedPsychology(
      {
        ...withPress,
        media: {
          ...withPress.media,
          reputation: clamp(withPress.media.reputation + event.reputationDelta, 0, 100),
          reactionLog: mediaLog({
            state: withPress.media,
            date: withPress.date,
            source: "press",
            message: `Press reaction settled: ${event.headline}`,
            stateDelta: `Reputation ${event.reputationDelta >= 0 ? "+" : ""}${event.reputationDelta}, morale ${event.moraleDelta >= 0 ? "+" : ""}${event.moraleDelta}`,
            relatedIds: [event.id]
          })
        }
      },
      event.moraleDelta,
      `Press reaction: ${event.headline}`
    );

    return { ...event, status: "settled" as const };
  });

  return {
    ...withPress,
    media: {
      ...withPress.media,
      federationObjectives: federationResolved.objectives,
      pressEvents
    },
    notes: ["Media desk reconciled sponsor and federation pressure", ...withPress.notes].slice(0, 6)
  };
}

export function upgradeFacility(state: CareerState, type: FacilityType): CareerState {
  const facility = state.facilities.find((entry) => entry.type === type);

  if (!facility || facility.level >= facility.maxLevel || facility.status === "building") {
    return state;
  }

  if (state.economy.cash < facility.nextUpgradeCost) {
    return {
      ...state,
      notes: [`Insufficient budget for ${facility.label}`, ...state.notes].slice(0, 6)
    };
  }

  const nextLevel = facility.level + 1;
  const catalog = facilityCatalog[type];
  const upgraded: FacilityState = {
    ...facility,
    level: nextLevel,
    nextUpgradeCost: nextCost(type, nextLevel),
    maintenanceCost: catalog.maintenanceBase * nextLevel,
    buildCompleteDate: addDays(state.date, facility.buildTimeDays),
    status: "building",
    modifiers: modifiersFor(type, facility.level),
    history: [
      {
        id: `${facility.id}-${state.date}-${nextLevel}`,
        date: state.date,
        level: nextLevel,
        cost: facility.nextUpgradeCost,
        note: `${facility.label} level ${nextLevel} build started`
      },
      ...facility.history
    ].slice(0, 8)
  };
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "facility",
    label: `${facility.label} level ${nextLevel}`,
    amount: -facility.nextUpgradeCost
  });
  const media: MediaSponsorState = {
    ...state.media,
    reputation: clamp(state.media.reputation + (type === "analytics_lab" || type === "youth_academy" ? 1 : 0), 0, 100),
    reactionLog: mediaLog({
      state: state.media,
      date: state.date,
      source: "facility",
      message: `${facility.label} level ${nextLevel} build started`,
      stateDelta: `-${facility.nextUpgradeCost} budget, completes ${addDays(state.date, facility.buildTimeDays)}`,
      relatedIds: [facility.id]
    })
  };

  return {
    ...state,
    economy,
    media,
    facilities: state.facilities.map((entry) => (entry.type === type ? upgraded : entry)),
    notes: [`${facility.label} level ${nextLevel} build started`, ...state.notes].slice(0, 6)
  };
}

export function upgradeCareerStateV4(career: CareerStateV4): CareerStateV5 {
  return {
    ...career,
    version: 5,
    facilities: createInitialFacilities(career.date),
    media: createInitialMediaState(career.date)
  };
}
