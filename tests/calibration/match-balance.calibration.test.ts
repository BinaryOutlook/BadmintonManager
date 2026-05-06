import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../src/game/content/players";
import { tacticLibrary } from "../../src/game/content/tactics";
import { deriveAthleteDossier } from "../../src/game/core/intel";
import { simulateMatchByFidelity } from "../../src/game/core/match";
import type { MatchResult, MatchTactic, Player, SimulationFidelity } from "../../src/game/core/models";

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
  return Object.fromEntries(
    bucketLabels.map((label) => [
      label,
      {
        matches: 0,
        highWins: 0,
        threeGameMatches: 0,
        totalPoints: 0,
        longestRally: 0,
        totalRallyLength: 0,
        pointCount: 0,
        highStraightGameWins: 0,
        lowStraightGameWins: 0
      }
    ])
  ) as Record<BucketLabel, BucketStats>;
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

function summarize(stats: Record<BucketLabel, BucketStats>) {
  return bucketLabels.map((label) => {
    const bucket = stats[label];

    return {
      gap: label,
      matches: bucket.matches,
      highWinRate: pct(bucket.highWins, bucket.matches),
      weakerWinRate: pct(bucket.matches - bucket.highWins, bucket.matches),
      threeGameRate: pct(bucket.threeGameMatches, bucket.matches),
      highStraightWinRate: pct(bucket.highStraightGameWins, bucket.matches),
      lowStraightWinRate: pct(bucket.lowStraightGameWins, bucket.matches),
      avgPoints: (bucket.totalPoints / bucket.matches).toFixed(1),
      avgRally: (bucket.totalRallyLength / bucket.pointCount).toFixed(1),
      longestRally: bucket.longestRally
    };
  });
}

suite("match balance calibration", () => {
  it(
    "prints OVR-gap win-rate and match-shape buckets",
    () => {
      console.log(`Seeds per pair: ${seedsPerPair}`);

      for (const mode of ["balanced", "autoplay"] satisfies CalibrationMode[]) {
        for (const fidelity of ["detailed", "quick"] satisfies SimulationFidelity[]) {
          console.log(`${mode} ${fidelity}`);
          console.table(summarize(runSweep(mode, fidelity)));
        }
      }

      expect(true).toBe(true);
    },
    120_000
  );
});
