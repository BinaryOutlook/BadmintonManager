import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { CareerCalendarPage } from "../../components/CareerWorkbench";
import { addDays } from "../../game/career/calendar";
import { getCareerEvent } from "../../game/career/events";
import { createInitialCareerState } from "../../game/career/state";
import { seededPlayers } from "../../game/content/players";
import { useTournamentStore } from "../../game/store/store";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

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
  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true
  });
}

function resetStoreForCareer(career = createInitialCareerState(seededPlayers[0].player.id, 9901)) {
  installWindowStorage();

  useTournamentStore.setState({
    phase: "setup",
    selectedPlayerId: career.program.managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed: 9901,
    tournament: null,
    liveMatch: null,
    career,
    saveRecovery: null,
    activeSavePresent: true,
    corruptSavePresent: false
  });
}

function careerEnteredOnMetroStart() {
  const career = createInitialCareerState(seededPlayers[0].player.id, 9902);
  const event = getCareerEvent(career.events, "metro-open-300")!;

  return {
    event,
    career: {
      ...career,
      date: event.startDate,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "event_entered" as const
    }
  };
}

function renderCalendarPage(overrides: Partial<Parameters<typeof CareerCalendarPage>[0]> = {}) {
  const { career } = careerEnteredOnMetroStart();

  return render(
    <CareerCalendarPage
      career={career}
      tournament={null}
      saveRecovery={null}
      activeSavePresent={true}
      corruptSavePresent={false}
      onStartCareer={vi.fn()}
      onOpenTraining={vi.fn()}
      onOpenCalendar={vi.fn()}
      onOpenHome={vi.fn()}
      onOpenLiveMatch={vi.fn()}
      onOpenPostMatch={vi.fn()}
      onOpenProgram={vi.fn()}
      onOpenRivals={vi.fn()}
      onOpenMatchPlanning={vi.fn()}
      onOpenSaveManager={vi.fn()}
      onRequestNewSession={vi.fn()}
      onOpenFacilities={vi.fn()}
      onOpenMedia={vi.fn()}
      onOpenScouting={vi.fn()}
      onOpenRecruitment={vi.fn()}
      onOpenYouth={vi.fn()}
      onOpenStaff={vi.fn()}
      onOpenPromises={vi.fn()}
      onOpenPlayerProfile={vi.fn()}
      onApplyTraining={vi.fn()}
      onEnterEvent={vi.fn()}
      onOpenScheduledCareerMatch={vi.fn()}
      onStartManagedMatch={vi.fn()}
      onContinueAfterPostMatch={vi.fn()}
      onCommissionScoutReport={vi.fn()}
      onMakeRecruitmentOffer={vi.fn()}
      onTrainRosterAthlete={vi.fn()}
      onEnterRosterAthleteLowerEvent={vi.fn()}
      onDevelopYouthProspect={vi.fn()}
      onEnterYouthLowerEvent={vi.fn()}
      onHireStaffMember={vi.fn()}
      onSetManagedAthletePromise={vi.fn()}
      onWithdrawPromise={vi.fn()}
      onAdvanceRivalCircuit={vi.fn()}
      onUpgradeFacility={vi.fn()}
      onResolveMediaObjectives={vi.fn()}
      onUpdateAdvancedTacticPlan={vi.fn()}
      onRefreshAssistantAdvice={vi.fn()}
      onApplyAssistantAdvice={vi.fn()}
      onOverrideAssistantAdvice={vi.fn()}
      {...overrides}
    />
  );
}

describe("career shell daily action", () => {
  it("shows a red topbar action for a due scheduled match and opens it without advancing the date", () => {
    const { career, event } = careerEnteredOnMetroStart();
    resetStoreForCareer(career);

    render(<App />);

    const playButton = screen.getByRole("button", { name: `Play ${event.name} R16` });
    expect(playButton).toHaveAttribute("data-tone", "required");

    fireEvent.click(playButton);

    const afterOpen = useTournamentStore.getState();
    expect(afterOpen.career?.date).toBe(event.startDate);
    expect(afterOpen.career?.stage).toBe("pre_match");
    expect(afterOpen.tournament?.id).toBe(event.id);
    expect(screen.getByRole("heading", { name: "Opponent Briefing" })).toBeInTheDocument();
  });

  it("shows a green topbar action and advances exactly one day when no daily blocker remains", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9903);
    resetStoreForCareer(career);

    render(<App />);

    const advanceButton = screen.getByRole("button", { name: "Advance Day" });
    expect(advanceButton).toHaveAttribute("data-tone", "ready");

    fireEvent.click(advanceButton);

    expect(useTournamentStore.getState().career?.date).toBe(addDays(career.date, 1));
  });
});

describe("career calendar event actions", () => {
  it("keeps an entered due event playable from the calendar row", () => {
    const { career, event } = careerEnteredOnMetroStart();
    const onOpenScheduledCareerMatch = vi.fn();

    renderCalendarPage({ career, onOpenScheduledCareerMatch });

    const playButton = screen.getByRole("button", { name: `Play ${event.name} R16` });
    expect(playButton).toBeEnabled();

    fireEvent.click(playButton);

    expect(onOpenScheduledCareerMatch).toHaveBeenCalledWith(event.id);
  });
});
