import { describe, expect, it } from "vitest";
import { tacticLibrary } from "../../src/game/content/tactics";
import {
  applyDirective,
  applyTeamTalk,
  createMatchSession,
  simulateMatch,
  simulateNextPoint
} from "../../src/game/core/match";
import { playerSchema, type Player } from "../../src/game/core/models";

function createPlayer(overrides: Partial<Player> = {}): Player {
  return playerSchema.parse({
    id: overrides.id ?? "player",
    name: overrides.name ?? "Player",
    nationality: overrides.nationality ?? "SGP",
    age: overrides.age ?? 24,
    handedness: overrides.handedness ?? "right",
    styleLabel: overrides.styleLabel ?? "Balanced",
    ratings: overrides.ratings ?? {
      technical: {
        smash: 74,
        netPlay: 72,
        clearLob: 73,
        dropShot: 71,
        defenseRetrieval: 72,
        serveReturn: 74
      },
      physical: {
        stamina: 76,
        footworkSpeed: 75,
        explosivenessJump: 72,
        agilityBalance: 74
      },
      mental: {
        anticipation: 73,
        composure: 72,
        focus: 73,
        aggression: 68
      }
    }
  });
}

describe("match simulation", () => {
  it("produces deterministic results for the same seed and inputs", () => {
    const playerA = createPlayer({ id: "a", name: "Lin" });
    const playerB = createPlayer({ id: "b", name: "Chen" });

    const left = simulateMatch({
      seed: 99,
      playerA,
      playerB,
      tacticA: tacticLibrary.balancedControl,
      tacticB: tacticLibrary.spreadCourt
    });
    const right = simulateMatch({
      seed: 99,
      playerA,
      playerB,
      tacticA: tacticLibrary.balancedControl,
      tacticB: tacticLibrary.spreadCourt
    });

    expect(left).toEqual(right);
  });

  it("lets the stronger player win most of the time across a seed batch", () => {
    const elite = createPlayer({
      id: "elite",
      name: "Elite",
      ratings: {
        technical: {
          smash: 89,
          netPlay: 84,
          clearLob: 86,
          dropShot: 85,
          defenseRetrieval: 87,
          serveReturn: 85
        },
        physical: {
          stamina: 86,
          footworkSpeed: 88,
          explosivenessJump: 85,
          agilityBalance: 86
        },
        mental: {
          anticipation: 87,
          composure: 85,
          focus: 86,
          aggression: 79
        }
      }
    });
    const weaker = createPlayer({
      id: "weaker",
      name: "Weaker",
      ratings: {
        technical: {
          smash: 69,
          netPlay: 67,
          clearLob: 68,
          dropShot: 66,
          defenseRetrieval: 70,
          serveReturn: 68
        },
        physical: {
          stamina: 70,
          footworkSpeed: 69,
          explosivenessJump: 68,
          agilityBalance: 70
        },
        mental: {
          anticipation: 68,
          composure: 67,
          focus: 66,
          aggression: 61
        }
      }
    });

    let eliteWins = 0;

    for (let seed = 1; seed <= 40; seed += 1) {
      const result = simulateMatch({
        seed,
        playerA: elite,
        playerB: weaker,
        tacticA: tacticLibrary.balancedControl,
        tacticB: tacticLibrary.balancedControl
      });

      if (result.winner === "A") {
        eliteWins += 1;
      }
    }

    expect(eliteWins).toBeGreaterThanOrEqual(28);
  });

  it("supports point-by-point live progression with directives and between-set team talks", () => {
    const playerA = createPlayer({ id: "a", name: "Coach Side" });
    const playerB = createPlayer({ id: "b", name: "Opponent" });
    let session = createMatchSession({
      seed: 17,
      playerA,
      playerB,
      tacticA: tacticLibrary.balancedControl,
      tacticB: tacticLibrary.aggressiveSmash
    });

    session = simulateNextPoint(session);

    expect(session.currentSetPoints).toHaveLength(1);
    expect(session.currentScoreA + session.currentScoreB).toBe(1);

    session = applyDirective(session, "A", "push_pace");
    expect(session.feed.at(-1)?.kind).toBe("directive");

    session = simulateNextPoint(session);
    expect(session.feed.some((entry) => entry.kind === "point")).toBe(true);

    const liveTalkAttempt = applyTeamTalk(session, "A", "encourage");
    expect(liveTalkAttempt.pendingTalkA).toBeUndefined();

    while (!session.complete && !session.intermission) {
      session = simulateNextPoint(session);
    }

    expect(session.setSummaries).toHaveLength(1);

    if (!session.complete) {
      session = applyTeamTalk(session, "A", "encourage");
      expect(session.pendingTalkA).toBe("encourage");
      expect(session.feed.at(-1)?.title).toContain("queues Encourage");

      session = simulateNextPoint(session);

      expect(session.currentSetNumber).toBe(2);
      expect(session.competitorA.composureShift).toBeGreaterThanOrEqual(6);
      expect(session.intermission).toBe(false);
    }
  });
});
