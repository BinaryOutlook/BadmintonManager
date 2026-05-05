import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../src/game/content/players";
import { deriveAthleteDossier } from "../../src/game/core/intel";

function overallFor(playerName: string) {
  const entry = seededPlayers.find((candidate) => candidate.player.name === playerName);

  if (!entry) {
    throw new Error(`Missing player: ${playerName}`);
  }

  const dossier = deriveAthleteDossier(entry.player);
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

describe("player content", () => {
  const trophyTitanNames = [
    "Grand-Slam Southpaw",
    "Three-Lung Dynamo",
    "Eight-Crown Monarch",
    "Nordic Tower",
    "Greatwall Dragon",
    "Backhand Mirage"
  ];

  it("loads the expanded 32-athlete pool", () => {
    expect(seededPlayers).toHaveLength(32);
  });

  it("reserves title-style names for Trophy Titans only", () => {
    const newPlayerNames = seededPlayers.slice(16).map((entry) => entry.player.name);

    expect(newPlayerNames.slice(0, 6)).toEqual(trophyTitanNames);
    expect(newPlayerNames.slice(6)).toEqual([
      "Renji Mori",
      "Krit Suriya",
      "Omar Nasser",
      "Wen Jie Hsu",
      "Min Jae Seo",
      "Theo Mercer",
      "Elliot Ward",
      "Mateo Vidal",
      "Arjun Sen",
      "Diego Quispe"
    ]);
  });

  it("keeps the headline legend overalls aligned with design targets", () => {
    expect(overallFor("Grand-Slam Southpaw")).toBe(92);
    expect(overallFor("Nordic Tower")).toBe(91);
    expect(overallFor("Greatwall Dragon")).toBe(90);
    expect(overallFor("Three-Lung Dynamo")).toBe(90);
  });
});
