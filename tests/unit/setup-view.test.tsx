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

function openQuickSelectionModal() {
  fireEvent.click(screen.getByRole("button", { name: "Quick Tournament" }));

  return screen.getByRole("dialog", { name: "Pick Your Playstyle" });
}

describe("SetupView", () => {
  it("presents a direct start screen and confirms a deliberately selected career athlete", () => {
    const onSelectPlayer = vi.fn();
    const onStartTournament = vi.fn();
    const onStartCareer = vi.fn();
    const onOpenSaveManager = vi.fn();
    const onOpenPreferences = vi.fn();
    const topRanked = rankRosterByOverall()[0];

    renderSetupView({
      onSelectPlayer,
      onStartTournament,
      onStartCareer,
      onOpenSaveManager,
      onOpenPreferences
    });

    expect(screen.getByRole("heading", { name: "Start Screen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse All Athletes" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));
    const dialog = screen.getByRole("dialog", { name: "Pick Your Playstyle" });
    expect(within(dialog).getByText("New Career")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm Career Athlete" })).toBeDisabled();
    expect(within(dialog).queryByRole("heading", { name: "Strategic Override" })).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: new RegExp(`Select featured ${topRanked.entry.player.name}`)
      })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Career Athlete" }));

    fireEvent.click(screen.getByRole("button", { name: "Load Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));

    expect(onStartTournament).not.toHaveBeenCalled();
    expect(onStartCareer).toHaveBeenCalledTimes(1);
    expect(onStartCareer).toHaveBeenCalledWith(topRanked.entry.player.id);
    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(onOpenSaveManager).toHaveBeenCalledTimes(1);
    expect(onOpenPreferences).toHaveBeenCalledTimes(1);
  });

  it("opens quick tournament as a blocking modal with explicit selection and compact tactics", () => {
    const onSelectPlayer = vi.fn();
    const onStartTournament = vi.fn();
    const onChooseTactic = vi.fn();
    const topRanked = rankRosterByOverall()[0];

    renderSetupView({ onSelectPlayer, onStartTournament, onChooseTactic });

    const dialog = openQuickSelectionModal();

    expect(screen.queryByRole("heading", { name: "Quick Tournament Setup" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Pick Your Playstyle" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Strategic Override" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Start Tournament" })).toBeDisabled();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: new RegExp(`Select featured ${topRanked.entry.player.name}`)
      })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /Defensive Wall/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Start Tournament" }));

    expect(onSelectPlayer).toHaveBeenCalledWith(topRanked.entry.player.id);
    expect(onChooseTactic).toHaveBeenCalledWith("defensiveWall");
    expect(onStartTournament).toHaveBeenCalledTimes(1);
    expect(onStartTournament).toHaveBeenCalledWith(topRanked.entry.player.id);
  });

  it("shows recommendations first and keeps the full roster as a fallback inside the modal", () => {
    renderSetupView();
    const dialog = openQuickSelectionModal();

    expect(within(dialog).getByRole("heading", { name: "Pick Your Playstyle" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Best Overall/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: /Attack First/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Control Artist/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Rally Engine/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Underdog/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Active Roster" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Featured recommendation:/)).toHaveTextContent("Featured Coach Pick");
    expect(within(dialog).getByLabelText("Supporting recommendations").querySelectorAll(".recommendation-pick")).toHaveLength(4);

    fireEvent.click(within(dialog).getByRole("button", { name: /Attack First/ }));

    expect(within(dialog).getByRole("button", { name: /Attack First/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getAllByText(/aggression/i).length).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText(/Featured recommendation:/)).toHaveTextContent("short rallies");

    fireEvent.click(within(dialog).getByRole("button", { name: "Browse All Athletes" }));

    const rosterPanel = within(dialog).getByRole("heading", { name: "Active Roster" }).closest("section");
    expect(rosterPanel).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Search")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Country")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tier")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Style")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Sort")).toBeInTheDocument();

    const athleteCards = rosterPanel!.querySelectorAll(".athlete-card");
    const topRanked = rankRosterByOverall()[0];

    expect(within(athleteCards[0] as HTMLElement).getByRole("button", { name: topRanked.entry.player.name })).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).getByText(topRanked.entry.player.nationality)).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).getByText("OVR Rank #1")).toBeInTheDocument();
    expect(within(athleteCards[0] as HTMLElement).queryByText("GS")).not.toBeInTheDocument();
    expect(within(rosterPanel!).queryByText(/Seed #/)).not.toBeInTheDocument();
  });

  it("selects from the featured coach pick, supporting alternatives, and full roster browse", () => {
    const onSelectPlayer = vi.fn();
    const topRanked = rankRosterByOverall()[0];

    renderSetupView({ onSelectPlayer });
    const dialog = openQuickSelectionModal();

    const featuredCard = within(dialog).getByLabelText(/Featured recommendation:/);
    fireEvent.click(within(featuredCard).getByRole("button", { name: /Select featured/ }));

    expect(onSelectPlayer).toHaveBeenCalledWith(topRanked.entry.player.id);

    const supportingRecommendations = within(dialog).getByLabelText("Supporting recommendations");
    fireEvent.click(within(supportingRecommendations).getAllByRole("button", { name: /Select/ })[0]);

    expect(onSelectPlayer).toHaveBeenCalledTimes(2);

    fireEvent.click(within(dialog).getByRole("button", { name: "Browse All Athletes" }));
    const rosterPanel = within(dialog).getByRole("heading", { name: "Active Roster" }).closest("section");
    fireEvent.click(within(rosterPanel!).getAllByRole("button", { name: /Select/ })[0]);

    expect(onSelectPlayer).toHaveBeenCalledTimes(3);
  });

  it("filters the full roster by country and resets browse state", () => {
    renderSetupView();
    const dialog = openQuickSelectionModal();

    fireEvent.click(within(dialog).getByRole("button", { name: "Browse All Athletes" }));
    fireEvent.change(within(dialog).getByLabelText("Country"), { target: { value: "CHN" } });

    expect(within(dialog).getByText("Country: CHN")).toBeInTheDocument();

    const rosterPanel = within(dialog).getByRole("heading", { name: "Active Roster" }).closest("section");
    const athleteCards = rosterPanel!.querySelectorAll(".athlete-card");

    expect(athleteCards.length).toBeGreaterThan(0);
    athleteCards.forEach((card) => {
      expect(within(card as HTMLElement).getByText("CHN")).toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear Filters" }));

    expect(within(dialog).queryByText("Country: CHN")).not.toBeInTheDocument();
    expect(within(dialog).getByText("All athletes")).toBeInTheDocument();
  });

  it("selects a career athlete from full roster browse without mutating setup selection", () => {
    const onSelectPlayer = vi.fn();
    const onStartCareer = vi.fn();
    const target = rankRosterByOverall()[1];

    renderSetupView({ onSelectPlayer, onStartCareer });
    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));
    const dialog = screen.getByRole("dialog", { name: "Pick Your Playstyle" });

    expect(within(dialog).getByRole("button", { name: "Confirm Career Athlete" })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Browse All Athletes" }));
    fireEvent.change(within(dialog).getByLabelText("Search"), {
      target: { value: target.entry.player.name }
    });
    const rosterPanel = within(dialog).getByRole("heading", { name: "Active Roster" }).closest("section")!;
    fireEvent.click(within(rosterPanel).getByRole("button", { name: `Select ${target.entry.player.name}` }));

    expect(within(dialog).getByRole("button", { name: "Confirm Career Athlete" })).toBeEnabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Career Athlete" }));

    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(onStartCareer).toHaveBeenCalledWith(target.entry.player.id);
  });

  it("clears stale modal selection after cancelling and reopening career selection", () => {
    const topRanked = rankRosterByOverall()[0];

    renderSetupView();
    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));
    let dialog = screen.getByRole("dialog", { name: "Pick Your Playstyle" });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: new RegExp(`Select featured ${topRanked.entry.player.name}`)
      })
    );
    expect(within(dialog).getByRole("button", { name: "Confirm Career Athlete" })).toBeEnabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));
    dialog = screen.getByRole("dialog", { name: "Pick Your Playstyle" });

    expect(within(dialog).getByRole("button", { name: "Confirm Career Athlete" })).toBeDisabled();
  });

  it("closes the selection modal on Escape without writing a career save", () => {
    const onStartCareer = vi.fn();

    renderSetupView({ onStartCareer });
    fireEvent.click(screen.getByRole("button", { name: "Start New Career" }));

    const dialog = screen.getByRole("dialog", { name: "Pick Your Playstyle" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Pick Your Playstyle" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start Screen" })).toBeInTheDocument();
    expect(onStartCareer).not.toHaveBeenCalled();
  });
});
