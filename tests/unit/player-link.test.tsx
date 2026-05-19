import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerNavigationProvider } from "../../app/playerNavigation";
import { PlayerLink, SmartPlayerText } from "../../components/PlayerLink";
import { playerMap } from "../../game/content/players";

describe("PlayerLink", () => {
  it("opens a known player through the navigation provider with the stable id", () => {
    const openPlayerProfile = vi.fn();
    const player = playerMap["player-18"]!;

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
        <PlayerLink playerId={player.id} />
      </PlayerNavigationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: player.name }));

    expect(openPlayerProfile).toHaveBeenCalledWith(player.id);
  });

  it("renders missing player ids as plain fallback text", () => {
    render(<PlayerLink playerId="missing-player">TBD</PlayerLink>);

    expect(screen.getByText("TBD")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TBD" })).not.toBeInTheDocument();
  });
});

describe("SmartPlayerText", () => {
  it("turns known player names into profile links inside prose", () => {
    const openPlayerProfile = vi.fn();

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
        <SmartPlayerText text="Scheduled against Three-Lung Dynamo after Adrian Koh advanced." />
      </PlayerNavigationProvider>
    );

    screen.getByRole("button", { name: "Three-Lung Dynamo" }).click();
    screen.getByRole("button", { name: "Adrian Koh" }).click();

    expect(openPlayerProfile).toHaveBeenCalledTimes(2);
    expect(openPlayerProfile).toHaveBeenNthCalledWith(1, "player-18");
  });

  it("keeps pending draw placeholders as plain text", () => {
    render(
      <PlayerNavigationProvider onOpenPlayerProfile={vi.fn()}>
        <SmartPlayerText text="Opponent pending. TBD after the previous round." />
      </PlayerNavigationProvider>
    );

    expect(screen.getByText("Opponent pending. TBD after the previous round.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
