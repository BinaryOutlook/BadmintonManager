import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seededPlayers } from "../../src/game/content/players";
import { SetupView, rankRosterByOverall } from "../../src/components/SetupView";

describe("SetupView", () => {
  it("renders athlete selection in OVR descending order", () => {
    render(
      <SetupView
        selectedPlayerId={seededPlayers[0].player.id}
        plannedTacticKey="balancedControl"
        onSelectPlayer={vi.fn()}
        onChooseTactic={vi.fn()}
        onStartTournament={vi.fn()}
      />
    );

    const rosterPanel = screen.getByRole("heading", { name: "Active Roster" }).closest("section");

    expect(rosterPanel).toBeInTheDocument();

    const athleteButtons = within(rosterPanel!).getAllByRole("button");
    const topRanked = rankRosterByOverall()[0];

    expect(within(athleteButtons[0]).getByText(topRanked.entry.player.name)).toBeInTheDocument();
    expect(within(athleteButtons[0]).getByText(topRanked.entry.player.nationality)).toBeInTheDocument();
    expect(within(athleteButtons[0]).getByText("OVR Rank #1")).toBeInTheDocument();
    expect(within(athleteButtons[0]).queryByText("GS")).not.toBeInTheDocument();
    expect(within(rosterPanel!).queryByText(/Seed #/)).not.toBeInTheDocument();
  });
});
