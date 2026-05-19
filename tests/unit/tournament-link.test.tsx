import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import { TournamentLink } from "../../components/TournamentLink";

describe("TournamentLink", () => {
  it("opens tournament homes through the navigation provider with a stable address", () => {
    const openTournamentHome = vi.fn();

    render(
      <TournamentNavigationProvider onOpenTournamentHome={openTournamentHome}>
        <TournamentLink seasonId="season-2026" eventId="metro-open-300">
          Metro Open
        </TournamentLink>
      </TournamentNavigationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open tournament home for Metro Open" }));

    expect(openTournamentHome).toHaveBeenCalledWith({
      seasonId: "season-2026",
      eventId: "metro-open-300"
    });
  });

  it("renders missing ids and placeholders as plain fallback text", () => {
    const openTournamentHome = vi.fn();

    const { container } = render(
      <TournamentNavigationProvider onOpenTournamentHome={openTournamentHome}>
        <TournamentLink seasonId="season-2026" eventId={null}>
          TBD
        </TournamentLink>
        <TournamentLink seasonId="season-2026" eventId="metro-open-300">
          TBD
        </TournamentLink>
      </TournamentNavigationProvider>
    );

    expect(container).toHaveTextContent("TBDTBD");
    expect(screen.queryByRole("button", { name: /TBD/ })).not.toBeInTheDocument();
    expect(openTournamentHome).not.toHaveBeenCalled();
  });
});
