import { seededPlayers, playerMap } from "../content/players";
import { tacticLibrary } from "../content/tactics";
import { simulateMatchByFidelity } from "../core/match";
import type { MatchTactic, Player } from "../core/models";
import { SeededRng } from "../core/rng";
import {
  completedTournamentMatches,
  createCareerEventBracketSnapshot,
  eventEndDate,
  getCareerEvent,
  roundKeyForPlacement,
  tournamentPlacements
} from "./events";
import { scheduledDateForRound } from "./matchSchedule";
import type {
  CareerEventDefinition,
  CareerMatchRecord,
  CareerMatchRecordSource,
  CareerState,
  CareerUniverseTournamentPlacement,
  CareerUniverseTournamentRecord,
  UniverseEventRecordSource,
  UniverseManagedPlayerResult
} from "./models";
import { awardRankingPoints } from "./rankings";
import { syncManagedAthleteFromRankings } from "./state";
import type { RoundName, TournamentState } from "../tournament/tournament";

const bracketOpeningOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15] as const;
const universeRounds: RoundName[] = ["R16", "QF", "SF", "F"];
const completeMatchCount = 15;

type UniverseMatchFact = {
  recordId: string;
  slotId: string;
  round: RoundName;
  date: string;
  playerAId: string;
  playerBId: string;
  winnerId: string;
  scoreline: string;
  source: CareerMatchRecordSource;
};

type UniverseBracket = {
  entrants: string[];
  matches: UniverseMatchFact[];
  championId: string | null;
  runnerUpId: string | null;
  placements: CareerUniverseTournamentPlacement[];
};

function stableHash(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function universeSeed(args: {
  career: CareerState;
  event: CareerEventDefinition;
  salt: string;
}) {
  return stableHash(`${args.career.seasonId}:${args.event.id}:${args.event.drawDate}:${args.career.seed}:${args.salt}`);
}

function uniquePlayerIds(ids: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const id of ids) {
    if (!playerMap[id] || seen.has(id)) {
      continue;
    }

    seen.add(id);
    unique.push(id);
  }

  return unique;
}

function rankedCandidateIds(career: CareerState) {
  const ranked = [...career.rankings]
    .sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId))
    .map((entry) => entry.playerId);
  const roster = seededPlayers.map((entry) => entry.player.id);

  return uniquePlayerIds([...ranked, ...roster]);
}

function shuffled<T>(items: T[], rng: SeededRng) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(0, index);
    const current = copy[index]!;
    copy[index] = copy[swapIndex]!;
    copy[swapIndex] = current;
  }

  return copy;
}

export function deterministicUniverseEntrants(args: {
  career: CareerState;
  event: CareerEventDefinition;
  includeManagedEntry?: boolean;
}) {
  const rng = new SeededRng(universeSeed({ ...args, salt: "entrants" }));
  const managedPlayerId = args.career.program.managedPlayerId;
  const enteredManagedPlayer = args.includeManagedEntry ?? args.career.enteredEventIds.includes(args.event.id);
  const candidateIds = rankedCandidateIds(args.career).filter(
    (playerId) => enteredManagedPlayer || playerId !== managedPlayerId
  );
  const field: string[] = enteredManagedPlayer ? [managedPlayerId] : [];
  const remaining = candidateIds.filter((playerId) => playerId !== managedPlayerId);
  const candidateWindow = remaining.slice(0, Math.max(args.event.drawSize, args.event.drawSize * 2));
  const fallbackWindow = remaining.slice(Math.max(args.event.drawSize, args.event.drawSize * 2));

  for (const playerId of [...shuffled(candidateWindow, rng), ...fallbackWindow]) {
    if (field.length >= args.event.drawSize) {
      break;
    }

    if (!field.includes(playerId)) {
      field.push(playerId);
    }
  }

  return field
    .slice(0, args.event.drawSize)
    .sort((left, right) => {
      const leftRank = args.career.rankings.find((entry) => entry.playerId === left)?.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = args.career.rankings.find((entry) => entry.playerId === right)?.rank ?? Number.MAX_SAFE_INTEGER;

      return leftRank - rightRank || left.localeCompare(right);
    });
}

function bracketOrder(entrants: string[]) {
  const seededMap = Object.fromEntries(entrants.map((playerId, index) => [index + 1, playerId]));

  return bracketOpeningOrder
    .map((seed) => seededMap[seed])
    .filter((playerId): playerId is string => Boolean(playerId));
}

function universeRecordId(args: {
  seasonId: string;
  eventId: string;
  round: RoundName;
  slot: number;
}) {
  return `${args.seasonId}:${args.eventId}:${args.round}:${args.slot}`;
}

function chooseUniverseTactic(player: Player, rng: SeededRng): MatchTactic {
  const { technical, mental, physical } = player.ratings;

  if (technical.smash > 84 && mental.aggression > 78) {
    return tacticLibrary.aggressiveSmash;
  }

  if (technical.netPlay > 83 || technical.serveReturn > 84) {
    return rng.chance(0.65) ? tacticLibrary.balancedControl : tacticLibrary.spreadCourt;
  }

  if (physical.stamina > 84 || technical.clearLob > 83) {
    return rng.chance(0.55) ? tacticLibrary.spreadCourt : tacticLibrary.defensiveWall;
  }

  return rng.chance(0.5) ? tacticLibrary.balancedControl : tacticLibrary.defensiveWall;
}

function simulateUniverseMatch(args: {
  career: CareerState;
  event: CareerEventDefinition;
  round: RoundName;
  slot: number;
  playerAId: string;
  playerBId: string;
  rng: SeededRng;
  source: CareerMatchRecordSource;
}): UniverseMatchFact {
  const playerA = playerMap[args.playerAId];
  const playerB = playerMap[args.playerBId];
  const result = simulateMatchByFidelity(
    {
      seed: args.rng.nextInt(1, 2_147_483_000),
      playerA,
      playerB,
      tacticA: chooseUniverseTactic(playerA, args.rng),
      tacticB: chooseUniverseTactic(playerB, args.rng)
    },
    "quick"
  );
  const winnerId = result.winner === "A" ? args.playerAId : args.playerBId;

  return {
    recordId: universeRecordId({
      seasonId: args.career.seasonId,
      eventId: args.event.id,
      round: args.round,
      slot: args.slot
    }),
    slotId: `${args.round}-${args.slot}`,
    round: args.round,
    date: scheduledDateForRound(args.event, args.round),
    playerAId: args.playerAId,
    playerBId: args.playerBId,
    winnerId,
    scoreline: result.scoreline,
    source: args.source
  };
}

function pointsForPlacement(event: CareerEventDefinition, resultRound: CareerUniverseTournamentPlacement["resultRound"]) {
  return event.rankingPoints[resultRound] ?? event.rankingPoints.R16 ?? 0;
}

function placementsFromMatches(event: CareerEventDefinition, matches: UniverseMatchFact[]) {
  const placements = new Map<string, CareerUniverseTournamentPlacement["resultRound"]>();

  for (const match of matches) {
    const loserId = match.playerAId === match.winnerId ? match.playerBId : match.playerAId;
    placements.set(loserId, match.round);

    if (match.round === "F") {
      placements.set(match.winnerId, "champion");
    }
  }

  return [...placements.entries()].map(([playerId, resultRound]) => ({
    playerId,
    resultRound,
    pointsAwarded: pointsForPlacement(event, resultRound)
  }));
}

function simulateCompletedUniverseBracket(args: {
  career: CareerState;
  event: CareerEventDefinition;
  entrants: string[];
  source: CareerMatchRecordSource;
}): UniverseBracket {
  const rng = new SeededRng(universeSeed({ career: args.career, event: args.event, salt: "bracket" }));
  const matches: UniverseMatchFact[] = [];
  let roundEntrants = bracketOrder(args.entrants);

  for (const round of universeRounds) {
    const winners: string[] = [];

    for (let index = 0; index < roundEntrants.length; index += 2) {
      const playerAId = roundEntrants[index];
      const playerBId = roundEntrants[index + 1];

      if (!playerAId || !playerBId) {
        continue;
      }

      const match = simulateUniverseMatch({
        career: args.career,
        event: args.event,
        round,
        slot: index / 2 + 1,
        playerAId,
        playerBId,
        rng,
        source: args.source
      });
      matches.push(match);
      winners.push(match.winnerId);
    }

    roundEntrants = winners;
  }

  const finalMatch = matches.find((match) => match.round === "F") ?? null;
  const championId = finalMatch?.winnerId ?? null;
  const runnerUpId = finalMatch
    ? finalMatch.playerAId === finalMatch.winnerId
      ? finalMatch.playerBId
      : finalMatch.playerAId
    : null;

  return {
    entrants: args.entrants,
    matches,
    championId,
    runnerUpId,
    placements: placementsFromMatches(args.event, matches)
  };
}

function sourceForActiveTournament(tournament: TournamentState): UniverseEventRecordSource {
  return tournament.eliminated ? "post_elimination" : "live_progression";
}

function matchRecordSourceFromTournamentMatch(match: ReturnType<typeof completedTournamentMatches>[number]): CareerMatchRecordSource {
  if (match.managed) {
    return "played";
  }

  return match.simulationFidelity === "quick" ? "quick_sim" : "archive_import";
}

function bracketFromTournament(args: {
  career: CareerState;
  event: CareerEventDefinition;
  tournament: TournamentState;
}): UniverseBracket {
  const matches = completedTournamentMatches(args.tournament).map((match): UniverseMatchFact => ({
    recordId: universeRecordId({
      seasonId: args.career.seasonId,
      eventId: args.event.id,
      round: match.round,
      slot: Number(match.id.split("-").at(-1) ?? 1)
    }),
    slotId: match.id,
    round: match.round,
    date: scheduledDateForRound(args.event, match.round),
    playerAId: match.sideAId,
    playerBId: match.sideBId,
    winnerId: match.winnerId,
    scoreline: match.scoreline,
    source: matchRecordSourceFromTournamentMatch(match)
  }));
  const finalMatch = matches.find((match) => match.round === "F") ?? null;
  const tournamentPlacementMap = tournamentPlacements(args.tournament);
  const placementSource = tournamentPlacementMap.size > 0
    ? [...tournamentPlacementMap.entries()].map(([playerId, resultRound]) => ({
        playerId,
        resultRound: resultRound as CareerUniverseTournamentPlacement["resultRound"],
        pointsAwarded: pointsForPlacement(args.event, resultRound as CareerUniverseTournamentPlacement["resultRound"])
      }))
    : placementsFromMatches(args.event, matches);
  const entrants = uniquePlayerIds(
    args.tournament.rounds[0]?.matches.flatMap((match) => [match.sideAId, match.sideBId]) ?? []
  );

  return {
    entrants,
    matches,
    championId: args.tournament.championId ?? finalMatch?.winnerId ?? null,
    runnerUpId: finalMatch
      ? finalMatch.playerAId === finalMatch.winnerId
        ? finalMatch.playerBId
        : finalMatch.playerAId
      : null,
    placements: placementSource
  };
}

function recordSignature(record: CareerMatchRecord) {
  return `${record.eventId}:${record.round}:${record.playerAId}:${record.playerBId}:${record.winnerId}:${record.scoreline}`;
}

function ensureUniverseMatchRecords(args: {
  career: CareerState;
  event: CareerEventDefinition;
  matches: UniverseMatchFact[];
}) {
  const records = [...args.career.matchHistory];
  const idsBySignature = new Map(records.map((record) => [recordSignature(record), record.id]));
  const existingIds = new Set(records.map((record) => record.id));
  const matchIds: string[] = [];

  for (const match of args.matches) {
    const signature = `${args.event.id}:${match.round}:${match.playerAId}:${match.playerBId}:${match.winnerId}:${match.scoreline}`;
    const existingSignatureId = idsBySignature.get(signature);

    if (existingSignatureId) {
      matchIds.push(existingSignatureId);
      continue;
    }

    if (existingIds.has(match.recordId)) {
      matchIds.push(match.recordId);
      continue;
    }

    const record: CareerMatchRecord = {
      id: match.recordId,
      seasonId: args.career.seasonId,
      eventId: args.event.id,
      eventName: args.event.name,
      date: match.date,
      round: match.round,
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      winnerId: match.winnerId,
      scoreline: match.scoreline,
      source: match.source
    };
    records.push(record);
    existingIds.add(record.id);
    idsBySignature.set(recordSignature(record), record.id);
    matchIds.push(record.id);
  }

  return {
    career: {
      ...args.career,
      matchHistory: records
    },
    matchIds
  };
}

function managedPlayerResult(args: {
  career: CareerState;
  event: CareerEventDefinition;
  placements: CareerUniverseTournamentPlacement[];
  entrants?: string[];
}): UniverseManagedPlayerResult {
  const managedPlayerId = args.career.program.managedPlayerId;

  if (!args.career.enteredEventIds.includes(args.event.id) || args.entrants?.includes(managedPlayerId) === false) {
    return "not_entered";
  }

  return args.placements.find((placement) => placement.playerId === managedPlayerId)?.resultRound ?? null;
}

function upsertUniverseRecord(career: CareerState, record: CareerUniverseTournamentRecord) {
  const index = career.universeEvents.findIndex(
    (entry) => entry.seasonId === record.seasonId && entry.eventId === record.eventId
  );

  if (index === -1) {
    return {
      ...career,
      universeEvents: [...career.universeEvents, record]
    };
  }

  const current = career.universeEvents[index]!;

  if (current.status === "completed" || current.status === "legacy_unavailable") {
    return career;
  }

  return {
    ...career,
    universeEvents: career.universeEvents.map((entry, entryIndex) => (entryIndex === index ? record : entry))
  };
}

function createDrawRecord(args: {
  career: CareerState;
  event: CareerEventDefinition;
  entrants: string[];
  source: UniverseEventRecordSource;
}) {
  return {
    seasonId: args.career.seasonId,
    eventId: args.event.id,
    source: args.source,
    status: "drawn" as const,
    drawDate: args.event.drawDate,
    startDate: args.event.startDate,
    completedAt: null,
    entrants: args.entrants,
    matchIds: [],
    championId: null,
    runnerUpId: null,
    placements: [],
    managedPlayerResult: args.entrants.includes(args.career.program.managedPlayerId) ? null : "not_entered" as const
  } satisfies CareerUniverseTournamentRecord;
}

function createCompletedRecord(args: {
  career: CareerState;
  event: CareerEventDefinition;
  bracket: UniverseBracket;
  matchIds: string[];
  completedAt: string;
  source: UniverseEventRecordSource;
}) {
  return {
    seasonId: args.career.seasonId,
    eventId: args.event.id,
    source: args.source,
    status: "completed" as const,
    drawDate: args.event.drawDate,
    startDate: args.event.startDate,
    completedAt: args.completedAt,
    entrants: args.bracket.entrants,
    matchIds: args.matchIds,
    championId: args.bracket.championId,
    runnerUpId: args.bracket.runnerUpId,
    placements: args.bracket.placements,
    managedPlayerResult: managedPlayerResult({
      career: args.career,
      event: args.event,
      placements: args.bracket.placements,
      entrants: args.bracket.entrants
    })
  } satisfies CareerUniverseTournamentRecord;
}

function settleUniverseRankingPoints(args: {
  career: CareerState;
  event: CareerEventDefinition;
  placements: CareerUniverseTournamentPlacement[];
  completedAt: string;
}) {
  return {
    ...args.career,
    rankings: args.placements.reduce(
      (rankings, placement) =>
        awardRankingPoints({
          rankings,
          playerId: placement.playerId,
          eventId: args.event.id,
          round: placement.resultRound,
          points: placement.pointsAwarded,
          date: args.completedAt,
          seasonId: args.career.seasonId,
          tier: args.event.tier
        }),
      args.career.rankings
    )
  };
}

function appendUniverseAchievements(args: {
  career: CareerState;
  event: CareerEventDefinition;
  championId: string | null;
  runnerUpId: string | null;
  completedAt: string;
}) {
  const candidates = [
    args.championId
      ? {
          playerId: args.championId,
          eventId: args.event.id,
          eventName: args.event.name,
          date: args.completedAt,
          result: "champion" as const
        }
      : null,
    args.runnerUpId
      ? {
          playerId: args.runnerUpId,
          eventId: args.event.id,
          eventName: args.event.name,
          date: args.completedAt,
          result: "runner_up" as const
        }
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const additions = candidates.filter(
    (candidate) =>
      !args.career.playerAchievements.some(
        (achievement) =>
          achievement.playerId === candidate.playerId &&
          achievement.eventId === candidate.eventId &&
          achievement.result === candidate.result
      )
  );

  if (additions.length === 0) {
    return args.career;
  }

  return {
    ...args.career,
    playerAchievements: [...args.career.playerAchievements, ...additions]
  };
}

function markCompletedEvent(career: CareerState, eventId: string) {
  return career.completedEventIds.includes(eventId)
    ? career
    : {
        ...career,
        completedEventIds: [...career.completedEventIds, eventId]
      };
}

function completeUniverseEvent(args: {
  career: CareerState;
  event: CareerEventDefinition;
  bracket: UniverseBracket;
  completedAt: string;
  source: UniverseEventRecordSource;
}) {
  const withMatchRecords = ensureUniverseMatchRecords({
    career: args.career,
    event: args.event,
    matches: args.bracket.matches
  });
  const withRankings = settleUniverseRankingPoints({
    career: withMatchRecords.career,
    event: args.event,
    placements: args.bracket.placements,
    completedAt: args.completedAt
  });
  const withAchievements = appendUniverseAchievements({
    career: withRankings,
    event: args.event,
    championId: args.bracket.championId,
    runnerUpId: args.bracket.runnerUpId,
    completedAt: args.completedAt
  });
  const record = createCompletedRecord({
    career: withAchievements,
    event: args.event,
    bracket: args.bracket,
    matchIds: withMatchRecords.matchIds,
    completedAt: args.completedAt,
    source: args.source
  });

  return syncManagedAthleteFromRankings(markCompletedEvent(upsertUniverseRecord(withAchievements, record), args.event.id));
}

function existingUniverseRecord(career: CareerState, event: CareerEventDefinition) {
  return career.universeEvents.find(
    (record) => record.seasonId === career.seasonId && record.eventId === event.id
  );
}

export function simulateUniverseThroughDate(args: {
  career: CareerState;
  activeTournament: TournamentState | null;
  targetDate: string;
}): {
  career: CareerState;
  activeTournament: TournamentState | null;
  eventsSimulated: string[];
} {
  let career = args.career;
  const eventsSimulated: string[] = [];

  for (const event of [...career.events].sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id))) {
    if (args.targetDate < event.drawDate) {
      continue;
    }

    const existing = existingUniverseRecord(career, event);

    if (existing?.status === "completed" || existing?.status === "legacy_unavailable") {
      continue;
    }

    const activeTournament = args.activeTournament?.id === event.id ? args.activeTournament : null;

    if (activeTournament?.championId) {
      const bracket = bracketFromTournament({ career, event, tournament: activeTournament });
      career = completeUniverseEvent({
        career,
        event,
        bracket,
        completedAt: args.targetDate,
        source: sourceForActiveTournament(activeTournament)
      });
      eventsSimulated.push(event.id);
      continue;
    }

    if (activeTournament) {
      const entrants = uniquePlayerIds(activeTournament.rounds[0]?.matches.flatMap((match) => [match.sideAId, match.sideBId]) ?? []);
      const drawRecord = createDrawRecord({
        career,
        event,
        entrants,
        source: "live_progression"
      });
      career = upsertUniverseRecord(career, {
        ...drawRecord,
        status: args.targetDate >= event.startDate ? "in_progress" : "drawn"
      });
      eventsSimulated.push(event.id);
      continue;
    }

    if (args.targetDate > eventEndDate(event)) {
      const enteredWithoutLiveTournament = career.enteredEventIds.includes(event.id);
      const hasPlayedManagedRecord = career.matchHistory.some(
        (record) =>
          record.eventId === event.id &&
          (record.playerAId === career.program.managedPlayerId || record.playerBId === career.program.managedPlayerId)
      );
      const entrants = deterministicUniverseEntrants({
        career,
        event,
        includeManagedEntry: enteredWithoutLiveTournament && hasPlayedManagedRecord
      });
      const bracket = simulateCompletedUniverseBracket({
        career,
        event,
        entrants,
        source: career.enteredEventIds.includes(event.id) ? "backfill_sim" : "universe_sim"
      });
      career = completeUniverseEvent({
        career,
        event,
        bracket,
        completedAt: args.targetDate,
        source: career.enteredEventIds.includes(event.id) ? "backfill_sim" : "unentered_sim"
      });
      eventsSimulated.push(event.id);
      continue;
    }

    const entrants = deterministicUniverseEntrants({ career, event });
    const drawRecord = createDrawRecord({
      career,
      event,
      entrants,
      source: career.enteredEventIds.includes(event.id) ? "live_progression" : "unentered_sim"
    });
    career = upsertUniverseRecord(career, drawRecord);
    eventsSimulated.push(event.id);
  }

  return {
    career,
    activeTournament: args.activeTournament,
    eventsSimulated
  };
}

function placementFromMatchRecords(event: CareerEventDefinition, records: CareerMatchRecord[]) {
  const placements = new Map<string, CareerUniverseTournamentPlacement["resultRound"]>();

  for (const record of records) {
    const loserId = record.playerAId === record.winnerId ? record.playerBId : record.playerAId;
    placements.set(loserId, record.round);

    if (record.round === "F") {
      placements.set(record.winnerId, "champion");
    }
  }

  return [...placements.entries()].map(([playerId, resultRound]) => ({
    playerId,
    resultRound,
    pointsAwarded: pointsForPlacement(event, resultRound)
  }));
}

function archiveRecordFromMatchHistory(args: {
  career: CareerState;
  event: CareerEventDefinition;
  records: CareerMatchRecord[];
  completedAt: string;
}): CareerUniverseTournamentRecord | null {
  if (args.records.length < completeMatchCount) {
    return null;
  }

  const finalRecord = args.records.find((record) => record.round === "F");

  if (!finalRecord) {
    return null;
  }

  const placements = placementFromMatchRecords(args.event, args.records);
  const runnerUpId = finalRecord.playerAId === finalRecord.winnerId ? finalRecord.playerBId : finalRecord.playerAId;

  return {
    seasonId: args.career.seasonId,
    eventId: args.event.id,
    source: "archive_import",
    status: "completed",
    drawDate: args.event.drawDate,
    startDate: args.event.startDate,
    completedAt: args.completedAt,
    entrants: uniquePlayerIds(args.records.flatMap((record) => [record.playerAId, record.playerBId])),
    matchIds: args.records.map((record) => record.id),
    championId: finalRecord.winnerId,
    runnerUpId,
    placements,
    managedPlayerResult: managedPlayerResult({ career: args.career, event: args.event, placements })
  };
}

export function hydrateLegacyUniverseEventRecords(career: CareerState): CareerState {
  const existingKeys = new Set(career.universeEvents.map((record) => `${record.seasonId}:${record.eventId}`));
  const additions: CareerUniverseTournamentRecord[] = [];

  for (const historyRecord of career.eventHistory) {
    const event = getCareerEvent(career.events, historyRecord.eventId);

    if (!event || existingKeys.has(`${career.seasonId}:${event.id}`)) {
      continue;
    }

    const records = career.matchHistory.filter((record) => record.eventId === event.id);
    const archiveRecord = archiveRecordFromMatchHistory({
      career,
      event,
      records,
      completedAt: historyRecord.completedAt
    });

    additions.push(
      archiveRecord ?? {
        seasonId: career.seasonId,
        eventId: event.id,
        source: "legacy_unavailable",
        status: "legacy_unavailable",
        drawDate: event.drawDate,
        startDate: event.startDate,
        completedAt: historyRecord.completedAt,
        entrants: [],
        matchIds: historyRecord.matchIds,
        championId: null,
        runnerUpId: null,
        placements: [],
        managedPlayerResult: historyRecord.entered
          ? (roundKeyForPlacement(historyRecord.resultRound ?? "R16", historyRecord.status === "champion") as UniverseManagedPlayerResult)
          : "not_entered"
      }
    );
  }

  if (additions.length === 0) {
    return career;
  }

  return {
    ...career,
    universeEvents: [...career.universeEvents, ...additions]
  };
}

export function universeTournamentRecordForEvent(args: {
  career: CareerState;
  eventId: string;
}) {
  return args.career.universeEvents.find(
    (record) => record.seasonId === args.career.seasonId && record.eventId === args.eventId
  ) ?? null;
}
