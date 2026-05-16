import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App, canAdvanceCareerDate } from "../../app/App";
import { seededPlayers } from "../../game/content/players";
import { createInitialCareerState } from "../../game/career/state";
import type { CareerState } from "../../game/career/models";
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

describe("career shell day advancement", () => {
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
    expect(screen.getByRole("heading", { name: "Calendar / Event Desk" })).toBeInTheDocument();
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
});
