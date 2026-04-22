import { describe, expect, it } from "vitest";
import { SeededRng } from "../../src/game/core/rng";

describe("SeededRng", () => {
  it("produces deterministic sequences for the same seed", () => {
    const left = new SeededRng(42);
    const right = new SeededRng(42);

    const leftValues = Array.from({ length: 5 }, () => left.nextInt(1, 100));
    const rightValues = Array.from({ length: 5 }, () => right.nextInt(1, 100));

    expect(leftValues).toEqual(rightValues);
  });
});
