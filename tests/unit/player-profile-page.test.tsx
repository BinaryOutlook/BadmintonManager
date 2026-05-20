import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { PlayerNavigationProvider } from "../../app/playerNavigation";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import { PlayerProfilePage } from "../../app/pages/PlayerProfilePage";
import { createInitialCareerState } from "../../game/career/state";
import { seededPlayers } from "../../game/content/players";

function renderProfile(props: Partial<ComponentProps<typeof PlayerProfilePage>> = {}) {
  const managed = seededPlayers[0].player;

  return render(
    <PlayerNavigationProvider onOpenPlayerProfile={vi.fn()}>
      <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
        <PlayerProfilePage
          playerId={managed.id}
          selectedPlayerId={managed.id}
          phase="setup"
          careerPresent={false}
          career={null}
          tournament={null}
          liveMatchSession={null}
          onBack={vi.fn()}
          onSelectPlayer={vi.fn()}
          {...props}
        />
      </TournamentNavigationProvider>
    </PlayerNavigationProvider>
  );
}

describe("player profile career tab", () => {
  it("renders five tabs with Development for managed profiles and a manager verdict overview", () => {
    const managed = seededPlayers[0].player;
    const career = createInitialCareerState(managed.id, 7419);

    renderProfile({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      careerPresent: true,
      career
    });

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Development" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Scouting" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manager Verdict" })).toBeInTheDocument();
    expect(screen.getByText(/Best tactic:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Readiness Strip" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tactical Plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Training Recommendation" })).toBeInTheDocument();
  });

  it("renders Scouting for selectable profiles, keeps Select Athlete available, and explains the choice", () => {
    const managed = seededPlayers[0].player;
    const candidate = seededPlayers[1].player;
    const onSelectPlayer = vi.fn();

    renderProfile({
      playerId: candidate.id,
      selectedPlayerId: managed.id,
      careerPresent: false,
      phase: "setup",
      onSelectPlayer
    });

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Scouting" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Development" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scouting Verdict" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Threat / Fit Summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How They Win" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How To Beat Them" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Select Athlete" })[0]!);
    expect(onSelectPlayer).toHaveBeenCalledWith(candidate.id);
  });

  it("renders contextual Development and Scouting tab bodies", () => {
    const managed = seededPlayers[0].player;
    const candidate = seededPlayers[1].player;

    const { unmount } = renderProfile({
      playerId: managed.id,
      selectedPlayerId: managed.id,
      careerPresent: true,
      career: createInitialCareerState(managed.id, 7429)
    });

    fireEvent.click(screen.getByRole("tab", { name: "Development" }));
    expect(screen.getByRole("heading", { name: "Development Plan" })).toBeInTheDocument();
    expect(screen.getByText(/Expected Gain:/)).toBeInTheDocument();
    unmount();

    renderProfile({
      playerId: candidate.id,
      selectedPlayerId: managed.id,
      careerPresent: false,
      phase: "setup"
    });

    fireEvent.click(screen.getByRole("tab", { name: "Scouting" }));
    expect(screen.getByRole("heading", { name: "Scouting Confidence" })).toBeInTheDocument();
    expect(screen.getByText(/Next Scout Focus:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uncertain Areas" })).toBeInTheDocument();
  });

  it("supports keyboard navigation across the tablist", () => {
    renderProfile();

    const overview = screen.getByRole("tab", { name: "Overview" });
    fireEvent.keyDown(overview, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Attributes" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: "Attributes" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Development" })).toHaveAttribute("aria-selected", "true");
  });

  it("uses compact performance empty states instead of blank panels", () => {
    renderProfile();

    fireEvent.click(screen.getByRole("tab", { name: "Performance" }));

    expect(screen.getByRole("heading", { name: "Recent Form" })).toBeInTheDocument();
    expect(screen.getByText("No recent form yet.")).toBeInTheDocument();
    expect(screen.getByText("Last match evidence locked.")).toBeInTheDocument();
    expect(screen.getByText("Shot profile unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Telemetry State" })).toBeInTheDocument();
  });

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
          scoreline: "21-13, 21-15",
          source: "played" as const
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
          scoreline: "18-21, 19-21",
          source: "played" as const
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
    expect(screen.getByText("Finals: 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Titles" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open tournament home for Metro Open" })[0]!);
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: "metro-open-300" });
    expect(screen.getByRole("heading", { name: "Runner-Up Finishes" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open tournament home for Harbor Masters" })[0]!);
    expect(onOpenTournamentHome).toHaveBeenCalledWith({ seasonId: career.seasonId, eventId: "harbor-masters-500" });

    const table = screen.getByRole("table", { name: "Head-to-head records" });
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(within(table).getByText("1-1")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: opponent.name }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(opponent.id);
  });

  it("renders non-managed universe records and an optional managed-player spotlight", () => {
    const managed = seededPlayers[0].player;
    const player = seededPlayers[1].player;
    const universeOpponent = seededPlayers[2].player;
    const onOpenPlayerProfile = vi.fn();
    const career = {
      ...createInitialCareerState(managed.id, 7421),
      matchHistory: [
        {
          id: "metro-open-300:R16-2",
          eventId: "metro-open-300",
          eventName: "Metro Open",
          date: "2026-06-03",
          round: "R16" as const,
          playerAId: player.id,
          playerBId: universeOpponent.id,
          winnerId: player.id,
          scoreline: "21-16, 21-19",
          source: "quick_sim" as const
        },
        {
          id: "harbor-masters-500:QF-3",
          eventId: "harbor-masters-500",
          eventName: "Harbor Masters",
          date: "2026-06-13",
          round: "QF" as const,
          playerAId: player.id,
          playerBId: managed.id,
          winnerId: managed.id,
          scoreline: "18-21, 17-21",
          source: "quick_sim" as const
        }
      ]
    };

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={onOpenPlayerProfile}>
        <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
          <PlayerProfilePage
            playerId={player.id}
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

    expect(screen.getByText("W-L: 1-1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vs Managed Player" })).toBeInTheDocument();
    expect(screen.getByText(`${managed.name}: 0-1 (0%)`)).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Head-to-head records" });
    expect(within(table).getByRole("button", { name: universeOpponent.name })).toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button", { name: managed.name }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(managed.id);
  });

  it("keeps old saves without match history in the honest empty state", () => {
    const managed = seededPlayers[0].player;

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={vi.fn()}>
        <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
          <PlayerProfilePage
            playerId={managed.id}
            selectedPlayerId={managed.id}
            phase="setup"
            careerPresent={true}
            career={{
              ...createInitialCareerState(managed.id, 7422),
              matchHistory: [],
              playerAchievements: []
            }}
            tournament={null}
            liveMatchSession={null}
            onBack={vi.fn()}
            onSelectPlayer={vi.fn()}
          />
        </TournamentNavigationProvider>
      </PlayerNavigationProvider>
    );

    fireEvent.click(screen.getByRole("tab", { name: "Career" }));

    expect(screen.getByText("W-L: 0-0")).toBeInTheDocument();
    expect(screen.getByText("Win %: N/A")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vs Managed Player" })).not.toBeInTheDocument();
    expect(screen.getByText("No completed head-to-head matches recorded.")).toBeInTheDocument();
    expect(screen.getByText("No persisted career history yet.")).toBeInTheDocument();
  });
});
