import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import { CareerPostMatchHubPage, CareerPreMatchHubPage } from "../../components/CareerWorkbench";
import {
  KnockoutTree,
  compactBracketDisplayName,
  compactBracketNamesForDraw,
  parseScorelineGames
} from "../../components/KnockoutTree";
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
    onOpenTimeline: noop,
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
    onOpenManagementDestination: noop,
    onApplyTraining: noop,
    onEnterEvent: noop,
    onOpenScheduledCareerMatch: noop,
    onStartManagedMatch: noop,
    onContinueAfterPostMatch: noop,
    onCommissionScoutReport: noop,
    onMakeRecruitmentOffer: noop,
    onScheduleRosterPreparation: noop,
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
  it("formats compact bracket names and expands only collisions", () => {
    expect(compactBracketDisplayName("Grand-Slam Southpaw")).toBe("G. Southpaw");
    expect(compactBracketDisplayName("Pablo Reyes")).toBe("P. Reyes");
    expect(compactBracketDisplayName("Eight-Crown Monarch")).toBe("E. Monarch");
    expect(compactBracketDisplayName("Louis Mercier")).toBe("L. Mercier");

    expect(
      compactBracketNamesForDraw([
        { id: "pablo", name: "Pablo Reyes" },
        { id: "pedro", name: "Pedro Reyes" },
        { id: "louis", name: "Louis Mercier" }
      ])
    ).toEqual({
      pablo: "Pab. Reyes",
      pedro: "Ped. Reyes",
      louis: "L. Mercier"
    });
  });

  it("renders compact score cells, selected-match detail, and abbreviated profile links", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 7802);
    const managedMatch = tournament.rounds[0]!.matches.find((match) => match.managed)!;
    const backgroundMatch = tournament.rounds[0]!.matches.find((match) => !match.managed && match.summaryEvents?.[0])!;
    const onOpenPlayerProfile = vi.fn();
    const compactNames = compactBracketNamesForDraw(
      [...new Set(tournament.rounds.flatMap((round) => round.matches.flatMap((match) => [match.sideAId, match.sideBId])))]
        .map((playerId) => playerMap[playerId])
    );

    render(
      <KnockoutTree
        tournament={tournament}
        selectedPlayerId={managedPlayerId}
        onOpenPlayerProfile={onOpenPlayerProfile}
      />
    );

    expect(screen.getByRole("heading", { name: "Knockout Tree" })).toBeInTheDocument();
    expect(screen.getByLabelText("Knockout tree")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Round of 32" })).not.toBeInTheDocument();
    expect(screen.getByText("Winner R16-1")).toBeInTheDocument();
    expect(screen.getByText("Winner QF-1")).toBeInTheDocument();
    expect(screen.getByText("Winner SF-1")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting previous winners")).not.toBeInTheDocument();
    expect(screen.queryByText(backgroundMatch.summaryEvents![0]!.title)).not.toBeInTheDocument();
    expect(screen.getByText("up next").closest(".bracket-card")).toHaveClass("bracket-card-managed");

    const games = parseScorelineGames(backgroundMatch.scoreline);
    const backgroundButton = screen.getByRole("button", {
      name: `Inspect Round of 16 match ${Number(backgroundMatch.id.split("-").at(-1))}: ${playerMap[backgroundMatch.sideAId]!.name} vs ${playerMap[backgroundMatch.sideBId]!.name}`
    });

    expect(within(backgroundButton).getAllByText(games[0]!.sideA).length).toBeGreaterThan(0);
    expect(within(backgroundButton).getAllByText(games[0]!.sideB).length).toBeGreaterThan(0);
    expect(within(backgroundButton).queryByText(backgroundMatch.scoreline!)).not.toBeInTheDocument();

    fireEvent.click(backgroundButton);

    const detail = screen.getByLabelText("Selected match details");
    expect(within(detail).getByText(backgroundMatch.scoreline!)).toBeInTheDocument();
    expect(within(detail).getByText(backgroundMatch.summaryEvents![0]!.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: compactNames[managedMatch.sideAId] }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(managedMatch.sideAId);
  });

  it("renders generated career entrants with names, compact labels, details, and profile links", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 7_813);
    const managedMatch = tournament.rounds[0]!.matches.find((match) => match.managed)!;
    const replacedPlayerId = managedMatch.sideAId === managedPlayerId ? managedMatch.sideBId : managedMatch.sideAId;
    const generated = {
      ...playerMap[replacedPlayerId]!,
      id: "world-2027-01",
      name: "Ari Qureshi",
      styleLabel: "Attacking prospect"
    };
    const playersById = { ...playerMap, [generated.id]: generated };
    const generatedTournament: TournamentState = {
      ...tournament,
      rounds: tournament.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => match.id === managedMatch.id
          ? {
              ...match,
              sideAId: match.sideAId === replacedPlayerId ? generated.id : match.sideAId,
              sideBId: match.sideBId === replacedPlayerId ? generated.id : match.sideBId
            }
          : match)
      }))
    };
    const rewrittenManagedMatch = generatedTournament.rounds[0]!.matches.find((match) => match.id === managedMatch.id)!;
    const onOpenPlayerProfile = vi.fn();

    render(
      <KnockoutTree
        tournament={generatedTournament}
        selectedPlayerId={managedPlayerId}
        playersById={playersById}
        onOpenPlayerProfile={onOpenPlayerProfile}
      />
    );

    const managedCard = screen.getByRole("button", {
      name: `Inspect Round of 16 match ${Number(rewrittenManagedMatch.id.split("-").at(-1))}: ${playersById[rewrittenManagedMatch.sideAId]!.name} vs ${playersById[rewrittenManagedMatch.sideBId]!.name}`
    });
    expect(within(managedCard).getByRole("button", { name: "A. Qureshi" })).toHaveAttribute("title", generated.name);
    expect(screen.queryByText(generated.id)).not.toBeInTheDocument();

    const detail = screen.getByLabelText("Selected match details");
    expect(within(detail).getByRole("button", { name: generated.name })).toBeInTheDocument();

    fireEvent.click(within(managedCard).getByRole("button", { name: "A. Qureshi" }));
    fireEvent.click(within(detail).getByRole("button", { name: generated.name }));
    expect(onOpenPlayerProfile).toHaveBeenNthCalledWith(1, generated.id);
    expect(onOpenPlayerProfile).toHaveBeenNthCalledWith(2, generated.id);
  });

  it("preserves champion styling after the final is decided", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const championTournament = advanceManagedPlayerToTitle(
      createTournament(seededPlayers, managedPlayerId, 7803),
      managedPlayerId
    );

    const { container } = render(
      <KnockoutTree
        tournament={championTournament}
        selectedPlayerId={managedPlayerId}
        onOpenPlayerProfile={() => undefined}
      />
    );

    expect(container.querySelector(".bracket-card-champion")).toBeInTheDocument();
  });

  it("renders a five-round Round of 32 bracket shape when a draw includes R32 data", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const playerIds = seededPlayers.slice(0, 32).map((entry) => entry.player.id);
    const roundOf32Matches = Array.from({ length: 16 }, (_, index) => ({
      id: `R32-${index + 1}`,
      round: "R32",
      sideAId: playerIds[index * 2]!,
      sideBId: playerIds[index * 2 + 1]!,
      winnerId: index === 0 ? playerIds[0] : undefined,
      scoreline: index === 0 ? "21-12, 21-13" : undefined,
      managed: index === 0,
      completed: index === 0
    }));
    const tournament32 = {
      ...createTournament(seededPlayers, managedPlayerId, 7812),
      rounds: [{ name: "R32", matches: roundOf32Matches }]
    } as unknown as TournamentState;

    render(
      <KnockoutTree
        tournament={tournament32}
        selectedPlayerId={managedPlayerId}
        onOpenPlayerProfile={() => undefined}
      />
    );

    expect(screen.getByRole("heading", { name: "Round of 32" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Round of 16" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final" })).toBeInTheDocument();
    expect(screen.getByText("Winner R32-2")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Inspect Round of 32 match/ })).toHaveLength(16);
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

    const compactNames = compactBracketNamesForDraw(
      [...new Set(tournament.rounds.flatMap((round) => round.matches.flatMap((match) => [match.sideAId, match.sideBId])))]
        .map((playerId) => playerMap[playerId])
    );

    fireEvent.click(screen.getByRole("button", { name: compactNames[managedPlayerId] }));

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
    expect(within(screen.getByLabelText("Knockout tree")).queryByText("21-14, 21-16")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `Inspect Round of 16 match ${Number(context.matchId.split("-").at(-1))}: ${playerMap[context.playerAId]!.name} vs ${playerMap[context.playerBId]!.name}`
      })
    );

    expect(within(screen.getByLabelText("Selected match details")).getByText("21-14, 21-16")).toBeInTheDocument();
  });
});
