import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { resolveCareerDay } from "../../game/career/dayResolution";
import {
  commissionScoutReport,
  makeRecruitmentOffer,
  resolveDueScoutReports
} from "../../game/career/ecosystem";
import {
  previewRosterPreparation,
  scheduleRosterPreparation
} from "../../game/career/program";
import { resolveScheduledPreparation } from "../../game/career/preparation";
import { createInitialCareerState } from "../../game/career/state";

const RECRUIT_ID = "cand-arya-prakash";

function careerWithAcceptedRotationRecruit(seed: number) {
  const initial = createInitialCareerState(seededPlayers[0].player.id, seed);
  const assigned = commissionScoutReport(initial, RECRUIT_ID, "candidate");
  const dueAt = assigned.ecosystem.scouting.assignments.find(
    (assignment) => assignment.subjectId === RECRUIT_ID
  )!.dueAt;
  const reported = resolveDueScoutReports({ ...assigned, date: dueAt });
  const signed = makeRecruitmentOffer(reported, RECRUIT_ID);

  expect(
    signed.ecosystem.recruitment.candidates.find((candidate) => candidate.id === RECRUIT_ID)?.offerState
  ).toBe("accepted");
  expect(signed.athletes.some((athlete) => athlete.playerId === RECRUIT_ID)).toBe(true);

  return signed;
}

function recruitAthlete(state: ReturnType<typeof careerWithAcceptedRotationRecruit>) {
  return state.athletes.find((athlete) => athlete.playerId === RECRUIT_ID)!;
}

describe("multi-athlete program workflow", () => {
  it("treats replaying an accepted recruitment offer as a domain-level no-op", () => {
    const signed = careerWithAcceptedRotationRecruit(9951);
    const replayed = makeRecruitmentOffer(signed, RECRUIT_ID);

    expect(replayed).toEqual(signed);
    expect(
      replayed.ecosystem.recruitment.roster.filter((slot) => slot.athleteId === RECRUIT_ID)
    ).toHaveLength(1);
    expect(replayed.athletes.filter((athlete) => athlete.playerId === RECRUIT_ID)).toHaveLength(1);
    expect(replayed.ecosystem.promises.filter((promise) => promise.athleteId === RECRUIT_ID)).toHaveLength(1);
    expect(
      replayed.economy.ledger.filter((entry) => entry.label === "Arya Prakash program signing")
    ).toHaveLength(1);
  });

  it("schedules the recruit's role-default preparation without immediately changing athlete or cash", () => {
    const signed = careerWithAcceptedRotationRecruit(9952);
    const athleteBefore = recruitAthlete(signed);
    const cashBefore = signed.economy.cash;
    const scheduled = scheduleRosterPreparation({ state: signed, athleteId: RECRUIT_ID });
    const block = scheduled.preparationSchedule.find(
      (entry) => entry.athleteId === RECRUIT_ID && entry.scheduledDate === signed.date
    );

    expect(block).toMatchObject({
      athleteId: RECRUIT_ID,
      scheduledDate: signed.date,
      scheduledOn: signed.date
    });
    expect(block?.planSnapshot.id).toBeTruthy();
    expect(recruitAthlete(scheduled)).toEqual(athleteBefore);
    expect(scheduled.economy).toEqual(signed.economy);
    expect(scheduled.economy.cash).toBe(cashBefore);
    expect(scheduled.selectedTrainingPlanId).toBe(signed.selectedTrainingPlanId);
  });

  it("previews the exact preparation outcome and lets the career day consume it once", () => {
    const signed = careerWithAcceptedRotationRecruit(9953);
    const preview = previewRosterPreparation({ state: signed, athleteId: RECRUIT_ID });

    expect(preview).not.toBeNull();

    if (!preview) {
      throw new Error("Expected an active recruited roster athlete to have a preparation preview.");
    }

    const scheduled = scheduleRosterPreparation({ state: signed, athleteId: RECRUIT_ID });
    const block = scheduled.preparationSchedule.find(
      (entry) => entry.athleteId === RECRUIT_ID && entry.scheduledDate === signed.date
    )!;
    const preparationResolved = resolveScheduledPreparation(scheduled);
    const resolved = resolveCareerDay({ career: scheduled, tournament: null });
    const deterministicReplay = resolveCareerDay({ career: scheduled, tournament: null });
    const record = resolved.developmentHistory.find(
      (entry) => entry.kind === "preparation" && entry.blockId === block.id
    );

    expect(record).toMatchObject({
      kind: "preparation",
      athleteId: RECRUIT_ID,
      blockId: block.id,
      outcome: "completed",
      planId: block.planSnapshot.id,
      cost: block.planSnapshot.cost
    });
    expect(resolved.preparationSchedule.some((entry) => entry.id === block.id)).toBe(false);
    expect(recruitAthlete(preparationResolved)).toEqual(preview.after);
    expect(preparationResolved.economy).toEqual(preview.economyAfter);
    expect(preparationResolved.economy.cash).toBe(signed.economy.cash - block.planSnapshot.cost);
    expect(
      resolved.economy.ledger.filter(
        (entry) =>
          entry.category === "training" &&
          entry.date === block.scheduledDate &&
          entry.label === block.planSnapshot.label
      )
    ).toHaveLength(1);
    expect(
      resolved.economy.ledger.find(
        (entry) =>
          entry.category === "training" &&
          entry.date === block.scheduledDate &&
          entry.label === block.planSnapshot.label
      )
    ).toMatchObject({ amount: -block.planSnapshot.cost });
    expect(deterministicReplay).toEqual(resolved);

    const nextDay = resolveCareerDay({ career: resolved, tournament: null });

    expect(
      nextDay.developmentHistory.filter(
        (entry) => entry.kind === "preparation" && entry.blockId === block.id
      )
    ).toHaveLength(1);
    expect(
      nextDay.economy.ledger.filter(
        (entry) =>
          entry.category === "training" &&
          entry.date === block.scheduledDate &&
          entry.label === block.planSnapshot.label
      )
    ).toHaveLength(1);
    expect(recruitAthlete(nextDay).development).toEqual(recruitAthlete(resolved).development);
  });
});
