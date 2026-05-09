import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { SetupView, rankRosterByOverall } from "../../components/SetupView";

describe("SetupView", () => {
  it("renders athlete selection in OVR descending order", () => {
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

    const rosterPanel = screen.getByRole("heading", { name: "Active Roster" }).closest("section");

    expect(rosterPanel).toBeInTheDocument();

    const athleteCards = rosterPanel!.querySelectorAll(".athlete-card");
    const topRanked = rankRosterByOverall()[0];

    expect(within(athleteCards[0] as HTMLElement).getByRole("button", { name: topRanked.entry.player.name })).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).getByText(topRanked.entry.player.nationality)).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).getByText("OVR Rank #1")).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).queryByText("GS")).not.toBeInTheDocument();
    expect(within(rosterPanel!).queryByText(/Seed #/)).not.toBeInTheDocument();
  });
});
