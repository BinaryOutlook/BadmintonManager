import { seededPlayers } from "../content/players";
import { careerEventCatalog } from "./events";
import { createInitialEconomy } from "./economy";
import { createInitialEcosystem } from "./ecosystem";
import type { AthleteCareerState, CareerState } from "./models";
import { createInitialRankings, rankingFor } from "./rankings";
import { refreshAthleteReadiness } from "./health";

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
  const rankings = createInitialRankings(seededPlayers, selectedPlayerId);
  const ranking = rankingFor(rankings, selectedPlayerId) ?? rankings[0];

  return {
    version: 2,
    seed,
    date: "2026-06-01",
    seasonId: "2026",
    stage: "planning",
    program: {
      id: "program-command",
      name: "Command Performance Unit",
      managedPlayerId: selectedPlayerId
    },
    athletes: [createCareerAthlete(selectedPlayerId, ranking.rank, ranking.points)],
    events: careerEventCatalog,
    enteredEventIds: [],
    completedEventIds: [],
    activeEventId: null,
    rankings,
    economy: createInitialEconomy(),
    selectedTrainingPlanId: null,
    lastPreMatchBrief: null,
    lastMatchReport: null,
    ecosystem: createInitialEcosystem(selectedPlayerId),
    notes: ["Career save initialized"]
  };
}

export function managedAthlete(state: CareerState) {
  return state.athletes.find((athlete) => athlete.playerId === state.program.managedPlayerId) ?? state.athletes[0];
}
