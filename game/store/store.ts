import { create } from "zustand";
import { seededPlayers, playerMap } from "../content/players";
import { tacticLibrary } from "../content/tactics";
import {
  applyDirective as queueDirective,
  applyTeamTalk,
  createMatchSession,
  getMatchResultFromSession,
  simulateNextPoint as runNextPoint
} from "../core/match";
import type { LiveDirective, LiveMatchSession, MatchTactic, Side, TeamTalk } from "../core/models";
import {
  advanceTournament,
  createManagedMatchInput,
  createTournament,
  type ManagedMatchContext,
  type TournamentState
} from "../tournament/tournament";
import { persistedSaveSchema, type PersistedSave } from "./save";

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

interface TournamentStoreState {
  phase: AppPhase;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  seed: number;
  tournament: TournamentState | null;
  liveMatch: LiveManagedMatch | null;
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
    version: 2,
    selectedPlayerId: state.selectedPlayerId,
    plannedTacticKey: state.plannedTacticKey,
    seed: state.seed,
    tournament: state.tournament,
    liveMatch: state.liveMatch
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPersisted(): Pick<
  TournamentStoreState,
  "selectedPlayerId" | "plannedTacticKey" | "seed" | "tournament" | "liveMatch" | "phase"
> {
  const defaultState = {
    selectedPlayerId: seededPlayers[0].player.id,
    plannedTacticKey: "balancedControl" as TacticKey,
    seed: randomSeed(),
    tournament: null,
    liveMatch: null,
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

  const parsed = persistedSaveSchema.safeParse(json);

  if (!parsed.success) {
    window.localStorage.removeItem(STORAGE_KEY);
    return defaultState;
  }

  return {
    selectedPlayerId: parsed.data.selectedPlayerId,
    plannedTacticKey: parsed.data.plannedTacticKey,
    seed: parsed.data.seed,
    tournament: parsed.data.tournament,
    liveMatch: parsed.data.liveMatch,
    phase: inferPhase(parsed.data.tournament, parsed.data.liveMatch)
  };
}

function currentManagedTactic(state: TournamentStoreState): MatchTactic {
  return tacticLibrary[state.plannedTacticKey];
}

const initialState = loadPersisted();

export const useTournamentStore = create<TournamentStoreState>((set, get) => ({
  ...initialState,
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
      const next = {
        ...state,
        tournament,
        liveMatch,
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

      const tournament = advanceTournament({
        tournament: state.tournament,
        seededEntries: seededPlayers,
        managedMatchId: state.liveMatch.matchId,
        managedResult: getMatchResultFromSession(state.liveMatch.session)
      });

      const next = {
        ...state,
        tournament,
        liveMatch: null,
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
