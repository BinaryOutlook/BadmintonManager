import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import { CareerPostMatchHubPage, CareerPreMatchHubPage } from "../../components/CareerWorkbench";
import { KnockoutTree } from "../../components/KnockoutTree";
import { playerMap, seededPlayers } from "../../game/content/players";
import { getCareerEvent } from "../../game/career/events";
import type { CareerState } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import type { MatchResult, Side } from "../../game/core/models";
import { advanceTournament, createTournament, getManagedMatchContext, type TournamentState } from "../../game/tournament/tournament";

function forcedStraightGamesResult(winner: Side): MatchResult {
  return {
    winner,
    setsWonA: winner === "A" ? 2 : 0,
    setsWonB: winner === "B" ? 2 : 0,
    setSummaries: [
      {
        winner,
        scoreA: winner === "A" ? 21 : 14,
        scoreB: winner === "B" ? 21 : 14,
        points: []
      },
      {
        winner,
        scoreA: winner === "A" ? 21 : 16,
        scoreB: winner === "B" ? 21 : 16,
        points: []
      }
    ],
    stats: {
      winnersA: winner === "A" ? 22 : 12,
      winnersB: winner === "B" ? 22 : 12,
      unforcedErrorsA: winner === "A" ? 8 : 17,
      unforcedErrorsB: winner === "B" ? 8 : 17,
      totalSmashesA: 16,
      totalSmashesB: 15,
      peakSmashSpeedA: 388,
      peakSmashSpeedB: 381,
      staminaDrainA: 8,
      staminaDrainB: 10,
      longestRally: 26,
      totalPoints: 72
    },
    scoreline: winner === "A" ? "21-14, 21-16" : "14-21, 16-21",
    fidelity: "detailed",
    summaryEvents: [
      {
        kind: "straight_games",
        side: winner,
        title: "Forced deterministic result",
        detail: "Component proof supplies the result instead of relying on match luck."
      }
    ]
  };
}

function advanceManagedMatch(tournament: TournamentState, managedPlayerId: string) {
  const context = getManagedMatchContext(tournament);

  if (!context) {
    throw new Error("Expected managed match context.");
  }

  const managedSide = context.playerAId === managedPlayerId ? "A" : "B";

  return advanceTournament({
    tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: forcedStraightGamesResult(managedSide)
  });
}

function advanceManagedPlayerToTitle(tournament: TournamentState, managedPlayerId: string) {
  let current = tournament;

  while (!current.championId) {
    current = advanceManagedMatch(current, managedPlayerId);
  }

  return current;
}

function careerEventSetup(seed = 7801) {
  const managedPlayerId = seededPlayers[0].player.id;
  const initial = createInitialCareerState(managedPlayerId, seed);
  const event = getCareerEvent(initial.events, "metro-open-300")!;
  const career = {
    ...initial,
    date: event.startDate,
    activeEventId: event.id,
    enteredEventIds: [event.id],
    stage: "pre_match" as const
  };
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };

  return { career, event, managedPlayerId, tournament };
}

function buildCareerPageProps(
  career: CareerState,
  tournament: TournamentState | null,
  onOpenPlayerProfile: (playerId: string) => void = () => undefined
): Parameters<typeof CareerPreMatchHubPage>[0] {
  const noop = () => undefined;

  return {
    career,
    tournament,
    saveRecovery: null,
    activeSavePresent: true,
    corruptSavePresent: false,
    onStartCareer: noop,
    onOpenTraining: noop,
    onOpenCalendar: noop,
    onOpenTournamentHome: noop,
    onOpenHome: noop,
    onOpenLiveMatch: noop,
    onOpenPostMatch: noop,
    onOpenProgram: noop,
    onOpenRivals: noop,
    onOpenMatchPlanning: noop,
    onOpenSaveManager: noop,
    onRequestNewSession: noop,
    onOpenFacilities: noop,
    onOpenMedia: noop,
    onOpenScouting: noop,
    onOpenRecruitment: noop,
    onOpenYouth: noop,
    onOpenStaff: noop,
    onOpenPromises: noop,
    onOpenPlayerProfile,
    onApplyTraining: noop,
    onEnterEvent: noop,
    onOpenScheduledCareerMatch: noop,
    onStartManagedMatch: noop,
    onContinueAfterPostMatch: noop,
    onCommissionScoutReport: noop,
    onMakeRecruitmentOffer: noop,
    onTrainRosterAthlete: noop,
    onEnterRosterAthleteLowerEvent: noop,
    onDevelopYouthProspect: noop,
    onEnterYouthLowerEvent: noop,
    onHireStaffMember: noop,
    onSetManagedAthletePromise: noop,
    onWithdrawPromise: noop,
    onAdvanceRivalCircuit: noop,
    onUpgradeFacility: noop,
    onResolveMediaObjectives: noop,
    onUpdateAdvancedTacticPlan: noop,
    onRefreshAssistantAdvice: noop,
    onApplyAssistantAdvice: noop,
    onOverrideAssistantAdvice: noop
  };
}

describe("KnockoutTree", () => {
  it("renders placeholders, managed path, clickable player names, and background summaries", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 7802);
    const managedMatch = tournament.rounds[0]!.matches.find((match) => match.managed)!;
    const backgroundMatch = tournament.rounds[0]!.matches.find((match) => !match.managed && match.summaryEvents?.[0])!;
    const onOpenPlayerProfile = vi.fn();

    render(
      <KnockoutTree
        tournament={tournament}
        selectedPlayerId={managedPlayerId}
        onOpenPlayerProfile={onOpenPlayerProfile}
      />
    );

    expect(screen.getByRole("heading", { name: "Knockout Tree" })).toBeInTheDocument();
    expect(screen.getByLabelText("Knockout tree")).toBeInTheDocument();
    expect(screen.getByText("Winner R16-1")).toBeInTheDocument();
    expect(screen.getByText("Winner QF-1")).toBeInTheDocument();
    expect(screen.getByText("Winner SF-1")).toBeInTheDocument();
    expect(screen.getAllByText("Awaiting previous winners").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Winner R16-1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TBD" })).not.toBeInTheDocument();
    expect(screen.getByText("Managed match pending").closest(".bracket-card")).toHaveClass("bracket-card-managed");
    expect(screen.getByText(backgroundMatch.summaryEvents![0]!.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: playerMap[managedMatch.sideAId]!.name }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(managedMatch.sideAId);
  });

  it("preserves champion styling after the final is decided", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const championTournament = advanceManagedPlayerToTitle(
      createTournament(seededPlayers, managedPlayerId, 7803),
      managedPlayerId
    );

    render(
      <KnockoutTree
        tournament={championTournament}
        selectedPlayerId={managedPlayerId}
        onOpenPlayerProfile={() => undefined}
      />
    );

    expect(screen.getByText("Champion decided - 21-14, 21-16").closest(".bracket-card")).toHaveClass(
      "bracket-card-champion"
    );
  });
});

describe("career bracket placement", () => {
  it("renders the reusable tree in the career pre-match hub", () => {
    const { career, managedPlayerId, tournament } = careerEventSetup(7804);
    const onOpenPlayerProfile = vi.fn();

    render(
      <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
        <CareerPreMatchHubPage {...buildCareerPageProps(career, tournament, onOpenPlayerProfile)} />
      </TournamentNavigationProvider>
    );

    expect(screen.getByRole("heading", { name: "Current Event Bracket" })).toBeInTheDocument();
    expect(screen.getByLabelText("Knockout tree")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: playerMap[managedPlayerId]!.name }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(managedPlayerId);
  });

  it("renders the updated tree in the career post-match hub while the event remains active", () => {
    const { career, event, managedPlayerId, tournament } = careerEventSetup(7805);
    const context = getManagedMatchContext(tournament)!;
    const opponentId = context.playerAId === managedPlayerId ? context.playerBId : context.playerAId;
    const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
    const advancedTournament = advanceManagedMatch(tournament, managedPlayerId);
    const postMatchCareer = {
      ...career,
      stage: "post_match" as const,
      lastMatchReport: {
        eventId: event.id,
        matchId: context.matchId,
        opponentId,
        result: "win" as const,
        scoreline: "21-14, 21-16",
        round: context.roundName,
        pointsDelta: 0,
        cashDelta: 0,
        fatigueDelta: managedSide === "A" ? 8 : 10,
        evidence: ["Forced deterministic non-final win for bracket placement proof"],
        recommendations: ["Continue into the next managed round"],
        tacticalViewer: null
      }
    };

    render(
      <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
        <CareerPostMatchHubPage {...buildCareerPageProps(postMatchCareer, advancedTournament)} />
      </TournamentNavigationProvider>
    );

    expect(screen.getByRole("heading", { name: "Current Event Bracket" })).toBeInTheDocument();
    expect(screen.getByLabelText("Knockout tree")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Knockout tree")).getByText("21-14, 21-16")).toBeInTheDocument();
  });
});
