import { create } from "zustand";
import { seededPlayers, playerMap } from "../content/players";
import { tacticLibrary } from "../content/tactics";
import { advanceCareerCalendar } from "../career/calendar";
import { canAffordEventEntry, chargeEventEntry } from "../career/economy";
import {
  advanceFacilityBuilds,
  applyFacilitiesToTraining,
  applyFacilityDailyRecovery,
  applyTravelPressureForEvent,
  chargeFacilityUpkeep,
  effectiveEventEntryCosts,
  resolveMediaObjectives,
  upgradeFacility
} from "../career/facilitiesMedia";
import {
  applyMatchPsychology,
  applyStaffToTraining,
  commissionScoutReport,
  developYouthProspect,
  enterRosterAthleteLowerEvent,
  enterYouthLowerEvent,
  expireScoutReports,
  hireStaffMember,
  makeRecruitmentOffer,
  resolveDueScoutReports,
  resolvePromises,
  setManagedAthletePromise,
  trainRosterAthlete,
  withdrawPromise
} from "../career/ecosystem";
import { eventEligibilityFor, getCareerEvent } from "../career/events";
import { canCompeteWithInjury } from "../career/health";
import { buildPreMatchBrief, settleCareerMatch } from "../career/hubs";
import {
  applyDirective as queueDirective,
  applyTeamTalk,
  createMatchSession,
  getMatchResultFromSession,
  simulateNextPoint as runNextPoint
} from "../core/match";
import type { LiveDirective, LiveMatchSession, MatchTactic, Side, TeamTalk } from "../core/models";
import type { AdvancedTacticPlan, CareerState, FacilityType, PlayerPromise } from "../career/models";
import { createInitialCareerState } from "../career/state";
import { applyTrainingPlan, getTrainingPlan } from "../career/training";
import { advanceRivalCircuit } from "../career/rivals";
import {
  activeAdvancedTacticPlan,
  applyAssistantAdvice,
  overrideAssistantAdvice,
  refreshAssistantAdvice,
  tacticPlanToMatchTactic,
  updateAdvancedTacticPlan
} from "../career/tactics";
import {
  advanceTournament,
  createManagedMatchInput,
  createTournament,
  type ManagedMatchContext,
  type TournamentState
} from "../tournament/tournament";
import { migratePersistedSave, persistedSavePayloadSchema, type PersistedSave } from "./save";

export const STORAGE_KEY = "badminton-manager-save";
export const CORRUPT_STORAGE_KEY = "badminton-manager-save-corrupt";

export type TacticKey = keyof typeof tacticLibrary;
export type AppPhase = "setup" | "overview" | "match" | "complete";

export interface SaveRecoveryNotice {
  reason: "malformed_json" | "invalid_schema";
  backupKey: string;
  message: string;
}

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
  saveRecovery: SaveRecoveryNotice | null;
  startCareer: () => void;
  applyCareerTraining: (planId: string) => void;
  enterCareerEvent: (eventId: string) => void;
  advanceCareerDay: () => void;
  continueCareerAfterPostMatch: () => void;
  commissionScoutReport: (subjectId: string, subjectType: "candidate" | "prospect" | "opponent") => void;
  makeRecruitmentOffer: (candidateId: string) => void;
  trainRosterAthlete: (athleteId: string) => void;
  enterRosterAthleteLowerEvent: (athleteId: string) => void;
  developYouthProspect: (prospectId: string) => void;
  enterYouthLowerEvent: (prospectId: string) => void;
  hireStaffMember: (staffId: string) => void;
  setManagedAthletePromise: (targetType: PlayerPromise["targetType"]) => void;
  withdrawPromise: (promiseId: string) => void;
  advanceRivalCircuit: () => void;
  upgradeFacility: (facilityType: FacilityType) => void;
  resolveMediaObjectives: () => void;
  updateAdvancedTacticPlan: (
    patch: Partial<
      Pick<
        AdvancedTacticPlan,
        "name" | "tempo" | "rearCourtPressure" | "netPriority" | "riskTolerance" | "rallyLengthIntent" | "modules"
      >
    >
  ) => void;
  refreshAssistantAdvice: () => void;
  applyAssistantAdvice: (adviceId: string) => void;
  overrideAssistantAdvice: (adviceId: string, reason: string) => void;
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

function createDefaultPersistedState(seed = randomSeed()) {
  return {
    selectedPlayerId: seededPlayers[0].player.id,
    plannedTacticKey: "balancedControl" as TacticKey,
    seed,
    tournament: null,
    liveMatch: null,
    career: null,
    saveRecovery: null,
    phase: "setup" as AppPhase
  };
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
    version: 8,
    selectedPlayerId: state.selectedPlayerId,
    plannedTacticKey: state.plannedTacticKey,
    seed: state.seed,
    tournament: state.tournament,
    liveMatch: state.liveMatch,
    career: state.career
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

type PersistedRuntimeState = Pick<
  TournamentStoreState,
  "selectedPlayerId" | "plannedTacticKey" | "seed" | "tournament" | "liveMatch" | "phase"
  | "career" | "saveRecovery"
>;

type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isStorageAdapter(storage: unknown): storage is StorageAdapter {
  return Boolean(
    storage &&
      typeof (storage as StorageAdapter).getItem === "function" &&
      typeof (storage as StorageAdapter).setItem === "function" &&
      typeof (storage as StorageAdapter).removeItem === "function"
  );
}

function quarantineCorruptSave(storage: StorageAdapter, raw: string) {
  try {
    storage.setItem(CORRUPT_STORAGE_KEY, raw);
  } catch {
    // If backup storage is unavailable, still clear the active slot so boot remains safe.
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage teardown failures; recovery state still tells the user what happened.
  }
}

export function loadPersistedFromStorage(
  storage: StorageAdapter,
  seedFactory: () => number = randomSeed
): PersistedRuntimeState {
  const defaultState = createDefaultPersistedState(seedFactory());
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return defaultState;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    quarantineCorruptSave(storage, raw);

    return {
      ...defaultState,
      saveRecovery: {
        reason: "malformed_json",
        backupKey: CORRUPT_STORAGE_KEY,
        message: "The local save file could not be read as JSON, so it was quarantined before a fresh safe slot was opened."
      }
    };
  }

  const parsed = persistedSavePayloadSchema.safeParse(json);

  if (!parsed.success) {
    quarantineCorruptSave(storage, raw);

    return {
      ...defaultState,
      saveRecovery: {
        reason: "invalid_schema",
        backupKey: CORRUPT_STORAGE_KEY,
        message: "The local save file did not match the supported save schema, so it was quarantined before a fresh safe slot was opened."
      }
    };
  }

  const migrated = migratePersistedSave(parsed.data);

  return {
    selectedPlayerId: migrated.selectedPlayerId,
    plannedTacticKey: migrated.plannedTacticKey,
    seed: migrated.seed,
    tournament: migrated.tournament,
    liveMatch: migrated.liveMatch,
    career: migrated.career,
    saveRecovery: null,
    phase: inferPhase(migrated.tournament, migrated.liveMatch)
  };
}

function loadPersisted(): PersistedRuntimeState {
  if (typeof window === "undefined" || !isStorageAdapter(window.localStorage)) {
    return createDefaultPersistedState();
  }

  return loadPersistedFromStorage(window.localStorage);
}

function currentManagedTactic(state: TournamentStoreState): MatchTactic {
  if (state.career) {
    return tacticPlanToMatchTactic(activeAdvancedTacticPlan(state.career));
  }

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
        saveRecovery: null,
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

      if (result.blockedReason) {
        const next = {
          ...state,
          career: {
            ...state.career,
            notes: [`Training blocked: ${result.blockedReason}`, ...state.career.notes].slice(0, 6)
          }
        };
        persist(next);
        return next;
      }

      const athleteWithStaff = applyFacilitiesToTraining(
        applyStaffToTraining(result.athlete, state.career.ecosystem),
        state.career.facilities
      );
      const career = refreshAssistantAdvice({
        ...state.career,
        selectedTrainingPlanId: plan.id,
        athletes: state.career.athletes.map((entry) =>
          entry.playerId === athlete.playerId ? athleteWithStaff : entry
        ),
        economy: result.economy,
        notes: [`${plan.label} completed with staff modifiers`, ...state.career.notes].slice(0, 6)
      });
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

      const tierGate = eventEligibilityFor(state.career, event);

      if (!tierGate.allowed) {
        const next = {
          ...state,
          career: {
            ...state.career,
            notes: [`Event entry blocked: ${tierGate.reason}`, ...state.career.notes].slice(0, 6)
          }
        };
        persist(next);
        return next;
      }

      const athlete = state.career.athletes.find(
        (entry) => entry.playerId === state.career?.program.managedPlayerId
      );
      const medicalGate = athlete ? canCompeteWithInjury(athlete) : { allowed: true, reason: "Available" };

      if (!medicalGate.allowed) {
        const next = {
          ...state,
          career: {
            ...state.career,
            notes: [`Event entry blocked: ${medicalGate.reason}`, ...state.career.notes].slice(0, 6)
          }
        };
        persist(next);
        return next;
      }

      const entryCosts = effectiveEventEntryCosts(event, state.career.facilities);

      if (!canAffordEventEntry({
        economy: state.career.economy,
        travelCost: entryCosts.travelCost,
        entryFee: entryCosts.entryFee
      })) {
        const career = {
          ...state.career,
          notes: [`Insufficient funds for ${event.name}`, ...state.career.notes].slice(0, 6)
        };
        const next = {
          ...state,
          career
        };
        persist(next);
        return next;
      }

      const economy = chargeEventEntry({
        economy: state.career.economy,
        date: state.career.date,
        label: event.name,
        travelCost: entryCosts.travelCost,
        entryFee: entryCosts.entryFee
      });
      const enteredEventIds = state.career.enteredEventIds.includes(eventId)
        ? state.career.enteredEventIds
        : [...state.career.enteredEventIds, eventId];
      const career = applyTravelPressureForEvent({
        ...state.career,
        activeEventId: eventId,
        enteredEventIds,
        economy,
        stage: state.career.date >= event.startDate ? "pre_match" as const : "event_entered" as const,
        notes: [
          `Entered ${event.name}${entryCosts.savedTravelCost > 0 ? ` with ${entryCosts.savedTravelCost} travel savings` : ""}`,
          ...state.career.notes
        ].slice(0, 6)
      }, event);
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

      const career = refreshAssistantAdvice(
        resolveMediaObjectives(
          chargeFacilityUpkeep(
            applyFacilityDailyRecovery(
              advanceFacilityBuilds(
                advanceRivalCircuit(resolvePromises(expireScoutReports(resolveDueScoutReports(advanceCareerCalendar(state.career)))))
              )
            )
          )
        )
      );
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
  commissionScoutReport: (subjectId, subjectType) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: commissionScoutReport(state.career, subjectId, subjectType)
      };
      persist(next);
      return next;
    });
  },
  makeRecruitmentOffer: (candidateId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: makeRecruitmentOffer(state.career, candidateId)
      };
      persist(next);
      return next;
    });
  },
  trainRosterAthlete: (athleteId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: resolvePromises(trainRosterAthlete(state.career, athleteId))
      };
      persist(next);
      return next;
    });
  },
  enterRosterAthleteLowerEvent: (athleteId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: resolvePromises(enterRosterAthleteLowerEvent(state.career, athleteId))
      };
      persist(next);
      return next;
    });
  },
  developYouthProspect: (prospectId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: developYouthProspect(state.career, prospectId)
      };
      persist(next);
      return next;
    });
  },
  enterYouthLowerEvent: (prospectId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: resolvePromises(enterYouthLowerEvent(state.career, prospectId))
      };
      persist(next);
      return next;
    });
  },
  hireStaffMember: (staffId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: hireStaffMember(state.career, staffId)
      };
      persist(next);
      return next;
    });
  },
  setManagedAthletePromise: (targetType) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: setManagedAthletePromise(state.career, targetType)
      };
      persist(next);
      return next;
    });
  },
  withdrawPromise: (promiseId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: withdrawPromise(state.career, promiseId)
      };
      persist(next);
      return next;
    });
  },
  advanceRivalCircuit: () => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: refreshAssistantAdvice(advanceRivalCircuit(state.career))
      };
      persist(next);
      return next;
    });
  },
  upgradeFacility: (facilityType) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: refreshAssistantAdvice(upgradeFacility(state.career, facilityType))
      };
      persist(next);
      return next;
    });
  },
  resolveMediaObjectives: () => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: refreshAssistantAdvice(resolveMediaObjectives(state.career))
      };
      persist(next);
      return next;
    });
  },
  updateAdvancedTacticPlan: (patch) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: updateAdvancedTacticPlan(state.career, patch)
      };
      persist(next);
      return next;
    });
  },
  refreshAssistantAdvice: () => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: refreshAssistantAdvice(state.career)
      };
      persist(next);
      return next;
    });
  },
  applyAssistantAdvice: (adviceId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: applyAssistantAdvice(state.career, adviceId)
      };
      persist(next);
      return next;
    });
  },
  overrideAssistantAdvice: (adviceId, reason) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: overrideAssistantAdvice(state.career, adviceId, reason)
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
        saveRecovery: null,
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

      if (state.career) {
        const athlete = state.career.athletes.find(
          (entry) => entry.playerId === state.career?.program.managedPlayerId
        );
        const medicalGate = athlete ? canCompeteWithInjury(athlete) : { allowed: true, reason: "Available" };

        if (!medicalGate.allowed) {
          const next = {
            ...state,
            career: {
              ...state.career,
              notes: [`Match entry blocked: ${medicalGate.reason}`, ...state.career.notes].slice(0, 6)
            }
          };
          persist(next);
          return next;
        }
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
      const careerWithPsychology = career
        ? refreshAssistantAdvice(resolveMediaObjectives(resolvePromises(applyMatchPsychology(career, managedResult.winner === state.liveMatch.managedSide))))
        : career;

      const next = {
        ...state,
        tournament,
        liveMatch: null,
        career: careerWithPsychology,
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
