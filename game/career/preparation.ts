import { applyFacilitiesToTraining } from "./facilitiesMedia";
import { applyStaffToTraining } from "./ecosystem";
import { developmentSnapshotFromAthlete } from "./development";
import { canTrainWithInjury } from "./health";
import type {
  AthleteCareerState,
  CareerState,
  DevelopmentHistoryRecord,
  ScheduledPreparationBlock,
  TrainingPlan
} from "./models";
import { managedAthlete } from "./state";
import { applyTrainingPlan } from "./training";

export const PREPARATION_RULES_VERSION = 1 as const;
export const MAX_DEVELOPMENT_HISTORY = 24;

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneTrainingPlan(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    attributeDelta: { ...plan.attributeDelta }
  };
}

function scheduledBlockId(state: CareerState, athleteId: string, date: string) {
  return `preparation:${state.seasonId}:${date}:${athleteId}`;
}

export function scheduledPreparationForAthlete(
  state: CareerState,
  athleteId = state.program.managedPlayerId,
  date = state.date
) {
  return state.preparationSchedule.find(
    (block) => block.athleteId === athleteId && block.scheduledDate === date
  ) ?? null;
}

export function schedulePreparationBlock(args: {
  state: CareerState;
  plan: TrainingPlan;
  athleteId?: string;
  source?: ScheduledPreparationBlock["source"];
}): CareerState {
  const athleteId = args.athleteId ?? args.state.program.managedPlayerId;
  const block: ScheduledPreparationBlock = {
    id: scheduledBlockId(args.state, athleteId, args.state.date),
    athleteId,
    scheduledDate: args.state.date,
    scheduledOn: args.state.date,
    source: args.source ?? "manager",
    rulesVersion: PREPARATION_RULES_VERSION,
    planSnapshot: cloneTrainingPlan(args.plan)
  };

  return {
    ...args.state,
    selectedTrainingPlanId: athleteId === args.state.program.managedPlayerId
      ? args.plan.id
      : args.state.selectedTrainingPlanId,
    preparationSchedule: [
      ...args.state.preparationSchedule.filter(
        (entry) => entry.athleteId !== athleteId || entry.scheduledDate !== args.state.date
      ),
      block
    ],
    notes: [`${args.plan.label} scheduled for ${args.state.date}`, ...args.state.notes].slice(0, 6)
  };
}

export function clearScheduledPreparationBlock(
  state: CareerState,
  athleteId = state.program.managedPlayerId,
  date = state.date
): CareerState {
  const preparationSchedule = state.preparationSchedule.filter(
    (entry) => entry.athleteId !== athleteId || entry.scheduledDate !== date
  );

  if (preparationSchedule.length === state.preparationSchedule.length) {
    return state;
  }

  return {
    ...state,
    preparationSchedule,
    notes: [`Preparation block cleared for ${date}`, ...state.notes].slice(0, 6)
  };
}

function modifierSourceIds(state: CareerState) {
  const staffIds = state.ecosystem.staff.hired
    .filter((staff) =>
      staff.modifiers.training !== 0 || staff.modifiers.recovery !== 0 || staff.modifiers.morale !== 0
    )
    .map((staff) => `staff:${staff.id}`);
  const facilityIds = state.facilities
    .filter((facility) =>
      facility.status !== "building" &&
      facility.level > 0 &&
      (
        facility.modifiers.trainingDevelopment !== 0 ||
        facility.modifiers.recoveryFatigue !== 0 ||
        facility.modifiers.injuryMitigation !== 0 ||
        facility.modifiers.adviceQuality !== 0
      )
    )
    .map((facility) => `facility:${facility.id}`);

  return [...staffIds, ...facilityIds].sort(compareText);
}

function appendHistory(state: CareerState, record: DevelopmentHistoryRecord) {
  const withoutDuplicate = state.developmentHistory.filter((entry) => entry.id !== record.id);
  return [...withoutDuplicate, record].slice(-MAX_DEVELOPMENT_HISTORY);
}

function preparationHistoryRecord(args: {
  block: ScheduledPreparationBlock;
  athlete: AthleteCareerState;
  outcome: "completed" | "blocked";
  cost: number;
  modifierSourceIds: string[];
  reason: string;
}): DevelopmentHistoryRecord {
  return {
    kind: "preparation",
    id: `development:${args.block.id}:resolution`,
    athleteId: args.block.athleteId,
    date: args.block.scheduledDate,
    blockId: args.block.id,
    outcome: args.outcome,
    planId: args.block.planSnapshot.id,
    planLabel: args.block.planSnapshot.label,
    focus: args.block.planSnapshot.focus,
    intensity: args.block.planSnapshot.intensity,
    rulesVersion: args.block.rulesVersion,
    cost: args.cost,
    modifierSourceIds: args.modifierSourceIds,
    snapshot: developmentSnapshotFromAthlete(args.athlete),
    reason: args.reason
  };
}

function resolvePreparationBlock(state: CareerState, block: ScheduledPreparationBlock): CareerState {
  const athlete = state.athletes.find((entry) => entry.playerId === block.athleteId);
  const scheduleWithoutBlock = state.preparationSchedule.filter((entry) => entry.id !== block.id);

  if (!athlete) {
    return {
      ...state,
      preparationSchedule: scheduleWithoutBlock,
      notes: [`Preparation blocked: athlete ${block.athleteId} is unavailable`, ...state.notes].slice(0, 6)
    };
  }

  const staleReason = block.scheduledDate < state.date
    ? `Scheduled date ${block.scheduledDate} passed before resolution.`
    : null;
  const medicalGate = canTrainWithInjury(athlete, block.planSnapshot.intensity);
  const blockedReason = staleReason ??
    (state.economy.cash < block.planSnapshot.cost
      ? `Insufficient cash for ${block.planSnapshot.label}.`
      : !medicalGate.allowed
        ? medicalGate.reason
        : null);

  if (blockedReason) {
    const record = preparationHistoryRecord({
      block,
      athlete,
      outcome: "blocked",
      cost: 0,
      modifierSourceIds: [],
      reason: blockedReason
    });

    return {
      ...state,
      preparationSchedule: scheduleWithoutBlock,
      developmentHistory: appendHistory(state, record),
      notes: [`Preparation blocked: ${blockedReason}`, ...state.notes].slice(0, 6)
    };
  }

  const applied = applyTrainingPlan({
    athlete,
    economy: state.economy,
    plan: block.planSnapshot,
    date: block.scheduledDate
  });

  if (applied.blockedReason) {
    const record = preparationHistoryRecord({
      block,
      athlete: applied.athlete,
      outcome: "blocked",
      cost: 0,
      modifierSourceIds: [],
      reason: applied.blockedReason
    });

    return {
      ...state,
      preparationSchedule: scheduleWithoutBlock,
      developmentHistory: appendHistory(state, record),
      notes: [`Preparation blocked: ${applied.blockedReason}`, ...state.notes].slice(0, 6)
    };
  }

  const resolvedAthlete = applyFacilitiesToTraining(
    applyStaffToTraining(applied.athlete, state.ecosystem),
    state.facilities
  );
  const sources = modifierSourceIds(state);
  const record = preparationHistoryRecord({
    block,
    athlete: resolvedAthlete,
    outcome: "completed",
    cost: block.planSnapshot.cost,
    modifierSourceIds: sources,
    reason: sources.length > 0
      ? `${block.planSnapshot.label} completed with ${sources.join(", ")}.`
      : `${block.planSnapshot.label} completed without active staff or facility modifiers.`
  });

  return {
    ...state,
    preparationSchedule: scheduleWithoutBlock,
    athletes: state.athletes.map((entry) =>
      entry.playerId === resolvedAthlete.playerId ? resolvedAthlete : entry
    ),
    economy: applied.economy,
    developmentHistory: appendHistory(state, record),
    notes: [`${block.planSnapshot.label} completed for ${block.scheduledDate}`, ...state.notes].slice(0, 6)
  };
}

export function resolveScheduledPreparation(state: CareerState): CareerState {
  const dueBlocks = [...state.preparationSchedule]
    .filter((block) => block.scheduledDate <= state.date)
    .sort(
      (left, right) =>
        compareText(left.scheduledDate, right.scheduledDate) ||
        compareText(left.athleteId, right.athleteId) ||
        compareText(left.id, right.id)
    );

  return dueBlocks.reduce(resolvePreparationBlock, state);
}

export function previewPreparationPlan(args: {
  state: CareerState;
  plan: TrainingPlan;
  athleteId?: string;
}) {
  const scheduled = schedulePreparationBlock({
    state: args.state,
    plan: args.plan,
    athleteId: args.athleteId
  });
  const resolved = resolveScheduledPreparation(scheduled);
  const athleteId = args.athleteId ?? args.state.program.managedPlayerId;

  return {
    before: args.state.athletes.find((entry) => entry.playerId === athleteId) ?? managedAthlete(args.state),
    after: resolved.athletes.find((entry) => entry.playerId === athleteId) ?? managedAthlete(resolved),
    economyAfter: resolved.economy,
    record: resolved.developmentHistory.find(
      (entry) => entry.kind === "preparation" && entry.blockId === scheduledBlockId(args.state, athleteId, args.state.date)
    ) ?? null
  };
}
