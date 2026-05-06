import { describe, expect, it } from "vitest";
import { tacticLibrary } from "../../src/game/content/tactics";
import { deriveAthleteDossier } from "../../src/game/core/intel";
import { deriveProfile } from "../../src/game/core/ratings";
import { simulateMatchByFidelity } from "../../src/game/core/match";
import { playerSchema, type MatchTactic, type Player, type SimulationFidelity } from "../../src/game/core/models";

type ArchetypeKey =
  | "balanced"
  | "power"
  | "net"
  | "retriever"
  | "grinder"
  | "speed"
  | "precision";

interface ArchetypeDefinition {
  key: ArchetypeKey;
  label: string;
  tactic: MatchTactic;
  ratings: Player["ratings"];
}

const suite = process.env.STAT_COMPOSITION_CALIBRATION === "1" ? describe : describe.skip;
const seedsPerPair = Number.parseInt(process.env.STAT_COMPOSITION_SEEDS ?? "20", 10);
const targetOverall = Number.parseInt(process.env.STAT_COMPOSITION_OVR ?? "82", 10);

const archetypeDefinitions: ArchetypeDefinition[] = [
  {
    key: "balanced",
    label: "Balanced All-Court",
    tactic: tacticLibrary.balancedControl,
    ratings: {
      technical: { smash: 82, netPlay: 82, clearLob: 82, dropShot: 82, defenseRetrieval: 82, serveReturn: 82 },
      physical: { stamina: 82, footworkSpeed: 82, explosivenessJump: 82, agilityBalance: 82 },
      mental: { anticipation: 82, composure: 82, focus: 82, aggression: 82 }
    }
  },
  {
    key: "power",
    label: "Power Smasher",
    tactic: tacticLibrary.aggressiveSmash,
    ratings: {
      technical: { smash: 94, netPlay: 75, clearLob: 77, dropShot: 80, defenseRetrieval: 77, serveReturn: 79 },
      physical: { stamina: 79, footworkSpeed: 83, explosivenessJump: 93, agilityBalance: 78 },
      mental: { anticipation: 79, composure: 76, focus: 78, aggression: 94 }
    }
  },
  {
    key: "net",
    label: "Net Controller",
    tactic: tacticLibrary.balancedControl,
    ratings: {
      technical: { smash: 76, netPlay: 95, clearLob: 80, dropShot: 90, defenseRetrieval: 79, serveReturn: 93 },
      physical: { stamina: 78, footworkSpeed: 84, explosivenessJump: 74, agilityBalance: 84 },
      mental: { anticipation: 91, composure: 88, focus: 84, aggression: 72 }
    }
  },
  {
    key: "retriever",
    label: "Counter Retriever",
    tactic: tacticLibrary.defensiveWall,
    ratings: {
      technical: { smash: 75, netPlay: 80, clearLob: 84, dropShot: 78, defenseRetrieval: 96, serveReturn: 82 },
      physical: { stamina: 88, footworkSpeed: 90, explosivenessJump: 75, agilityBalance: 95 },
      mental: { anticipation: 90, composure: 86, focus: 88, aggression: 68 }
    }
  },
  {
    key: "grinder",
    label: "Rear-Court Grinder",
    tactic: {
      label: "Rear-Court Grind",
      tempo: "conserve",
      pressurePattern: "rear_court_grind",
      riskProfile: "patient"
    },
    ratings: {
      technical: { smash: 76, netPlay: 78, clearLob: 96, dropShot: 80, defenseRetrieval: 88, serveReturn: 80 },
      physical: { stamina: 96, footworkSpeed: 82, explosivenessJump: 74, agilityBalance: 86 },
      mental: { anticipation: 84, composure: 88, focus: 95, aggression: 66 }
    }
  },
  {
    key: "speed",
    label: "Speed Counter",
    tactic: tacticLibrary.spreadCourt,
    ratings: {
      technical: { smash: 82, netPlay: 82, clearLob: 78, dropShot: 84, defenseRetrieval: 86, serveReturn: 88 },
      physical: { stamina: 82, footworkSpeed: 96, explosivenessJump: 84, agilityBalance: 94 },
      mental: { anticipation: 91, composure: 80, focus: 82, aggression: 78 }
    }
  },
  {
    key: "precision",
    label: "Precision Deceiver",
    tactic: tacticLibrary.balancedControl,
    ratings: {
      technical: { smash: 78, netPlay: 90, clearLob: 82, dropShot: 96, defenseRetrieval: 80, serveReturn: 88 },
      physical: { stamina: 80, footworkSpeed: 84, explosivenessJump: 76, agilityBalance: 86 },
      mental: { anticipation: 90, composure: 92, focus: 86, aggression: 70 }
    }
  }
];

function clampRating(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function mapRatings(
  ratings: Player["ratings"],
  mapper: (value: number) => number
): Player["ratings"] {
  return {
    technical: {
      smash: clampRating(mapper(ratings.technical.smash)),
      netPlay: clampRating(mapper(ratings.technical.netPlay)),
      clearLob: clampRating(mapper(ratings.technical.clearLob)),
      dropShot: clampRating(mapper(ratings.technical.dropShot)),
      defenseRetrieval: clampRating(mapper(ratings.technical.defenseRetrieval)),
      serveReturn: clampRating(mapper(ratings.technical.serveReturn))
    },
    physical: {
      stamina: clampRating(mapper(ratings.physical.stamina)),
      footworkSpeed: clampRating(mapper(ratings.physical.footworkSpeed)),
      explosivenessJump: clampRating(mapper(ratings.physical.explosivenessJump)),
      agilityBalance: clampRating(mapper(ratings.physical.agilityBalance))
    },
    mental: {
      anticipation: clampRating(mapper(ratings.mental.anticipation)),
      composure: clampRating(mapper(ratings.mental.composure)),
      focus: clampRating(mapper(ratings.mental.focus)),
      aggression: clampRating(mapper(ratings.mental.aggression))
    }
  };
}

function createPlayer(definition: ArchetypeDefinition, ratings: Player["ratings"]) {
  return playerSchema.parse({
    id: `calibration-${definition.key}`,
    name: definition.label,
    nationality: "CAL",
    age: 24,
    handedness: "right",
    styleLabel: definition.label,
    ratings
  });
}

function overall(player: Player) {
  const dossier = deriveAthleteDossier(player);
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

function normalizeToOverall(definition: ArchetypeDefinition) {
  let ratings = definition.ratings;
  let player = createPlayer(definition, ratings);

  for (let attempt = 0; attempt < 50 && overall(player) !== targetOverall; attempt += 1) {
    const delta = targetOverall - overall(player);
    ratings = mapRatings(ratings, (value) => value + delta);
    player = createPlayer(definition, ratings);
  }

  return player;
}

const archetypes = archetypeDefinitions.map((definition) => ({
  ...definition,
  player: normalizeToOverall(definition)
}));

function winRate(rowIndex: number, columnIndex: number, fidelity: SimulationFidelity) {
  if (rowIndex === columnIndex) {
    return 0.5;
  }

  const row = archetypes[rowIndex];
  const column = archetypes[columnIndex];
  let rowWins = 0;
  let matches = 0;

  for (let seedOffset = 1; seedOffset <= seedsPerPair; seedOffset += 1) {
    const seed = 700_000 + rowIndex * 10_000 + columnIndex * 100 + seedOffset;
    const rowAsA = simulateMatchByFidelity(
      {
        seed,
        playerA: row.player,
        playerB: column.player,
        tacticA: row.tactic,
        tacticB: column.tactic
      },
      fidelity
    );
    const rowAsB = simulateMatchByFidelity(
      {
        seed: seed + 50_000,
        playerA: column.player,
        playerB: row.player,
        tacticA: column.tactic,
        tacticB: row.tactic
      },
      fidelity
    );

    rowWins += rowAsA.winner === "A" ? 1 : 0;
    rowWins += rowAsB.winner === "B" ? 1 : 0;
    matches += 2;
  }

  return rowWins / matches;
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function summarizeProfiles() {
  return archetypes.map((archetype) => {
    const dossier = deriveAthleteDossier(archetype.player);
    const profile = deriveProfile(archetype.player);

    return {
      archetype: archetype.label,
      overall: overall(archetype.player),
      power: dossier.power,
      speed: dossier.speed,
      stamina: dossier.stamina,
      control: dossier.control,
      attack: profile.attackPressure.toFixed(1),
      front: profile.frontCourtControl.toFixed(1),
      recovery: profile.recoveryQuality.toFixed(1),
      tolerance: profile.rallyTolerance.toFixed(1),
      pressure: profile.pressureResistance.toFixed(1),
      judgment: profile.judgment.toFixed(1)
    };
  });
}

function summarizeMatrix(fidelity: SimulationFidelity) {
  return archetypes.map((row, rowIndex) => {
    const entry: Record<string, string> = {
      archetype: row.label
    };

    for (let columnIndex = 0; columnIndex < archetypes.length; columnIndex += 1) {
      entry[archetypes[columnIndex].key] = pct(winRate(rowIndex, columnIndex, fidelity));
    }

    return entry;
  });
}

suite("stat composition calibration", () => {
  it(
    "prints same-OVR archetype profile and matchup matrices",
    () => {
      console.log(`Target OVR: ${targetOverall}`);
      console.log(`Seeds per ordered archetype pair: ${seedsPerPair}`);
      console.log("archetype profiles");
      console.table(summarizeProfiles());
      console.log("same-OVR detailed win-rate matrix");
      console.table(summarizeMatrix("detailed"));
      console.log("same-OVR quick win-rate matrix");
      console.table(summarizeMatrix("quick"));

      expect(true).toBe(true);
    },
    120_000
  );
});
