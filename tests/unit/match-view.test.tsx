import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MatchView } from "../../components/MatchView.js";
import { seededPlayers } from "../../game/content/players.js";
import { tacticLibrary } from "../../game/content/tactics.js";
import { createMatchSession } from "../../game/core/match.js";
import type { LiveMatchSession } from "../../game/core/models.js";

function createSession(): LiveMatchSession {
  return createMatchSession({
    seed: 90210,
    playerA: seededPlayers[0].player,
    playerB: seededPlayers[1].player,
    tacticA: tacticLibrary.balancedControl,
    tacticB: tacticLibrary.spreadCourt
  });
}

function renderMatchView(session: LiveMatchSession, overrides: Partial<Parameters<typeof MatchView>[0]> = {}) {
  const props = {
    session,
    managedSide: "A" as const,
    opponentName: session.input.playerB.name,
    opponentTacticLabel: session.input.tacticB.label,
    onApplyDirective: vi.fn(),
    onApplyTalk: vi.fn(),
    onSimulateNextPoint: vi.fn(),
    onFinishSet: vi.fn(),
    onAdvanceAfterMatch: vi.fn(),
    onOpenPlayerProfile: vi.fn(),
    ...overrides
  };

  return {
    props,
    ...render(<MatchView {...props} />)
  };
}

describe("MatchView", () => {
  it("places compact point and set controls beside the broadcast scoreboard", () => {
    const { props } = renderMatchView(createSession());

    expect(screen.getByLabelText("Match command surface")).toHaveClass("match-command-layout-v2");
    expect(screen.getByLabelText("Compact scoreboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Match controls")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Next Point" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Finish Set" })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Tactical Options" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rally Pattern Map" })).toBeInTheDocument();
    expect(screen.getByText("Attack Value")).toBeInTheDocument();
    expect(screen.getByText("Movement Load")).toBeInTheDocument();
    expect(screen.getByText("Rally Control")).toBeInTheDocument();
    expect(screen.getByText("Tactical Read")).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("Match controls")).getByRole("button", { name: "Next Point" }));
    fireEvent.click(within(screen.getByLabelText("Match controls")).getByRole("button", { name: "Finish Set" }));

    expect(props.onSimulateNextPoint).toHaveBeenCalledTimes(1);
    expect(props.onFinishSet).toHaveBeenCalledTimes(1);
  });

  it("keeps between-set talks available while preserving a single next-set action", () => {
    const intermissionSession: LiveMatchSession = {
      ...createSession(),
      setsWonA: 1,
      setSummaries: [
        {
          winner: "A",
          scoreA: 21,
          scoreB: 16,
          points: []
        }
      ],
      currentSetNumber: 2,
      currentScoreA: 0,
      currentScoreB: 0,
      intermission: true
    };
    const { props, rerender } = renderMatchView(intermissionSession);

    expect(screen.getAllByRole("button", { name: "Open Next Set" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Finish Set" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Encourage/ }));
    expect(props.onApplyTalk).toHaveBeenCalledWith("encourage");

    rerender(<MatchView {...props} session={{ ...intermissionSession, pendingTalkA: "encourage" }} />);

    expect(screen.getAllByRole("button", { name: "Open Next Set" })).toHaveLength(1);
  });

  it("switches the single primary action to bracket advancement after completion", () => {
    const completeSession: LiveMatchSession = {
      ...createSession(),
      setsWonA: 2,
      setSummaries: [
        {
          winner: "A",
          scoreA: 21,
          scoreB: 16,
          points: []
        },
        {
          winner: "A",
          scoreA: 21,
          scoreB: 17,
          points: []
        }
      ],
      currentSetNumber: 2,
      currentScoreA: 21,
      currentScoreB: 17,
      complete: true,
      winner: "A"
    };
    const { props } = renderMatchView(completeSession);

    expect(screen.getAllByRole("button", { name: "Advance" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Finish Set" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));

    expect(props.onAdvanceAfterMatch).toHaveBeenCalledTimes(1);
  });
});
