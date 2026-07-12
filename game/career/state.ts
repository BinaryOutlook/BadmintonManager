import { seededPlayers } from "../content/players";
import { careerEventCatalog, generateCareerSeasonEvents } from "./events";
import { createInitialEconomy } from "./economy";
import { createDevelopmentBaseline } from "./development";
import { createInitialEcosystem } from "./ecosystem";
import { createHealthyInjuryState, defaultRankingSettings, type AthleteCareerState, type CareerState } from "./models";
import { buildRankingSnapshot, createBootstrapRankingResults, rankingFor, registerRankingPlayerPool } from "./rankings";
import { refreshAthleteReadiness } from "./health";
import { createInitialRivalCircuit } from "./rivals";
import { createInitialMatchPlanning, refreshAssistantAdvice } from "./tactics";
import { createInitialFacilities, createInitialMediaState } from "./facilitiesMedia";

export function createCareerAthlete(playerId: string, rank: number, points: number): AthleteCareerState {
  const entry = seededPlayers.find((seeded) => seeded.player.id === playerId) ?? seededPlayers[0];
  const player = entry.player;
  const athlete = {
    playerId,
    development: {
      smash: player.ratings.technical.smash,
      stamina: player.ratings.physical.stamina,
      composure: player.ratings.mental.composure,
      recovery: Math.round(
        (player.ratings.physical.stamina + player.ratings.physical.agilityBalance + player.ratings.mental.focus) / 3
      )
    },
    fatigue: 22,
    injuryRisk: 0.06,
    readiness: 0,
    recoveryStatus: "ready" as const,
    injury: createHealthyInjuryState(),
    rankingPoints: points,
    currentRank: rank
  };

  return refreshAthleteReadiness(athlete);
}

export function syncManagedAthleteFromRankings(state: CareerState): CareerState {
  const managedPlayerId = state.program.managedPlayerId;
  const ranking = rankingFor(state.rankings, managedPlayerId);

  if (!ranking) {
    return state;
  }

  return {
    ...state,
    athletes: state.athletes.map((athlete) =>
      athlete.playerId === managedPlayerId
        ? { ...athlete, rankingPoints: ranking.points, currentRank: ranking.rank }
        : athlete
    )
  };
}

export function createInitialCareerState(selectedPlayerId: string, seed: number): CareerState {
  registerRankingPlayerPool(seededPlayers);
  const rankingSettings = defaultRankingSettings;
  const date = "2026-06-01";
  const seasonId = "2026";
  const rankingResults = createBootstrapRankingResults({
    players: seededPlayers,
    careerStartDate: date,
    seed,
    settings: rankingSettings,
    eventTemplates: careerEventCatalog
  });
  const rankings = buildRankingSnapshot({
    players: seededPlayers,
    results: rankingResults,
    asOfDate: date,
    settings: rankingSettings
  });
  const ranking = rankingFor(rankings, selectedPlayerId) ?? rankings[0];

  const athlete = createCareerAthlete(selectedPlayerId, ranking.rank, ranking.points);
  const career: CareerState = {
    version: 11,
    seed,
    date,
    seasonId,
    stage: "planning",
    program: {
      id: "program-command",
      name: "Command Performance Unit",
      managedPlayerId: selectedPlayerId
    },
    athletes: [athlete],
    events: generateCareerSeasonEvents(seasonId),
    seasonStartedAt: date,
    seasonReviews: [],
    enteredEventIds: [],
    completedEventIds: [],
    eventHistory: [],
    universeEvents: [],
    matchHistory: [],
    playerAchievements: [],
    activeEventId: null,
    rankingResults,
    rankings,
    rankingSettings,
    preparationSchedule: [],
    developmentHistory: [
      createDevelopmentBaseline({
        athlete,
        date,
        seasonId,
        source: "career_start",
        note: "Career-start development baseline."
      })
    ],
    economy: createInitialEconomy(),
    selectedTrainingPlanId: null,
    lastPreMatchBrief: null,
    lastMatchReport: null,
    ecosystem: createInitialEcosystem(
      selectedPlayerId,
      date,
      seededPlayers.find((entry) => entry.player.id === selectedPlayerId)?.player.name
    ),
    rivals: createInitialRivalCircuit(date, rankings),
    matchPlanning: createInitialMatchPlanning(date),
    facilities: createInitialFacilities(date),
    media: createInitialMediaState(date),
    notes: ["Career save initialized with a deterministic prior-year ranking ledger"]
  };

  return refreshAssistantAdvice(career);
}

export function managedAthlete(state: CareerState) {
  return state.athletes.find((athlete) => athlete.playerId === state.program.managedPlayerId) ?? state.athletes[0];
}
