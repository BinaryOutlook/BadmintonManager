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
  const honorableMentionNames = [
    "Shadow Phoenix",
    "Jade Commander",
    "Danish Trickster",
    "Electric Garuda",
    "Ceremony Blade",
    "Storm Tiger",
    "Siam Sage",
    "Lion Sprint",
    "Delhi Falcon",
    "Iron Uncle",
    "Silent Maze",
    "Imperial Spear",
    "Kerala Counterhawk",
    "Paris Panther",
    "Blue Comet"
  ];
  const specialAliasNames = [...trophyTitanNames, ...honorableMentionNames];

  it("loads the expanded 47-athlete pool", () => {
    expect(seededPlayers).toHaveLength(47);
  });

  it("reserves title-style names for special archetype classes", () => {
    const newPlayerNames = seededPlayers.slice(16).map((entry) => entry.player.name);

    expect(newPlayerNames.slice(0, 6)).toEqual(trophyTitanNames);
    expect(newPlayerNames.slice(6, 16)).toEqual([
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
    expect(newPlayerNames.slice(16)).toEqual(honorableMentionNames);
  });

  it("keeps the headline legend overalls aligned with design targets", () => {
    expect(overallFor("Grand-Slam Southpaw")).toBe(92);
    expect(overallFor("Nordic Tower")).toBe(91);
    expect(overallFor("Greatwall Dragon")).toBe(90);
    expect(overallFor("Three-Lung Dynamo")).toBe(90);
  });

  it("keeps honorable mentions in the 85-88 OVR band", () => {
    for (const playerName of honorableMentionNames) {
      expect(overallFor(playerName)).toBeGreaterThanOrEqual(85);
      expect(overallFor(playerName)).toBeLessThanOrEqual(88);
    }
  });

  it("caps ordinary fictional depth players at 86 OVR", () => {
    const ordinaryPlayers = seededPlayers.filter(
      (entry) => !specialAliasNames.includes(entry.player.name)
    );

    for (const entry of ordinaryPlayers) {
      expect(overallFor(entry.player.name)).toBeLessThanOrEqual(86);
    }
  });
});
