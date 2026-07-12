import type { CareerState, ProgramRosterSlot, TrainingPlan } from "./models";
import {
  previewPreparationPlan,
  schedulePreparationBlock,
  scheduledPreparationForAthlete
} from "./preparation";
import { getTrainingPlan } from "./training";

export type ProgramRole = "lead" | "rotation" | "development";

const defaultPlanByRosterRole: Record<ProgramRosterSlot["role"], string> = {
  lead: "rally-base",
  senior: "rally-base",
  academy: "pressure-patterns"
};

export function programRoleForRosterSlot(slot: ProgramRosterSlot): ProgramRole {
  if (slot.role === "lead") {
    return "lead";
  }

  return slot.role === "senior" ? "rotation" : "development";
}

export function programRoleLabel(slot: ProgramRosterSlot) {
  const role = programRoleForRosterSlot(slot);
  return role === "lead" ? "Lead" : role === "rotation" ? "Rotation" : "Development";
}

export function rosterSlotForAthlete(state: CareerState, athleteId: string) {
  return state.ecosystem.recruitment.roster.find(
    (slot) => slot.athleteId === athleteId && slot.status === "active"
  ) ?? null;
}

export function rosterPreparationPlan(
  state: CareerState,
  athleteId: string,
  requestedPlanId?: string
): TrainingPlan | null {
  const slot = rosterSlotForAthlete(state, athleteId);

  if (!slot || !state.athletes.some((athlete) => athlete.playerId === athleteId)) {
    return null;
  }

  return getTrainingPlan(requestedPlanId ?? defaultPlanByRosterRole[slot.role]) ?? null;
}

export function previewRosterPreparation(args: {
  state: CareerState;
  athleteId: string;
  planId?: string;
}) {
  const plan = rosterPreparationPlan(args.state, args.athleteId, args.planId);

  if (!plan) {
    return null;
  }

  return {
    plan,
    scheduled: scheduledPreparationForAthlete(args.state, args.athleteId),
    ...previewPreparationPlan({
      state: args.state,
      athleteId: args.athleteId,
      plan
    })
  };
}

export function scheduleRosterPreparation(args: {
  state: CareerState;
  athleteId: string;
  planId?: string;
}): CareerState {
  const plan = rosterPreparationPlan(args.state, args.athleteId, args.planId);

  if (!plan) {
    return args.state;
  }

  return schedulePreparationBlock({
    state: args.state,
    athleteId: args.athleteId,
    plan,
    source: "manager"
  });
}
