import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import {
  CareerTimelinePage,
  CareerTournamentHomePage
} from "../../components/CareerWorkbench";
import { addDays } from "../../game/career/calendar";
import { eventEndDate, recordPastCareerEvents } from "../../game/career/events";
import { finalizeSeasonReview, startNextSeason } from "../../game/career/lifecycle";
import type { CareerState } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import { simulateUniverseThroughDate } from "../../game/career/universe";
import { playerMap, seededPlayers } from "../../game/content/players";

function historicalCareer() {
  const initial = createInitialCareerState(seededPlayers[0].player.id, 53_001);
  const lastEventDate = initial.events.reduce(
    (latest, event) => eventEndDate(event) > latest ? eventEndDate(event) : latest,
    "2026-01-01"
  );
  const date = addDays(lastEventDate, 1);
  const terminal: CareerState = {
    ...initial,
    date,
    stage: "event_complete",
    activeEventId: null,
    enteredEventIds: [],
    completedEventIds: []
  };
  const simulated = simulateUniverseThroughDate({
    career: terminal,
    activeTournament: null,
    targetDate: date
  }).career;
  const finalized = finalizeSeasonReview(recordPastCareerEvents(simulated));
  const next = startNextSeason(finalized);
  const review = next.seasonReviews.find((entry) => entry.seasonId === "2026")!;
  const event = review.events[0]!;
  const hasEventHistory = next.eventHistory.some(
    (record) => (record.seasonId ?? record.startDate.slice(0, 4)) === "2026" && record.eventId === event.id
  );
  const career: CareerState = hasEventHistory
    ? next
    : {
        ...next,
        eventHistory: [
          ...next.eventHistory,
          {
            seasonId: "2026",
            eventId: event.id,
            eventName: event.name,
            tier: event.tier,
            startDate: event.startDate,
            endDate: eventEndDate(event),
            status: "missed_deadline",
            entered: false,
            resultRound: null,
            pointsAwarded: 0,
            prizeMoney: 0,
            entryCost: 0,
            travelCost: 0,
            netCash: 0,
            completedAt: review.createdAt,
            matchIds: [],
            scorelines: [],
            achievements: [],
            bracketSnapshot: null
          }
        ]
      };

  return { career, review, event };
}

function pageProps(career: CareerState, onOpenTournamentHome = vi.fn()) {
  return {
    career,
    tournament: null,
    saveRecovery: null,
    activeSavePresent: true,
    corruptSavePresent: false,
    onStartCareer: vi.fn(),
    onOpenTraining: vi.fn(),
    onOpenCalendar: vi.fn(),
    onOpenTimeline: vi.fn(),
    onOpenTournamentHome,
    onOpenHome: vi.fn(),
    onOpenLiveMatch: vi.fn(),
    onOpenPostMatch: vi.fn(),
    onOpenProgram: vi.fn(),
    onOpenRivals: vi.fn(),
    onOpenMatchPlanning: vi.fn(),
    onOpenSaveManager: vi.fn(),
    onRequestNewSession: vi.fn(),
    onOpenFacilities: vi.fn(),
    onOpenMedia: vi.fn(),
    onOpenScouting: vi.fn(),
    onOpenRecruitment: vi.fn(),
    onOpenYouth: vi.fn(),
    onOpenStaff: vi.fn(),
    onOpenPromises: vi.fn(),
    onOpenPlayerProfile: vi.fn(),
    onOpenManagementDestination: vi.fn(),
    onApplyTraining: vi.fn(),
    onEnterEvent: vi.fn(),
    onOpenScheduledCareerMatch: vi.fn(),
    onStartManagedMatch: vi.fn(),
    onContinueAfterPostMatch: vi.fn(),
    onStartNextCareerSeason: vi.fn(),
    onCommissionScoutReport: vi.fn(),
    onMakeRecruitmentOffer: vi.fn(),
    onScheduleRosterPreparation: vi.fn(),
    onEnterRosterAthleteLowerEvent: vi.fn(),
    onDevelopYouthProspect: vi.fn(),
    onEnterYouthLowerEvent: vi.fn(),
    onHireStaffMember: vi.fn(),
    onSetManagedAthletePromise: vi.fn(),
    onWithdrawPromise: vi.fn(),
    onAdvanceRivalCircuit: vi.fn(),
    onUpgradeFacility: vi.fn(),
    onResolveMediaObjectives: vi.fn(),
    onUpdateAdvancedTacticPlan: vi.fn(),
    onRefreshAssistantAdvice: vi.fn(),
    onApplyAssistantAdvice: vi.fn(),
    onOverrideAssistantAdvice: vi.fn()
  };
}

describe("historical tournament addressing", () => {
  it("opens a finalized prior-season event as a read-only reconstructed archive", () => {
    const { career, event } = historicalCareer();

    render(
      <CareerTournamentHomePage
        {...pageProps(career)}
        seasonId="2026"
        eventId={event.id}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: event.name })).toBeInTheDocument();
    expect(screen.getByText(/Address:/)).toHaveTextContent(`2026 / ${event.id}`);
    expect(screen.getByRole("button", { name: "Historical" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enter Event" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archived Knockout Draw" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Full Event Outcome" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archive Context" })).toBeInTheDocument();
    expect(screen.getByText("Current rival pressure is never projected backward.")).toBeInTheDocument();
  });

  it("filters archive facts by season and event together when ids collide", () => {
    const fixture = historicalCareer();
    const correctHistory = fixture.career.eventHistory.find(
      (record) => (record.seasonId ?? record.startDate.slice(0, 4)) === "2026" && record.eventId === fixture.event.id
    )!;
    const correctWinner = seededPlayers[0].player.id;
    const wrongWinner = seededPlayers[1].player.id;
    const opponentId = seededPlayers[2].player.id;
    const career: CareerState = {
      ...fixture.career,
      eventHistory: [
        {
          ...correctHistory,
          seasonId: "2027",
          status: "champion",
          resultRound: "F"
        },
        ...fixture.career.eventHistory
      ],
      universeEvents: fixture.career.universeEvents.filter(
        (record) => !(record.seasonId === "2026" && record.eventId === fixture.event.id)
      ),
      matchHistory: [
        {
          id: "collision:wrong",
          seasonId: "2027",
          eventId: fixture.event.id,
          eventName: fixture.event.name,
          date: "2027-06-03",
          round: "R16",
          playerAId: wrongWinner,
          playerBId: opponentId,
          winnerId: wrongWinner,
          scoreline: "21-4, 21-5",
          source: "archive_import"
        },
        {
          id: "collision:correct",
          seasonId: "2026",
          eventId: fixture.event.id,
          eventName: fixture.event.name,
          date: "2026-06-03",
          round: "R16",
          playerAId: correctWinner,
          playerBId: opponentId,
          winnerId: correctWinner,
          scoreline: "21-18, 21-16",
          source: "archive_import"
        }
      ],
      playerAchievements: [
        {
          seasonId: "2027",
          playerId: wrongWinner,
          eventId: fixture.event.id,
          eventName: fixture.event.name,
          date: "2027-06-07",
          result: "champion"
        },
        {
          seasonId: "2026",
          playerId: correctWinner,
          eventId: fixture.event.id,
          eventName: fixture.event.name,
          date: "2026-06-07",
          result: "champion"
        }
      ]
    };

    render(
      <CareerTournamentHomePage
        {...pageProps(career)}
        seasonId="2026"
        eventId={fixture.event.id}
      />
    );

    const outcome = screen.getByLabelText(`${fixture.event.name} complete event outcome`);
    expect(within(outcome).getByRole("button", { name: playerMap[correctWinner].name })).toBeInTheDocument();
    expect(within(outcome).queryByRole("button", { name: playerMap[wrongWinner].name })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Event Notes"));
    const evidence = screen.getByLabelText(`${fixture.event.name} match result evidence`);
    expect(evidence).toHaveTextContent("21-18, 21-16");
    expect(evidence).not.toHaveTextContent("21-4, 21-5");
  });

  it("routes Past Events with the record season instead of the active season", () => {
    const { career, event } = historicalCareer();
    const onOpenTournamentHome = vi.fn();
    const props = pageProps(career, onOpenTournamentHome);

    render(
      <TournamentNavigationProvider onOpenTournamentHome={onOpenTournamentHome}>
        <CareerTimelinePage {...props} />
      </TournamentNavigationProvider>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));
    const row = within(screen.getByLabelText("Past event records"))
      .getByText(event.name)
      .closest(".calendar-event-row") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Open Event" }));

    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: "2026", eventId: event.id });
  });
});
