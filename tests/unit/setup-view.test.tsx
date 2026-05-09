import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { SetupView, rankRosterByOverall } from "../../components/SetupView";

describe("SetupView", () => {
  it("shows recommendations first and keeps the full roster as a fallback", () => {
    render(
      <SetupView
        selectedPlayerId={seededPlayers[0].player.id}
        plannedTacticKey="balancedControl"
        onSelectPlayer={vi.fn()}
        onOpenPlayerProfile={vi.fn()}
        onChooseTactic={vi.fn()}
        onStartTournament={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Pick Your Playstyle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Best Overall/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Attack First/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Control Artist/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rally Engine/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Underdog/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Active Roster" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Attack First/ }));

    expect(screen.getByRole("button", { name: /Attack First/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(/aggression/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Browse All Athletes" }));

    const rosterPanel = screen.getByRole("heading", { name: "Active Roster" }).closest("section");
    expect(rosterPanel).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Tier")).toBeInTheDocument();
    expect(screen.getByLabelText("Style")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort")).toBeInTheDocument();

    const athleteCards = rosterPanel!.querySelectorAll(".athlete-card");
    const topRanked = rankRosterByOverall()[0];

    expect(within(athleteCards[0] as HTMLElement).getByRole("button", { name: topRanked.entry.player.name })).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).getByText(topRanked.entry.player.nationality)).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).getByText("OVR Rank #1")).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).queryByText("GS")).not.toBeInTheDocument();
    expect(within(rosterPanel!).queryByText(/Seed #/)).not.toBeInTheDocument();
  });

  it("filters the full roster by country and resets browse state", () => {
    render(
      <SetupView
        selectedPlayerId={seededPlayers[0].player.id}
        plannedTacticKey="balancedControl"
        onSelectPlayer={vi.fn()}
        onOpenPlayerProfile={vi.fn()}
        onChooseTactic={vi.fn()}
        onStartTournament={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse All Athletes" }));
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "CHN" } });

    expect(screen.getByText("Country: CHN")).toBeInTheDocument();

    const rosterPanel = screen.getByRole("heading", { name: "Active Roster" }).closest("section");
    const athleteCards = rosterPanel!.querySelectorAll(".athlete-card");

    expect(athleteCards.length).toBeGreaterThan(0);
    athleteCards.forEach((card) => {
      expect(within(card as HTMLElement).getByText("CHN")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));

    expect(screen.queryByText("Country: CHN")).not.toBeInTheDocument();
    expect(screen.getByText("All athletes")).toBeInTheDocument();
  });
});
