import { fireEvent, render, screen, within } from "@testing-library/react";
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
      onOpenEventDetails={vi.fn()}
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
  it("renders a clean standalone start screen before any save or run exists", () => {
    installWindowStorage();
    useTournamentStore.setState({
      phase: "setup",
      selectedPlayerId: seededPlayers[0].player.id,
      plannedTacticKey: "balancedControl",
      seed: 9900,
      tournament: null,
      liveMatch: null,
      career: null,
      saveRecovery: null,
      activeSavePresent: false,
      corruptSavePresent: false
    });

    render(<App />);

    expect(screen.getByRole("heading", { name: "Badminton Manager" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("Launch mode");
    expect(screen.queryByRole("navigation", { name: "Primary commands" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resize sidebar" })).not.toBeInTheDocument();
  });

  it("removes lower context, tactic, and athlete blocks from the loaded career sidebar", () => {
    resetStoreForCareer();

    render(<App />);

    const sidebar = screen.getByRole("complementary", { name: "Primary command sidebar" });
    expect(within(sidebar).queryByText("Active Command")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Tactic")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Managed Athlete")).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Go Live" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

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

  it("pages upcoming events five at a time", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9910);
    const { container } = renderCalendarPage({ career });
    const schedule = screen.getByLabelText("Upcoming event schedule");

    expect(container.querySelectorAll(".calendar-event-table[aria-label='Upcoming event schedule'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(5);
    expect(within(schedule).getByText("Metro Open")).toBeInTheDocument();
    expect(within(schedule).queryByText("Academy Select Invitational")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(within(screen.getByLabelText("Upcoming event schedule")).getByText("Academy Select Invitational")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("opens entered event details instead of no-oping back to Calendar", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9911);
    const harbor = getCareerEvent(baseCareer.events, "harbor-masters-500")!;
    const onOpenEventDetails = vi.fn();
    const career = {
      ...baseCareer,
      date: "2026-06-07",
      activeEventId: null,
      enteredEventIds: [harbor.id],
      stage: "event_entered" as const
    };

    renderCalendarPage({ career, onOpenEventDetails });

    fireEvent.click(screen.getByRole("button", { name: "View Entry" }));

    expect(onOpenEventDetails).toHaveBeenCalledWith(harbor.id);
  });

  it("renders real paged past-event records", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9912);
    const career = {
      ...baseCareer,
      eventHistory: baseCareer.events.slice(0, 6).map((event, index) => ({
        eventId: event.id,
        eventName: event.name,
        tier: event.tier,
        startDate: event.startDate,
        endDate: addDays(event.startDate, event.durationDays - 1),
        status: "missed_deadline" as const,
        entered: false,
        resultRound: null,
        pointsAwarded: index,
        prizeMoney: index * 100,
        entryCost: 10,
        travelCost: 20,
        netCash: index * 100 - 30,
        completedAt: addDays(event.startDate, event.durationDays + index),
        matchIds: [],
        scorelines: index === 0 ? ["21-18, 21-19"] : [],
        achievements: index === 0 ? ["Points Finish"] : []
      }))
    };
    const { container } = renderCalendarPage({ career });

    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));

    expect(container.querySelectorAll(".calendar-event-table[aria-label='Past event records'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(5);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".calendar-event-table[aria-label='Past event records'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(1);
  });
});
