import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App, commandIdForPage, pageForRuntime } from "../../app/App";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import {
  CareerCalendarPage,
  CareerHomePage,
  CareerRankingsPage,
  CareerTimelinePage,
  CareerTrainingPage,
  CareerTournamentHomePage
} from "../../components/CareerWorkbench";
import { addDays } from "../../game/career/calendar";
import { buildAdvanceDayForecast } from "../../game/career/dayResolution";
import {
  appendCompletedTournamentMatchRecords,
  eventEndDate,
  getCareerEvent,
  tournamentMatchArchiveIds,
  tournamentMatchArchiveScorelines
} from "../../game/career/events";
import type { CareerState, ScoutAssignment } from "../../game/career/models";
import { appendRankingResultsAndRebuild, createRankingResult } from "../../game/career/rankings";
import { previewPreparationPlan, schedulePreparationBlock } from "../../game/career/preparation";
import { createInitialCareerState } from "../../game/career/state";
import { trainingPlans } from "../../game/career/training";
import { simulateUniverseThroughDate } from "../../game/career/universe";
import { playerMap, seededPlayers } from "../../game/content/players";
import type { MatchResult, Side } from "../../game/core/models";
import { useTournamentStore } from "../../game/store/store";
import { advanceTournament, createTournament, getManagedMatchContext } from "../../game/tournament/tournament";

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

function unifiedScheduleUiFixture(seed = 9930) {
  const initial = createInitialCareerState(seededPlayers[0].player.id, seed);
  const event = getCareerEvent(initial.events, "metro-open-300")!;
  const date = addDays(event.startDate, -1);
  const plan = trainingPlans.find((entry) => entry.id === "pressure-patterns")!;
  const assignment: ScoutAssignment = {
    id: "assignment-ui-schedule",
    subjectId: initial.ecosystem.recruitment.candidates[0]!.id,
    subjectType: "candidate",
    assignedScoutId: "baseline-network",
    cost: 3_200,
    startedAt: initial.date,
    dueAt: date,
    status: "pending",
    scope: "fit"
  };
  const staged: CareerState = {
    ...initial,
    date,
    activeEventId: event.id,
    enteredEventIds: [event.id],
    stage: "event_entered",
    athletes: initial.athletes.map((athlete) =>
      athlete.playerId === initial.program.managedPlayerId
        ? {
            ...athlete,
            recoveryStatus: "injured",
            injury: {
              status: "managed",
              label: "Shoulder load",
              daysRemaining: 0,
              triggeredAt: initial.date,
              returnDate: date,
              notes: ["Medical team monitoring the return."]
            }
          }
        : athlete
    ),
    ecosystem: {
      ...initial.ecosystem,
      scouting: {
        ...initial.ecosystem.scouting,
        assignments: [assignment]
      }
    },
    facilities: initial.facilities.map((facility, index) =>
      index === 0
        ? {
            ...facility,
            level: 1,
            status: "building",
            buildCompleteDate: date
          }
        : facility
    )
  };
  const career = schedulePreparationBlock({ state: staged, plan });
  const tournament = {
    ...createTournament(seededPlayers, career.program.managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier
  };

  return { assignment, career, date, event, plan, tournament };
}

function forcedUiResult(winner: Side): MatchResult {
  return {
    winner,
    setsWonA: winner === "A" ? 2 : 0,
    setsWonB: winner === "B" ? 2 : 0,
    setSummaries: [
      {
        winner,
        scoreA: winner === "A" ? 21 : 13,
        scoreB: winner === "B" ? 21 : 13,
        points: []
      },
      {
        winner,
        scoreA: winner === "A" ? 21 : 15,
        scoreB: winner === "B" ? 21 : 15,
        points: []
      }
    ],
    stats: {
      winnersA: winner === "A" ? 20 : 10,
      winnersB: winner === "B" ? 20 : 10,
      unforcedErrorsA: winner === "A" ? 8 : 18,
      unforcedErrorsB: winner === "B" ? 8 : 18,
      totalSmashesA: 14,
      totalSmashesB: 13,
      peakSmashSpeedA: 386,
      peakSmashSpeedB: 379,
      staminaDrainA: 8,
      staminaDrainB: 10,
      longestRally: 24,
      totalPoints: 70
    },
    scoreline: winner === "A" ? "21-13, 21-15" : "13-21, 15-21",
    fidelity: "detailed",
    summaryEvents: [
      {
        kind: "straight_games",
        side: winner,
        title: "Forced UI test result",
        detail: "Unit test supplies the managed result so archive presentation stays deterministic."
      }
    ]
  };
}

function renderCalendarPage(overrides: Partial<Parameters<typeof CareerCalendarPage>[0]> = {}) {
  const { career } = careerEnteredOnMetroStart();
  const onOpenTournamentHome = overrides.onOpenTournamentHome ?? vi.fn();

  return render(
    <TournamentNavigationProvider onOpenTournamentHome={onOpenTournamentHome}>
      <CareerCalendarPage
        career={career}
        tournament={null}
        saveRecovery={null}
        activeSavePresent={true}
        corruptSavePresent={false}
        onStartCareer={vi.fn()}
        onOpenTraining={vi.fn()}
        onOpenCalendar={vi.fn()}
        onOpenTimeline={vi.fn()}
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
        onOpenManagementDestination={vi.fn()}
        onApplyTraining={vi.fn()}
        onEnterEvent={vi.fn()}
        onOpenScheduledCareerMatch={vi.fn()}
        onStartManagedMatch={vi.fn()}
        onContinueAfterPostMatch={vi.fn()}
        onCommissionScoutReport={vi.fn()}
        onMakeRecruitmentOffer={vi.fn()}
        onScheduleRosterPreparation={vi.fn()}
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
        onOpenTournamentHome={onOpenTournamentHome}
      />
    </TournamentNavigationProvider>
  );
}

function renderTimelinePage(overrides: Partial<Parameters<typeof CareerTimelinePage>[0]> = {}) {
  const { career } = careerEnteredOnMetroStart();
  const onOpenTournamentHome = overrides.onOpenTournamentHome ?? vi.fn();

  return render(
    <TournamentNavigationProvider onOpenTournamentHome={onOpenTournamentHome}>
      <CareerTimelinePage
        career={career}
        tournament={null}
        saveRecovery={null}
        activeSavePresent={true}
        corruptSavePresent={false}
        onStartCareer={vi.fn()}
        onOpenTraining={vi.fn()}
        onOpenCalendar={vi.fn()}
        onOpenTimeline={vi.fn()}
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
        onOpenManagementDestination={vi.fn()}
        onApplyTraining={vi.fn()}
        onEnterEvent={vi.fn()}
        onOpenScheduledCareerMatch={vi.fn()}
        onStartManagedMatch={vi.fn()}
        onContinueAfterPostMatch={vi.fn()}
        onCommissionScoutReport={vi.fn()}
        onMakeRecruitmentOffer={vi.fn()}
        onScheduleRosterPreparation={vi.fn()}
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
        onOpenTournamentHome={onOpenTournamentHome}
      />
    </TournamentNavigationProvider>
  );
}

function renderHomePage(overrides: Partial<Parameters<typeof CareerHomePage>[0]> = {}) {
  const career = createInitialCareerState(seededPlayers[0].player.id, 9919);
  const onOpenTournamentHome = overrides.onOpenTournamentHome ?? vi.fn();

  return render(
    <TournamentNavigationProvider onOpenTournamentHome={onOpenTournamentHome}>
      <CareerHomePage
        career={career}
        tournament={null}
        saveRecovery={null}
        activeSavePresent={true}
        corruptSavePresent={false}
        onStartCareer={vi.fn()}
        onOpenTraining={vi.fn()}
        onOpenCalendar={vi.fn()}
        onOpenTimeline={vi.fn()}
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
        onOpenManagementDestination={vi.fn()}
        onApplyTraining={vi.fn()}
        onEnterEvent={vi.fn()}
        onOpenScheduledCareerMatch={vi.fn()}
        onStartManagedMatch={vi.fn()}
        onContinueAfterPostMatch={vi.fn()}
        onCommissionScoutReport={vi.fn()}
        onMakeRecruitmentOffer={vi.fn()}
        onScheduleRosterPreparation={vi.fn()}
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
        onOpenTournamentHome={onOpenTournamentHome}
      />
    </TournamentNavigationProvider>
  );
}

function renderTrainingPage(overrides: Partial<Parameters<typeof CareerTrainingPage>[0]> = {}) {
  const career = overrides.career ?? createInitialCareerState(seededPlayers[0].player.id, 9921);
  const advanceDayForecast = overrides.advanceDayForecast ?? buildAdvanceDayForecast({
    career,
    tournament: overrides.tournament ?? null,
    phase: "overview",
    liveMatchActive: false
  });

  return render(
    <CareerTrainingPage
      career={career}
      tournament={null}
      saveRecovery={null}
      activeSavePresent={true}
      corruptSavePresent={false}
      onStartCareer={vi.fn()}
      onOpenTraining={vi.fn()}
      onOpenCalendar={vi.fn()}
      onOpenTimeline={vi.fn()}
      onOpenTournamentHome={vi.fn()}
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
      onOpenManagementDestination={vi.fn()}
      onApplyTraining={vi.fn()}
      onEnterEvent={vi.fn()}
      onOpenScheduledCareerMatch={vi.fn()}
      onStartManagedMatch={vi.fn()}
      onContinueAfterPostMatch={vi.fn()}
      onCommissionScoutReport={vi.fn()}
      onMakeRecruitmentOffer={vi.fn()}
      onScheduleRosterPreparation={vi.fn()}
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
      advanceDayForecast={advanceDayForecast}
    />
  );
}

function renderRankingsPage(overrides: Partial<Parameters<typeof CareerRankingsPage>[0]> = {}) {
  const career = createInitialCareerState(seededPlayers[0].player.id, 9913);

  return render(
    <CareerRankingsPage
      career={career}
      tournament={null}
      saveRecovery={null}
      activeSavePresent={true}
      corruptSavePresent={false}
      onStartCareer={vi.fn()}
      onOpenTraining={vi.fn()}
      onOpenCalendar={vi.fn()}
      onOpenTimeline={vi.fn()}
      onOpenTournamentHome={vi.fn()}
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
      onOpenManagementDestination={vi.fn()}
      onApplyTraining={vi.fn()}
      onEnterEvent={vi.fn()}
      onOpenScheduledCareerMatch={vi.fn()}
      onStartManagedMatch={vi.fn()}
      onContinueAfterPostMatch={vi.fn()}
      onCommissionScoutReport={vi.fn()}
      onMakeRecruitmentOffer={vi.fn()}
      onScheduleRosterPreparation={vi.fn()}
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

function renderTournamentHomePage(
  overrides: Partial<Parameters<typeof CareerTournamentHomePage>[0]> & {
    career: Parameters<typeof CareerTournamentHomePage>[0]["career"];
    eventId: string;
  }
) {
  const { career, eventId, ...rest } = overrides;

  return render(
    <CareerTournamentHomePage
      seasonId={career?.seasonId ?? "season-2026"}
      eventId={eventId}
      career={career}
      tournament={null}
      saveRecovery={null}
      activeSavePresent={true}
      corruptSavePresent={false}
      onStartCareer={vi.fn()}
      onOpenTraining={vi.fn()}
      onOpenCalendar={vi.fn()}
      onOpenTimeline={vi.fn()}
      onOpenTournamentHome={vi.fn()}
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
      onOpenManagementDestination={vi.fn()}
      onApplyTraining={vi.fn()}
      onEnterEvent={vi.fn()}
      onOpenScheduledCareerMatch={vi.fn()}
      onStartManagedMatch={vi.fn()}
      onContinueAfterPostMatch={vi.fn()}
      onCommissionScoutReport={vi.fn()}
      onMakeRecruitmentOffer={vi.fn()}
      onScheduleRosterPreparation={vi.fn()}
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
      {...rest}
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

  it("removes duplicated identity, lower context, tactic, and athlete blocks from the loaded career sidebar", () => {
    resetStoreForCareer();

    render(<App />);

    const sidebar = screen.getByRole("complementary", { name: "Primary command sidebar" });
    expect(within(sidebar).queryByText("BM")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Command Rail")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Local-first career shell")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Active Command")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Tactic")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Managed Athlete")).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: "Go Live" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("orders the command rail as pure navigation through schedule shortcuts and the match path", () => {
    resetStoreForCareer();

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    const labels = within(commandRail)
      .getAllByRole("button")
      .map((button) => button.querySelector("span")?.textContent ?? "");

    expect(labels).toEqual([
      "Portal",
      "Timeline",
      "Calendar",
      "Inbox",
      "Squad",
      "Training",
      "Tactics",
      "Rankings",
      "Live Match",
      "Reports",
      "Scouting",
      "Staff",
      "Facilities",
      "Save Manager",
      "Settings"
    ]);
    expect(labels).not.toContain("Competitions");
    expect(commandIdForPage({ id: "bracket" })).toBe("live");
    expect(commandIdForPage({ id: "timeline" })).toBe("timeline");
    expect(commandIdForPage({ id: "calendar" })).toBe("calendar");
    expect(commandIdForPage({ id: "inbox" })).toBe("inbox");
    expect(commandIdForPage({ id: "reports" })).toBe("reports");
    expect(within(commandRail).getByRole("button", { name: /^Inbox:/ })).toBeEnabled();
    expect(within(commandRail).getByRole("button", { name: /^Reports:/ })).toBeEnabled();
  });

  it("routes Inbox and read-only Reports without mutating the planning career", () => {
    resetStoreForCareer();
    const before = useTournamentStore.getState().career;

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    fireEvent.click(within(commandRail).getByRole("button", { name: /^Inbox:/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Actionable Career Desk" })).toBeInTheDocument();
    expect(screen.getByLabelText("Career inbox items")).toBeInTheDocument();

    fireEvent.click(within(commandRail).getByRole("button", { name: /^Reports:/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Institutional Memory" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Persisted Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue|Close Event/ })).not.toBeInTheDocument();
    expect(useTournamentStore.getState().career).toBe(before);
  });

  it("derives a career-safe fallback page without trusting the setup phase", () => {
    const planning = createInitialCareerState(seededPlayers[0].player.id, 9001);

    expect(pageForRuntime(planning, "setup")).toEqual({ id: "home" });
    expect(pageForRuntime({ ...planning, stage: "pre_match" }, "setup")).toEqual({ id: "bracket" });
    expect(pageForRuntime({ ...planning, stage: "post_match" }, "setup")).toEqual({ id: "review" });
    expect(pageForRuntime(null, "overview")).toEqual({ id: "bracket" });
  });

  it("orders the Portal Home as a decision center and demotes healthy save and ledger noise", () => {
    renderHomePage();

    const portal = screen.getByLabelText("Portal Home");
    const panelHeadings = within(portal)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(panelHeadings).toEqual([
      "Next Decision",
      "Advance Day Forecast",
      "Player Condition",
      "Urgent Tasks",
      "Calendar Snapshot",
      "Ranking Pressure",
      "Recent Match Evidence",
      "Finance Summary",
      "Program Ecosystem"
    ]);
    expect(within(portal).queryByText("Save state")).not.toBeInTheDocument();
    expect(within(portal).queryByRole("heading", { name: "Ledger" })).not.toBeInTheDocument();
    expect(within(portal).getByRole("heading", { name: "Finance Summary" })).toBeInTheDocument();
  });

  it("renders consequence-first next-decision fields with a direct event-entry action", () => {
    const onEnterEvent = vi.fn();

    renderHomePage({ onEnterEvent });

    const decision = screen.getByLabelText("Next Decision");
    expect(decision).toHaveTextContent("Action");
    expect(decision).toHaveTextContent("Enter Event");
    expect(decision).toHaveTextContent("Reward");
    expect(decision).toHaveTextContent("+700 pts");
    expect(decision).toHaveTextContent("$15,000");
    expect(decision).toHaveTextContent("Cost");
    expect(decision).toHaveTextContent("-$3,550");
    expect(decision).toHaveTextContent("Risk");
    expect(decision).toHaveTextContent(/Projected condition/i);
    expect(decision).toHaveTextContent("Deadline");
    expect(decision).toHaveTextContent("2026-06-01");
    expect(decision).toHaveTextContent("Recommendation");

    fireEvent.click(within(decision).getByRole("button", { name: "Enter Event" }));

    expect(onEnterEvent).toHaveBeenCalledWith("metro-open-300");
  });

  it("schedules or clears one current-day block and renders the exact preparation preview", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9922);
    const plan = trainingPlans.find((entry) => entry.id === "rear-court-power")!;
    const career = schedulePreparationBlock({ state: baseCareer, plan });
    const forecast = buildAdvanceDayForecast({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });
    const preview = previewPreparationPlan({ state: career, plan });
    const onApplyTraining = vi.fn();
    const format = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);

    renderTrainingPage({ career, advanceDayForecast: forecast, onApplyTraining });

    const status = screen.getByLabelText("Training status");
    expect(status).toHaveTextContent(plan.label);
    expect(status).toHaveTextContent(career.date);
    expect(status).toHaveTextContent(`$${plan.cost.toLocaleString()}`);
    expect(status).toHaveTextContent(forecast.targetDate);

    const scheduledCard = screen.getByRole("button", { name: new RegExp(plan.label) });
    expect(scheduledCard).toHaveAttribute("aria-pressed", "true");
    expect(scheduledCard).toHaveTextContent(`Scheduled for ${career.date}`);

    const smashProjection = screen.getByLabelText("Smash projection");
    expect(smashProjection).toHaveTextContent(
      `${format(preview.before.development.smash)} → ${format(preview.after.development.smash)}`
    );
    expect(screen.getByLabelText("Preparation block preview")).toHaveTextContent(`Exact cost$${plan.cost.toLocaleString()}`);

    fireEvent.click(screen.getByRole("button", { name: /Rally Base/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Block" }));

    expect(onApplyTraining).toHaveBeenNthCalledWith(1, "rally-base");
    expect(onApplyTraining).toHaveBeenNthCalledWith(2, null);
  });

  it("disables preparation scheduling and explains the required action when advance is unavailable", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9923);
    const career = { ...baseCareer, stage: "post_match" as const };
    const forecast = buildAdvanceDayForecast({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });

    renderTrainingPage({ career, advanceDayForecast: forecast });

    expect(screen.getByLabelText("Training scheduling blocked")).toHaveTextContent(
      "The latest managed match needs post-match review."
    );
    expect(screen.getByRole("button", { name: /Rear-Court Power/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Mobility Recovery/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear Block" })).toBeDisabled();
  });

  it("renders the exact advance-day forecast and next due item on Portal", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9924);
    const targetDate = addDays(baseCareer.date, 1);
    const facility = baseCareer.facilities[0]!;
    const careerWithBuild = {
      ...baseCareer,
      facilities: baseCareer.facilities.map((entry, index) =>
        index === 0
          ? { ...entry, level: 1, status: "building" as const, buildCompleteDate: targetDate }
          : entry
      )
    };
    const plan = trainingPlans.find((entry) => entry.id === "pressure-patterns")!;
    const career = schedulePreparationBlock({ state: careerWithBuild, plan });
    const forecast = buildAdvanceDayForecast({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });
    const signed = (value: number, suffix = "") => {
      const normalized = Math.abs(value) < 0.000_1 ? 0 : value;
      const label = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(normalized);
      return `${normalized > 0 ? "+" : ""}${label}${suffix}`;
    };

    renderHomePage({ career, advanceDayForecast: forecast });

    const panel = screen.getByLabelText("Advance Day Forecast");
    expect(panel).toHaveTextContent(forecast.targetDate);
    expect(panel).toHaveTextContent(plan.label);
    expect(panel).toHaveTextContent(
      `${forecast.cashDelta >= 0 ? "+" : "-"}$${Math.abs(forecast.cashDelta).toLocaleString()}`
    );
    const deltas = within(panel).getByLabelText("Forecast condition and development deltas");
    expect(deltas).toHaveTextContent(`Readiness${signed(forecast.readinessDelta)}`);
    expect(deltas).toHaveTextContent(`Fatigue${signed(forecast.fatigueDelta)}`);
    expect(deltas).toHaveTextContent(`Injury Risk${signed(forecast.injuryRiskDelta * 100, " pts")}`);
    expect(deltas).toHaveTextContent(`Smash${signed(forecast.developmentDelta.smash)}`);
    expect(deltas).toHaveTextContent(`Stamina${signed(forecast.developmentDelta.stamina)}`);
    expect(deltas).toHaveTextContent(`Composure${signed(forecast.developmentDelta.composure)}`);
    expect(deltas).toHaveTextContent(`Recovery${signed(forecast.developmentDelta.recovery)}`);
    expect(within(panel).getByLabelText("Next due item")).toHaveTextContent(
      `${facility.label} construction completes`
    );
  });

  it("renders the blocking action instead of fabricated Portal deltas", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9925);
    const career = { ...baseCareer, stage: "post_match" as const };
    const forecast = buildAdvanceDayForecast({
      career,
      tournament: null,
      phase: "overview",
      liveMatchActive: false
    });

    renderHomePage({ career, advanceDayForecast: forecast });

    const panel = screen.getByLabelText("Advance Day Forecast");
    expect(panel).toHaveTextContent("Review Match");
    expect(panel).toHaveTextContent("The latest managed match needs post-match review.");
    expect(within(panel).queryByLabelText("Forecast condition and development deltas")).not.toBeInTheDocument();
  });

  it("shows preparation only on its persisted date and ignores a legacy selected-plan hint", () => {
    const baseCareer = {
      ...createInitialCareerState(seededPlayers[0].player.id, 9920),
      date: "2026-06-05",
      selectedTrainingPlanId: "physio-recovery"
    };
    const legacyView = renderHomePage({ career: baseCareer });
    const legacySnapshot = screen.getByLabelText("Portal calendar snapshot");

    expect(within(legacySnapshot).queryByText("Training")).not.toBeInTheDocument();
    expect(within(legacySnapshot).queryByText("Mobility Recovery")).not.toBeInTheDocument();
    expect(within(legacySnapshot).getAllByText("Open").length).toBeGreaterThan(0);

    legacyView.unmount();

    const plan = trainingPlans.find((entry) => entry.id === "pressure-patterns")!;
    const career = schedulePreparationBlock({ state: baseCareer, plan });
    const onOpenTraining = vi.fn();

    renderHomePage({ career, onOpenTraining });

    const snapshot = screen.getByLabelText("Portal calendar snapshot");
    const planLabel = within(snapshot).getByText(new RegExp(`${plan.label}$`));
    const scheduledDay = planLabel.closest(".career-day") as HTMLElement;

    expect(within(snapshot).getAllByText(new RegExp(`${plan.label}$`))).toHaveLength(1);
    expect(scheduledDay).toHaveTextContent("06-05");
    expect(scheduledDay).toHaveTextContent("Training");
    expect(scheduledDay).toHaveTextContent("Due");

    fireEvent.click(within(scheduledDay).getByRole("button", {
      name: new RegExp(`^Open training: .*${plan.label}, Training, Due, ${career.date}$`)
    }));

    expect(onOpenTraining).toHaveBeenCalledTimes(1);
  });

  it("shows a deterministic primary Portal commitment and opens Calendar for same-day overflow", () => {
    const { career, date } = unifiedScheduleUiFixture(9931);
    const onOpenCalendar = vi.fn();

    renderHomePage({ career, onOpenCalendar });

    const snapshot = screen.getByLabelText("Portal calendar snapshot");
    const overflow = within(snapshot).getByRole("button", {
      name: `+5 more on ${date}; open Calendar`
    });
    const scheduledDay = overflow.closest(".career-day") as HTMLElement;

    expect(scheduledDay).toHaveTextContent(date.slice(5));
    expect(scheduledDay).toHaveTextContent("Metro Open · Draw published");
    expect(scheduledDay).toHaveTextContent("Event");
    expect(scheduledDay).toHaveTextContent("Due");
    expect(overflow).toHaveTextContent("+5 more");

    fireEvent.click(overflow);

    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
  });

  it("opens the standalone Calendar from the real Portal overflow route", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9932);
    const plan = trainingPlans.find((entry) => entry.id === "rally-base")!;
    const career = schedulePreparationBlock({ state: baseCareer, plan });
    resetStoreForCareer(career);

    render(<App />);

    const snapshot = screen.getByLabelText("Portal calendar snapshot");
    fireEvent.click(within(snapshot).getByRole("button", { name: /\+1 more .* open Calendar/i }));

    expect(screen.getByRole("heading", { level: 1, name: "Calendar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Timeline" })).not.toBeInTheDocument();
  });

  it("surfaces save state in the Portal inbox only when the local slot needs attention", () => {
    renderHomePage({ activeSavePresent: false, corruptSavePresent: true });

    const inbox = screen.getByLabelText("Portal tasks inbox");
    expect(inbox).toHaveTextContent("Save issue");
    expect(inbox).toHaveTextContent("Review Save Manager");
  });

  it("routes Timeline and Calendar sidebar shortcuts into standalone pages", () => {
    resetStoreForCareer();

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    const timelineCommand = within(commandRail).getByRole("button", { name: /Timeline/ });
    const calendarCommand = within(commandRail).getByRole("button", { name: /Calendar/ });

    fireEvent.click(timelineCommand);

    expect(screen.getByRole("heading", { level: 1, name: "Timeline" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Schedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Calendar for June 2026")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Upcoming", "Past Events"]);
    expect(screen.getByRole("tab", { name: "Upcoming" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Past Events" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Event Brief" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Week Strip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Milestones & Seeding" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eligibility & Costs" })).not.toBeInTheDocument();
    expect(timelineCommand).toHaveAttribute("aria-current", "page");

    fireEvent.click(calendarCommand);

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Schedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Calendar for June 2026" })).toBeInTheDocument();
    expect(calendarCommand).toHaveAttribute("aria-current", "page");
  });

  it("keeps Timeline-labelled page actions separate from Calendar navigation", () => {
    resetStoreForCareer();

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    fireEvent.click(within(commandRail).getByRole("button", { name: /Rankings/ }));

    expect(screen.getByRole("heading", { level: 1, name: "Circuit Rankings" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Timeline" }));

    expect(screen.getByRole("heading", { level: 1, name: "Timeline" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Calendar" })).not.toBeInTheDocument();
  });

  it("renders the career topbar as identity, utility controls, and the right-edge career clock", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9904);
    resetStoreForCareer(career);

    render(<App />);

    const banner = screen.getByRole("banner");
    const managedAthlete = within(banner).getByLabelText("Managed athlete");
    const utilityControls = within(banner).getByLabelText("Career utility controls");
    const dailyCluster = within(banner).getByLabelText("Career clock control");
    const careerSave = within(utilityControls).getByRole("button", { name: "Career Save" });
    const settings = within(utilityControls).getByRole("button", { name: "Settings" });
    const mobileNavigationToggle = within(banner).getByRole("button", { name: "Open navigation menu" });
    const brandMark = banner.querySelector(".brand-mark");
    const brandLockup = banner.querySelector(".brand-lockup");
    const commandSearch = banner.querySelector(".command-search");
    const date = banner.querySelector(".topbar-date");
    const dailyAction = within(dailyCluster).getByRole("button", { name: "Advance Day" });

    expect(brandMark).not.toBeNull();
    expect(brandLockup).not.toBeNull();
    expect(commandSearch).not.toBeNull();
    expect(date).not.toBeNull();
    expect(brandLockup).toHaveTextContent("Badminton Manager");
    expect(brandLockup).toHaveTextContent("Coach OS");
    expect(managedAthlete).toHaveTextContent(seededPlayers[0].player.name);
    expect(brandMark?.nextElementSibling).toBe(brandLockup);
    expect(brandLockup?.nextElementSibling).toBe(mobileNavigationToggle);
    expect(managedAthlete.previousElementSibling).toBe(mobileNavigationToggle);
    expect(managedAthlete.nextElementSibling).toBe(commandSearch);
    expect(careerSave.nextElementSibling).toBe(settings);
    expect(date?.nextElementSibling).toBe(dailyAction);
    expect(careerSave.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(settings.compareDocumentPosition(date!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(date!.compareDocumentPosition(dailyAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(banner).queryByRole("button", { name: "Intel" })).not.toBeInTheDocument();
  });

  it("keeps topbar save management and settings overlay access working", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9905);
    resetStoreForCareer(career);

    render(<App />);

    const banner = screen.getByRole("banner");
    fireEvent.click(within(banner).getByRole("button", { name: "Career Save" }));

    expect(screen.getByRole("heading", { level: 1, name: "Local Career Library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Manager: Active slot online/ })).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(banner).getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("dialog", { name: "Console Preferences" })).toBeInTheDocument();
  });

  it("routes the Live Match command into a due career opponent briefing", () => {
    const { career, event } = careerEnteredOnMetroStart();
    resetStoreForCareer(career);

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    fireEvent.click(within(commandRail).getByRole("button", { name: /Live Match/ }));

    const afterOpen = useTournamentStore.getState();
    expect(afterOpen.career?.date).toBe(event.startDate);
    expect(afterOpen.career?.stage).toBe("pre_match");
    expect(afterOpen.tournament?.id).toBe(event.id);
    expect(screen.getByRole("heading", { name: "Opponent Briefing" })).toBeInTheDocument();
    expect(within(commandRail).getByRole("button", { name: /Live Match/ })).toHaveAttribute("aria-current", "page");
  });

  it("routes the Live Match command to match planning when no match is due", () => {
    resetStoreForCareer();

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    fireEvent.click(within(commandRail).getByRole("button", { name: /Live Match/ }));

    expect(screen.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeInTheDocument();
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

  it("opens a career Rankings page from the command rail with addressable managed-player rows", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9914);
    const managedPlayerId = baseCareer.program.managedPlayerId;
    const career = {
      ...baseCareer,
      rankings: baseCareer.rankings.map((entry) =>
        entry.playerId === managedPlayerId
          ? { ...entry, rank: 1 }
          : { ...entry, rank: entry.rank + 1 }
      )
    };
    resetStoreForCareer(career);

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    const rankingsCommand = within(commandRail).getByRole("button", { name: "Rankings: Circuit table" });

    expect(rankingsCommand).toBeInTheDocument();
    fireEvent.click(rankingsCommand);

    expect(screen.getByRole("heading", { name: "Circuit Rankings" })).toBeInTheDocument();
    expect(rankingsCommand).toHaveAttribute("aria-current", "page");

    const table = screen.getByRole("table", { name: "Circuit rankings table" });
    const rows = within(table).getAllByRole("row");
    const firstDataRow = rows[1]!;
    const managedRanking = career.rankings.find((entry) => entry.playerId === managedPlayerId)!;
    const managedName = playerMap[managedPlayerId].name;

    expect(within(firstDataRow).getByText("#1")).toBeInTheDocument();
    expect(within(firstDataRow).getByRole("button", { name: managedName })).toBeInTheDocument();
    expect(within(firstDataRow).getByText("Managed athlete")).toBeInTheDocument();
    expect(within(firstDataRow).getByText(playerMap[managedPlayerId].nationality)).toBeInTheDocument();
    expect(within(firstDataRow).getByText(`${managedRanking.points.toLocaleString()} pts`)).toBeInTheDocument();
    expect(within(firstDataRow).getByText(`${managedRanking.seasonPoints.toLocaleString()} pts`)).toBeInTheDocument();

    fireEvent.click(within(firstDataRow).getByRole("button", { name: managedName }));

    expect(screen.getByRole("heading", { name: managedName })).toBeInTheDocument();
  });
});

describe("career rankings page", () => {
  it("shows a career-required state when no career is loaded", () => {
    renderRankingsPage({ career: null, activeSavePresent: false });

    expect(screen.getByRole("heading", { name: "Career Command Center" })).toBeInTheDocument();
    expect(screen.getByText("No Career Loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Career Save" })).toBeInTheDocument();
  });

  it("opens the Full Circuit Table on the first eight ranked athletes with clear paging state", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9915);
    const { container } = renderRankingsPage({ career });
    const table = screen.getByRole("table", { name: "Circuit rankings table" });
    const dataRows = within(table).getAllByRole("row").slice(1);

    expect(dataRows).toHaveLength(8);
    expect(within(dataRows[0]!).getByText("#1")).toBeInTheDocument();
    expect(within(dataRows[7]!).getByText("#8")).toBeInTheDocument();
    expect(within(table).queryByText("#9")).not.toBeInTheDocument();
    expect(screen.getByText(`1-8 of ${career.rankings.length}`)).toBeInTheDocument();

    const pagination = screen.getByLabelText("Rankings pagination");
    expect(within(pagination).getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(within(pagination).getByRole("button", { name: "Next" })).toBeEnabled();
    expect(container.querySelectorAll(".rankings-row:not(.rankings-row-head)")).toHaveLength(8);
  });

  it("moves the Full Circuit Table forward and backward by eight-rank windows", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9916);
    renderRankingsPage({ career });

    const pagination = screen.getByLabelText("Rankings pagination");
    fireEvent.click(within(pagination).getByRole("button", { name: "Next" }));

    const pageTwoTable = screen.getByRole("table", { name: "Circuit rankings table" });
    const pageTwoRows = within(pageTwoTable).getAllByRole("row").slice(1);
    const pageTwoLeader = [...career.rankings].sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId))[8]!;
    const pageTwoLeaderName = playerMap[pageTwoLeader.playerId].name;

    expect(pageTwoRows).toHaveLength(8);
    expect(within(pageTwoRows[0]!).getByText("#9")).toBeInTheDocument();
    expect(within(pageTwoRows[0]!).getByRole("button", { name: pageTwoLeaderName })).toBeInTheDocument();
    expect(screen.getByText(`9-16 of ${career.rankings.length}`)).toBeInTheDocument();
    expect(within(pagination).getByRole("button", { name: "Prev" })).toBeEnabled();

    fireEvent.click(within(pagination).getByRole("button", { name: "Prev" }));

    const pageOneRows = within(screen.getByRole("table", { name: "Circuit rankings table" })).getAllByRole("row").slice(1);
    expect(within(pageOneRows[0]!).getByText("#1")).toBeInTheDocument();
    expect(screen.getByText(`1-8 of ${career.rankings.length}`)).toBeInTheDocument();
  });

  it("labels the newest dated ranking result as latest after a rolling-ledger rebuild", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9924);
    const targetEntry = [...baseCareer.rankings].sort((left, right) => left.rank - right.rank)[0]!;
    const targetPlayer = playerMap[targetEntry.playerId];
    const olderEvent = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const newerEvent = getCareerEvent(baseCareer.events, "harbor-masters-500")!;
    const career = appendRankingResultsAndRebuild({
      career: baseCareer,
      results: [
        createRankingResult({
          seasonId: baseCareer.seasonId,
          playerId: targetEntry.playerId,
          eventId: olderEvent.id,
          eventName: olderEvent.name,
          tier: olderEvent.tier,
          date: olderEvent.startDate,
          resultRound: "QF",
          points: olderEvent.rankingPoints.QF,
          source: "played",
          artificial: false
        }),
        createRankingResult({
          seasonId: baseCareer.seasonId,
          playerId: targetEntry.playerId,
          eventId: newerEvent.id,
          eventName: newerEvent.name,
          tier: newerEvent.tier,
          date: newerEvent.startDate,
          resultRound: "champion",
          points: newerEvent.rankingPoints.champion,
          source: "played",
          artificial: false
        })
      ],
      asOfDate: newerEvent.startDate
    });

    renderRankingsPage({ career });

    const targetRow = screen.getByRole("row", { name: new RegExp(`Rank \\d+ ${targetPlayer.name}`, "i") });

    expect(within(targetRow).getByText(new RegExp(`Latest champion \\+${newerEvent.rankingPoints.champion.toLocaleString()} pts`))).toBeInTheDocument();
    expect(within(targetRow).queryByText(new RegExp(`Latest QF \\+${olderEvent.rankingPoints.QF.toLocaleString()} pts`))).not.toBeInTheDocument();
  });

  it("keeps the final rankings page reachable with Next disabled at the end", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9917);
    renderRankingsPage({ career });

    const pagination = screen.getByLabelText("Rankings pagination");
    const nextButton = within(pagination).getByRole("button", { name: "Next" });

    while (nextButton.hasAttribute("disabled") === false) {
      fireEvent.click(nextButton);
    }

    const finalTable = screen.getByRole("table", { name: "Circuit rankings table" });
    const finalRows = within(finalTable).getAllByRole("row").slice(1);

    expect(finalRows).toHaveLength(7);
    expect(within(finalRows[0]!).getByText("#41")).toBeInTheDocument();
    expect(within(finalRows[6]!).getByText("#47")).toBeInTheDocument();
    expect(screen.getByText(`41-47 of ${career.rankings.length}`)).toBeInTheDocument();
    expect(within(pagination).getByRole("button", { name: "Next" })).toBeDisabled();
    expect(within(pagination).getByRole("button", { name: "Prev" })).toBeEnabled();
  });

  it("only highlights the managed athlete when their ranked row is on the visible page", () => {
    const managedPageTwoPlayer = seededPlayers[8]!.player;
    const baseCareer = createInitialCareerState(managedPageTwoPlayer.id, 9918);
    const career = {
      ...baseCareer,
      rankings: baseCareer.rankings.map((entry) =>
        entry.playerId === managedPageTwoPlayer.id
          ? { ...entry, rank: 9 }
          : entry.rank >= 9
            ? { ...entry, rank: entry.rank + 1 }
            : entry
      )
    };
    renderRankingsPage({ career });

    const table = screen.getByRole("table", { name: "Circuit rankings table" });
    expect(within(table).queryByText("Managed athlete")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("Rankings pagination")).getByRole("button", { name: "Next" }));

    const managedRow = screen.getByRole("row", {
      name: new RegExp(`Rank 9 ${managedPageTwoPlayer.name} managed athlete`, "i")
    });
    expect(managedRow).toHaveClass("rankings-row-managed");
    expect(within(managedRow).getByText("Managed athlete")).toBeInTheDocument();
    expect(within(managedRow).getByRole("button", { name: managedPageTwoPlayer.name })).toBeInTheDocument();
  });
});

describe("career calendar event actions", () => {
  it("defaults Timeline to Upcoming and switches Past Events into view", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9917);
    const metro = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const career = {
      ...baseCareer,
      eventHistory: [
        {
          eventId: metro.id,
          eventName: metro.name,
          tier: metro.tier,
          startDate: metro.startDate,
          endDate: addDays(metro.startDate, metro.durationDays - 1),
          status: "missed_deadline" as const,
          entered: false,
          resultRound: null,
          pointsAwarded: 0,
          prizeMoney: 0,
          entryCost: 0,
          travelCost: 0,
          netCash: 0,
          completedAt: addDays(metro.startDate, metro.durationDays),
          matchIds: [],
          scorelines: [],
          achievements: []
        }
      ]
    };

    renderTimelinePage({ career });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Upcoming", "Past Events"]);
    expect(screen.getByRole("tab", { name: "Upcoming" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Past Events" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Past event records")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));

    expect(screen.getByRole("tab", { name: "Upcoming" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Past Events" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Upcoming event schedule")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Past event records")).getByText(metro.name)).toBeInTheDocument();
  });

  it("supports roving keyboard navigation across the Timeline tabs", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 99170);

    renderTimelinePage({ career });

    const upcoming = screen.getByRole("tab", { name: "Upcoming" });
    const pastEvents = screen.getByRole("tab", { name: "Past Events" });

    upcoming.focus();
    fireEvent.keyDown(upcoming, { key: "ArrowRight" });

    expect(pastEvents).toHaveFocus();
    expect(pastEvents).toHaveAttribute("aria-selected", "true");
    expect(pastEvents).toHaveAttribute("tabindex", "0");
    expect(upcoming).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(pastEvents, { key: "Home" });

    expect(upcoming).toHaveFocus();
    expect(upcoming).toHaveAttribute("aria-selected", "true");
  });

  it("renders generic Timeline commitments and routes every semantic destination", () => {
    const { assignment, career, event, plan, tournament } = unifiedScheduleUiFixture(9916);
    const matchContext = getManagedMatchContext(tournament)!;
    const opponentId = matchContext.playerAId === career.program.managedPlayerId
      ? matchContext.playerBId
      : matchContext.playerAId;
    const opponentName = playerMap[opponentId]!.name;
    const candidate = career.ecosystem.recruitment.candidates.find(
      (entry) => entry.id === assignment.subjectId
    )!;
    const facility = career.facilities[0]!;
    const athleteName = playerMap[career.program.managedPlayerId]!.name;
    const onOpenTournamentHome = vi.fn();
    const onOpenScheduledCareerMatch = vi.fn();
    const onOpenTraining = vi.fn();
    const onOpenScouting = vi.fn();
    const onOpenFacilities = vi.fn();
    const onOpenPlayerProfile = vi.fn();

    renderTimelinePage({
      career,
      tournament,
      onOpenTournamentHome,
      onOpenScheduledCareerMatch,
      onOpenTraining,
      onOpenScouting,
      onOpenFacilities,
      onOpenPlayerProfile
    });

    expect(screen.getByRole("heading", { level: 1, name: "Timeline" })).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: /Calendar for/ })).not.toBeInTheDocument();
    const commitments = screen.getByLabelText("Manager commitments");
    expect(screen.getByRole("heading", { name: "Manager Commitments" })).toBeInTheDocument();

    for (const category of ["Event", "Medical", "Travel", "Training", "Scouting", "Facility"]) {
      expect(within(commitments).getAllByText(category).length).toBeGreaterThan(0);
    }
    expect(within(commitments).getAllByText("Due").length).toBeGreaterThanOrEqual(6);
    expect(within(commitments).getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(within(commitments).getByText(new RegExp(`${plan.label}$`))).toBeInTheDocument();
    expect(within(commitments).getByText(`${athleteName} medical return`)).toBeInTheDocument();
    expect(within(commitments).getByText(`Scout report · ${candidate.name}`)).toBeInTheDocument();
    expect(within(commitments).getByText(`${facility.label} level ${facility.level} completion`)).toBeInTheDocument();

    fireEvent.click(within(commitments).getByRole("button", { name: new RegExp(`^Open event: ${event.name} R16,`) }));
    fireEvent.click(within(commitments).getByRole("button", { name: new RegExp(`^Open training: .*${plan.label},`) }));
    fireEvent.click(within(commitments).getByRole("button", { name: new RegExp(`^Open scouting: Scout report · ${candidate.name},`) }));
    fireEvent.click(within(commitments).getByRole("button", {
      name: new RegExp(`^Open facilities: ${facility.label} level ${facility.level} completion,`)
    }));
    fireEvent.click(within(commitments).getByRole("button", { name: new RegExp(`^Open event: ${event.name} travel,`) }));
    fireEvent.click(within(commitments).getByRole("button", { name: opponentName }));

    expect(onOpenScheduledCareerMatch).not.toHaveBeenCalled();
    expect(onOpenTraining).toHaveBeenCalledTimes(1);
    expect(onOpenScouting).toHaveBeenCalledTimes(1);
    expect(onOpenFacilities).toHaveBeenCalledTimes(1);
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: event.id });
    expect(onOpenPlayerProfile).toHaveBeenCalledWith(opponentId);
    expect(within(commitments).queryByText(`${event.name} QF`)).not.toBeInTheDocument();
    expect(within(commitments).queryByText(`${event.name} SF`)).not.toBeInTheDocument();
    expect(within(commitments).queryByText(`${event.name} F`)).not.toBeInTheDocument();
  });

  it("renders unified Calendar categories and statuses with semantic navigation and no speculative rounds", () => {
    const { assignment, career, event, plan, tournament } = unifiedScheduleUiFixture(9919);
    const candidate = career.ecosystem.recruitment.candidates.find(
      (entry) => entry.id === assignment.subjectId
    )!;
    const facility = career.facilities[0]!;
    const onOpenTournamentHome = vi.fn();
    const onOpenScheduledCareerMatch = vi.fn();
    const onOpenTraining = vi.fn();
    const onOpenScouting = vi.fn();
    const onOpenFacilities = vi.fn();
    const { container } = renderCalendarPage({
      career,
      tournament,
      onOpenTournamentHome,
      onOpenScheduledCareerMatch,
      onOpenTraining,
      onOpenScouting,
      onOpenFacilities
    });

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Upcoming" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Calendar status")).not.toBeInTheDocument();
    for (const diagnosticLabel of ["Career today", "Visible month", "Visible range", "Diary entries", "Scope"]) {
      expect(screen.queryByText(diagnosticLabel)).not.toBeInTheDocument();
    }

    const monthControls = screen.getByLabelText("Calendar month controls");
    expect(within(monthControls).getByRole("button", { name: "Previous month" })).toHaveTextContent("<<");
    expect(within(monthControls).getByRole("button", { name: "Today" })).toHaveTextContent("Today");
    expect(within(monthControls).getByRole("button", { name: "Next month" })).toHaveTextContent(">>");
    expect(within(monthControls).queryByText("Back")).not.toBeInTheDocument();
    expect(within(monthControls).queryByText("Forward")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "June 2026" })).toBeInTheDocument();
    expect(screen.getAllByText("June 2026")).toHaveLength(1);
    expect(container.querySelectorAll(".schedule-calendar-month")).toHaveLength(1);
    const monthHeader = container.querySelector(".schedule-calendar-month-header") as HTMLElement;
    expect(monthHeader).toContainElement(monthControls);
    expect(monthHeader.nextElementSibling).toHaveClass("schedule-calendar-weekdays");
    expect(screen.getByRole("grid", { name: "Calendar for June 2026" })).toBeInTheDocument();
    expect(container.querySelector(".schedule-calendar-weekdays")?.querySelectorAll("span")).toHaveLength(7);
    const grid = screen.getByRole("grid", { name: "Calendar for June 2026" });
    for (const category of ["Event", "Medical", "Travel", "Training", "Scouting", "Facility"]) {
      expect(within(grid).getAllByText(new RegExp(`^${category} ·`)).length).toBeGreaterThan(0);
    }
    expect(within(grid).getAllByText(/· Due$/).length).toBeGreaterThanOrEqual(6);
    expect(within(grid).getAllByText(/· Scheduled$/).length).toBeGreaterThan(0);
    expect(within(grid).getByText(new RegExp(`${plan.label}$`))).toBeInTheDocument();

    fireEvent.click(within(grid).getByRole("button", { name: new RegExp(`^Open event: ${event.name} R16,`) }));
    fireEvent.click(within(grid).getByRole("button", { name: new RegExp(`^Open training: .*${plan.label},`) }));
    fireEvent.click(within(grid).getByRole("button", { name: new RegExp(`^Open scouting: Scout report · ${candidate.name},`) }));
    fireEvent.click(within(grid).getByRole("button", {
      name: new RegExp(`^Open facilities: ${facility.label} level ${facility.level} completion,`)
    }));
    fireEvent.click(within(grid).getByRole("button", { name: new RegExp(`^Open event: ${event.name} travel,`) }));

    expect(onOpenScheduledCareerMatch).not.toHaveBeenCalled();
    expect(onOpenTraining).toHaveBeenCalledTimes(1);
    expect(onOpenScouting).toHaveBeenCalledTimes(1);
    expect(onOpenFacilities).toHaveBeenCalledTimes(1);
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: event.id });
    expect(within(grid).queryByText(`${event.name} QF`)).not.toBeInTheDocument();
    expect(within(grid).queryByText(`${event.name} SF`)).not.toBeInTheDocument();
    expect(within(grid).queryByText(`${event.name} F`)).not.toBeInTheDocument();
  });

  it("moves the visible Calendar month locally and resets Today to the career date month", () => {
    const { career } = careerEnteredOnMetroStart();
    const careerDate = career.date;

    renderCalendarPage({ career });

    expect(screen.getByRole("grid", { name: "Calendar for June 2026" })).toBeInTheDocument();
    expect(career.date).toBe(careerDate);

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "Calendar for July 2026" })).toBeInTheDocument();
    expect(career.date).toBe(careerDate);
    expect(screen.getAllByText("July 2026")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "Calendar for May 2026" })).toBeInTheDocument();
    expect(career.date).toBe(careerDate);

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("grid", { name: "Calendar for June 2026" })).toBeInTheDocument();
    expect(career.date).toBe(careerDate);
  });

  it("keeps an entered due event playable from the calendar row", () => {
    const { career, event } = careerEnteredOnMetroStart();
    const onOpenScheduledCareerMatch = vi.fn();

    renderCalendarPage({ career, onOpenScheduledCareerMatch });

    const playButton = screen.getByRole("button", {
      name: `Open match: ${event.name} R16, Event, Due, ${career.date}`
    });
    expect(playButton).toBeEnabled();

    fireEvent.click(playButton);

    expect(onOpenScheduledCareerMatch).toHaveBeenCalledWith(event.id);
  });

  it("pages upcoming events five at a time", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9910);
    const { container } = renderTimelinePage({ career });
    const schedule = screen.getByLabelText("Upcoming event schedule");

    expect(container.querySelectorAll(".calendar-event-table[aria-label='Upcoming event schedule'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(5);
    expect(within(schedule).getByText("Metro Open")).toBeInTheDocument();
    expect(within(schedule).queryByText("Academy Select Invitational")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("Upcoming events pagination")).getByRole("button", { name: "Next" }));

    expect(within(screen.getByLabelText("Upcoming event schedule")).getByText("Academy Select Invitational")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("opens upcoming event names through a stable season/event address", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9911);
    const harbor = getCareerEvent(baseCareer.events, "harbor-masters-500")!;
    const onOpenTournamentHome = vi.fn();
    const career = {
      ...baseCareer,
      date: "2026-06-07",
      activeEventId: null,
      enteredEventIds: [harbor.id],
      stage: "event_entered" as const
    };

    renderTimelinePage({ career, onOpenTournamentHome });

    const schedule = screen.getByLabelText("Upcoming event schedule");
    const harborNameLink = within(schedule).getByRole("button", { name: `Open tournament home for ${harbor.name}` });
    fireEvent.click(harborNameLink);

    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: harbor.id });
  });

  it("keeps unresolved active event ids as plain text instead of linking the next catalog event", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9918);
    const nextCatalogEvent = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const onOpenTournamentHome = vi.fn();
    const career = {
      ...baseCareer,
      activeEventId: "legacy-missing-event",
      stage: "event_entered" as const
    };

    renderTimelinePage({ career, onOpenTournamentHome });

    const status = screen.getByLabelText("Timeline status");
    expect(within(status).getByText("legacy-missing-event")).toBeInTheDocument();
    expect(
      within(status).queryByRole("button", { name: `Open tournament home for ${nextCatalogEvent.name}` })
    ).not.toBeInTheDocument();
    expect(onOpenTournamentHome).not.toHaveBeenCalled();
  });

  it("keeps calendar rows compact while exposing event homes for inspection", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9913);
    const { container } = renderTimelinePage({ career });
    const firstRow = container.querySelector(".calendar-event-table[aria-label='Upcoming event schedule'] .calendar-event-row:not(.calendar-event-row-head)") as HTMLElement;

    expect(within(firstRow).getByRole("button", { name: "Open Event" })).toBeEnabled();
    expect(within(firstRow).queryByLabelText(/deadline milestones/i)).not.toBeInTheDocument();
    expect(within(firstRow).queryByText(/Rival field:/i)).not.toBeInTheDocument();
    expect(within(firstRow).queryByText(/Seed snapshot:/i)).not.toBeInTheDocument();
  });

  it("renders a future tournament home with the draw prioritized and event notes collapsed", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9914);
    const event = getCareerEvent(career.events, "harbor-masters-500")!;

    renderTournamentHomePage({ career, eventId: event.id });

    expect(screen.getByRole("heading", { name: event.name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Knockout Draw" })).toBeInTheDocument();
    expect(screen.getByText("Event Notes")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Match Results And Scoreline Evidence" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Decision Summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Field Changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Eligibility" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rewards And Stakes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Field And Scouting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Event" })).toBeEnabled();
  });

  it("renders a completed non-managed champion from complete match-record truth without a snapshot", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const baseCareer = createInitialCareerState(managedPlayerId, 9920);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, managedPlayerId, 9920),
      id: event.id,
      name: event.name,
      tier: event.tier,
      prizePoolUsd: event.prizeMoney.champion * 2
    };
    const context = getManagedMatchContext(tournament)!;
    const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
    const completedTournament = advanceTournament({
      tournament,
      seededEntries: seededPlayers,
      managedMatchId: context.matchId,
      managedResult: forcedUiResult(managedSide === "A" ? "B" : "A")
    });
    const finalMatch = completedTournament.rounds.find((round) => round.name === "F")?.matches[0];

    if (!finalMatch?.winnerId || !finalMatch.scoreline) {
      throw new Error("Expected a completed non-managed final.");
    }

    const runnerUpId = finalMatch.sideAId === finalMatch.winnerId ? finalMatch.sideBId : finalMatch.sideAId;
    const withMatchRecords = appendCompletedTournamentMatchRecords({
      state: {
        ...baseCareer,
        date: eventEndDate(event),
        activeEventId: null,
        enteredEventIds: [event.id],
        completedEventIds: [event.id]
      },
      event,
      tournament: completedTournament,
      date: eventEndDate(event)
    });
    const withRankingResults = appendRankingResultsAndRebuild({
      career: withMatchRecords,
      results: [
        createRankingResult({
          seasonId: withMatchRecords.seasonId,
          playerId: finalMatch.winnerId,
          eventId: event.id,
          eventName: event.name,
          tier: event.tier,
          date: eventEndDate(event),
          resultRound: "champion",
          points: event.rankingPoints.champion,
          source: "archive_import",
          artificial: false
        }),
        createRankingResult({
          seasonId: withMatchRecords.seasonId,
          playerId: runnerUpId,
          eventId: event.id,
          eventName: event.name,
          tier: event.tier,
          date: eventEndDate(event),
          resultRound: "F",
          points: event.rankingPoints.F,
          source: "archive_import",
          artificial: false
        })
      ],
      asOfDate: eventEndDate(event)
    });
    const career = {
      ...withRankingResults,
      eventHistory: [
        {
          eventId: event.id,
          eventName: event.name,
          tier: event.tier,
          startDate: event.startDate,
          endDate: eventEndDate(event),
          status: "round_of_16" as const,
          entered: true,
          resultRound: "R16",
          pointsAwarded: event.rankingPoints.R16,
          prizeMoney: event.prizeMoney.R16,
          entryCost: event.entryFee,
          travelCost: event.travelCost,
          netCash: event.prizeMoney.R16 - event.entryFee - event.travelCost,
          completedAt: eventEndDate(event),
          matchIds: tournamentMatchArchiveIds(completedTournament),
          scorelines: tournamentMatchArchiveScorelines(completedTournament),
          achievements: ["Points Finish"],
          bracketSnapshot: null
        }
      ]
    };

    renderTournamentHomePage({ career, eventId: event.id });

    const outcome = screen.getByLabelText(`${event.name} complete event outcome`);
    expect(screen.getByRole("heading", { name: "Full Event Outcome" })).toBeInTheDocument();
    expect(within(outcome).getByRole("button", { name: playerMap[finalMatch.winnerId].name })).toBeInTheDocument();
    expect(within(outcome).getByRole("button", { name: playerMap[runnerUpId].name })).toBeInTheDocument();
    expect(within(outcome).getByText(finalMatch.scoreline)).toBeInTheDocument();
    expect(within(outcome).getByText("Reconstructed bracket")).toBeInTheDocument();
    expect(within(outcome).getByText(`Ranking ledger +${event.rankingPoints.champion.toLocaleString()} pts (champion).`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archived Knockout Draw" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Match Results And Scoreline Evidence" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Event Notes"));
    expect(screen.getByRole("heading", { name: "Scoreline Evidence" })).toBeInTheDocument();
    expect(screen.getByLabelText(`${event.name} match result evidence`)).toHaveTextContent("Quick simulation");
    expect(screen.queryByText("Not archived")).not.toBeInTheDocument();
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
    const { container } = renderTimelinePage({ career });
    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));

    expect(container.querySelectorAll(".calendar-event-table[aria-label='Past event records'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(5);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("Past events pagination")).getByRole("button", { name: "Next" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".calendar-event-table[aria-label='Past event records'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(1);
  });

  it("lists completed skipped universe events in Past Events", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9921);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const career = simulateUniverseThroughDate({
      career: {
        ...baseCareer,
        date: addDays(eventEndDate(event), 1)
      },
      activeTournament: null,
      targetDate: addDays(eventEndDate(event), 1)
    }).career;
    const onOpenTournamentHome = vi.fn();

    renderTimelinePage({ career, onOpenTournamentHome });
    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));

    const pastEvents = screen.getByLabelText("Past event records");
    const row = within(pastEvents).getByText(event.name).closest(".calendar-event-row") as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText(/Not entered/)).toBeInTheDocument();
    expect(within(row).getByText(/completed/)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: `Open tournament home for ${event.name}` }));

    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: event.id });
  });

  it("opens past events and renders an old-save archive fallback without a bracket snapshot", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9915);
    const event = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const onOpenTournamentHome = vi.fn();
    const career = {
      ...baseCareer,
      eventHistory: [
        {
          eventId: event.id,
          eventName: event.name,
          tier: event.tier,
          startDate: event.startDate,
          endDate: addDays(event.startDate, event.durationDays - 1),
          status: "round_of_16" as const,
          entered: true,
          resultRound: "R16",
          pointsAwarded: event.rankingPoints.R16,
          prizeMoney: event.prizeMoney.R16,
          entryCost: event.entryFee,
          travelCost: event.travelCost,
          netCash: event.prizeMoney.R16 - event.entryFee - event.travelCost,
          completedAt: event.startDate,
          matchIds: ["R16-1"],
          scorelines: ["21-18, 19-21, 21-17"],
          achievements: ["Points Finish"]
        }
      ]
    };

    renderTimelinePage({ career, onOpenTournamentHome });
    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));
    fireEvent.click(
      within(screen.getByLabelText("Past event records")).getByRole("button", {
        name: `Open tournament home for ${event.name}`
      })
    );

    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: event.id });

    renderTournamentHomePage({ career, eventId: event.id });
    expect(screen.getByRole("heading", { name: "Result Archive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Full Event Outcome" })).toBeInTheDocument();
    expect(screen.getAllByText("Legacy summary only").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/predates complete bracket truth/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Not archived")).not.toBeInTheDocument();
  });

  it("renders a safe not-found tournament home for legacy event ids", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9917);

    renderTournamentHomePage({ career, eventId: "legacy-missing-event" });

    expect(screen.getByRole("heading", { name: "Tournament Not Found" })).toBeInTheDocument();
    expect(screen.getByText(/Address:/)).toHaveTextContent(`${career.seasonId} / legacy-missing-event`);
  });
});
