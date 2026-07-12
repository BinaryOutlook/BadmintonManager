import { advanceCareerCalendar, addDays } from "./calendar";
import { getCareerDailyAction, type CareerActionPhase, type CareerDailyAction } from "./dailyAction";
import {
  advanceFacilityBuilds,
  applyFacilityDailyRecovery,
  chargeFacilityUpkeep,
  resolveMediaObjectives
} from "./facilitiesMedia";
import { expireScoutReports, resolveDueScoutReports, resolvePromises } from "./ecosystem";
import { getCareerEvent, recordPastCareerEvents } from "./events";
import type { CareerState } from "./models";
import { resolveScheduledPreparation, scheduledPreparationForAthlete } from "./preparation";
import { advanceRivalCircuit } from "./rivals";
import { managedAthlete } from "./state";
import { refreshAssistantAdvice } from "./tactics";
import { simulateUniverseThroughDate } from "./universe";
import type { TournamentState } from "../tournament/tournament";

export function resolveCareerDay(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): CareerState {
  const preparedCareer = resolveScheduledPreparation(args.career);
  const advancedCareer = advanceCareerCalendar(preparedCareer, { tournament: args.tournament });
  const universeCareer = simulateUniverseThroughDate({
    career: advancedCareer,
    activeTournament: args.tournament,
    targetDate: advancedCareer.date
  }).career;

  return refreshAssistantAdvice(
    recordPastCareerEvents(
      resolveMediaObjectives(
        chargeFacilityUpkeep(
          applyFacilityDailyRecovery(
            advanceFacilityBuilds(
              advanceRivalCircuit(
                resolvePromises(
                  expireScoutReports(
                    resolveDueScoutReports(universeCareer)
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

export type AdvanceDayForecast = {
  action: CareerDailyAction;
  available: boolean;
  fromDate: string;
  targetDate: string;
  preparationLabel: string;
  preparationOutcome: "completed" | "blocked" | "recovery_only" | "unavailable";
  cashDelta: number;
  readinessDelta: number;
  fatigueDelta: number;
  injuryRiskDelta: number;
  developmentDelta: {
    smash: number;
    stamina: number;
    composure: number;
    recovery: number;
  };
  dueItems: string[];
};

function unavailableForecast(career: CareerState, action: CareerDailyAction): AdvanceDayForecast {
  return {
    action,
    available: false,
    fromDate: career.date,
    targetDate: career.date,
    preparationLabel: "Blocked by required career action",
    preparationOutcome: "unavailable",
    cashDelta: 0,
    readinessDelta: 0,
    fatigueDelta: 0,
    injuryRiskDelta: 0,
    developmentDelta: { smash: 0, stamina: 0, composure: 0, recovery: 0 },
    dueItems: [action.reason]
  };
}

export function buildAdvanceDayForecast(args: {
  career: CareerState;
  tournament: TournamentState | null;
  phase: CareerActionPhase;
  liveMatchActive: boolean;
}): AdvanceDayForecast {
  const action = getCareerDailyAction(args);

  if (action.kind !== "advance_day") {
    return unavailableForecast(args.career, action);
  }

  const beforeAthlete = managedAthlete(args.career);
  const scheduledBlock = scheduledPreparationForAthlete(args.career);
  const resolved = resolveCareerDay({ career: args.career, tournament: args.tournament });
  const afterAthlete = managedAthlete(resolved);
  const preparationRecord = scheduledBlock
    ? resolved.developmentHistory.find(
        (entry) => entry.kind === "preparation" && entry.blockId === scheduledBlock.id
      )
    : null;
  const targetDate = addDays(args.career.date, 1);
  const dueItems = [
    ...args.career.ecosystem.scouting.assignments
      .filter((assignment) => assignment.status === "pending" && assignment.dueAt === targetDate)
      .map((assignment) => `Scout report due: ${assignment.subjectId}`),
    ...args.career.facilities
      .filter((facility) => facility.status === "building" && facility.buildCompleteDate === targetDate)
      .map((facility) => `${facility.label} construction completes`),
    ...args.career.athletes
      .filter((athlete) => athlete.injury.returnDate === targetDate)
      .map((athlete) => `${athlete.injury.label} medical return`)
  ];

  if (resolved.stage === "pre_match" && args.career.stage !== "pre_match") {
    const event = resolved.activeEventId ? getCareerEvent(resolved.events, resolved.activeEventId) : null;
    dueItems.push(`${event?.name ?? "Managed event"} match window opens`);
  }

  if (preparationRecord?.kind === "preparation" && preparationRecord.outcome === "blocked") {
    dueItems.unshift(preparationRecord.reason);
  }

  dueItems.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);

  return {
    action,
    available: true,
    fromDate: args.career.date,
    targetDate: resolved.date,
    preparationLabel: scheduledBlock?.planSnapshot.label ?? "Passive recovery only",
    preparationOutcome:
      preparationRecord?.kind === "preparation"
        ? preparationRecord.outcome
        : "recovery_only",
    cashDelta: resolved.economy.cash - args.career.economy.cash,
    readinessDelta: afterAthlete.readiness - beforeAthlete.readiness,
    fatigueDelta: afterAthlete.fatigue - beforeAthlete.fatigue,
    injuryRiskDelta: afterAthlete.injuryRisk - beforeAthlete.injuryRisk,
    developmentDelta: {
      smash: afterAthlete.development.smash - beforeAthlete.development.smash,
      stamina: afterAthlete.development.stamina - beforeAthlete.development.stamina,
      composure: afterAthlete.development.composure - beforeAthlete.development.composure,
      recovery: afterAthlete.development.recovery - beforeAthlete.development.recovery
    },
    dueItems: dueItems.length > 0 ? dueItems : ["No new manager commitment opens tomorrow."]
  };
}
