import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import { tacticLibrary } from "../../game/content/tactics";
import { deriveAthleteDossier } from "../../game/core/intel";
import { simulateMatchByFidelity } from "../../game/core/match";
import type { MatchResult, MatchTactic, Player, SimulationFidelity } from "../../game/core/models";

type BucketLabel = "0" | "1-2" | "3-4" | "5-6" | "7-9" | "10+";
type CalibrationMode = "balanced" | "autoplay";

interface BucketStats {
  matches: number;
  highWins: number;
  threeGameMatches: number;
  totalPoints: number;
  longestRally: number;
  totalRallyLength: number;
  pointCount: number;
  games: number;
  bagelGames: number;
  loserOneTwoGames: number;
  loserThreeFiveGames: number;
  loserSixTenGames: number;
  loserPointScores: number[];
  minLoserPoints: number;
  exampleScoreline: string;
  highStraightGameWins: number;
  lowStraightGameWins: number;
}

const bucketLabels: BucketLabel[] = ["0", "1-2", "3-4", "5-6", "7-9", "10+"];
const seedsPerPair = Number.parseInt(process.env.MATCH_BALANCE_SEEDS ?? "2", 10);

const suite = process.env.MATCH_BALANCE_CALIBRATION === "1" ? describe : describe.skip;

function overall(player: Player) {
  const dossier = deriveAthleteDossier(player);
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

function bucketFor(gap: number): BucketLabel {
  if (gap === 0) {
    return "0";
  }

  if (gap <= 2) {
    return "1-2";
  }

  if (gap <= 4) {
    return "3-4";
  }

  if (gap <= 6) {
    return "5-6";
  }

  if (gap <= 9) {
    return "7-9";
  }

  return "10+";
}

function emptyStats(): Record<BucketLabel, BucketStats> {
  const stats = {} as Record<BucketLabel, BucketStats>;

  for (const label of bucketLabels) {
    stats[label] = {
      matches: 0,
      highWins: 0,
      threeGameMatches: 0,
      totalPoints: 0,
      longestRally: 0,
      totalRallyLength: 0,
      pointCount: 0,
      games: 0,
      bagelGames: 0,
      loserOneTwoGames: 0,
      loserThreeFiveGames: 0,
      loserSixTenGames: 0,
      loserPointScores: [],
      minLoserPoints: Number.POSITIVE_INFINITY,
      exampleScoreline: "",
      highStraightGameWins: 0,
      lowStraightGameWins: 0
    };
  }

  return stats;
}

function pickAutoplayTactic(player: Player): MatchTactic {
  const dossier = deriveAthleteDossier(player);
  const strongest = Math.max(dossier.power, dossier.speed, dossier.stamina, dossier.control);

  if (dossier.power === strongest && dossier.power >= dossier.control + 2) {
    return tacticLibrary.aggressiveSmash;
  }

  if (dossier.stamina === strongest) {
    return tacticLibrary.defensiveWall;
  }

  if (dossier.speed === strongest) {
    return tacticLibrary.spreadCourt;
  }

  return tacticLibrary.balancedControl;
}

function recordResult(bucket: BucketStats, result: MatchResult) {
  const highWon = result.winner === "A";
  const straightGames = result.setsWonA + result.setsWonB === 2;

  bucket.matches += 1;
  bucket.highWins += highWon ? 1 : 0;
  bucket.threeGameMatches += result.setsWonA + result.setsWonB === 3 ? 1 : 0;
  bucket.totalPoints += result.stats.totalPoints;
  bucket.longestRally = Math.max(bucket.longestRally, result.stats.longestRally);
  bucket.totalRallyLength += result.setSummaries.reduce(
    (sum, set) => sum + set.points.reduce((pointSum, point) => pointSum + point.rallyLength, 0),
    0
  );
  bucket.pointCount += result.stats.totalPoints;
  bucket.highStraightGameWins += highWon && straightGames ? 1 : 0;
  bucket.lowStraightGameWins += !highWon && straightGames ? 1 : 0;

  for (const set of result.setSummaries) {
    const loserPoints = Math.min(set.scoreA, set.scoreB);

    bucket.games += 1;
    bucket.loserPointScores.push(loserPoints);

    if (loserPoints === 0) {
      bucket.bagelGames += 1;
    } else if (loserPoints <= 2) {
      bucket.loserOneTwoGames += 1;
    } else if (loserPoints <= 5) {
      bucket.loserThreeFiveGames += 1;
    } else if (loserPoints <= 10) {
      bucket.loserSixTenGames += 1;
    }

    if (loserPoints < bucket.minLoserPoints) {
      bucket.minLoserPoints = loserPoints;
      bucket.exampleScoreline = result.scoreline;
    }
  }
}

function runSweep(mode: CalibrationMode, fidelity: SimulationFidelity) {
  const stats = emptyStats();

  for (let leftIndex = 0; leftIndex < seededPlayers.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < seededPlayers.length; rightIndex += 1) {
      const left = seededPlayers[leftIndex].player;
      const right = seededPlayers[rightIndex].player;
      const leftOverall = overall(left);
      const rightOverall = overall(right);
      const high = leftOverall >= rightOverall ? left : right;
      const low = leftOverall >= rightOverall ? right : left;
      const gap = Math.abs(leftOverall - rightOverall);
      const bucket = stats[bucketFor(gap)];

      for (let seedOffset = 1; seedOffset <= seedsPerPair; seedOffset += 1) {
        const tacticA = mode === "balanced" ? tacticLibrary.balancedControl : pickAutoplayTactic(high);
        const tacticB = mode === "balanced" ? tacticLibrary.balancedControl : pickAutoplayTactic(low);
        const result = simulateMatchByFidelity(
          {
            seed: 100_000 + leftIndex * 1_000 + rightIndex * 10 + seedOffset,
            playerA: high,
            playerB: low,
            tacticA,
            tacticB
          },
          fidelity
        );

        recordResult(bucket, result);
      }
    }
  }

  return stats;
}

function pct(numerator: number, denominator: number) {
  return denominator === 0 ? "0.0%" : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function rawPct(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function summarize(stats: Record<BucketLabel, BucketStats>) {
  return bucketLabels.map((label) => {
    const bucket = stats[label];
    const loserLe2Games = bucket.bagelGames + bucket.loserOneTwoGames;
    const loserLe5Games = loserLe2Games + bucket.loserThreeFiveGames;
    const loserLe10Games = loserLe5Games + bucket.loserSixTenGames;

    return {
      gap: label,
      matches: bucket.matches,
      games: bucket.games,
      highWinRate: pct(bucket.highWins, bucket.matches),
      weakerWinRate: pct(bucket.matches - bucket.highWins, bucket.matches),
      threeGameRate: pct(bucket.threeGameMatches, bucket.matches),
      highStraightWinRate: pct(bucket.highStraightGameWins, bucket.matches),
      lowStraightWinRate: pct(bucket.lowStraightGameWins, bucket.matches),
      avgPoints: (bucket.totalPoints / bucket.matches).toFixed(1),
      avgRally: (bucket.totalRallyLength / bucket.pointCount).toFixed(1),
      longestRally: bucket.longestRally,
      bagelRate: pct(bucket.bagelGames, bucket.games),
      loserLe2Rate: pct(loserLe2Games, bucket.games),
      loserLe5Rate: pct(loserLe5Games, bucket.games),
      loserLe10Rate: pct(loserLe10Games, bucket.games),
      avgLoserPoints: average(bucket.loserPointScores).toFixed(1),
      medianLoserPoints: median(bucket.loserPointScores).toFixed(1),
      minLoserPoints: bucket.minLoserPoints === Number.POSITIVE_INFINITY ? 0 : bucket.minLoserPoints,
      exampleScoreline: bucket.exampleScoreline
    };
  });
}

function assertDetailedScoreShape(stats: Record<BucketLabel, BucketStats>) {
  const loserLe2Rate = (bucket: BucketLabel) =>
    rawPct(stats[bucket].bagelGames + stats[bucket].loserOneTwoGames, stats[bucket].games);
  const bagelRate = (bucket: BucketLabel) => rawPct(stats[bucket].bagelGames, stats[bucket].games);
  const avgLoserPoints = (bucket: BucketLabel) => average(stats[bucket].loserPointScores);

  for (const bucket of ["0", "1-2"] satisfies BucketLabel[]) {
    expect(loserLe2Rate(bucket), `${bucket} loser <=2 rate`).toBeLessThan(1);
    expect(avgLoserPoints(bucket), `${bucket} average loser points`).toBeGreaterThanOrEqual(12);
  }

  for (const bucket of ["3-4", "5-6"] satisfies BucketLabel[]) {
    expect(loserLe2Rate(bucket), `${bucket} loser <=2 rate`).toBeLessThan(3);
    expect(avgLoserPoints(bucket), `${bucket} average loser points`).toBeGreaterThanOrEqual(10);
  }

  for (const bucket of ["7-9", "10+"] satisfies BucketLabel[]) {
    expect(bagelRate(bucket), `${bucket} bagel rate`).toBeLessThan(0.5);
  }

  expect(avgLoserPoints("10+"), "10+ average loser points").toBeGreaterThanOrEqual(7);
}

suite("match balance calibration", () => {
  it(
    "prints OVR-gap win-rate and match-shape buckets",
    () => {
      console.log(`Seeds per pair: ${seedsPerPair}`);

      for (const mode of ["balanced", "autoplay"] satisfies CalibrationMode[]) {
        for (const fidelity of ["detailed", "quick"] satisfies SimulationFidelity[]) {
          const stats = runSweep(mode, fidelity);

          console.log(`${mode} ${fidelity}`);
          console.table(summarize(stats));

          if (process.env.MATCH_SCORE_SHAPE_ASSERT === "1" && fidelity === "detailed") {
            assertDetailedScoreShape(stats);
          }
        }
      }

      expect(true).toBe(true);
    },
    120_000
  );
});
