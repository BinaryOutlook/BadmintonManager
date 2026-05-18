import { describe, expect, it } from "vitest";
import { tacticLibrary } from "../../game/content/tactics";
import {
  applyDirective,
  applyTeamTalk,
  createMatchSession,
  simulateMatchByFidelity,
  simulateMatch,
  simulateNextPoint,
  simulateUntilSetComplete,
  simulateQuickMatch
} from "../../game/core/match";
import { playerSchema, type Player } from "../../game/core/models";

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

function assertLegalSetScore(scoreA: number, scoreB: number) {
  const reachedCap = scoreA === 30 || scoreB === 30;
  const reachedGamePoint = scoreA >= 21 || scoreB >= 21;
  const twoPointMargin = Math.abs(scoreA - scoreB) >= 2;

  expect(Math.max(scoreA, scoreB)).toBeLessThanOrEqual(30);
  expect(reachedCap || (reachedGamePoint && twoPointMargin)).toBe(true);
}

function loserPoints(scoreA: number, scoreB: number) {
  return Math.min(scoreA, scoreB);
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
    expect(left.fidelity).toBe("detailed");
  });

  it("keeps detailed set scores legal under the 21-by-2 and 30-cap rules", () => {
    const playerA = createPlayer({ id: "a", name: "Legal A" });
    const playerB = createPlayer({ id: "b", name: "Legal B" });

    for (let seed = 200; seed < 212; seed += 1) {
      const result = simulateMatch({
        seed,
        playerA,
        playerB,
        tacticA: tacticLibrary.balancedControl,
        tacticB: tacticLibrary.spreadCourt
      });

      expect(result.setsWonA === 2 || result.setsWonB === 2).toBe(true);
      expect(result.stats.totalPoints).toBe(
        result.setSummaries.reduce((sum, set) => sum + set.points.length, 0)
      );

      for (const set of result.setSummaries) {
        assertLegalSetScore(set.scoreA, set.scoreB);
        expect(set.points.at(-1)?.scoreboard).toBe(`${set.scoreA}-${set.scoreB}`);
      }
    }
  });

  it("produces deterministic quick results that obey badminton scoring", () => {
    const playerA = createPlayer({ id: "a", name: "Quick A" });
    const playerB = createPlayer({ id: "b", name: "Quick B" });

    const left = simulateQuickMatch({
      seed: 1224,
      playerA,
      playerB,
      tacticA: tacticLibrary.balancedControl,
      tacticB: tacticLibrary.defensiveWall
    });
    const right = simulateQuickMatch({
      seed: 1224,
      playerA,
      playerB,
      tacticA: tacticLibrary.balancedControl,
      tacticB: tacticLibrary.defensiveWall
    });

    expect(left).toEqual(right);
    expect(left.fidelity).toBe("quick");
    expect(left.setsWonA === 2 || left.setsWonB === 2).toBe(true);
    expect(left.stats.longestRally).toBeGreaterThan(0);
    expect(left.stats.longestRally).toBeLessThanOrEqual(70);
    expect(left.stats.totalPoints).toBe(
      left.setSummaries.reduce((sum, set) => sum + set.points.length, 0)
    );
    expect(left.summaryEvents?.length).toBeGreaterThan(0);

    for (const set of left.setSummaries) {
      const reachedCap = set.scoreA === 30 || set.scoreB === 30;
      const reachedGamePoint = set.scoreA >= 21 || set.scoreB >= 21;
      const twoPointMargin = Math.abs(set.scoreA - set.scoreB) >= 2;

      expect(Math.max(set.scoreA, set.scoreB)).toBeLessThanOrEqual(30);
      expect(reachedCap || (reachedGamePoint && twoPointMargin)).toBe(true);
      expect(set.points.at(-1)?.scoreboard).toBe(`${set.scoreA}-${set.scoreB}`);
      expect(set.points.every((point) => point.shots.length === 0)).toBe(true);
    }
  });

  it("keeps near-equal detailed games from routinely collapsing into bagels", () => {
    const playerA = createPlayer({ id: "near-a", name: "Near A" });
    const playerB = createPlayer({
      id: "near-b",
      name: "Near B",
      ratings: {
        technical: {
          smash: 73,
          netPlay: 73,
          clearLob: 72,
          dropShot: 72,
          defenseRetrieval: 73,
          serveReturn: 73
        },
        physical: {
          stamina: 75,
          footworkSpeed: 74,
          explosivenessJump: 73,
          agilityBalance: 75
        },
        mental: {
          anticipation: 74,
          composure: 73,
          focus: 74,
          aggression: 67
        }
      }
    });
    const setLoserPoints: number[] = [];

    for (let seed = 500; seed < 536; seed += 1) {
      const result = simulateMatch({
        seed,
        playerA,
        playerB,
        tacticA: tacticLibrary.balancedControl,
        tacticB: tacticLibrary.balancedControl
      });

      for (const set of result.setSummaries) {
        setLoserPoints.push(loserPoints(set.scoreA, set.scoreB));
      }
    }

    const bagels = setLoserPoints.filter((points) => points === 0).length;
    const loserLe2 = setLoserPoints.filter((points) => points <= 2).length;
    const averageLoserPoints =
      setLoserPoints.reduce((sum, points) => sum + points, 0) / setLoserPoints.length;

    expect(bagels).toBe(0);
    expect(loserLe2).toBeLessThanOrEqual(1);
    expect(averageLoserPoints).toBeGreaterThanOrEqual(12);
  });

  it("still allows stronger detailed players to create decisive games", () => {
    const elite = createPlayer({
      id: "dominant-elite",
      name: "Dominant Elite",
      ratings: {
        technical: {
          smash: 90,
          netPlay: 86,
          clearLob: 88,
          dropShot: 86,
          defenseRetrieval: 88,
          serveReturn: 86
        },
        physical: {
          stamina: 88,
          footworkSpeed: 89,
          explosivenessJump: 87,
          agilityBalance: 88
        },
        mental: {
          anticipation: 88,
          composure: 87,
          focus: 88,
          aggression: 80
        }
      }
    });
    const developing = createPlayer({
      id: "developing",
      name: "Developing",
      ratings: {
        technical: {
          smash: 61,
          netPlay: 60,
          clearLob: 62,
          dropShot: 60,
          defenseRetrieval: 62,
          serveReturn: 61
        },
        physical: {
          stamina: 63,
          footworkSpeed: 62,
          explosivenessJump: 61,
          agilityBalance: 62
        },
        mental: {
          anticipation: 61,
          composure: 60,
          focus: 61,
          aggression: 58
        }
      }
    });
    let eliteWins = 0;
    let decisiveGames = 0;

    for (let seed = 700; seed < 724; seed += 1) {
      const result = simulateMatch({
        seed,
        playerA: elite,
        playerB: developing,
        tacticA: tacticLibrary.balancedControl,
        tacticB: tacticLibrary.balancedControl
      });

      if (result.winner === "A") {
        eliteWins += 1;
      }

      decisiveGames += result.setSummaries.filter((set) => loserPoints(set.scoreA, set.scoreB) <= 13).length;
    }

    expect(eliteWins).toBeGreaterThanOrEqual(20);
    expect(decisiveGames).toBeGreaterThanOrEqual(12);
  });

  it("allows detailed neutral rallies beyond the old 18-shot guardrail", () => {
    const rallyRatings = {
      technical: {
        smash: 58,
        netPlay: 84,
        clearLob: 94,
        dropShot: 76,
        defenseRetrieval: 96,
        serveReturn: 90
      },
      physical: {
        stamina: 98,
        footworkSpeed: 92,
        explosivenessJump: 64,
        agilityBalance: 95
      },
      mental: {
        anticipation: 94,
        composure: 92,
        focus: 98,
        aggression: 42
      }
    };
    const playerA = createPlayer({ id: "grinder-a", name: "Grinder A", ratings: rallyRatings });
    const playerB = createPlayer({ id: "grinder-b", name: "Grinder B", ratings: rallyRatings });
    let longestRally = 0;

    for (let seed = 1; seed <= 20 && longestRally <= 18; seed += 1) {
      const result = simulateMatch({
        seed,
        playerA,
        playerB,
        tacticA: tacticLibrary.defensiveWall,
        tacticB: tacticLibrary.defensiveWall
      });

      longestRally = Math.max(longestRally, result.stats.longestRally);
      expect(result.stats.longestRally).toBeLessThanOrEqual(32);
    }

    expect(longestRally).toBeGreaterThan(18);
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

  it("lets the stronger player win most quick simulations across a seed batch", () => {
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
      const result = simulateMatchByFidelity(
        {
          seed,
          playerA: elite,
          playerB: weaker,
          tacticA: tacticLibrary.balancedControl,
          tacticB: tacticLibrary.balancedControl
        },
        "quick"
      );

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
      const composureBeforeTalk = session.competitorA.composureShift;
      session = applyTeamTalk(session, "A", "encourage");
      expect(session.pendingTalkA).toBe("encourage");
      expect(session.feed.at(-1)?.title).toContain("queues Encourage");

      session = simulateNextPoint(session);

      expect(session.currentSetNumber).toBe(2);
      expect(session.competitorA.composureShift).toBeGreaterThanOrEqual(composureBeforeTalk + 6);
      expect(session.intermission).toBe(false);
    }
  });

  it("finishes the current set by replaying the same deterministic point path", () => {
    const playerA = createPlayer({ id: "a", name: "Coach Side" });
    const playerB = createPlayer({ id: "b", name: "Opponent" });
    const session = createMatchSession({
      seed: 912,
      playerA,
      playerB,
      tacticA: tacticLibrary.balancedControl,
      tacticB: tacticLibrary.aggressiveSmash
    });
    let pointByPointSession = session;

    while (!pointByPointSession.complete && !pointByPointSession.intermission) {
      pointByPointSession = simulateNextPoint(pointByPointSession);
    }

    const finishedSetSession = simulateUntilSetComplete(session);

    expect(finishedSetSession).toEqual(pointByPointSession);
    expect(finishedSetSession.complete || finishedSetSession.intermission).toBe(true);
    expect(finishedSetSession.setSummaries).toHaveLength(1);
  });
});
