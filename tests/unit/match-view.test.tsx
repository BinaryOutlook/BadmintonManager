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
  it("places exactly one dominant point action beside the compact scoreboard", () => {
    const { props } = renderMatchView(createSession());

    expect(screen.getByLabelText("Match command surface")).toHaveClass("match-command-layout-v2");
    expect(screen.getByLabelText("Compact scoreboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary match action")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Simulate Next Point" })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Tactical Options" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText("Primary match action")).getByRole("button", { name: "Simulate Next Point" }));

    expect(props.onSimulateNextPoint).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole("button", { name: /Encourage/ }));
    expect(props.onApplyTalk).toHaveBeenCalledWith("encourage");

    rerender(<MatchView {...props} session={{ ...intermissionSession, pendingTalkA: "encourage" }} />);

    expect(screen.getAllByRole("button", { name: "Apply Talk + Open Next Set" })).toHaveLength(1);
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

    expect(screen.getAllByRole("button", { name: "Advance Bracket" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Advance Bracket" }));

    expect(props.onAdvanceAfterMatch).toHaveBeenCalledTimes(1);
  });
});
