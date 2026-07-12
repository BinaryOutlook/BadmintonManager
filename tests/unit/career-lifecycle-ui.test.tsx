import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { addDays } from "../../game/career/calendar";
import { getCareerDailyAction } from "../../game/career/dailyAction";
import { eventEndDate, recordPastCareerEvents } from "../../game/career/events";
import { finalizeSeasonReview, generateCareerSeasonEvents, startNextSeason } from "../../game/career/lifecycle";
import { careerInboxItems } from "../../game/career/managementMemory";
import type { CareerState } from "../../game/career/models";
import { createInitialCareerState } from "../../game/career/state";
import { advanceWorldRegistry, protectedWorldPlayerIds } from "../../game/career/world";
import { simulateUniverseThroughDate } from "../../game/career/universe";
import { seededPlayers } from "../../game/content/players";
import { useTournamentStore } from "../../game/store/store";

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

function finalizeCareerSeason(initial: CareerState): CareerState {
  const endDate = initial.events.reduce(
    (latest, event) => eventEndDate(event) > latest ? eventEndDate(event) : latest,
    "2026-01-01"
  );
  const date = addDays(endDate, 1);
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

  return finalizeSeasonReview(recordPastCareerEvents(simulated));
}

function finalizedSeason(): CareerState {
  return finalizeCareerSeason(createInitialCareerState(seededPlayers[0].player.id, 52_001));
}

function installCareer(career: CareerState) {
  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true
  });
  useTournamentStore.setState({
    phase: "setup",
    selectedPlayerId: career.program.managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed: career.seed,
    tournament: null,
    liveMatch: null,
    career,
    saveRecovery: null,
    activeSavePresent: true,
    corruptSavePresent: false
  });
}

describe("career lifecycle management UI", () => {
  it("turns a finalized season into one stable required Reports action", () => {
    const career = finalizedSeason();

    expect(getCareerDailyAction({
      career,
      tournament: null,
      phase: "setup",
      liveMatchActive: false
    })).toMatchObject({
      kind: "review_season",
      label: "Review 2026 Season",
      route: "reports",
      seasonId: "2026"
    });
    expect(careerInboxItems(career)).toContainEqual(expect.objectContaining({
      id: "inbox:season-review:2026",
      category: "season",
      priority: "required",
      destination: { kind: "reports" }
    }));
  });

  it("keeps rollover explicit in Reports and opens exactly the next season", () => {
    const career = finalizedSeason();
    installCareer(career);

    render(<App />);

    const banner = screen.getByRole("banner");
    fireEvent.click(within(banner).getByRole("button", { name: "Review 2026 Season" }));

    expect(screen.getByRole("heading", { level: 1, name: "Institutional Memory" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Season Review" })).toBeInTheDocument();
    expect(useTournamentStore.getState().career).toBe(career);

    fireEvent.click(screen.getByRole("button", { name: "Start 2027 Season" }));

    const next = useTournamentStore.getState().career;
    expect(next?.seasonId).toBe("2027");
    expect(next?.events).toEqual(generateCareerSeasonEvents("2027"));
    expect(next?.seasonReviews).toEqual(career.seasonReviews);
    expect(screen.getByRole("heading", { level: 1, name: "Career Command Center" })).toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Advance Day" })).toBeInTheDocument();
  });

  it("keeps every finalized season review selectable after later rollovers", () => {
    const closed2026 = finalizedSeason();
    const closed2027 = finalizeCareerSeason(startNextSeason(closed2026));
    const career = startNextSeason(closed2027);
    installCareer(career);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Reports/ }));

    const archiveTabs = screen.getByRole("tablist", { name: "Season review archive" });
    expect(within(archiveTabs).getByRole("tab", { name: "2027" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(archiveTabs).getByRole("tab", { name: "2026" }));
    expect(within(archiveTabs).getByRole("tab", { name: "2026" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/2026 finalized/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start 2027 Season" })).not.toBeInTheDocument();
  });

  it("exposes persisted world intake and progression records in Reports", () => {
    const initial = createInitialCareerState(seededPlayers[0].player.id, 52_003);
    const career: CareerState = {
      ...initial,
      seasonId: "2027",
      date: "2027-01-01",
      world: advanceWorldRegistry({
        registry: initial.world,
        careerSeed: initial.seed,
        seasonId: "2027",
        date: "2027-01-01",
        protectedPlayerIds: protectedWorldPlayerIds(initial)
      })
    };
    const generated = career.world.players.find((record) => record.origin === "generated_intake");

    if (!generated) {
      throw new Error("Expected the 2027 world intake.");
    }

    installCareer(career);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Reports/ }));

    const movement = screen.getByLabelText("Circuit movement 2027");
    expect(within(movement).getByRole("heading", { name: "Circuit Movement" })).toBeInTheDocument();
    expect(within(movement).getByText(generated.player.name)).toBeInTheDocument();
    expect(within(movement).getByText("Progression").parentElement).toHaveTextContent(
      String(career.world.lifecycleLog.filter((event) => event.seasonId === "2027" && event.type === "progression").length)
    );
  });
});
