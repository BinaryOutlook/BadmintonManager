import { playerSchema, type Player } from "../core/models";

export interface SeededPlayer {
  seed: number;
  player: Player;
}

function createSeededPlayer(seed: number, player: Omit<Player, "id"> & { id?: string }): SeededPlayer {
  return {
    seed,
    player: playerSchema.parse({
      id: player.id ?? `player-${seed}`,
      ...player
    })
  };
}

export const seededPlayers: SeededPlayer[] = [
  createSeededPlayer(1, {
    name: "Adrian Koh",
    nationality: "SGP",
    age: 25,
    handedness: "right",
    styleLabel: "Attack architect",
    ratings: {
      technical: { smash: 90, netPlay: 82, clearLob: 84, dropShot: 83, defenseRetrieval: 85, serveReturn: 84 },
      physical: { stamina: 86, footworkSpeed: 88, explosivenessJump: 89, agilityBalance: 84 },
      mental: { anticipation: 83, composure: 82, focus: 83, aggression: 84 }
    }
  }),
  createSeededPlayer(2, {
    name: "Mika Sato",
    nationality: "JPN",
    age: 23,
    handedness: "left",
    styleLabel: "Front-court dissector",
    ratings: {
      technical: { smash: 82, netPlay: 89, clearLob: 81, dropShot: 87, defenseRetrieval: 83, serveReturn: 88 },
      physical: { stamina: 84, footworkSpeed: 87, explosivenessJump: 81, agilityBalance: 88 },
      mental: { anticipation: 87, composure: 84, focus: 85, aggression: 73 }
    }
  }),
  createSeededPlayer(3, {
    name: "Jun Park",
    nationality: "KOR",
    age: 24,
    handedness: "right",
    styleLabel: "Pace breaker",
    ratings: {
      technical: { smash: 84, netPlay: 80, clearLob: 86, dropShot: 82, defenseRetrieval: 86, serveReturn: 83 },
      physical: { stamina: 88, footworkSpeed: 84, explosivenessJump: 83, agilityBalance: 86 },
      mental: { anticipation: 84, composure: 86, focus: 84, aggression: 71 }
    }
  }),
  createSeededPlayer(4, {
    name: "Rahul Menon",
    nationality: "IND",
    age: 27,
    handedness: "right",
    styleLabel: "Heavy finisher",
    ratings: {
      technical: { smash: 88, netPlay: 75, clearLob: 80, dropShot: 78, defenseRetrieval: 81, serveReturn: 79 },
      physical: { stamina: 81, footworkSpeed: 82, explosivenessJump: 87, agilityBalance: 80 },
      mental: { anticipation: 78, composure: 79, focus: 78, aggression: 86 }
    }
  }),
  createSeededPlayer(5, {
    name: "Thiago Vale",
    nationality: "BRA",
    age: 22,
    handedness: "left",
    styleLabel: "Counter striker",
    ratings: {
      technical: { smash: 79, netPlay: 81, clearLob: 82, dropShot: 80, defenseRetrieval: 86, serveReturn: 82 },
      physical: { stamina: 83, footworkSpeed: 85, explosivenessJump: 79, agilityBalance: 85 },
      mental: { anticipation: 84, composure: 80, focus: 82, aggression: 69 }
    }
  }),
  createSeededPlayer(6, {
    name: "Louis Mercier",
    nationality: "FRA",
    age: 26,
    handedness: "right",
    styleLabel: "Measured grinder",
    ratings: {
      technical: { smash: 77, netPlay: 80, clearLob: 87, dropShot: 79, defenseRetrieval: 84, serveReturn: 81 },
      physical: { stamina: 89, footworkSpeed: 80, explosivenessJump: 76, agilityBalance: 83 },
      mental: { anticipation: 82, composure: 85, focus: 84, aggression: 63 }
    }
  }),
  createSeededPlayer(7, {
    name: "Wang Lei",
    nationality: "CHN",
    age: 21,
    handedness: "right",
    styleLabel: "Fast-court attacker",
    ratings: {
      technical: { smash: 86, netPlay: 79, clearLob: 79, dropShot: 81, defenseRetrieval: 79, serveReturn: 81 },
      physical: { stamina: 78, footworkSpeed: 89, explosivenessJump: 86, agilityBalance: 82 },
      mental: { anticipation: 77, composure: 76, focus: 79, aggression: 88 }
    }
  }),
  createSeededPlayer(8, {
    name: "Noah Becker",
    nationality: "GER",
    age: 28,
    handedness: "left",
    styleLabel: "Patient retriever",
    ratings: {
      technical: { smash: 74, netPlay: 78, clearLob: 85, dropShot: 77, defenseRetrieval: 88, serveReturn: 80 },
      physical: { stamina: 87, footworkSpeed: 81, explosivenessJump: 73, agilityBalance: 86 },
      mental: { anticipation: 85, composure: 83, focus: 84, aggression: 58 }
    }
  }),
  createSeededPlayer(9, {
    name: "Arif Hadi",
    nationality: "MAS",
    age: 24,
    handedness: "right",
    styleLabel: "Net hunter",
    ratings: {
      technical: { smash: 78, netPlay: 85, clearLob: 76, dropShot: 84, defenseRetrieval: 77, serveReturn: 86 },
      physical: { stamina: 80, footworkSpeed: 83, explosivenessJump: 77, agilityBalance: 84 },
      mental: { anticipation: 82, composure: 79, focus: 80, aggression: 74 }
    }
  }),
  createSeededPlayer(10, {
    name: "Oscar Nyman",
    nationality: "SWE",
    age: 25,
    handedness: "right",
    styleLabel: "Long-rally mechanic",
    ratings: {
      technical: { smash: 73, netPlay: 76, clearLob: 84, dropShot: 78, defenseRetrieval: 82, serveReturn: 77 },
      physical: { stamina: 86, footworkSpeed: 80, explosivenessJump: 74, agilityBalance: 82 },
      mental: { anticipation: 80, composure: 82, focus: 81, aggression: 57 }
    }
  }),
  createSeededPlayer(11, {
    name: "Pablo Reyes",
    nationality: "ESP",
    age: 23,
    handedness: "left",
    styleLabel: "Sharp shotmaker",
    ratings: {
      technical: { smash: 81, netPlay: 82, clearLob: 78, dropShot: 84, defenseRetrieval: 76, serveReturn: 80 },
      physical: { stamina: 77, footworkSpeed: 82, explosivenessJump: 80, agilityBalance: 79 },
      mental: { anticipation: 78, composure: 76, focus: 75, aggression: 81 }
    }
  }),
  createSeededPlayer(12, {
    name: "Tomas Novak",
    nationality: "CZE",
    age: 27,
    handedness: "right",
    styleLabel: "Deep-court spoiler",
    ratings: {
      technical: { smash: 75, netPlay: 74, clearLob: 83, dropShot: 76, defenseRetrieval: 80, serveReturn: 77 },
      physical: { stamina: 82, footworkSpeed: 79, explosivenessJump: 75, agilityBalance: 81 },
      mental: { anticipation: 79, composure: 80, focus: 78, aggression: 61 }
    }
  }),
  createSeededPlayer(13, {
    name: "Hamza Qureshi",
    nationality: "PAK",
    age: 22,
    handedness: "right",
    styleLabel: "Burst attacker",
    ratings: {
      technical: { smash: 84, netPlay: 72, clearLob: 75, dropShot: 74, defenseRetrieval: 74, serveReturn: 75 },
      physical: { stamina: 74, footworkSpeed: 83, explosivenessJump: 85, agilityBalance: 76 },
      mental: { anticipation: 73, composure: 72, focus: 71, aggression: 85 }
    }
  }),
  createSeededPlayer(14, {
    name: "Daniel Flores",
    nationality: "MEX",
    age: 26,
    handedness: "left",
    styleLabel: "Flat-drive disruptor",
    ratings: {
      technical: { smash: 76, netPlay: 79, clearLob: 77, dropShot: 78, defenseRetrieval: 77, serveReturn: 81 },
      physical: { stamina: 78, footworkSpeed: 80, explosivenessJump: 76, agilityBalance: 79 },
      mental: { anticipation: 78, composure: 75, focus: 76, aggression: 72 }
    }
  }),
  createSeededPlayer(15, {
    name: "Yousef Rahman",
    nationality: "UAE",
    age: 21,
    handedness: "right",
    styleLabel: "Early-strike gambler",
    ratings: {
      technical: { smash: 79, netPlay: 72, clearLob: 73, dropShot: 74, defenseRetrieval: 71, serveReturn: 74 },
      physical: { stamina: 73, footworkSpeed: 77, explosivenessJump: 80, agilityBalance: 72 },
      mental: { anticipation: 70, composure: 69, focus: 70, aggression: 82 }
    }
  }),
  createSeededPlayer(16, {
    name: "Kai Tan",
    nationality: "SGP",
    age: 20,
    handedness: "left",
    styleLabel: "Developing all-rounder",
    ratings: {
      technical: { smash: 71, netPlay: 74, clearLob: 72, dropShot: 73, defenseRetrieval: 73, serveReturn: 75 },
      physical: { stamina: 76, footworkSpeed: 75, explosivenessJump: 72, agilityBalance: 74 },
      mental: { anticipation: 74, composure: 71, focus: 72, aggression: 67 }
    }
  })
];

export const playerMap = Object.fromEntries(
  seededPlayers.map((entry) => [entry.player.id, entry.player])
) as Record<string, Player>;
