import { create } from "zustand";
import { seededPlayers, playerMap } from "../content/players";
import { tacticLibrary } from "../content/tactics";
import { advanceCareerCalendar } from "../career/calendar";
import { chargeEventEntry } from "../career/economy";
import { getCareerEvent } from "../career/events";
import { buildPreMatchBrief, settleCareerMatch } from "../career/hubs";
import {
  applyDirective as queueDirective,
  applyTeamTalk,
  createMatchSession,
  getMatchResultFromSession,
  simulateNextPoint as runNextPoint
} from "../core/match";
import type { LiveDirective, LiveMatchSession, MatchTactic, Side, TeamTalk } from "../core/models";
import type { CareerState } from "../career/models";
import { createInitialCareerState } from "../career/state";
import { applyTrainingPlan, getTrainingPlan } from "../career/training";
import {
  advanceTournament,
  createManagedMatchInput,
  createTournament,
  type ManagedMatchContext,
  type TournamentState
} from "../tournament/tournament";
import { migratePersistedSave, persistedSavePayloadSchema, type PersistedSave } from "./save";

const STORAGE_KEY = "badminton-manager-save";

export type TacticKey = keyof typeof tacticLibrary;
export type AppPhase = "setup" | "overview" | "match" | "complete";

interface LiveManagedMatch {
  matchId: string;
  roundName: ManagedMatchContext["roundName"];
  managedSide: Side;
  opponentName: string;
  opponentTacticLabel: string;
  session: LiveMatchSession;
}

export interface TournamentStoreState {
  phase: AppPhase;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  seed: number;
  tournament: TournamentState | null;
  liveMatch: LiveManagedMatch | null;
  career: CareerState | null;
  startCareer: () => void;
  applyCareerTraining: (planId: string) => void;
  enterCareerEvent: (eventId: string) => void;
  advanceCareerDay: () => void;
  continueCareerAfterPostMatch: () => void;
  selectPlayer: (playerId: string) => void;
  chooseTactic: (tacticKey: TacticKey) => void;
  startTournament: () => void;
  startManagedMatch: () => void;
  applyDirective: (directive: LiveDirective) => void;
  applyTalk: (teamTalk: TeamTalk) => void;
  simulateNextPoint: () => void;
  advanceAfterMatch: () => void;
  reset: () => void;
}

function randomSeed() {
  return Math.floor(Math.random() * 2_147_483_000);
}

function inferPhase(tournament: TournamentState | null, liveMatch: LiveManagedMatch | null): AppPhase {
  if (liveMatch) {
    return "match";
  }

  if (!tournament) {
    return "setup";
  }

  if (tournament.championId || tournament.eliminated) {
    return "complete";
  }

  return "overview";
}

function persist(state: TournamentStoreState) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedSave = {
    version: 3,
    selectedPlayerId: state.selectedPlayerId,
    plannedTacticKey: state.plannedTacticKey,
    seed: state.seed,
    tournament: state.tournament,
    liveMatch: state.liveMatch,
    career: state.career
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPersisted(): Pick<
  TournamentStoreState,
  "selectedPlayerId" | "plannedTacticKey" | "seed" | "tournament" | "liveMatch" | "phase"
  | "career"
> {
  const defaultState = {
    selectedPlayerId: seededPlayers[0].player.id,
    plannedTacticKey: "balancedControl" as TacticKey,
    seed: randomSeed(),
    tournament: null,
    liveMatch: null,
    career: null,
    phase: "setup" as AppPhase
  };

  if (typeof window === "undefined") {
    return defaultState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return defaultState;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return defaultState;
  }

  const parsed = persistedSavePayloadSchema.safeParse(json);

  if (!parsed.success) {
    window.localStorage.removeItem(STORAGE_KEY);
    return defaultState;
  }

  const migrated = migratePersistedSave(parsed.data);

  return {
    selectedPlayerId: migrated.selectedPlayerId,
    plannedTacticKey: migrated.plannedTacticKey,
    seed: migrated.seed,
    tournament: migrated.tournament,
    liveMatch: migrated.liveMatch,
    career: migrated.career,
    phase: inferPhase(migrated.tournament, migrated.liveMatch)
  };
}

function currentManagedTactic(state: TournamentStoreState): MatchTactic {
  return tacticLibrary[state.plannedTacticKey];
}

function tournamentForCareerEvent(career: CareerState, seed: number) {
  const event = career.activeEventId ? getCareerEvent(career.events, career.activeEventId) : undefined;
  const tournament = createTournament(seededPlayers, career.program.managedPlayerId, seed);

  if (!event) {
    return tournament;
  }

  return {
    ...tournament,
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };
}

function addCareerTournamentIfReady(state: TournamentStoreState, career: CareerState) {
  if (career.stage !== "pre_match" || state.tournament) {
    return { career, tournament: state.tournament, phase: state.phase };
  }

  const seed = randomSeed();
  const tournament = tournamentForCareerEvent(career, seed);
  const prepared = createManagedMatchInput({
    tournament,
    playerMap,
    tacticA: currentManagedTactic(state)
  });
  const opponentId = prepared
    ? prepared.context.playerAId === career.program.managedPlayerId
      ? prepared.context.playerBId
      : prepared.context.playerAId
    : "";
  const brief = opponentId ? buildPreMatchBrief({ state: career, opponentId }) : null;

  return {
    career: {
      ...career,
      lastPreMatchBrief: brief
    },
    tournament,
    phase: "overview" as AppPhase
  };
}

const initialState = loadPersisted();

export const useTournamentStore = create<TournamentStoreState>((set, get) => ({
  ...initialState,
  startCareer: () => {
    set((state) => {
      const seed = randomSeed();
      const career = createInitialCareerState(state.selectedPlayerId, seed);
      const next = {
        ...state,
        seed,
        career,
        tournament: null,
        liveMatch: null,
        phase: "setup" as AppPhase
      };
      persist(next);
      return next;
    });
  },
  applyCareerTraining: (planId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const plan = getTrainingPlan(planId);
      const athlete = state.career.athletes.find(
        (entry) => entry.playerId === state.career?.program.managedPlayerId
      );

      if (!plan || !athlete || state.career.economy.cash < plan.cost) {
        return state;
      }

      const result = applyTrainingPlan({
        athlete,
        economy: state.career.economy,
        plan,
        date: state.career.date
      });
      const career = {
        ...state.career,
        selectedTrainingPlanId: plan.id,
        athletes: state.career.athletes.map((entry) =>
          entry.playerId === athlete.playerId ? result.athlete : entry
        ),
        economy: result.economy,
        notes: [`${plan.label} completed`, ...state.career.notes].slice(0, 6)
      };
      const next = {
        ...state,
        career
      };
      persist(next);
      return next;
    });
  },
  enterCareerEvent: (eventId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const event = getCareerEvent(state.career.events, eventId);

      if (!event || state.career.completedEventIds.includes(eventId)) {
        return state;
      }

      const economy = chargeEventEntry({
        economy: state.career.economy,
        date: state.career.date,
        label: event.name,
        travelCost: event.travelCost,
        entryFee: event.entryFee
      });
      const enteredEventIds = state.career.enteredEventIds.includes(eventId)
        ? state.career.enteredEventIds
        : [...state.career.enteredEventIds, eventId];
      const career = {
        ...state.career,
        activeEventId: eventId,
        enteredEventIds,
        economy,
        stage: state.career.date >= event.startDate ? "pre_match" as const : "event_entered" as const,
        notes: [`Entered ${event.name}`, ...state.career.notes].slice(0, 6)
      };
      const withTournament = addCareerTournamentIfReady(state, career);
      const next = {
        ...state,
        career: withTournament.career,
        tournament: withTournament.tournament,
        liveMatch: null,
        phase: withTournament.phase
      };
      persist(next);
      return next;
    });
  },
  advanceCareerDay: () => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const career = advanceCareerCalendar(state.career);
      const withTournament = addCareerTournamentIfReady(state, career);
      const next = {
        ...state,
        career: withTournament.career,
        tournament: withTournament.tournament,
        phase: withTournament.phase
      };
      persist(next);
      return next;
    });
  },
  continueCareerAfterPostMatch: () => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        tournament: null,
        liveMatch: null,
        phase: "setup" as AppPhase,
        career: {
          ...state.career,
          stage: "event_complete" as const,
          activeEventId: null
        }
      };
      persist(next);
      return next;
    });
  },
  selectPlayer: (playerId) => {
    set((state) => {
      const next = { ...state, selectedPlayerId: playerId };
      persist(next);
      return next;
    });
  },
  chooseTactic: (plannedTacticKey) => {
    set((state) => {
      const next = { ...state, plannedTacticKey };
      persist(next);
      return next;
    });
  },
  startTournament: () => {
    set((state) => {
      const seed = randomSeed();
      const tournament = createTournament(seededPlayers, state.selectedPlayerId, seed);
      const next = {
        ...state,
        seed,
        tournament,
        liveMatch: null,
        career: null,
        phase: "overview" as AppPhase
      };
      persist(next);
      return next;
    });
  },
  startManagedMatch: () => {
    set((state) => {
      if (!state.tournament) {
        return state;
      }

      const prepared = createManagedMatchInput({
        tournament: state.tournament,
        playerMap,
        tacticA: currentManagedTactic(state)
      });

      if (!prepared) {
        return state;
      }

      const managedSide = prepared.context.playerAId === state.tournament.managedPlayerId ? "A" : "B";
      const session = createMatchSession(prepared.input);
      const liveMatch: LiveManagedMatch = {
        matchId: prepared.context.matchId,
        roundName: prepared.context.roundName,
        managedSide,
        opponentName:
          managedSide === "A" ? prepared.input.playerB.name : prepared.input.playerA.name,
        opponentTacticLabel:
          managedSide === "A" ? prepared.input.tacticB.label : prepared.input.tacticA.label,
        session
      };
      const tournament = {
        ...state.tournament,
        rngState: prepared.rngState
      };
      const opponentId =
        managedSide === "A" ? prepared.context.playerBId : prepared.context.playerAId;
      const career =
        state.career && state.career.stage === "pre_match"
          ? {
              ...state.career,
              lastPreMatchBrief: buildPreMatchBrief({ state: state.career, opponentId })
            }
          : state.career;
      const next = {
        ...state,
        tournament,
        liveMatch,
        career,
        phase: "match" as AppPhase
      };
      persist(next);
      return next;
    });
  },
  applyTalk: (teamTalk) => {
    set((state) => {
      if (!state.liveMatch) {
        return state;
      }

      const session = applyTeamTalk(state.liveMatch.session, state.liveMatch.managedSide, teamTalk);
      const next = {
        ...state,
        liveMatch: {
          ...state.liveMatch,
          session
        }
      };
      persist(next);
      return next;
    });
  },
  applyDirective: (directive) => {
    set((state) => {
      if (!state.liveMatch) {
        return state;
      }

      const session = queueDirective(state.liveMatch.session, state.liveMatch.managedSide, directive);
      const next = {
        ...state,
        liveMatch: {
          ...state.liveMatch,
          session
        }
      };
      persist(next);
      return next;
    });
  },
  simulateNextPoint: () => {
    set((state) => {
      if (!state.liveMatch) {
        return state;
      }

      const session = runNextPoint(state.liveMatch.session);
      const next = {
        ...state,
        liveMatch: {
          ...state.liveMatch,
          session
        }
      };
      persist(next);
      return next;
    });
  },
  advanceAfterMatch: () => {
    set((state) => {
      if (!state.liveMatch || !state.liveMatch.session.complete || !state.tournament) {
        return state;
      }

      const managedResult = getMatchResultFromSession(state.liveMatch.session);
      const tournament = advanceTournament({
        tournament: state.tournament,
        seededEntries: seededPlayers,
        managedMatchId: state.liveMatch.matchId,
        managedResult
      });
      const managedRunMatch = tournament.managedResults[tournament.managedResults.length - 1];
      const opponentId =
        state.liveMatch.managedSide === "A"
          ? state.liveMatch.session.input.playerB.id
          : state.liveMatch.session.input.playerA.id;
      const career =
        state.career && managedRunMatch
          ? settleCareerMatch({
              state: state.career,
              matchId: state.liveMatch.matchId,
              opponentId,
              managedSide: state.liveMatch.managedSide,
              managedRunMatch,
              result: managedResult
            })
          : state.career;

      const next = {
        ...state,
        tournament,
        liveMatch: null,
        career,
        phase: inferPhase(tournament, null)
      };
      persist(next);
      return next;
    });
  },
  reset: () => {
    set((state) => {
      const next = {
        ...state,
        seed: randomSeed(),
        tournament: null,
        liveMatch: null,
        phase: "setup" as AppPhase
      };
      persist(next);
      return next;
    });
  }
}));
