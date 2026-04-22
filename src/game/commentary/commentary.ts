import type { MatchInput, PointSummary, SetSummary, Side } from "../core/models";

function sideName(side: Side, input: MatchInput) {
  return side === "A" ? input.playerA.name : input.playerB.name;
}

export function describePoint(point: PointSummary, input: MatchInput) {
  const winnerName = sideName(point.winner, input);
  const loserName = sideName(point.winner === "A" ? "B" : "A", input);

  switch (point.reason) {
    case "winner":
      return `${winnerName} takes control and closes the rally after ${point.rallyLength} shots.`;
    case "forced_error":
      return `${winnerName} forces ${loserName} into a weak final reply.`;
    case "unforced_error":
      return `${loserName} blinks first under pressure.`;
    case "left_long":
      return `${winnerName} reads the drift and lets the shuttle sail long.`;
    case "net":
      return `${loserName} clips the tape and hands over the point.`;
    case "out":
      return `${loserName} pushes too close to the edge and misses long.`;
  }
}

export function describeSet(set: SetSummary, input: MatchInput) {
  const winnerName = sideName(set.winner, input);
  return `${winnerName} claims the set ${set.scoreA}-${set.scoreB}.`;
}
