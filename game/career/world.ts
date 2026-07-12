import { seededPlayers, type SeededPlayer } from "../content/players";
import type { Player } from "../core/models";
import { clamp, type CareerState, type RankingEntry, type RivalCircuitState, type WorldPlayerRecord, type WorldRegistryState } from "./models";

const minimumActiveWorldSize = 32;
const annualIntakeSize = 2;
const generatedFirstNames = [
  "Ari", "Bima", "Chen", "Dae", "Eli", "Farid", "Haru", "Ilya",
  "Jin", "Kiran", "Luca", "Min", "Niko", "Omar", "Pavel", "Rafi"
] as const;
const generatedLastNames = [
  "Ahn", "Basu", "Costa", "Dimas", "Eng", "Fujita", "Gao", "Halim",
  "Ito", "Jensen", "Kovac", "Lim", "Moreau", "Nordin", "Petrov", "Qureshi"
] as const;
const generatedNationalities = ["CHN", "DEN", "FRA", "GER", "IND", "INA", "JPN", "KOR", "MAS", "SGP", "SWE", "THA"] as const;
const generatedStyles = [
  "Attacking prospect",
  "Counter-punching prospect",
  "Front-court prospect",
  "Rally-building prospect",
  "Retrieval prospect"
] as const;

function stableHash(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function stableInt(input: string, min: number, max: number) {
  return min + (stableHash(input) % (max - min + 1));
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    traits: player.traits ? [...player.traits] : undefined,
    ratings: {
      technical: { ...player.ratings.technical },
      physical: { ...player.ratings.physical },
      mental: { ...player.ratings.mental }
    }
  };
}

function legacyCareerCurve(player: Player, seed: number) {
  const peakAge = stableInt(`${seed}:${player.id}:peak`, 23, 27);
  const declineAge = peakAge + stableInt(`${seed}:${player.id}:decline`, 2, 4);
  const retirementAge = Math.max(
    declineAge + 4,
    stableInt(`${seed}:${player.id}:retirement`, 33, 39)
  );

  return { peakAge, declineAge, retirementAge: Math.min(44, retirementAge) };
}

export function createInitialWorldRegistry(args: {
  seed: number;
  seasonId: string;
  date: string;
}): WorldRegistryState {
  return {
    version: 1,
    initializedAt: args.date,
    lastAdvancedSeasonId: args.seasonId,
    players: seededPlayers.map((entry, index): WorldPlayerRecord => ({
      player: clonePlayer(entry.player),
      status: "active",
      origin: "legacy_snapshot",
      seed: entry.seed,
      order: index,
      debutSeason: "legacy",
      retiredSeason: null,
      ...legacyCareerCurve(entry.player, args.seed)
    })),
    lifecycleLog: []
  };
}

export function ensureWorldRegistry(args: {
  registry: WorldRegistryState | undefined;
  seed: number;
  seasonId: string;
  date: string;
}) {
  return args.registry?.players.length
    ? args.registry
    : createInitialWorldRegistry(args);
}

export function averagePlayerRating(player: Player) {
  const values = [
    ...Object.values(player.ratings.technical),
    ...Object.values(player.ratings.physical),
    ...Object.values(player.ratings.mental)
  ];

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function progressionDelta(record: WorldPlayerRecord, nextAge: number, seasonId: string, attribute: string) {
  const salt = `${record.seed}:${record.player.id}:${seasonId}:${attribute}`;

  if (nextAge <= record.peakAge) {
    return stableInt(salt, 1, 2);
  }

  if (nextAge < record.declineAge) {
    return stableInt(salt, 0, 1);
  }

  return -stableInt(salt, 1, 3);
}

function progressPlayer(record: WorldPlayerRecord, seasonId: string): Player {
  const nextAge = Math.min(45, record.player.age + 1);
  const rating = (value: number, attribute: string) =>
    clamp(value + progressionDelta(record, nextAge, seasonId, attribute), 1, 100);
  const { technical, physical, mental } = record.player.ratings;

  return {
    ...clonePlayer(record.player),
    age: nextAge,
    ratings: {
      technical: {
        smash: rating(technical.smash, "technical.smash"),
        netPlay: rating(technical.netPlay, "technical.netPlay"),
        clearLob: rating(technical.clearLob, "technical.clearLob"),
        dropShot: rating(technical.dropShot, "technical.dropShot"),
        defenseRetrieval: rating(technical.defenseRetrieval, "technical.defenseRetrieval"),
        serveReturn: rating(technical.serveReturn, "technical.serveReturn")
      },
      physical: {
        stamina: rating(physical.stamina, "physical.stamina"),
        footworkSpeed: rating(physical.footworkSpeed, "physical.footworkSpeed"),
        explosivenessJump: rating(physical.explosivenessJump, "physical.explosivenessJump"),
        agilityBalance: rating(physical.agilityBalance, "physical.agilityBalance")
      },
      mental: {
        anticipation: rating(mental.anticipation, "mental.anticipation"),
        composure: rating(mental.composure, "mental.composure"),
        focus: rating(mental.focus, "mental.focus"),
        aggression: rating(mental.aggression, "mental.aggression")
      }
    }
  };
}

function generatedName(args: {
  seed: number;
  seasonId: string;
  ordinal: number;
  existingNames: Set<string>;
}) {
  const start = stableInt(`${args.seed}:${args.seasonId}:${args.ordinal}:name`, 0, generatedFirstNames.length * generatedLastNames.length - 1);

  for (let offset = 0; offset < generatedFirstNames.length * generatedLastNames.length; offset += 1) {
    const cursor = (start + offset) % (generatedFirstNames.length * generatedLastNames.length);
    const firstName = generatedFirstNames[cursor % generatedFirstNames.length]!;
    const lastName = generatedLastNames[Math.floor(cursor / generatedFirstNames.length)]!;
    const name = `${firstName} ${lastName}`;

    if (!args.existingNames.has(name)) {
      args.existingNames.add(name);
      return name;
    }
  }

  const fallback = `Circuit Prospect ${args.seasonId}-${args.ordinal + 1}`;
  args.existingNames.add(fallback);
  return fallback;
}

function createGeneratedPlayer(args: {
  careerSeed: number;
  seasonId: string;
  ordinal: number;
  order: number;
  existingNames: Set<string>;
}): WorldPlayerRecord {
  const id = `world-${args.seasonId}-${String(args.ordinal + 1).padStart(2, "0")}`;
  const seed = stableHash(`${args.careerSeed}:${id}`);
  const score = (attribute: string) => stableInt(`${seed}:${attribute}`, 57, 76);
  const player: Player = {
    id,
    name: generatedName({ ...args, seed: args.careerSeed }),
    nationality: generatedNationalities[stableInt(`${seed}:nationality`, 0, generatedNationalities.length - 1)]!,
    age: stableInt(`${seed}:age`, 17, 19),
    handedness: stableInt(`${seed}:handedness`, 0, 4) === 0 ? "left" : "right",
    styleLabel: generatedStyles[stableInt(`${seed}:style`, 0, generatedStyles.length - 1)]!,
    traits: ["generatedIntake", "futureUpside"],
    ratings: {
      technical: {
        smash: score("technical.smash"),
        netPlay: score("technical.netPlay"),
        clearLob: score("technical.clearLob"),
        dropShot: score("technical.dropShot"),
        defenseRetrieval: score("technical.defenseRetrieval"),
        serveReturn: score("technical.serveReturn")
      },
      physical: {
        stamina: score("physical.stamina"),
        footworkSpeed: score("physical.footworkSpeed"),
        explosivenessJump: score("physical.explosivenessJump"),
        agilityBalance: score("physical.agilityBalance")
      },
      mental: {
        anticipation: score("mental.anticipation"),
        composure: score("mental.composure"),
        focus: score("mental.focus"),
        aggression: score("mental.aggression")
      }
    }
  };
  const peakAge = stableInt(`${seed}:peak`, 24, 28);
  const declineAge = peakAge + stableInt(`${seed}:decline`, 2, 4);

  return {
    player,
    status: "active",
    origin: "generated_intake",
    seed,
    order: args.order,
    debutSeason: args.seasonId,
    retiredSeason: null,
    peakAge,
    declineAge,
    retirementAge: Math.min(44, Math.max(declineAge + 4, stableInt(`${seed}:retirement`, 34, 41)))
  };
}

export function protectedWorldPlayerIds(state: Pick<CareerState, "program" | "athletes" | "ecosystem">) {
  return new Set([
    state.program.managedPlayerId,
    ...state.athletes.map((athlete) => athlete.playerId),
    ...state.ecosystem.recruitment.roster.map((slot) => slot.athleteId)
  ]);
}

export function advanceWorldRegistry(args: {
  registry: WorldRegistryState;
  careerSeed: number;
  seasonId: string;
  date: string;
  protectedPlayerIds: Set<string>;
}): WorldRegistryState {
  if (args.registry.lastAdvancedSeasonId === args.seasonId) {
    return args.registry;
  }

  const orderedRecords = [...args.registry.players].sort((left, right) =>
    left.player.id.localeCompare(right.player.id)
  );
  const lifecycleLog = [...args.registry.lifecycleLog];
  let retirements = 0;
  const progressed = orderedRecords.map((record): WorldPlayerRecord => {
    if (record.status === "retired") {
      return record;
    }

    const ratingBefore = averagePlayerRating(record.player);
    const player = progressPlayer(record, args.seasonId);
    const ratingAfter = averagePlayerRating(player);
    const shouldRetire =
      player.age >= record.retirementAge &&
      !args.protectedPlayerIds.has(record.player.id);
    const type = shouldRetire ? "retirement" as const : "progression" as const;

    if (shouldRetire) {
      retirements += 1;
    }

    lifecycleLog.push({
      id: `world:${args.seasonId}:${record.player.id}:${type}`,
      seasonId: args.seasonId,
      date: args.date,
      playerId: record.player.id,
      type,
      ageBefore: record.player.age,
      ageAfter: player.age,
      ratingBefore,
      ratingAfter,
      summary: shouldRetire
        ? `${player.name} retired from the active circuit at age ${player.age}.`
        : `${player.name} advanced to age ${player.age}; world ratings followed the stored career curve.`
    });

    return {
      ...record,
      player,
      status: shouldRetire ? "retired" : "active",
      retiredSeason: shouldRetire ? args.seasonId : null
    };
  });
  const activeCount = progressed.filter((record) => record.status === "active").length;
  const intakeCount = Math.max(annualIntakeSize, retirements, minimumActiveWorldSize - activeCount);
  const existingNames = new Set(progressed.map((record) => record.player.name));
  const firstOrder = progressed.reduce((highest, record) => Math.max(highest, record.order), -1) + 1;
  const intake = Array.from({ length: intakeCount }, (_, ordinal) =>
    createGeneratedPlayer({
      careerSeed: args.careerSeed,
      seasonId: args.seasonId,
      ordinal,
      order: firstOrder + ordinal,
      existingNames
    })
  );

  for (const record of intake) {
    lifecycleLog.push({
      id: `world:${args.seasonId}:${record.player.id}:intake`,
      seasonId: args.seasonId,
      date: args.date,
      playerId: record.player.id,
      type: "intake",
      ageBefore: null,
      ageAfter: record.player.age,
      ratingBefore: null,
      ratingAfter: averagePlayerRating(record.player),
      summary: `${record.player.name} entered the circuit through the ${args.seasonId} intake.`
    });
  }

  return {
    ...args.registry,
    lastAdvancedSeasonId: args.seasonId,
    players: [...progressed, ...intake].sort((left, right) => left.order - right.order || left.player.id.localeCompare(right.player.id)),
    lifecycleLog
  };
}

export function activeWorldSeededPlayers(
  state: Pick<CareerState, "world" | "seed" | "seasonId" | "date">
): SeededPlayer[] {
  const world = ensureWorldRegistry({
    registry: state.world,
    seed: state.seed,
    seasonId: state.seasonId,
    date: state.date
  });

  return world.players
    .filter((record) => record.status === "active")
    .sort((left, right) => left.order - right.order || left.player.id.localeCompare(right.player.id))
    .map((record, index) => ({ seed: index + 1, player: record.player }));
}

export function careerWorldPlayerMap(
  state: Pick<CareerState, "world" | "seed" | "seasonId" | "date">
) {
  const world = ensureWorldRegistry({
    registry: state.world,
    seed: state.seed,
    seasonId: state.seasonId,
    date: state.date
  });

  return Object.fromEntries(world.players.map((record) => [record.player.id, record.player])) as Record<string, Player>;
}

function worldRatingForRival(player: Player) {
  return Math.round(averagePlayerRating(player));
}

export function syncRivalCircuitWithWorld(args: {
  rivals: RivalCircuitState;
  world: WorldRegistryState;
  rankings: RankingEntry[];
  protectedPlayerIds: Set<string>;
  date: string;
}): RivalCircuitState {
  const active = args.world.players.filter((record) => record.status === "active");
  const activeById = new Map(active.map((record) => [record.player.id, record]));
  const rankingById = new Map(args.rankings.map((entry) => [entry.playerId, entry]));
  const assignedIds = new Set(args.rivals.programs.flatMap((program) =>
    program.roster.filter((athlete) => activeById.has(athlete.playerId)).map((athlete) => athlete.playerId)
  ));
  const replacementPool = active
    .filter((record) => record.origin === "generated_intake" && !args.protectedPlayerIds.has(record.player.id))
    .sort((left, right) => right.order - left.order || left.player.id.localeCompare(right.player.id));

  const nextPrograms = args.rivals.programs.map((program) => ({
    ...program,
    eventEntries: [],
    roster: program.roster.map((athlete) => {
      let record = activeById.get(athlete.playerId);

      if (!record) {
        record = replacementPool.find((candidate) => !assignedIds.has(candidate.player.id));
      }

      if (!record) {
        return athlete;
      }

      assignedIds.add(record.player.id);
      const ranking = rankingById.get(record.player.id);

      return {
        ...athlete,
        playerId: record.player.id,
        name: record.player.name,
        age: Math.min(42, record.player.age),
        rating: worldRatingForRival(record.player),
        fatigue: Math.max(8, athlete.fatigue * 0.35),
        rankingPoints: ranking?.points ?? 0,
        currentRank: ranking?.rank ?? args.rankings.length + 1,
        trend: record.origin === "generated_intake" ? "surging" as const : athlete.trend
      };
    })
  }));

  return {
    ...args.rivals,
    programs: nextPrograms,
    fieldPressure: [],
    lastSimulatedDate: args.date
  };
}
