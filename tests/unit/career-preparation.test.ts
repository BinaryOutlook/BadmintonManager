import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { buildAdvanceDayForecast, resolveCareerDay } from "../../game/career/dayResolution";
import { hireStaffMember } from "../../game/career/ecosystem";
import { getCareerEvent } from "../../game/career/events";
import { advanceFacilityBuilds, upgradeFacility } from "../../game/career/facilitiesMedia";
import {
  clearScheduledPreparationBlock,
  previewPreparationPlan,
  resolveScheduledPreparation,
  schedulePreparationBlock,
  scheduledPreparationForAthlete
} from "../../game/career/preparation";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import { trainingPlans } from "../../game/career/training";
import { useTournamentStore } from "../../game/store/store";
import { createTournament } from "../../game/tournament/tournament";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function installWindowStorage() {
  if (typeof window === "undefined") {
    return;
  }

  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true
  });
}

describe("scheduled career preparation", () => {
  it("upserts one exact current-day block without changing athlete or economy state", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8901);
    const originalAthlete = managedAthlete(career);
    const originalCash = career.economy.cash;
    const mutablePlan = {
      ...trainingPlans[0],
      attributeDelta: { ...trainingPlans[0].attributeDelta }
    };
    const first = schedulePreparationBlock({ state: career, plan: mutablePlan });

    mutablePlan.attributeDelta.smash = 99;

    expect(first.preparationSchedule).toHaveLength(1);
    expect(first.preparationSchedule[0]?.planSnapshot.attributeDelta.smash).toBe(1.8);
    expect(managedAthlete(first)).toEqual(originalAthlete);
    expect(first.economy.cash).toBe(originalCash);

    const replacement = schedulePreparationBlock({ state: first, plan: trainingPlans[1] });

    expect(replacement.preparationSchedule).toHaveLength(1);
    expect(replacement.preparationSchedule[0]?.id).toBe(first.preparationSchedule[0]?.id);
    expect(replacement.preparationSchedule[0]?.planSnapshot.id).toBe("rally-base");
    expect(clearScheduledPreparationBlock(replacement).preparationSchedule).toEqual([]);
  });

  it("resolves one block once with cost, development, and an auditable history record", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8902);
    const plan = trainingPlans[0];
    const scheduled = schedulePreparationBlock({ state: career, plan });
    const resolved = resolveScheduledPreparation(scheduled);
    const replayed = resolveScheduledPreparation(resolved);
    const record = resolved.developmentHistory.find(
      (entry) => entry.kind === "preparation" && entry.blockId === scheduled.preparationSchedule[0]?.id
    );

    expect(resolved.preparationSchedule).toEqual([]);
    expect(resolved.economy.cash).toBe(career.economy.cash - plan.cost);
    expect(managedAthlete(resolved).development.smash).toBeGreaterThan(managedAthlete(career).development.smash);
    expect(record).toMatchObject({
      kind: "preparation",
      outcome: "completed",
      planId: plan.id,
      planLabel: plan.label,
      cost: plan.cost,
      modifierSourceIds: []
    });
    expect(replayed).toEqual(resolved);
  });

  it("records an unaffordable block as blocked without charging or changing the athlete", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8903);
    const noCashCareer = {
      ...career,
      economy: { ...career.economy, cash: 0 }
    };
    const scheduled = schedulePreparationBlock({ state: noCashCareer, plan: trainingPlans[0] });
    const resolved = resolveScheduledPreparation(scheduled);
    const record = resolved.developmentHistory.at(-1);

    expect(resolved.preparationSchedule).toEqual([]);
    expect(resolved.economy.cash).toBe(0);
    expect(managedAthlete(resolved)).toEqual(managedAthlete(noCashCareer));
    expect(record).toMatchObject({
      kind: "preparation",
      outcome: "blocked",
      cost: 0,
      reason: expect.stringContaining("Insufficient cash")
    });
  });

  it("captures active staff and facility modifiers in the resolved snapshot", () => {
    const base = createInitialCareerState(seededPlayers[0].player.id, 8904);
    const staffed = hireStaffMember(base, "staff-assistant-ruiz");
    const building = upgradeFacility(staffed, "training_hall");
    const completed = advanceFacilityBuilds({
      ...building,
      date: building.facilities.find((facility) => facility.type === "training_hall")!.buildCompleteDate!
    });
    const plan = trainingPlans[0];
    const withoutModifiers = resolveScheduledPreparation(schedulePreparationBlock({ state: base, plan }));
    const withModifiers = resolveScheduledPreparation(schedulePreparationBlock({ state: completed, plan }));
    const record = withModifiers.developmentHistory.at(-1);

    expect(managedAthlete(withModifiers).development.smash).toBeGreaterThan(
      managedAthlete(withoutModifiers).development.smash
    );
    expect(record).toMatchObject({
      kind: "preparation",
      outcome: "completed",
      modifierSourceIds: expect.arrayContaining([
        "staff:staff-assistant-ruiz",
        expect.stringContaining("facility:")
      ])
    });
  });

  it("derives a forecast from the exact day resolver", () => {
    const career = schedulePreparationBlock({
      state: createInitialCareerState(seededPlayers[0].player.id, 8905),
      plan: trainingPlans[1]
    });
    const forecast = buildAdvanceDayForecast({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });
    const actual = resolveCareerDay({ career, tournament: null });
    const beforeAthlete = managedAthlete(career);
    const afterAthlete = managedAthlete(actual);

    expect(forecast.available).toBe(true);
    expect(forecast.preparationLabel).toBe("Rally Base");
    expect(forecast.cashDelta).toBe(actual.economy.cash - career.economy.cash);
    expect(forecast.readinessDelta).toBe(afterAthlete.readiness - beforeAthlete.readiness);
    expect(forecast.fatigueDelta).toBe(afterAthlete.fatigue - beforeAthlete.fatigue);
    expect(forecast.developmentDelta.stamina).toBe(
      afterAthlete.development.stamina - beforeAthlete.development.stamina
    );
    expect(resolveCareerDay({ career, tournament: null })).toEqual(actual);
  });

  it("previews candidate plans without mutating the career", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 8906);
    const preview = previewPreparationPlan({ state: career, plan: trainingPlans[2] });

    expect(preview.after.development.composure).toBeGreaterThan(preview.before.development.composure);
    expect(preview.economyAfter.cash).toBe(career.economy.cash - trainingPlans[2].cost);
    expect(preview.record).toMatchObject({ kind: "preparation", outcome: "completed" });
    expect(career.preparationSchedule).toEqual([]);
  });

  it("blocks scheduling through the store when a managed match is already due", () => {
    installWindowStorage();
    const managedPlayerId = seededPlayers[0].player.id;
    const initial = createInitialCareerState(managedPlayerId, 8907);
    const event = getCareerEvent(initial.events, "metro-open-300")!;
    const career = {
      ...initial,
      date: event.startDate,
      stage: "pre_match" as const,
      activeEventId: event.id,
      enteredEventIds: [event.id]
    };
    const tournament = {
      ...createTournament(seededPlayers, managedPlayerId, 8907),
      id: event.id,
      name: event.name,
      tier: event.tier
    };

    useTournamentStore.setState({
      phase: "overview",
      selectedPlayerId: managedPlayerId,
      plannedTacticKey: "balancedControl",
      seed: 8907,
      tournament,
      liveMatch: null,
      career,
      saveRecovery: null,
      activeSavePresent: true,
      corruptSavePresent: false
    });
    useTournamentStore.getState().scheduleCareerTraining("rear-court-power");

    expect(scheduledPreparationForAthlete(useTournamentStore.getState().career!)).toBeNull();
    expect(useTournamentStore.getState().career?.notes[0]).toMatch(/scheduling blocked/i);
  });
});
