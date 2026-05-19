import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App, commandIdForPage } from "../../app/App";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import { CareerCalendarPage, CareerRankingsPage, CareerTournamentHomePage } from "../../components/CareerWorkbench";
import { addDays } from "../../game/career/calendar";
import {
  appendCompletedTournamentMatchRecords,
  eventEndDate,
  getCareerEvent,
  tournamentMatchArchiveIds,
  tournamentMatchArchiveScorelines
} from "../../game/career/events";
import { awardRankingPoints } from "../../game/career/rankings";
import { createInitialCareerState } from "../../game/career/state";
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
        onOpenTournamentHome={onOpenTournamentHome}
      />
    </TournamentNavigationProvider>
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
      "Inbox Preview",
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
    expect(commandIdForPage({ id: "calendar", section: "timeline" })).toBe("timeline");
    expect(commandIdForPage({ id: "calendar", section: "calendar" })).toBe("calendar");
    expect(within(commandRail).getByRole("button", { name: /Inbox Preview preview-only/ })).toBeDisabled();
  });

  it("routes Timeline and Calendar sidebar shortcuts into the Schedule split", () => {
    resetStoreForCareer();

    render(<App />);

    const commandRail = screen.getByRole("navigation", { name: "Primary commands" });
    const timelineCommand = within(commandRail).getByRole("button", { name: /Timeline/ });
    const calendarCommand = within(commandRail).getByRole("button", { name: /Calendar/ });

    fireEvent.click(timelineCommand);

    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(timelineCommand).toHaveAttribute("aria-current", "page");

    fireEvent.click(calendarCommand);

    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(calendarCommand).toHaveAttribute("aria-current", "page");
  });

  it("renders the career topbar as identity, clock control, save, and settings", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9904);
    resetStoreForCareer(career);

    render(<App />);

    const banner = screen.getByRole("banner");
    const managedAthlete = within(banner).getByLabelText("Managed athlete");
    const dailyCluster = within(banner).getByLabelText("Career clock control");
    const saveStatus = within(banner).getByLabelText("Save status");
    const brandMark = banner.querySelector(".brand-mark");
    const commandSearch = banner.querySelector(".command-search");
    const date = banner.querySelector(".topbar-date");
    const dailyAction = within(dailyCluster).getByRole("button", { name: "Advance Day" });

    expect(brandMark).not.toBeNull();
    expect(commandSearch).not.toBeNull();
    expect(date).not.toBeNull();
    expect(managedAthlete).toHaveTextContent(seededPlayers[0].player.name);
    expect(managedAthlete.previousElementSibling).toBe(brandMark);
    expect(managedAthlete.nextElementSibling).toBe(commandSearch);
    expect(date?.nextElementSibling).toBe(dailyAction);
    expect(saveStatus).toHaveTextContent("Career save");
    expect(within(banner).queryByRole("button", { name: "Intel" })).not.toBeInTheDocument();
    expect(within(banner).getByRole("button", { name: "Settings" })).toBeInTheDocument();
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
    const career = {
      ...baseCareer,
      rankings: [...baseCareer.rankings].reverse()
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
    const managedRanking = baseCareer.rankings.find((entry) => entry.playerId === baseCareer.program.managedPlayerId)!;

    expect(within(firstDataRow).getByText("#1")).toBeInTheDocument();
    expect(within(firstDataRow).getByRole("button", { name: "Adrian Koh" })).toBeInTheDocument();
    expect(within(firstDataRow).getByText("Managed athlete")).toBeInTheDocument();
    expect(within(firstDataRow).getByText("SGP")).toBeInTheDocument();
    expect(within(firstDataRow).getByText(`${managedRanking.points.toLocaleString()} pts`)).toBeInTheDocument();
    expect(within(firstDataRow).getByText(`${managedRanking.seasonPoints.toLocaleString()} pts`)).toBeInTheDocument();

    fireEvent.click(within(firstDataRow).getByRole("button", { name: "Adrian Koh" }));

    expect(screen.getByRole("heading", { name: "Adrian Koh" })).toBeInTheDocument();
  });
});

describe("career rankings page", () => {
  it("shows a career-required state when no career is loaded", () => {
    renderRankingsPage({ career: null, activeSavePresent: false });

    expect(screen.getByRole("heading", { name: "Career Command Center" })).toBeInTheDocument();
    expect(screen.getByText("No Career Loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Career Save" })).toBeInTheDocument();
  });
});

describe("career calendar event actions", () => {
  it("renders Timeline commitments with TBD, result markers, event actions, and profile links", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9916);
    const metro = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const harbor = getCareerEvent(baseCareer.events, "harbor-masters-500")!;
    const tournament = {
      ...createTournament(seededPlayers, baseCareer.program.managedPlayerId, 9916),
      id: metro.id,
      name: metro.name,
      tier: metro.tier
    };
    const context = getManagedMatchContext(tournament)!;
    const activeOpponentId =
      context.playerAId === baseCareer.program.managedPlayerId ? context.playerBId : context.playerAId;
    const activeOpponentName = seededPlayers.find((entry) => entry.player.id === activeOpponentId)!.player.name;
    const pastOpponent = seededPlayers[4].player;
    const onOpenTournamentHome = vi.fn();
    const onOpenPlayerProfile = vi.fn();
    const career = {
      ...baseCareer,
      date: metro.startDate,
      activeEventId: metro.id,
      enteredEventIds: [metro.id],
      stage: "pre_match" as const,
      matchHistory: [
        {
          id: `${harbor.id}:R16-1`,
          eventId: harbor.id,
          eventName: harbor.name,
          date: harbor.startDate,
          round: "R16" as const,
          playerAId: baseCareer.program.managedPlayerId,
          playerBId: pastOpponent.id,
          winnerId: baseCareer.program.managedPlayerId,
          scoreline: "21-14, 21-18",
          source: "played" as const
        }
      ]
    };

    renderCalendarPage({ career, tournament, onOpenTournamentHome, onOpenPlayerProfile });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Upcoming",
      "Past Events",
      "Timeline",
      "Calendar"
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));

    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open tournament home for Metro Open: Round of 16" })).toBeInTheDocument();
    expect(screen.getAllByText("TBD").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Open tournament home for Harbor Masters: Round of 16 (W)" })).toBeInTheDocument();

    const activeCard = screen.getByRole("button", { name: "Open tournament home for Metro Open: Round of 16" }).closest(".calendar-commitment-card") as HTMLElement;
    fireEvent.click(within(activeCard).getByRole("button", { name: "Open tournament home for Metro Open: Round of 16" }));
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: metro.id });

    fireEvent.click(within(activeCard).getByRole("button", { name: activeOpponentName }));
    expect(onOpenPlayerProfile).toHaveBeenCalledWith(activeOpponentId);
    expect(onOpenTournamentHome).toHaveBeenCalledTimes(1);
  });

  it("renders a month-grid Calendar with confirmed commitments and gated future rounds", () => {
    const baseCareer = createInitialCareerState(seededPlayers[0].player.id, 9919);
    const metro = getCareerEvent(baseCareer.events, "metro-open-300")!;
    const tournament = {
      ...createTournament(seededPlayers, baseCareer.program.managedPlayerId, 9919),
      id: metro.id,
      name: metro.name,
      tier: metro.tier
    };
    const pastOpponent = seededPlayers[4].player;
    const onOpenTournamentHome = vi.fn();
    const career = {
      ...baseCareer,
      date: metro.startDate,
      activeEventId: metro.id,
      enteredEventIds: [metro.id],
      stage: "pre_match" as const,
      matchHistory: [
        {
          id: "harbor-masters-500:R16-1",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-12",
          round: "R16" as const,
          playerAId: baseCareer.program.managedPlayerId,
          playerBId: pastOpponent.id,
          winnerId: baseCareer.program.managedPlayerId,
          scoreline: "21-14, 21-18",
          source: "played" as const
        }
      ]
    };
    const { container } = renderCalendarPage({ career, tournament, onOpenTournamentHome });

    fireEvent.click(screen.getByRole("tab", { name: "Calendar" }));

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("June 2026")).toBeInTheDocument();
    expect(container.querySelector(".schedule-calendar-grid")).toBeInTheDocument();
    expect(container.querySelector(".schedule-calendar-weekdays")?.querySelectorAll("span")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Open match detail for Metro Open: Round of 16" })).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
    expect(screen.queryByText("Quarter-Final")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open tournament home for Harbor Masters: Round of 16 (W)" }));
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: "harbor-masters-500" });
  });

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

    renderCalendarPage({ career, onOpenTournamentHome });

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

    renderCalendarPage({ career, onOpenTournamentHome });

    const status = screen.getByLabelText("Schedule status");
    expect(within(status).getByText("legacy-missing-event")).toBeInTheDocument();
    expect(
      within(status).queryByRole("button", { name: `Open tournament home for ${nextCatalogEvent.name}` })
    ).not.toBeInTheDocument();
    expect(onOpenTournamentHome).not.toHaveBeenCalled();
  });

  it("keeps calendar rows compact while exposing event homes for inspection", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9913);
    const { container } = renderCalendarPage({ career });
    const firstRow = container.querySelector(".calendar-event-table[aria-label='Upcoming event schedule'] .calendar-event-row:not(.calendar-event-row-head)") as HTMLElement;

    expect(within(firstRow).getByRole("button", { name: "Open Event" })).toBeEnabled();
    expect(within(firstRow).queryByLabelText(/deadline milestones/i)).not.toBeInTheDocument();
    expect(within(firstRow).queryByText(/Rival field:/i)).not.toBeInTheDocument();
    expect(within(firstRow).queryByText(/Seed snapshot:/i)).not.toBeInTheDocument();
  });

  it("renders a future tournament home with decision, draw, timeline, eligibility, rewards, and field sections", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9914);
    const event = getCareerEvent(career.events, "harbor-masters-500")!;

    renderTournamentHomePage({ career, eventId: event.id });

    expect(screen.getByRole("heading", { name: event.name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Decision Summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Knockout Draw" })).toBeInTheDocument();
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
    const rankingsWithChampion = awardRankingPoints({
      rankings: withMatchRecords.rankings,
      playerId: finalMatch.winnerId,
      eventId: event.id,
      round: "champion",
      points: event.rankingPoints.champion,
      date: eventEndDate(event),
      seasonId: withMatchRecords.seasonId,
      tier: event.tier
    });
    const rankingsWithRunnerUp = awardRankingPoints({
      rankings: rankingsWithChampion,
      playerId: runnerUpId,
      eventId: event.id,
      round: "F",
      points: event.rankingPoints.F,
      date: eventEndDate(event),
      seasonId: withMatchRecords.seasonId,
      tier: event.tier
    });
    const career = {
      ...withMatchRecords,
      rankings: rankingsWithRunnerUp,
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
    expect(screen.getByRole("heading", { name: "Match Results And Scoreline Evidence" })).toBeInTheDocument();
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
    const { container } = renderCalendarPage({ career });

    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));

    expect(container.querySelectorAll(".calendar-event-table[aria-label='Past event records'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(5);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".calendar-event-table[aria-label='Past event records'] .calendar-event-row:not(.calendar-event-row-head)")).toHaveLength(1);
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

    renderCalendarPage({ career, onOpenTournamentHome });
    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));
    fireEvent.click(screen.getByRole("button", { name: `Open tournament home for ${event.name}` }));

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
