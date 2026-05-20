import type { Player } from "../core/models";
import { SeededRng } from "../core/rng";
import { seededPlayers, type SeededPlayer } from "../content/players";
import { addDays, daysBetween } from "./calendar";
import {
  defaultRankingSettings,
  type CareerEventDefinition,
  type CareerState,
  type CareerTier,
  type RankingEntry,
  type RankingResult,
  type RankingResultRound,
  type RankingResultSource,
  type RankingSettings
} from "./models";

const bootstrapTiers: CareerTier[] = [
  "National",
  "Invitational",
  "Circuit 300",
  "Circuit 500",
  "Circuit 300",
  "National",
  "Circuit 500",
  "Circuit 750",
  "Circuit 300",
  "Invitational",
  "Circuit 500",
  "Circuit 1000",
  "Circuit 300",
  "National",
  "Circuit 500",
  "Circuit 750",
  "Circuit 300",
  "Invitational",
  "Circuit 500",
  "Circuit 1000",
  "Circuit 300",
  "National",
  "Circuit 500",
  "Circuit 750",
  "Circuit 300",
  "Invitational",
  "Circuit 750",
  "Circuit 300"
];

const bracketOpeningOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15] as const;

function stableHash(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function playerStrength(player: Player) {
  const { technical, physical, mental } = player.ratings;

  return (
    technical.smash * 0.14 +
    technical.netPlay * 0.12 +
    technical.defenseRetrieval * 0.13 +
    technical.serveReturn * 0.1 +
    physical.stamina * 0.13 +
    physical.footworkSpeed * 0.13 +
    physical.agilityBalance * 0.08 +
    mental.composure * 0.1 +
    mental.focus * 0.09 +
    mental.aggression * 0.08
  );
}

function dateFromCareerStart(careerStartDate: string, daysBeforeStart: number) {
  return addDays(careerStartDate, -daysBeforeStart);
}

function countedExpiryDate(resultDate: string, windowDays: number) {
  return addDays(resultDate, windowDays + 1);
}

function compareRankingResults(left: RankingResult, right: RankingResult) {
  return (
    right.points - left.points ||
    right.date.localeCompare(left.date) ||
    left.eventId.localeCompare(right.eventId) ||
    left.id.localeCompare(right.id)
  );
}

function toRankingEventHistory(result: RankingResult): RankingEntry["eventHistory"][number] {
  return {
    eventId: result.eventId,
    round: result.resultRound,
    points: result.points,
    date: result.date,
    seasonId: result.seasonId,
    tier: result.tier
  };
}

function seasonIdForDate(asOfDate: string) {
  return asOfDate.slice(0, 4);
}

function normalizeSettings(settings: Partial<RankingSettings> | RankingSettings | undefined): RankingSettings {
  return {
    ...defaultRankingSettings,
    ...settings
  };
}

export function isWithinRankingWindow(args: {
  resultDate: string;
  asOfDate: string;
  windowDays: number;
}): boolean {
  const daysOld = daysBetween(args.resultDate, args.asOfDate);

  return daysOld >= 0 && daysOld <= args.windowDays;
}

export function rankingResultsForPlayer(args: {
  results: RankingResult[];
  playerId: string;
  asOfDate: string;
  windowDays: number;
  maxCountedResults: number;
}): {
  eligible: RankingResult[];
  counted: RankingResult[];
  nextExpiryDate: string | null;
} {
  const eligible = args.results
    .filter(
      (result) =>
        result.playerId === args.playerId &&
        isWithinRankingWindow({
          resultDate: result.date,
          asOfDate: args.asOfDate,
          windowDays: args.windowDays
        })
    )
    .sort(compareRankingResults);
  const counted = eligible.slice(0, args.maxCountedResults);
  const nextExpiryDate = eligible.length
    ? eligible
        .map((result) => countedExpiryDate(result.date, args.windowDays))
        .sort((left, right) => left.localeCompare(right))[0] ?? null
    : null;

  return {
    eligible,
    counted,
    nextExpiryDate
  };
}

export function buildRankingSnapshot(args: {
  players: SeededPlayer[];
  results: RankingResult[];
  asOfDate: string;
  previousRankings?: RankingEntry[];
  settings: RankingSettings;
}): RankingEntry[] {
  const previousRankByPlayer = new Map(args.previousRankings?.map((entry) => [entry.playerId, entry.rank]) ?? []);
  const seasonId = seasonIdForDate(args.asOfDate);
  const rows = args.players.map((entry) => {
    const playerResults = rankingResultsForPlayer({
      results: args.results,
      playerId: entry.player.id,
      asOfDate: args.asOfDate,
      windowDays: args.settings.windowDays,
      maxCountedResults: args.settings.maxCountedResults
    });
    const points = playerResults.counted.reduce((total, result) => total + result.points, 0);
    const seasonPoints = args.results
      .filter((result) => result.playerId === entry.player.id && result.seasonId === seasonId && !result.artificial)
      .reduce((total, result) => total + result.points, 0);
    const bestResultPoints = playerResults.counted[0]?.points ?? 0;

    return {
      playerId: entry.player.id,
      rank: previousRankByPlayer.get(entry.player.id) ?? entry.seed,
      points,
      seasonPoints,
      eventHistory: playerResults.eligible
        .slice()
        .sort((left, right) => right.date.localeCompare(left.date) || compareRankingResults(left, right))
        .map(toRankingEventHistory),
      countedResults: playerResults.counted.length,
      eligibleResults: playerResults.eligible.length,
      bestResultPoints,
      nextExpiryDate: playerResults.nextExpiryDate,
      movement: null,
      countedResultIds: playerResults.counted.map((result) => result.id)
    } satisfies RankingEntry;
  });
  const ordered = rows
    .sort((left, right) => {
      const previousLeft = previousRankByPlayer.get(left.playerId) ?? Number.MAX_SAFE_INTEGER;
      const previousRight = previousRankByPlayer.get(right.playerId) ?? Number.MAX_SAFE_INTEGER;

      return (
        right.points - left.points ||
        right.countedResults - left.countedResults ||
        right.bestResultPoints - left.bestResultPoints ||
        previousLeft - previousRight ||
        left.playerId.localeCompare(right.playerId)
      );
    })
    .map((entry, index) => {
      const rank = index + 1;

      return {
        ...entry,
        rank,
        movement: null
      };
    });

  return ordered;
}

export function rankingsByCurrentRank(entries: RankingEntry[]) {
  return [...entries].sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId));
}

export function recalculateRanks(entries: RankingEntry[]) {
  return [...entries]
    .sort((left, right) => right.points - left.points || left.playerId.localeCompare(right.playerId))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

export function rankingFor(rankings: RankingEntry[], playerId: string) {
  return rankings.find((entry) => entry.playerId === playerId);
}

export function rankingResultId(args: {
  seasonId: string;
  eventId: string;
  playerId: string;
}) {
  return `${args.seasonId}:${args.eventId}:${args.playerId}:ranking`;
}

export function createRankingResult(args: {
  seasonId: string;
  playerId: string;
  eventId: string;
  eventName: string;
  tier: CareerTier;
  date: string;
  resultRound: RankingResultRound;
  points: number;
  source: RankingResultSource;
  artificial: boolean;
}): RankingResult {
  return {
    id: rankingResultId({
      seasonId: args.seasonId,
      eventId: args.eventId,
      playerId: args.playerId
    }),
    seasonId: args.seasonId,
    playerId: args.playerId,
    eventId: args.eventId,
    eventName: args.eventName,
    tier: args.tier,
    date: args.date,
    resultRound: args.resultRound,
    points: args.points,
    source: args.source,
    artificial: args.artificial
  };
}

export function rebuildCareerRankingSnapshot(career: CareerState, asOfDate = career.date): CareerState {
  const settings = normalizeSettings(career.rankingSettings);

  return {
    ...career,
    rankingSettings: settings,
    rankings: buildRankingSnapshot({
      players: careerPlayersFromState(career),
      results: career.rankingResults,
      asOfDate,
      previousRankings: career.rankings,
      settings
    })
  };
}

export function appendRankingResultsAndRebuild(args: {
  career: CareerState;
  results: RankingResult[];
  asOfDate: string;
}): CareerState {
  if (args.results.length === 0) {
    return rebuildCareerRankingSnapshot(args.career, args.asOfDate);
  }

  const existingIds = new Set(args.career.rankingResults.map((result) => result.id));
  const existingPlayerEvents = new Set(
    args.career.rankingResults.map((result) => `${result.seasonId}:${result.eventId}:${result.playerId}`)
  );
  const additions = args.results.filter((result) => {
    const key = `${result.seasonId}:${result.eventId}:${result.playerId}`;

    return !existingIds.has(result.id) && !existingPlayerEvents.has(key);
  });

  return rebuildCareerRankingSnapshot(
    {
      ...args.career,
      rankingResults: [...args.career.rankingResults, ...additions]
    },
    args.asOfDate
  );
}

function careerPlayersFromState(career: Pick<CareerState, "rankings">) {
  const rankedIds = new Set(career.rankings.map((entry) => entry.playerId));
  const rankedPlayers = career.rankings
    .map((entry) => seededPlayers.find((playerEntry) => playerEntry.player.id === entry.playerId))
    .filter((entry): entry is SeededPlayer => Boolean(entry));
  const missingPlayers = seededPlayers.filter((entry) => !rankedIds.has(entry.player.id));

  return [...rankedPlayers, ...missingPlayers];
}

export function registerRankingPlayerPool(players: SeededPlayer[]) {
  void players;
}

export function createInitialRankings(seededEntries: SeededPlayer[], managedPlayerId: string) {
  registerRankingPlayerPool(seededEntries);
  const results = seededEntries.map((entry) =>
    createRankingResult({
      seasonId: "legacy",
      playerId: entry.player.id,
      eventId: "legacy-initial-strength-snapshot",
      eventName: "Legacy Initial Strength Snapshot",
      tier: "Invitational",
      date: "2026-06-01",
      resultRound: "R16",
      points: Math.max(1, Math.round(playerStrength(entry.player) * 18)),
      source: "legacy_snapshot",
      artificial: true
    })
  );
  const rankings = buildRankingSnapshot({
    players: seededEntries,
    results,
    asOfDate: "2026-06-01",
    settings: defaultRankingSettings
  });
  void managedPlayerId;

  return rankingsByCurrentRank(rankings);
}

function templateForTier(eventTemplates: CareerEventDefinition[], tier: CareerTier, index: number) {
  const matches = eventTemplates.filter((event) => event.tier === tier);
  const fallback = eventTemplates[index % eventTemplates.length];

  return matches[index % Math.max(1, matches.length)] ?? fallback;
}

function targetAppearancesForBootstrap(tier: CareerTier) {
  if (tier === "National" || tier === "Invitational" || tier === "Circuit 300") {
    return 8;
  }

  if (tier === "Circuit 500") {
    return 6;
  }

  return 4;
}

function tierFitForBootstrap(tier: CareerTier, strengthRank: number, playerCount: number) {
  const percentile = strengthRank / playerCount;

  if (tier === "National" || tier === "Invitational") {
    return percentile > 0.55 ? 1.55 : percentile > 0.35 ? 1.15 : 0.82;
  }

  if (tier === "Circuit 300") {
    return percentile > 0.4 ? 1.35 : 1;
  }

  if (tier === "Circuit 750" || tier === "Circuit 1000" || tier === "Finals") {
    return percentile < 0.38 ? 1.35 : percentile < 0.62 ? 0.82 : 0.42;
  }

  return percentile < 0.65 ? 1.05 : 0.85;
}

function weightedPickWithoutReplacement(args: {
  players: SeededPlayer[];
  count: number;
  rng: SeededRng;
  weightFor: (entry: SeededPlayer) => number;
}) {
  const remaining = [...args.players];
  const selected: SeededPlayer[] = [];

  while (selected.length < args.count && remaining.length > 0) {
    const picked = args.rng.weightedPick(
      remaining.map((entry) => ({
        item: entry,
        weight: Math.max(0.001, args.weightFor(entry))
      }))
    );
    selected.push(picked);
    remaining.splice(remaining.findIndex((entry) => entry.player.id === picked.player.id), 1);
  }

  return selected;
}

function selectBootstrapField(args: {
  players: SeededPlayer[];
  tier: CareerTier;
  eventKey: string;
  seed: number;
  appearances: Map<string, number>;
}) {
  const rng = new SeededRng(stableHash(`${args.seed}:${args.eventKey}:field`));
  const rankedByStrength = [...args.players].sort(
    (left, right) => playerStrength(right.player) - playerStrength(left.player) || left.player.id.localeCompare(right.player.id)
  );
  const strengthRank = new Map(rankedByStrength.map((entry, index) => [entry.player.id, index + 1]));
  const forcedDebtCount = args.tier === "National" || args.tier === "Invitational" || args.tier === "Circuit 300" ? 4 : 1;
  const forced = [...args.players]
    .sort((left, right) => {
      const leftAppearances = args.appearances.get(left.player.id) ?? 0;
      const rightAppearances = args.appearances.get(right.player.id) ?? 0;

      return (
        leftAppearances - rightAppearances ||
        (strengthRank.get(right.player.id) ?? 99) - (strengthRank.get(left.player.id) ?? 99) ||
        left.player.id.localeCompare(right.player.id)
      );
    })
    .slice(0, forcedDebtCount);
  const forcedIds = new Set(forced.map((entry) => entry.player.id));
  const remaining = args.players.filter((entry) => !forcedIds.has(entry.player.id));
  const targetAppearances = targetAppearancesForBootstrap(args.tier);
  const selected = [
    ...forced,
    ...weightedPickWithoutReplacement({
      players: remaining,
      count: 16 - forced.length,
      rng,
      weightFor: (entry) => {
        const rank = strengthRank.get(entry.player.id) ?? args.players.length;
        const strength = playerStrength(entry.player);
        const debt = Math.max(0, targetAppearances - (args.appearances.get(entry.player.id) ?? 0));
        const tierFit = tierFitForBootstrap(args.tier, rank, args.players.length);
        const skillWeight = Math.pow(Math.max(1, strength), args.tier === "National" || args.tier === "Invitational" ? 1.35 : 2.15);

        return skillWeight * tierFit * (1 + debt * 0.42);
      }
    })
  ];

  for (const entry of selected) {
    args.appearances.set(entry.player.id, (args.appearances.get(entry.player.id) ?? 0) + 1);
  }

  return selected.sort((left, right) => playerStrength(right.player) - playerStrength(left.player) || left.player.id.localeCompare(right.player.id));
}

function orderedBootstrapBracket(field: SeededPlayer[]) {
  const bySeed = Object.fromEntries(field.map((entry, index) => [index + 1, entry]));

  return bracketOpeningOrder
    .map((seed) => bySeed[seed])
    .filter((entry): entry is SeededPlayer => Boolean(entry));
}

function bootstrapMatchWinner(left: SeededPlayer, right: SeededPlayer, rng: SeededRng) {
  const leftStrength = playerStrength(left.player) + rng.nextNumber(-5.5, 5.5);
  const rightStrength = playerStrength(right.player) + rng.nextNumber(-5.5, 5.5);
  const leftProbability = Math.max(0.18, Math.min(0.82, 0.5 + (leftStrength - rightStrength) / 58));

  return rng.chance(leftProbability) ? left : right;
}

function simulateBootstrapPlacements(args: {
  field: SeededPlayer[];
  seed: number;
  eventKey: string;
}) {
  const rng = new SeededRng(stableHash(`${args.seed}:${args.eventKey}:bracket`));
  const placements = new Map<string, RankingResultRound>();
  let roundEntrants = orderedBootstrapBracket(args.field);
  const rounds: RankingResultRound[] = ["R16", "QF", "SF", "F"];

  for (const round of rounds) {
    const winners: SeededPlayer[] = [];

    for (let index = 0; index < roundEntrants.length; index += 2) {
      const left = roundEntrants[index];
      const right = roundEntrants[index + 1];

      if (!left || !right) {
        continue;
      }

      const winner = bootstrapMatchWinner(left, right, rng);
      const loser = winner.player.id === left.player.id ? right : left;
      placements.set(loser.player.id, round);
      winners.push(winner);
    }

    roundEntrants = winners;
  }

  const champion = roundEntrants[0];

  if (champion) {
    placements.set(champion.player.id, "champion");
  }

  return placements;
}

export function createBootstrapRankingResults(args: {
  players: SeededPlayer[];
  careerStartDate: string;
  seed: number;
  settings: RankingSettings;
  eventTemplates: CareerEventDefinition[];
}): RankingResult[] {
  registerRankingPlayerPool(args.players);
  const appearances = new Map<string, number>();
  const results: RankingResult[] = [];
  const firstDaysBeforeStart = args.settings.bootstrapWeeks * 7 - 7;
  const lastDaysBeforeStart = 7;
  const span = firstDaysBeforeStart - lastDaysBeforeStart;

  bootstrapTiers.forEach((tier, index) => {
    const template = templateForTier(args.eventTemplates, tier, index);
    const daysBeforeStart = Math.round(firstDaysBeforeStart - (span * index) / Math.max(1, bootstrapTiers.length - 1));
    const date = dateFromCareerStart(args.careerStartDate, daysBeforeStart);
    const eventId = `bootstrap-${index + 1}-${tier.toLowerCase().replaceAll(" ", "-")}`;
    const eventName = `Prior ${tier} Form Event ${index + 1}`;
    const field = selectBootstrapField({
      players: args.players,
      tier,
      eventKey: eventId,
      seed: args.seed,
      appearances
    });
    const placements = simulateBootstrapPlacements({
      field,
      seed: args.seed,
      eventKey: eventId
    });

    for (const [playerId, resultRound] of placements) {
      const points = template.rankingPoints[resultRound] ?? template.rankingPoints.R16 ?? 0;

      results.push(
        createRankingResult({
          seasonId: String(Number(args.careerStartDate.slice(0, 4)) - 1),
          playerId,
          eventId,
          eventName,
          tier,
          date,
          resultRound,
          points,
          source: "bootstrap_sim",
          artificial: true
        })
      );
    }
  });

  return results.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}
