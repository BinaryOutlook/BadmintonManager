import type { CareerState, ProgramRosterSlot, TrainingPlan } from "./models";
import { addLedgerEntry } from "./economy";
import { addDays } from "./calendar";
import {
  previewPreparationPlan,
  schedulePreparationBlock,
  scheduledPreparationForAthlete
} from "./preparation";
import { getTrainingPlan } from "./training";

export type ProgramRole = "lead" | "rotation" | "development";

export type ProgramTask = {
  id: string;
  label: string;
  detail: string;
  urgent: boolean;
  athleteId: string | null;
};

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

export function programTasksForCareer(state: CareerState): ProgramTask[] {
  const tasks: ProgramTask[] = state.ecosystem.recruitment.roster
    .filter(
      (slot) =>
        slot.status === "active" &&
        slot.athleteId !== state.program.managedPlayerId &&
        state.athletes.some((athlete) => athlete.playerId === slot.athleteId)
    )
    .map((slot) => {
      const block = scheduledPreparationForAthlete(state, slot.athleteId);
      const role = programRoleLabel(slot);

      return block
        ? {
            id: `program-task:${state.date}:${slot.athleteId}:scheduled`,
            label: `${role} preparation`,
            detail: `${slot.name} · ${block.planSnapshot.label} resolves on Advance Day`,
            urgent: false,
            athleteId: slot.athleteId
          }
        : {
            id: `program-task:${state.date}:${slot.athleteId}:unscheduled`,
            label: `${role} load`,
            detail: `${slot.name} has no preparation block for ${state.date}`,
            urgent: true,
            athleteId: slot.athleteId
          };
    });
  const payrollDate = addDays(state.date, 1);

  if (isProgramPayrollDate(payrollDate)) {
    const payroll = weeklyProgramPayroll(state);
    tasks.push({
      id: `program-task:${payrollDate}:payroll`,
      label: "Weekly payroll",
      detail: `${payroll.total.toLocaleString()} due ${payrollDate} · roster ${payroll.rosterContracts.toLocaleString()} + staff ${payroll.staffSalaries.toLocaleString()}`,
      urgent: state.economy.cash < payroll.total,
      athleteId: null
    });
  }

  return tasks;
}

export function weeklyProgramPayroll(state: CareerState) {
  const rosterContracts = state.ecosystem.recruitment.roster
    .filter((slot) => slot.status === "active")
    .reduce((total, slot) => total + slot.contractCost, 0);
  const staffSalaries = state.ecosystem.staff.hired.reduce((total, staff) => total + staff.salary, 0);

  return {
    rosterContracts,
    staffSalaries,
    total: rosterContracts + staffSalaries
  };
}

export function isProgramPayrollDate(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
}

export function chargeProgramPayroll(state: CareerState): CareerState {
  const payroll = weeklyProgramPayroll(state);
  const synchronizedEconomy = state.economy.contractCostPerWeek === payroll.rosterContracts
    ? state.economy
    : { ...state.economy, contractCostPerWeek: payroll.rosterContracts };
  const synchronizedState = synchronizedEconomy === state.economy
    ? state
    : { ...state, economy: synchronizedEconomy };

  if (!isProgramPayrollDate(state.date) || payroll.total === 0) {
    return synchronizedState;
  }

  const label = `Program payroll · ${state.date}`;

  if (state.economy.ledger.some((entry) => entry.date === state.date && entry.label === label)) {
    return synchronizedState;
  }

  const economy = addLedgerEntry({
    economy: synchronizedEconomy,
    date: state.date,
    category: "contract",
    label,
    amount: -payroll.total
  });
  const shortfall = economy.cash < 0;

  return {
    ...state,
    economy,
    notes: [
      shortfall
        ? `Program payroll charged ${payroll.total}; cash is now overdrawn`
        : `Program payroll charged ${payroll.total}`,
      ...state.notes
    ].slice(0, 6)
  };
}
