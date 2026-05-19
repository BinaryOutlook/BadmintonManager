import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerNavigationProvider } from "../../app/playerNavigation";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import { PlayerProfilePage } from "../../app/pages/PlayerProfilePage";
import { createInitialCareerState } from "../../game/career/state";
import { seededPlayers } from "../../game/content/players";

describe("player profile career tab", () => {
  it("renders persisted career history and links head-to-head opponents by player id", () => {
    const managed = seededPlayers[0].player;
    const opponent = seededPlayers[1].player;
    const onOpenPlayerProfile = vi.fn();
    const onOpenTournamentHome = vi.fn();
    const career = {
      ...createInitialCareerState(managed.id, 7420),
      matchHistory: [
        {
          id: "metro-open-300:R16-1",
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-03",
          round: "R16" as const,
          playerAId: managed.id,
          playerBId: opponent.id,
          winnerId: managed.id,
          scoreline: "21-13, 21-15"
        },
        {
          id: "harbor-masters-500:F-1",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-17",
          round: "F" as const,
          playerAId: opponent.id,
          playerBId: managed.id,
          winnerId: opponent.id,
          scoreline: "18-21, 19-21"
        }
      ],
      playerAchievements: [
        {
          playerId: managed.id,
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-07",
          result: "champion" as const
        },
        {
          playerId: managed.id,
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-17",
          result: "runner_up" as const
        }
      ]
    };

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={onOpenPlayerProfile}>
        <TournamentNavigationProvider onOpenTournamentHome={onOpenTournamentHome}>
          <PlayerProfilePage
            playerId={managed.id}
            selectedPlayerId={managed.id}
            phase="setup"
            careerPresent={true}
            career={career}
            tournament={null}
            liveMatchSession={null}
            onBack={vi.fn()}
            onSelectPlayer={vi.fn()}
          />
        </TournamentNavigationProvider>
      </PlayerNavigationProvider>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Career" }));

    expect(screen.getByRole("heading", { name: "Career Record" })).toBeInTheDocument();
    expect(screen.getByText("W-L: 1-1")).toBeInTheDocument();
    expect(screen.getByText("Win %: 50%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Titles" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open tournament home for Metro Open" }));
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: "metro-open-300" });
    expect(screen.getByRole("heading", { name: "Runner-Up Finishes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open tournament home for Harbor Masters" }));
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: "harbor-masters-500" });

    const table = screen.getByRole("table", { name: "Head-to-head records" });
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(within(table).getByText("1-1")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: opponent.name }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(opponent.id);
  });
});
