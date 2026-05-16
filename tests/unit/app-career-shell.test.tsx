import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App, canAdvanceCareerDate } from "../../app/App";
import { eventActionForCareer } from "../../components/CareerWorkbench";
import { seededPlayers } from "../../game/content/players";
import { getCareerEvent } from "../../game/career/events";
import { createInitialCareerState } from "../../game/career/state";
import type { MatchResult, Side } from "../../game/core/models";
import type { CareerState } from "../../game/career/models";
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

function resetStoreWithCareer(career: CareerState) {
  installWindowStorage();
  useTournamentStore.setState({
    phase: "setup",
    selectedPlayerId: career.program.managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed: 7701,
    tournament: null,
    liveMatch: null,
    career,
    saveRecovery: null,
    activeSavePresent: true,
    corruptSavePresent: false
  });
}

function straightGamesResult(winner: Side): MatchResult {
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
      winnersA: winner === "A" ? 20 : 10,
      winnersB: winner === "B" ? 20 : 10,
      unforcedErrorsA: winner === "A" ? 8 : 18,
      unforcedErrorsB: winner === "B" ? 8 : 18,
      totalSmashesA: 14,
      totalSmashesB: 12,
      peakSmashSpeedA: 380,
      peakSmashSpeedB: 374,
      staminaDrainA: 7,
      staminaDrainB: 10,
      longestRally: 24,
      totalPoints: 72
    },
    scoreline: winner === "A" ? "21-14, 21-16" : "14-21, 16-21",
    fidelity: "detailed",
    summaryEvents: []
  };
}

function buildNextRoundTournament(career: CareerState) {
  const event = getCareerEvent(career.events, "metro-open-300");

  if (!event) {
    throw new Error("Expected Metro Open fixture.");
  }

  const tournament = {
    ...createTournament(seededPlayers, career.program.managedPlayerId, 8801),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };
  const context = getManagedMatchContext(tournament);

  if (!context) {
    throw new Error("Expected opening managed match.");
  }

  const managedSide = context.playerAId === career.program.managedPlayerId ? "A" : "B";

  return advanceTournament({
    tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: straightGamesResult(managedSide)
  });
}

describe("career shell day advancement", () => {
  it("maps Calendar event actions to schedule-aware next steps", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const baseCareer = createInitialCareerState(managedPlayerId, 8800);
    const event = getCareerEvent(baseCareer.events, "metro-open-300");

    if (!event) {
      throw new Error("Expected Metro Open fixture.");
    }

    const actionDefaults = {
      tournament: null,
      event,
      affordable: true,
      medicalAllowed: true,
      tierAllowed: true
    };

    expect(eventActionForCareer({ ...actionDefaults, career: baseCareer })).toMatchObject({
      label: "Enter Event",
      action: "enter",
      disabled: false
    });

    expect(
      eventActionForCareer({
        ...actionDefaults,
        career: {
          ...baseCareer,
          activeEventId: event.id,
          enteredEventIds: [event.id],
          stage: "event_entered"
        }
      })
    ).toMatchObject({
      label: "Await Draw",
      action: "none",
      disabled: true
    });

    expect(
      eventActionForCareer({
        ...actionDefaults,
        career: {
          ...baseCareer,
          date: event.drawDate,
          activeEventId: event.id,
          enteredEventIds: [event.id],
          stage: "event_entered"
        }
      })
    ).toMatchObject({
      label: "View Draw",
      action: "openBracket",
      disabled: false
    });

    expect(
      eventActionForCareer({
        ...actionDefaults,
        career: {
          ...baseCareer,
          date: event.startDate,
          activeEventId: event.id,
          enteredEventIds: [event.id],
          stage: "pre_match"
        }
      })
    ).toMatchObject({
      label: "Play Match",
      action: "openBracket",
      disabled: false
    });

    const qfTournament = buildNextRoundTournament(baseCareer);
    expect(
      eventActionForCareer({
        ...actionDefaults,
        tournament: qfTournament,
        career: {
          ...baseCareer,
          date: event.startDate,
          activeEventId: event.id,
          enteredEventIds: [event.id],
          stage: "between_rounds"
        }
      })
    ).toMatchObject({
      label: "Next Match 2026-06-04",
      action: "none",
      disabled: true
    });

    expect(
      eventActionForCareer({
        ...actionDefaults,
        career: {
          ...baseCareer,
          date: event.startDate,
          activeEventId: event.id,
          enteredEventIds: [event.id],
          stage: "post_match"
        }
      })
    ).toMatchObject({
      label: "Review Match",
      action: "openReview",
      disabled: false
    });

    expect(
      eventActionForCareer({
        ...actionDefaults,
        career: {
          ...baseCareer,
          completedEventIds: [event.id],
          eventHistory: [
            {
              eventId: event.id,
              eventName: event.name,
              tier: event.tier,
              startDate: event.startDate,
              endDate: "2026-06-07",
              status: "champion",
              entered: true,
              resultRound: "champion",
              pointsAwarded: 700,
              prizeMoney: 15000,
              entryCost: 750,
              travelCost: 2800,
              netCash: 11450,
              completedAt: "2026-06-06",
              matchIds: ["match-1"],
              scorelines: ["21-14, 21-16"],
              achievements: ["First Title"]
            }
          ]
        }
      })
    ).toMatchObject({
      label: "View Result",
      action: "openHistory",
      disabled: false
    });
  });

  it("centralizes which career stages can advance the calendar", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const baseCareer = createInitialCareerState(managedPlayerId, 7701);

    expect(canAdvanceCareerDate({ ...baseCareer, stage: "planning" }, "setup")).toBe(true);
    expect(canAdvanceCareerDate({ ...baseCareer, stage: "event_entered" }, "overview")).toBe(true);
    expect(canAdvanceCareerDate({ ...baseCareer, stage: "between_rounds" }, "overview")).toBe(true);
    expect(canAdvanceCareerDate({ ...baseCareer, stage: "event_complete" }, "setup")).toBe(true);
    expect(canAdvanceCareerDate({ ...baseCareer, stage: "pre_match" }, "overview")).toBe(false);
    expect(canAdvanceCareerDate({ ...baseCareer, stage: "post_match" }, "overview")).toBe(false);
    expect(canAdvanceCareerDate({ ...baseCareer, stage: "event_entered" }, "match")).toBe(false);
    expect(canAdvanceCareerDate(null, "setup")).toBe(false);
  });

  it("advances the career date from the global topbar outside the calendar page", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const career = createInitialCareerState(managedPlayerId, 7702);
    resetStoreWithCareer(career);

    render(<App />);

    expect(screen.getByRole("heading", { name: "Career Command Center" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Advance Day" }));

    expect(useTournamentStore.getState().career?.date).toBe("2026-06-02");
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Past Events" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Advance Day" })).toHaveLength(1);
  });

  it("keeps normal career pages free of duplicate in-page Advance Day buttons", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const career = createInitialCareerState(managedPlayerId, 7704);
    resetStoreWithCareer(career);

    render(<App />);

    expect(screen.getAllByRole("button", { name: "Advance Day" })).toHaveLength(1);

    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Program Hub" }));
    expect(screen.getByRole("heading", { name: "Program Ecosystem" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Advance Day" })).toHaveLength(1);
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Advance Day" })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: /Scouting Network/ }));
    expect(screen.getByRole("heading", { name: "Reduce Uncertainty" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Advance Day" })).toHaveLength(1);
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Advance Day" })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Program Hub" }));
    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: /Facilities Upgrades/ }));
    expect(screen.getByRole("heading", { name: "Facilities Upgrades" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Advance Day" })).toHaveLength(1);
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Advance Day" })).not.toBeInTheDocument();
  });

  it("routes into the pre-match hub when a topbar day advance reaches match day", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const career = {
      ...createInitialCareerState(managedPlayerId, 7703),
      date: "2026-06-02",
      activeEventId: "metro-open-300",
      enteredEventIds: ["metro-open-300"],
      stage: "event_entered" as const
    };
    resetStoreWithCareer(career);

    render(<App />);

    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Advance Day" }));

    expect(useTournamentStore.getState().career?.date).toBe("2026-06-03");
    expect(useTournamentStore.getState().career?.stage).toBe("pre_match");
    expect(useTournamentStore.getState().tournament).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Opponent Briefing" })).toBeInTheDocument();
    expect(screen.getByLabelText("Knockout tree")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Open Live Desk" }));

    expect(useTournamentStore.getState().career?.date).toBe("2026-06-03");
    expect(screen.getByRole("heading", { name: "Opponent Briefing" })).toBeInTheDocument();
  });

  it("blocks topbar day advancement when an unplayed match is already due", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const career = {
      ...createInitialCareerState(managedPlayerId, 7705),
      date: "2026-06-03",
      activeEventId: "metro-open-300",
      enteredEventIds: ["metro-open-300"],
      stage: "event_entered" as const
    };
    resetStoreWithCareer(career);

    render(<App />);

    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Advance Day" }));

    expect(useTournamentStore.getState().career?.date).toBe("2026-06-03");
    expect(useTournamentStore.getState().career?.stage).toBe("pre_match");
    expect(useTournamentStore.getState().career?.notes[0]).toContain("Match day blocked");
    expect(useTournamentStore.getState().tournament).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Opponent Briefing" })).toBeInTheDocument();
  });

  it("renders actual Past Events history with result and economy details", () => {
    const managedPlayerId = seededPlayers[0].player.id;
    const baseCareer = createInitialCareerState(managedPlayerId, 7706);
    const event = getCareerEvent(baseCareer.events, "metro-open-300");

    if (!event) {
      throw new Error("Expected Metro Open fixture.");
    }

    const career: CareerState = {
      ...baseCareer,
      completedEventIds: [event.id],
      eventHistory: [
        {
          eventId: event.id,
          eventName: event.name,
          tier: event.tier,
          startDate: event.startDate,
          endDate: "2026-06-07",
          status: "champion",
          entered: true,
          resultRound: "champion",
          pointsAwarded: 700,
          prizeMoney: 15000,
          entryCost: 750,
          travelCost: 2800,
          netCash: 11450,
          completedAt: "2026-06-06",
          matchIds: ["metro-final"],
          scorelines: ["21-14, 21-16"],
          achievements: ["First Title", "Points Finish"]
        },
        {
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          tier: "Circuit 500",
          startDate: "2026-06-12",
          endDate: "2026-06-17",
          status: "missed_deadline",
          entered: false,
          resultRound: null,
          pointsAwarded: 0,
          prizeMoney: 0,
          entryCost: 0,
          travelCost: 0,
          netCash: 0,
          completedAt: "2026-06-18",
          matchIds: [],
          scorelines: [],
          achievements: []
        }
      ]
    };
    resetStoreWithCareer(career);

    render(<App />);

    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Calendar" }));
    fireEvent.click(screen.getByRole("tab", { name: "Past Events" }));

    const history = screen.getByLabelText("Past event history");
    expect(within(history).getByText("Metro Open")).toBeInTheDocument();
    expect(within(history).getByText("Champion")).toBeInTheDocument();
    expect(within(history).getByText("21-14, 21-16")).toBeInTheDocument();
    expect(within(history).getByText("700 pts")).toBeInTheDocument();
    expect(within(history).getByText("$15,000")).toBeInTheDocument();
    expect(within(history).getByText("+$11,450")).toBeInTheDocument();
    expect(within(history).getByText("First Title")).toBeInTheDocument();
    expect(within(history).getByText("Harbor Masters")).toBeInTheDocument();
    expect(within(history).getByText("Missed")).toBeInTheDocument();
    expect(screen.queryByText(/safe coming state/)).not.toBeInTheDocument();
  });
});
