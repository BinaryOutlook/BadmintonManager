import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { SetupView, rankRosterByOverall } from "../../components/SetupView";

function renderSetupView(overrides: Partial<Parameters<typeof SetupView>[0]> = {}) {
  return render(
    <SetupView
      selectedPlayerId={seededPlayers[0].player.id}
      plannedTacticKey="balancedControl"
      onSelectPlayer={vi.fn()}
      onOpenPlayerProfile={vi.fn()}
      onChooseTactic={vi.fn()}
      onStartTournament={vi.fn()}
      onStartCareer={vi.fn()}
      onContinueLocalSave={vi.fn()}
      onOpenSaveManager={vi.fn()}
      onOpenPreferences={vi.fn()}
      activeSavePresent={false}
      careerPresent={false}
      corruptSavePresent={false}
      {...overrides}
    />
  );
}

describe("SetupView", () => {
  it("presents a direct start screen and confirms the locked career athlete", () => {
    const onStartTournament = vi.fn();
    const onStartCareer = vi.fn();
    const onOpenSaveManager = vi.fn();
    const onOpenPreferences = vi.fn();

    renderSetupView({ onStartTournament, onStartCareer, onOpenSaveManager, onOpenPreferences });

    expect(screen.getByRole("heading", { name: "Start Screen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse All Athletes" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));
    expect(screen.getByRole("dialog", { name: "Confirm Career Athlete" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Choose Grand-Slam Southpaw/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm Grand-Slam Southpaw/ }));

    fireEvent.click(screen.getByRole("button", { name: "Quick Tournament" }));
    expect(screen.getByRole("heading", { name: "Quick Tournament Setup" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Tournament" }));
    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));
    fireEvent.click(screen.getByRole("button", { name: "Load Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));

    expect(onStartTournament).toHaveBeenCalledTimes(1);
    expect(onStartCareer).toHaveBeenCalledTimes(1);
    expect(onStartCareer).toHaveBeenCalledWith("player-17");
    expect(onOpenSaveManager).toHaveBeenCalledTimes(1);
    expect(onOpenPreferences).toHaveBeenCalledTimes(1);
  });

  it("shows recommendations first and keeps the full roster as a fallback", () => {
    renderSetupView();
    fireEvent.click(screen.getByRole("button", { name: "Quick Tournament" }));

    expect(screen.getByRole("heading", { name: "Pick Your Playstyle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Best Overall/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Attack First/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Control Artist/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rally Engine/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Underdog/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Active Roster" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Featured recommendation:/)).toHaveTextContent("Featured Coach Pick");
    expect(screen.getByLabelText("Supporting recommendations").querySelectorAll(".recommendation-pick")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: /Attack First/ }));

    expect(screen.getByRole("button", { name: /Attack First/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(/aggression/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Featured recommendation:/)).toHaveTextContent("short rallies");

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

  it("selects from the featured coach pick and supporting alternatives", () => {
    const onSelectPlayer = vi.fn();

    renderSetupView({ onSelectPlayer });
    fireEvent.click(screen.getByRole("button", { name: "Quick Tournament" }));

    const featuredCard = screen.getByLabelText(/Featured recommendation:/);
    fireEvent.click(within(featuredCard).getByRole("button", { name: /Select featured/ }));

    expect(onSelectPlayer).toHaveBeenCalledTimes(1);

    const supportingRecommendations = screen.getByLabelText("Supporting recommendations");
    fireEvent.click(within(supportingRecommendations).getAllByRole("button", { name: /Select/ })[0]);

    expect(onSelectPlayer).toHaveBeenCalledTimes(2);
  });

  it("filters the full roster by country and resets browse state", () => {
    renderSetupView();
    fireEvent.click(screen.getByRole("button", { name: "Quick Tournament" }));

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
