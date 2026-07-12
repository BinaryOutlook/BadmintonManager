import { describe, expect, it } from "vitest";
import { playerMap, seededPlayers } from "../../game/content/players";
import { careerPlayerForMatch } from "../../game/career/development";
import { getCareerEvent } from "../../game/career/events";
import { createInitialCareerState, managedAthlete } from "../../game/career/state";
import { simulateMatch } from "../../game/core/match";
import { useTournamentStore } from "../../game/store/store";
import { createTournament } from "../../game/tournament/tournament";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function installWindowStorage() {
  if (typeof window === "undefined") {
    return;
  }

  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true
  });
}

function resolveTrainingBeforePreparedCareerMatch(seed: number) {
  installWindowStorage();
  const managedPlayerId = seededPlayers[0].player.id;
  const planningCareer = createInitialCareerState(managedPlayerId, seed);

  useTournamentStore.setState({
    phase: "overview",
    selectedPlayerId: managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed,
    tournament: null,
    liveMatch: null,
    career: planningCareer,
    saveRecovery: null,
    activeSavePresent: true,
    corruptSavePresent: false
  });
  useTournamentStore.getState().scheduleCareerTraining("rear-court-power");
  useTournamentStore.getState().advanceCareerDay();

  const evolvedCareer = useTournamentStore.getState().career!;
  const event = getCareerEvent(evolvedCareer.events, "metro-open-300")!;
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier
  };

  useTournamentStore.setState({
    career: {
      ...evolvedCareer,
      date: event.startDate,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      stage: "pre_match"
    },
    tournament,
    liveMatch: null,
    phase: "overview"
  });

  return { managedPlayerId };
}

function managedMatchPlayer() {
  const state = useTournamentStore.getState();
  const liveMatch = state.liveMatch;

  if (!liveMatch) {
    throw new Error("Expected a live managed match.");
  }

  return liveMatch.managedSide === "A" ? liveMatch.session.input.playerA : liveMatch.session.input.playerB;
}

describe("career development match bridge", () => {
  it("projects only direct trained attributes without mutating canonical content", () => {
    const basePlayer = seededPlayers[0].player;
    const athlete = {
      ...managedAthlete(createInitialCareerState(basePlayer.id, 8800)),
      development: {
        smash: 120,
        stamina: 92.4,
        composure: -4,
        recovery: 99
      }
    };

    const projected = careerPlayerForMatch(basePlayer, athlete);

    expect(projected.ratings.technical.smash).toBe(100);
    expect(projected.ratings.physical.stamina).toBe(92.4);
    expect(projected.ratings.mental.composure).toBe(1);
    expect(projected.ratings.technical.netPlay).toBe(basePlayer.ratings.technical.netPlay);
    expect(projected.ratings.physical.agilityBalance).toBe(basePlayer.ratings.physical.agilityBalance);
    expect(playerMap[basePlayer.id].ratings.technical.smash).toBe(90);
    expect(() => careerPlayerForMatch(seededPlayers[1].player, athlete)).toThrow(/does not match/);
  });

  it("feeds completed career training into the managed match engine input", () => {
    const { managedPlayerId } = resolveTrainingBeforePreparedCareerMatch(8801);
    const basePlayer = playerMap[managedPlayerId];

    const trainedAthlete = managedAthlete(useTournamentStore.getState().career!);
    useTournamentStore.getState().startManagedMatch();

    const matchPlayer = managedMatchPlayer();

    expect(trainedAthlete.development.smash).toBeGreaterThan(basePlayer.ratings.technical.smash);
    expect(matchPlayer.ratings.technical.smash).toBe(trainedAthlete.development.smash);
    expect(matchPlayer.ratings.physical.stamina).toBe(trainedAthlete.development.stamina);
    expect(matchPlayer.ratings.mental.composure).toBe(trainedAthlete.development.composure);
    expect(playerMap[managedPlayerId].ratings.technical.smash).toBe(90);
  });

  it("keeps quick-tournament matches on canonical player ratings", () => {
    installWindowStorage();
    const managedPlayerId = seededPlayers[0].player.id;
    const tournament = createTournament(seededPlayers, managedPlayerId, 8802);

    useTournamentStore.setState({
      phase: "overview",
      selectedPlayerId: managedPlayerId,
      plannedTacticKey: "balancedControl",
      seed: 8802,
      tournament,
      liveMatch: null,
      career: null,
      saveRecovery: null,
      activeSavePresent: true,
      corruptSavePresent: false
    });
    useTournamentStore.getState().startManagedMatch();

    expect(managedMatchPlayer()).toEqual(playerMap[managedPlayerId]);
  });

  it("recreates the same evolved input and outcome after a save replacement", () => {
    resolveTrainingBeforePreparedCareerMatch(8803);
    const saved = useTournamentStore.getState().exportActiveSave();

    expect(saved).not.toBeNull();

    useTournamentStore.getState().startManagedMatch();
    const firstSession = useTournamentStore.getState().liveMatch!.session;
    const firstResult = simulateMatch(firstSession.input);

    useTournamentStore.getState().replaceActiveSave(saved!);
    useTournamentStore.getState().startManagedMatch();
    const restoredSession = useTournamentStore.getState().liveMatch!.session;
    const restoredResult = simulateMatch(restoredSession.input);

    expect(restoredSession.input).toEqual(firstSession.input);
    expect(restoredResult).toEqual(firstResult);
  });
});
