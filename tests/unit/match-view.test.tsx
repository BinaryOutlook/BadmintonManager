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

  it("separates the persistent exact match plan from short live directives", () => {
    const session = createMatchSession({
      seed: 90211,
      playerA: seededPlayers[0].player,
      playerB: seededPlayers[1].player,
      tacticA: {
        label: "Rear Court Blitz",
        tempo: "fast",
        pressurePattern: "all_out_attack",
        riskProfile: "high_risk",
        advancedIntent: {
          version: 1,
          tempo: 84,
          rearCourtPressure: 91,
          netPriority: 58,
          riskTolerance: 79,
          rallyLengthIntent: "shorten",
          modules: ["rear_court_lock", "body_smash"]
        }
      },
      tacticB: tacticLibrary.spreadCourt
    });

    renderMatchView(session);

    const lockedPlan = screen.getByLabelText("Locked match plan");
    expect(lockedPlan).toHaveTextContent("Rear Court Blitz");
    expect(lockedPlan).toHaveTextContent("Tempo 84 / rear 91 / net 58 / risk 79 / shorten rallies");
    expect(within(lockedPlan).getByLabelText("Active plan modules")).toHaveTextContent("rear court lock");
    expect(within(lockedPlan).getByLabelText("Active plan modules")).toHaveTextContent("body smash");
    expect(lockedPlan).toHaveTextContent("Live directives alter only the next three points");
  });

  it("renders set one as the only visible score column at match start", () => {
    renderMatchView(createSession());

    const scoreboard = screen.getByLabelText("Broadcast match score");
    expect(within(scoreboard).getByRole("columnheader", { name: "S1" })).toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "S2" })).not.toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "S3" })).not.toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "Current" })).not.toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "Final" })).not.toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 1 active score for ${seededPlayers[0].player.name}: 0`)
      })
    ).toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 1 active score for ${seededPlayers[1].player.name}: 0`)
      })
    ).toBeInTheDocument();
  });

  it("renders completed set one and active set two without advertising set three", () => {
    const setTwoSession: LiveMatchSession = {
      ...createSession(),
      setsWonA: 1,
      setSummaries: [
        {
          winner: "A",
          scoreA: 21,
          scoreB: 17,
          points: []
        }
      ],
      currentSetNumber: 2,
      currentScoreA: 8,
      currentScoreB: 6
    };

    renderMatchView(setTwoSession);

    const scoreboard = screen.getByLabelText("Broadcast match score");
    expect(within(scoreboard).getByRole("columnheader", { name: "S1" })).toBeInTheDocument();
    expect(within(scoreboard).getByRole("columnheader", { name: "S2" })).toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "S3" })).not.toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 1 completed score for ${seededPlayers[0].player.name}: 21`)
      })
    ).toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 2 active score for ${seededPlayers[0].player.name}: 8`)
      })
    ).toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 2 active score for ${seededPlayers[1].player.name}: 6`)
      })
    ).toBeInTheDocument();
  });

  it("renders all three set columns when a deciding set is active", () => {
    const setThreeSession: LiveMatchSession = {
      ...createSession(),
      setsWonA: 1,
      setsWonB: 1,
      setSummaries: [
        {
          winner: "A",
          scoreA: 21,
          scoreB: 17,
          points: []
        },
        {
          winner: "B",
          scoreA: 18,
          scoreB: 21,
          points: []
        }
      ],
      currentSetNumber: 3,
      currentScoreA: 13,
      currentScoreB: 11
    };

    renderMatchView(setThreeSession);

    const scoreboard = screen.getByLabelText("Broadcast match score");
    expect(within(scoreboard).getByRole("columnheader", { name: "S1" })).toBeInTheDocument();
    expect(within(scoreboard).getByRole("columnheader", { name: "S2" })).toBeInTheDocument();
    expect(within(scoreboard).getByRole("columnheader", { name: "S3" })).toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 3 active score for ${seededPlayers[0].player.name}: 13`)
      })
    ).toBeInTheDocument();
  });

  it("renders only played sets for completed straight-game and three-game matches", () => {
    const straightGameSession: LiveMatchSession = {
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
          scoreB: 19,
          points: []
        }
      ],
      currentSetNumber: 2,
      currentScoreA: 21,
      currentScoreB: 19,
      complete: true,
      winner: "A"
    };
    const { rerender, props } = renderMatchView(straightGameSession);

    let scoreboard = screen.getByLabelText("Broadcast match score");
    expect(within(scoreboard).getByRole("columnheader", { name: "S1" })).toBeInTheDocument();
    expect(within(scoreboard).getByRole("columnheader", { name: "S2" })).toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "S3" })).not.toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "Final" })).not.toBeInTheDocument();

    const threeGameSession: LiveMatchSession = {
      ...straightGameSession,
      setsWonA: 2,
      setsWonB: 1,
      setSummaries: [
        {
          winner: "A",
          scoreA: 21,
          scoreB: 17,
          points: []
        },
        {
          winner: "B",
          scoreA: 18,
          scoreB: 21,
          points: []
        },
        {
          winner: "A",
          scoreA: 21,
          scoreB: 16,
          points: []
        }
      ],
      currentSetNumber: 3,
      currentScoreA: 21,
      currentScoreB: 16
    };

    rerender(<MatchView {...props} session={threeGameSession} />);

    scoreboard = screen.getByLabelText("Broadcast match score");
    expect(within(scoreboard).getByRole("columnheader", { name: "S1" })).toBeInTheDocument();
    expect(within(scoreboard).getByRole("columnheader", { name: "S2" })).toBeInTheDocument();
    expect(within(scoreboard).getByRole("columnheader", { name: "S3" })).toBeInTheDocument();
    expect(within(scoreboard).queryByRole("columnheader", { name: "Final" })).not.toBeInTheDocument();
    expect(
      within(scoreboard).getByRole("cell", {
        name: new RegExp(`Set 3 completed score for ${seededPlayers[0].player.name}: 21`)
      })
    ).toBeInTheDocument();
  });

  it("includes nationality codes and accessible server state in player rows", () => {
    const { props } = renderMatchView(createSession());

    const scoreboard = screen.getByLabelText("Broadcast match score");
    expect(scoreboard).toHaveTextContent(seededPlayers[0].player.nationality);
    expect(scoreboard).toHaveTextContent(seededPlayers[1].player.nationality);
    expect(
      within(scoreboard).getByLabelText(`${seededPlayers[0].player.name} serving`)
    ).toBeInTheDocument();
    expect(
      within(scoreboard).getByLabelText(`${seededPlayers[1].player.name} receiving`)
    ).toBeInTheDocument();

    fireEvent.click(within(scoreboard).getByRole("button", { name: seededPlayers[0].player.name }));

    expect(props.onOpenPlayerProfile).toHaveBeenCalledWith(seededPlayers[0].player.id);
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
