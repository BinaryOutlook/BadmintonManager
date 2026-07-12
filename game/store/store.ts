import { create } from "zustand";
import { seededPlayers, playerMap } from "../content/players";
import { tacticLibrary } from "../content/tactics";
import { resolveCareerDay } from "../career/dayResolution";
import { getCareerDailyAction } from "../career/dailyAction";
import { canAffordEventEntry, chargeEventEntry } from "../career/economy";
import { careerPlayerForMatch } from "../career/development";
import {
  applyTravelPressureForEvent,
  effectiveEventEntryCosts,
  resolveMediaObjectives,
  upgradeFacility
} from "../career/facilitiesMedia";
import {
  applyMatchPsychology,
  commissionScoutReport,
  developYouthProspect,
  enterRosterAthleteLowerEvent,
  enterYouthLowerEvent,
  hireStaffMember,
  makeRecruitmentOffer,
  resolvePromises,
  setManagedAthletePromise,
  withdrawPromise
} from "../career/ecosystem";
import { eventEligibilityFor, eventEndDate, getCareerEvent } from "../career/events";
import { canCompeteWithInjury, canTrainWithInjury } from "../career/health";
import { buildPreMatchBrief, settleCareerMatch } from "../career/hubs";
import {
  activateDueEnteredEvent,
  canAdvanceCareerDay as canAdvanceCareerDayBySchedule,
  currentManagedMatchSchedule,
  managedMatchScheduleForEvent
} from "../career/matchSchedule";
import {
  applyDirective as queueDirective,
  applyTeamTalk,
  createMatchSession,
  getMatchResultFromSession,
  simulateNextPoint as runNextPoint,
  simulateUntilSetComplete
} from "../core/match";
import type { LiveDirective, LiveMatchSession, MatchTactic, Side, TeamTalk } from "../core/models";
import type { AdvancedTacticPlan, CareerState, FacilityType, PlayerPromise } from "../career/models";
import { createInitialCareerState } from "../career/state";
import { scheduleRosterPreparation } from "../career/program";
import { clearScheduledPreparationBlock, schedulePreparationBlock } from "../career/preparation";
import { createEventFieldSnapshot, simulateUniverseThroughDate } from "../career/universe";
import { getTrainingPlan } from "../career/training";
import { advanceRivalCircuit } from "../career/rivals";
import { startNextSeason } from "../career/lifecycle";
import { activeWorldSeededPlayers, careerWorldPlayerMap } from "../career/world";
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
  createTournamentFromPlayerIds,
  getManagedMatchContext,
  getNextManagedOpponentId,
  isManagedPlayerStillInEvent,
  isTournamentComplete,
  type ManagedMatchContext,
  type TournamentState
} from "../tournament/tournament";
import {
  CURRENT_SAVE_VERSION,
  migratePersistedSave,
  persistedSavePayloadSchema,
  type PersistedSave
} from "./save";
import {
  SaveRepository,
  type SaveRepositoryStorage,
  type SaveSlotEnvelope
} from "./saveRepository";

export const STORAGE_KEY = "badminton-manager-save";
export const CORRUPT_STORAGE_KEY = "badminton-manager-save-corrupt";

export type TacticKey = keyof typeof tacticLibrary;
export type AppPhase = "setup" | "overview" | "match" | "complete";

export interface SaveRecoveryNotice {
  reason: "malformed_json" | "invalid_schema";
  backupKey: string;
  disposition: "quarantined" | "source_preserved";
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
  activeSavePresent: boolean;
  corruptSavePresent: boolean;
  saveSlots: SaveSlotEnvelope[];
  activeSaveSlotId: string | null;
  quarantinedSlotCount: number;
  quarantinedSlotCounts: Record<string, number>;
  saveBackupCounts: Record<string, number>;
  startCareer: (managedPlayerId?: string) => void;
  scheduleCareerTraining: (planId: string | null) => void;
  enterCareerEvent: (eventId: string) => void;
  advanceCareerDay: () => void;
  startNextCareerSeason: () => void;
  openScheduledCareerMatch: (eventId?: string) => void;
  continueCareerAfterPostMatch: () => void;
  commissionScoutReport: (subjectId: string, subjectType: "candidate" | "prospect" | "opponent") => void;
  makeRecruitmentOffer: (candidateId: string) => void;
  scheduleRosterAthletePreparation: (athleteId: string) => void;
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
  startTournament: (managedPlayerId?: string) => void;
  startManagedMatch: () => void;
  applyDirective: (directive: LiveDirective) => void;
  applyTalk: (teamTalk: TeamTalk) => void;
  simulateNextPoint: () => void;
  finishSet: () => void;
  advanceAfterMatch: () => void;
  reset: () => void;
  exportActiveSave: () => PersistedSave | null;
  replaceActiveSave: (save: PersistedSave) => void;
  switchSaveSlot: (slotId: string) => void;
  renameSaveSlot: (slotId: string, name: string) => void;
  archiveSaveSlot: (slotId: string) => void;
  duplicateSaveSlot: (slotId: string, name?: string) => void;
  deleteSaveSlot: (slotId: string) => void;
  restoreLatestSaveBackup: (slotId: string) => void;
  createEmptySaveSlot: (name?: string) => void;
  importSaveAsSlot: (save: PersistedSave, name?: string) => void;
  deleteActiveSave: () => void;
  deleteCorruptSave: () => void;
}

function randomSeed() {
  return Math.floor(Math.random() * 2_147_483_000);
}

function createDefaultPersistedState(
  seed = randomSeed(),
  storageFlags: Pick<TournamentStoreState, "activeSavePresent" | "corruptSavePresent"> = {
    activeSavePresent: false,
    corruptSavePresent: false
  }
) {
  return {
    selectedPlayerId: seededPlayers[0].player.id,
    plannedTacticKey: "balancedControl" as TacticKey,
    seed,
    tournament: null,
    liveMatch: null,
    career: null,
    saveRecovery: null,
    phase: "setup" as AppPhase,
    activeSavePresent: storageFlags.activeSavePresent,
    corruptSavePresent: storageFlags.corruptSavePresent,
    saveSlots: [] as SaveSlotEnvelope[],
    activeSaveSlotId: null,
    quarantinedSlotCount: 0,
    quarantinedSlotCounts: {} as Record<string, number>,
    saveBackupCounts: {} as Record<string, number>
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

function createPersistedSavePayload(
  state: Pick<
    TournamentStoreState,
    "selectedPlayerId" | "plannedTacticKey" | "seed" | "tournament" | "liveMatch" | "career"
  >
): PersistedSave {
  return {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: state.selectedPlayerId,
    plannedTacticKey: state.plannedTacticKey,
    seed: state.seed,
    tournament: state.tournament,
    liveMatch: state.liveMatch,
    career: state.career
  };
}

function writeLegacyActiveSaveToStorage(save: PersistedSave) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

type PersistedRuntimeState = Pick<
  TournamentStoreState,
  "selectedPlayerId" | "plannedTacticKey" | "seed" | "tournament" | "liveMatch" | "phase"
  | "career" | "saveRecovery" | "activeSavePresent" | "corruptSavePresent" | "saveSlots"
  | "activeSaveSlotId" | "quarantinedSlotCount" | "quarantinedSlotCounts" | "saveBackupCounts"
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

function isSaveRepositoryStorage(storage: unknown): storage is SaveRepositoryStorage {
  return Boolean(
    isStorageAdapter(storage) &&
      typeof (storage as SaveRepositoryStorage).length === "number" &&
      typeof (storage as SaveRepositoryStorage).key === "function"
  );
}

function repositoryForBrowser() {
  if (typeof window === "undefined" || !isSaveRepositoryStorage(window.localStorage)) {
    return null;
  }

  return new SaveRepository({ storage: window.localStorage });
}

function repositoryMetadata(repository: SaveRepository) {
  const saveSlots = repository.listSlots();
  const quarantines = repository.listQuarantinedSlots();
  const quarantinedSlotCounts = quarantines.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.record.slotId] = (counts[entry.record.slotId] ?? 0) + 1;
    return counts;
  }, {});
  const saveBackupCounts = saveSlots.reduce<Record<string, number>>((counts, slot) => {
    counts[slot.slotId] = repository.listBackups(slot.slotId).length;
    return counts;
  }, {});

  return {
    saveSlots,
    activeSaveSlotId: repository.getActiveSlotId(),
    quarantinedSlotCount: quarantines.length,
    quarantinedSlotCounts,
    saveBackupCounts
  };
}

function nextSaveName(repository: SaveRepository) {
  return `Career ${repository.listSlots().filter((slot) => slot.archivedAt === null).length + 1}`;
}

function persist<T extends TournamentStoreState>(state: T) {
  const save = createPersistedSavePayload(state);
  const repository = repositoryForBrowser();

  if (!repository) {
    writeLegacyActiveSaveToStorage(save);
    Object.assign(state, { activeSavePresent: true });
    return state;
  }

  const capturedSlotId = state.activeSaveSlotId;
  const activeSlot = capturedSlotId ? repository.readSlot(capturedSlotId) : null;
  const slot = activeSlot && activeSlot.archivedAt === null
    ? repository.updateSlot(capturedSlotId!, save)
    : repository.createSlot({ name: nextSaveName(repository), save });

  Object.assign(state, repositoryMetadata(repository), {
    activeSavePresent: true,
    activeSaveSlotId: slot.slotId
  });
  return state;
}

function quarantineCorruptSave(storage: StorageAdapter, raw: string) {
  let backupVerified = false;

  try {
    storage.setItem(CORRUPT_STORAGE_KEY, raw);
    backupVerified = storage.getItem(CORRUPT_STORAGE_KEY) === raw;
  } catch {
    backupVerified = false;
  }

  if (!backupVerified) {
    return { backupVerified: false, sourceRemoved: false };
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // The verified quarantine copy remains available even when source cleanup fails.
  }

  return {
    backupVerified: true,
    sourceRemoved: storage.getItem(STORAGE_KEY) === null
  };
}

function recoveryStateFor(args: {
  defaultState: PersistedRuntimeState;
  reason: SaveRecoveryNotice["reason"];
  quarantine: ReturnType<typeof quarantineCorruptSave>;
}) {
  const quarantined = args.quarantine.backupVerified;
  const sourcePreserved = !args.quarantine.sourceRemoved;
  const problem = args.reason === "malformed_json"
    ? "could not be read as JSON"
    : "did not match the supported save schema";
  const message = quarantined
    ? sourcePreserved
      ? `The local save ${problem}. A verified quarantine copy was created, but the original storage entry could not be removed.`
      : `The local save ${problem}, so a verified quarantine copy was created before a fresh safe slot was opened.`
    : `The local save ${problem}. Backup storage was unavailable, so the original entry was preserved in place and was not deleted.`;

  return {
    ...args.defaultState,
    saveRecovery: {
      reason: args.reason,
      backupKey: quarantined ? CORRUPT_STORAGE_KEY : STORAGE_KEY,
      disposition: quarantined ? "quarantined" as const : "source_preserved" as const,
      message
    },
    activeSavePresent: sourcePreserved,
    corruptSavePresent: args.defaultState.corruptSavePresent || quarantined
  };
}

export function loadPersistedFromStorage(
  storage: StorageAdapter,
  seedFactory: () => number = randomSeed
): PersistedRuntimeState {
  const defaultState = createDefaultPersistedState(seedFactory(), {
    activeSavePresent: false,
    corruptSavePresent: storage.getItem(CORRUPT_STORAGE_KEY) !== null
  });
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return defaultState;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return recoveryStateFor({
      defaultState,
      reason: "malformed_json",
      quarantine: quarantineCorruptSave(storage, raw)
    });
  }

  const parsed = persistedSavePayloadSchema.safeParse(json);

  if (!parsed.success) {
    return recoveryStateFor({
      defaultState,
      reason: "invalid_schema",
      quarantine: quarantineCorruptSave(storage, raw)
    });
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
    phase: inferPhase(migrated.tournament, migrated.liveMatch),
    activeSavePresent: true,
    corruptSavePresent: defaultState.corruptSavePresent,
    saveSlots: [],
    activeSaveSlotId: null,
    quarantinedSlotCount: 0,
    quarantinedSlotCounts: {},
    saveBackupCounts: {}
  };
}

function runtimeStateFromSave(
  save: PersistedSave,
  corruptSavePresent = false,
  repositoryState: Pick<
    PersistedRuntimeState,
    "saveSlots" | "activeSaveSlotId" | "quarantinedSlotCount" | "quarantinedSlotCounts" | "saveBackupCounts"
  > = {
    saveSlots: [],
    activeSaveSlotId: null,
    quarantinedSlotCount: 0,
    quarantinedSlotCounts: {},
    saveBackupCounts: {}
  }
): PersistedRuntimeState {
  return {
    selectedPlayerId: save.selectedPlayerId,
    plannedTacticKey: save.plannedTacticKey,
    seed: save.seed,
    tournament: save.tournament,
    liveMatch: save.liveMatch,
    career: save.career,
    saveRecovery: null,
    phase: inferPhase(save.tournament, save.liveMatch),
    activeSavePresent: true,
    corruptSavePresent,
    ...repositoryState
  };
}

export function loadPersistedFromSaveRepository(
  storage: SaveRepositoryStorage,
  seedFactory: () => number = randomSeed
): PersistedRuntimeState {
  const repository = new SaveRepository({ storage });
  const legacyMigration = repository.migrateLegacySave();
  const legacyRecovery = legacyMigration.status === "invalid"
    ? loadPersistedFromStorage(storage, seedFactory)
    : null;

  let activeSlot = repository.getActiveSlot();
  if (activeSlot?.archivedAt) {
    repository.setActiveSlot(null);
    activeSlot = null;
  }
  if (!activeSlot) {
    activeSlot = repository.listSlots({ includeArchived: false })[0] ?? null;
    repository.setActiveSlot(activeSlot?.slotId ?? null);
  }

  const metadata = repositoryMetadata(repository);
  if (activeSlot) {
    const runtime = runtimeStateFromSave(
      activeSlot.save,
      storage.getItem(CORRUPT_STORAGE_KEY) !== null,
      metadata
    );
    return legacyRecovery
      ? {
          ...runtime,
          saveRecovery: legacyRecovery.saveRecovery,
          corruptSavePresent: legacyRecovery.corruptSavePresent
        }
      : runtime;
  }

  if (legacyRecovery) {
    return {
      ...legacyRecovery,
      ...metadata
    };
  }

  return {
    ...createDefaultPersistedState(seedFactory(), {
      activeSavePresent: false,
      corruptSavePresent: storage.getItem(CORRUPT_STORAGE_KEY) !== null
    }),
    ...metadata
  };
}

function loadPersisted(): PersistedRuntimeState {
  if (typeof window === "undefined" || !isStorageAdapter(window.localStorage)) {
    return createDefaultPersistedState();
  }

  if (isSaveRepositoryStorage(window.localStorage)) {
    return loadPersistedFromSaveRepository(window.localStorage);
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

  if (!event) {
    return createTournament(activeWorldSeededPlayers(career), career.program.managedPlayerId, seed);
  }

  const fieldSnapshot = createEventFieldSnapshot({
    career,
    event,
    includeManagedEntry: true
  });

  return createTournamentFromPlayerIds({
    seededEntries: activeWorldSeededPlayers(career),
    playerIds: fieldSnapshot.finalPlayerIds,
    managedPlayerId: career.program.managedPlayerId,
    seed,
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  });
}

function buildPreMatchBriefForTournament(career: CareerState, tournament: TournamentState) {
  const context = getManagedMatchContext(tournament);

  if (!context) {
    return career.lastPreMatchBrief;
  }

  const opponentId =
    context.playerAId === career.program.managedPlayerId ? context.playerBId : context.playerAId;

  return buildPreMatchBrief({ state: career, opponentId }) ?? career.lastPreMatchBrief;
}

function addCareerTournamentIfReady(state: TournamentStoreState, career: CareerState) {
  if (career.stage !== "pre_match") {
    return { career, tournament: state.tournament, phase: state.phase };
  }

  if (state.tournament && state.tournament.id === career.activeEventId && !isTournamentComplete(state.tournament)) {
    return {
      career: {
        ...career,
        lastPreMatchBrief: buildPreMatchBriefForTournament(career, state.tournament)
      },
      tournament: state.tournament,
      phase: "overview" as AppPhase
    };
  }

  const seed = randomSeed();
  const tournament = tournamentForCareerEvent(career, seed);

  return {
    career: {
      ...career,
      lastPreMatchBrief: buildPreMatchBriefForTournament(career, tournament)
    },
    tournament,
    phase: "overview" as AppPhase
  };
}

function prependCareerNote(career: CareerState, note: string) {
  return {
    ...career,
    notes: career.notes[0] === note ? career.notes : [note, ...career.notes].slice(0, 6)
  };
}

function simulateCareerUniverseForStore(args: {
  career: CareerState;
  tournament: TournamentState | null;
  targetDate?: string;
}) {
  return simulateUniverseThroughDate({
    career: args.career,
    activeTournament: args.tournament,
    targetDate: args.targetDate ?? args.career.date
  }).career;
}

const initialState = loadPersisted();

export const useTournamentStore = create<TournamentStoreState>((set, get) => ({
  ...initialState,
  startCareer: (managedPlayerId) => {
    set((state) => {
      const seed = randomSeed();
      const lockedPlayerId = managedPlayerId && playerMap[managedPlayerId]
        ? managedPlayerId
        : state.selectedPlayerId;
      const career = createInitialCareerState(lockedPlayerId, seed);
      const next = {
        ...state,
        selectedPlayerId: lockedPlayerId,
        seed,
        career,
        tournament: null,
        liveMatch: null,
        saveRecovery: null,
        phase: "setup" as AppPhase,
        activeSavePresent: true
      };
      persist(next);
      return next;
    });
  },
  scheduleCareerTraining: (planId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      if (planId === null) {
        const next = {
          ...state,
          career: clearScheduledPreparationBlock(state.career)
        };
        persist(next);
        return next;
      }

      const plan = getTrainingPlan(planId);
      const athlete = state.career.athletes.find(
        (entry) => entry.playerId === state.career?.program.managedPlayerId
      );

      const dailyAction = getCareerDailyAction({
        career: state.career,
        tournament: state.tournament,
        phase: state.phase,
        liveMatchActive: Boolean(state.liveMatch)
      });

      if (!plan || !athlete) {
        return state;
      }

      const medicalGate = canTrainWithInjury(athlete, plan.intensity);
      const blockedReason = dailyAction.kind !== "advance_day"
        ? dailyAction.reason
        : state.career.economy.cash < plan.cost
          ? `Insufficient cash for ${plan.label}.`
          : !medicalGate.allowed
            ? medicalGate.reason
            : null;

      if (blockedReason) {
        const next = {
          ...state,
          career: {
            ...state.career,
            notes: [`Preparation scheduling blocked: ${blockedReason}`, ...state.career.notes].slice(0, 6)
          }
        };
        persist(next);
        return next;
      }

      const career = refreshAssistantAdvice({
        ...schedulePreparationBlock({ state: state.career, plan }),
        notes: [`${plan.label} scheduled; resolve it with Advance Day`, ...state.career.notes].slice(0, 6)
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
      const eventDue = state.career.date >= event.startDate && state.career.date <= eventEndDate(event);
      const preservesActiveStage =
        state.career.stage === "pre_match" ||
        state.career.stage === "post_match" ||
        state.career.stage === "between_rounds";
      const career = applyTravelPressureForEvent({
        ...state.career,
        activeEventId: eventDue ? eventId : state.career.activeEventId,
        enteredEventIds,
        economy,
        stage: eventDue ? "pre_match" as const : preservesActiveStage ? state.career.stage : "event_entered" as const,
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

      const guard = canAdvanceCareerDayBySchedule({
        career: state.career,
        tournament: state.tournament,
        liveMatchActive: Boolean(state.liveMatch)
      });

      if (!guard.allowed) {
        const blockedCareer =
          guard.route === "pre_match"
            ? prependCareerNote(
                activateDueEnteredEvent({
                  career: state.career,
                  tournament: state.tournament,
                  eventId: guard.schedule?.event.id
                }),
                guard.reason
              )
            : prependCareerNote(state.career, guard.reason);
        const withTournament =
          guard.route === "pre_match"
            ? addCareerTournamentIfReady(state, blockedCareer)
            : { career: blockedCareer, tournament: state.tournament, phase: "match" as AppPhase };
        const next = {
          ...state,
          career: withTournament.career,
          tournament: withTournament.tournament,
          phase: withTournament.phase
        };
        persist(next);
        return next;
      }

      const career = resolveCareerDay({
        career: state.career,
        tournament: state.tournament
      });
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
  startNextCareerSeason: () => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const career = startNextSeason(state.career);

      if (career === state.career) {
        return state;
      }

      const next = {
        ...state,
        career,
        tournament: null,
        liveMatch: null,
        phase: "setup" as AppPhase
      };
      persist(next);
      return next;
    });
  },
  openScheduledCareerMatch: (eventId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const schedule = eventId
        ? managedMatchScheduleForEvent({
            career: state.career,
            tournament: state.tournament,
            eventId
          })
        : currentManagedMatchSchedule({
            career: state.career,
            tournament: state.tournament
          });

      if (!schedule?.playable) {
        return state;
      }

      const career = activateDueEnteredEvent({
        career: state.career,
        tournament: state.tournament,
        eventId: schedule.event.id
      });
      const withTournament = addCareerTournamentIfReady(state, career);
      const next = {
        ...state,
        career: withTournament.career,
        tournament: withTournament.tournament,
        liveMatch: null,
        phase: "overview" as AppPhase
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

      const activeTournament = state.tournament;
      const stillInEvent =
        activeTournament &&
        isManagedPlayerStillInEvent(activeTournament) &&
        state.career.activeEventId &&
        !state.career.completedEventIds.includes(state.career.activeEventId);

      if (stillInEvent) {
        const opponentId = getNextManagedOpponentId(activeTournament);
        const brief = opponentId
          ? buildPreMatchBrief({ state: state.career, opponentId })
          : state.career.lastPreMatchBrief;
        const schedule = currentManagedMatchSchedule({
          career: state.career,
          tournament: activeTournament
        });
        const nextStage = schedule?.playable ? "pre_match" as const : "between_rounds" as const;
        const note = schedule
          ? `${schedule.event.name} ${schedule.round} scheduled for ${schedule.scheduledDate}`
          : "Next event round scheduled";
        const next = {
          ...state,
          tournament: activeTournament,
          liveMatch: null,
          phase: "overview" as AppPhase,
          career: prependCareerNote({
            ...state.career,
            stage: nextStage,
            lastPreMatchBrief: brief
          }, note)
        };
        persist(next);
        return next;
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
  scheduleRosterAthletePreparation: (athleteId) => {
    set((state) => {
      if (!state.career) {
        return state;
      }

      const next = {
        ...state,
        career: resolvePromises(scheduleRosterPreparation({ state: state.career, athleteId }))
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
      if (state.career) {
        return state;
      }

      const next = { ...state, selectedPlayerId: playerId, activeSavePresent: true };
      persist(next);
      return next;
    });
  },
  chooseTactic: (plannedTacticKey) => {
    set((state) => {
      const next = { ...state, plannedTacticKey, activeSavePresent: true };
      persist(next);
      return next;
    });
  },
  startTournament: (managedPlayerId) => {
    set((state) => {
      const seed = randomSeed();
      const tournamentPlayerId = managedPlayerId && playerMap[managedPlayerId]
        ? managedPlayerId
        : state.selectedPlayerId;
      const tournament = createTournament(seededPlayers, tournamentPlayerId, seed);
      const next = {
        ...state,
        selectedPlayerId: tournamentPlayerId,
        seed,
        tournament,
        liveMatch: null,
        career: null,
        saveRecovery: null,
        phase: "overview" as AppPhase,
        activeSavePresent: true
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

      const managedCareerAthlete = state.career?.athletes.find(
        (entry) => entry.playerId === state.tournament?.managedPlayerId
      );

      if (state.career) {
        const schedule = currentManagedMatchSchedule({
          career: state.career,
          tournament: state.tournament
        });

        if (state.career.stage !== "pre_match" || (schedule && !schedule.playable)) {
          const note = schedule && !schedule.playable
            ? `Match entry blocked: ${schedule.event.name} ${schedule.round} is scheduled for ${schedule.scheduledDate}`
            : "Match entry blocked: open the scheduled pre-match briefing first";
          const next = {
            ...state,
            career: prependCareerNote(state.career, note)
          };
          persist(next);
          return next;
        }

        const medicalGate = managedCareerAthlete
          ? canCompeteWithInjury(managedCareerAthlete)
          : { allowed: true, reason: "Available" };

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

      const careerPlayerMap = state.career ? careerWorldPlayerMap(state.career) : playerMap;
      const baseManagedPlayer = careerPlayerMap[state.tournament.managedPlayerId];
      const matchPlayerMap = managedCareerAthlete && baseManagedPlayer
        ? {
            ...careerPlayerMap,
            [managedCareerAthlete.playerId]: careerPlayerForMatch(baseManagedPlayer, managedCareerAthlete)
          }
        : careerPlayerMap;

      const prepared = createManagedMatchInput({
        tournament: state.tournament,
        playerMap: matchPlayerMap,
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
  finishSet: () => {
    set((state) => {
      if (!state.liveMatch) {
        return state;
      }

      const session = simulateUntilSetComplete(state.liveMatch.session);
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
        seededEntries: state.career ? activeWorldSeededPlayers(state.career) : seededPlayers,
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
              result: managedResult,
              eventComplete: isTournamentComplete(tournament),
              tournament
            })
          : state.career;
      const careerWithPsychology = career
        ? refreshAssistantAdvice(
            simulateCareerUniverseForStore({
              career: resolveMediaObjectives(resolvePromises(applyMatchPsychology(career, managedResult.winner === state.liveMatch.managedSide))),
              tournament
            })
          )
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
        phase: "setup" as AppPhase,
        activeSavePresent: true
      };
      persist(next);
      return next;
    });
  },
  exportActiveSave: () => {
    const state = get();

    if (!state.activeSavePresent) {
      return null;
    }

    return createPersistedSavePayload(state);
  },
  replaceActiveSave: (save) => {
    const repository = repositoryForBrowser();

    if (!repository) {
      writeLegacyActiveSaveToStorage(save);
      set((state) => ({
        ...state,
        ...runtimeStateFromSave(save, state.corruptSavePresent)
      }));
      return;
    }

    set((state) => {
      const capturedSlotId = state.activeSaveSlotId;
      const capturedSlot = capturedSlotId ? repository.readSlot(capturedSlotId) : null;
      const slot = capturedSlot && capturedSlot.archivedAt === null
        ? repository.updateSlot(capturedSlotId!, save)
        : repository.createSlot({ name: nextSaveName(repository), save });

      return {
        ...state,
        ...runtimeStateFromSave(save, state.corruptSavePresent, repositoryMetadata(repository)),
        activeSaveSlotId: slot.slotId
      };
    });
  },
  switchSaveSlot: (slotId) => {
    const repository = repositoryForBrowser();
    if (!repository) {
      return;
    }

    const slot = repository.readSlot(slotId);
    if (!slot || slot.archivedAt !== null) {
      return;
    }

    repository.setActiveSlot(slot.slotId);
    set((state) => ({
      ...state,
      ...runtimeStateFromSave(slot.save, state.corruptSavePresent, repositoryMetadata(repository))
    }));
  },
  renameSaveSlot: (slotId, name) => {
    const repository = repositoryForBrowser();
    if (!repository || name.trim().length === 0) {
      return;
    }

    repository.renameSlot(slotId, name);
    set((state) => ({
      ...state,
      ...repositoryMetadata(repository)
    }));
  },
  archiveSaveSlot: (slotId) => {
    const repository = repositoryForBrowser();
    if (!repository) {
      return;
    }

    const slot = repository.readSlot(slotId);
    if (!slot) {
      return;
    }

    if (slot.archivedAt !== null) {
      repository.setSlotArchived(slotId, false);
      set((state) => ({ ...state, ...repositoryMetadata(repository) }));
      return;
    }

    const archivedActiveSlot = repository.getActiveSlotId() === slotId;
    repository.setSlotArchived(slotId, true);
    if (!archivedActiveSlot) {
      set((state) => ({ ...state, ...repositoryMetadata(repository) }));
      return;
    }

    const fallbackSlot = repository.listSlots({ includeArchived: false })[0] ?? null;
    repository.setActiveSlot(fallbackSlot?.slotId ?? null);
    const metadata = repositoryMetadata(repository);
    if (fallbackSlot) {
      set((state) => ({
        ...state,
        ...runtimeStateFromSave(
          fallbackSlot.save,
          state.corruptSavePresent,
          metadata
        )
      }));
      return;
    }

    set((state) => ({
      ...state,
      ...createDefaultPersistedState(randomSeed(), {
        activeSavePresent: false,
        corruptSavePresent: state.corruptSavePresent
      }),
      ...metadata
    }));
  },
  duplicateSaveSlot: (slotId, name) => {
    const repository = repositoryForBrowser();
    if (!repository) {
      return;
    }

    const duplicate = repository.duplicateSlot(slotId, { name });
    set((state) => ({
      ...state,
      ...runtimeStateFromSave(
        duplicate.save,
        state.corruptSavePresent,
        repositoryMetadata(repository)
      )
    }));
  },
  deleteSaveSlot: (slotId) => {
    const repository = repositoryForBrowser();
    if (!repository || !repository.readSlot(slotId)) {
      return;
    }

    const deletedActiveSlot = repository.getActiveSlotId() === slotId;
    repository.deleteSlot(slotId);
    if (!deletedActiveSlot) {
      set((state) => ({ ...state, ...repositoryMetadata(repository) }));
      return;
    }

    const fallbackSlot = repository.listSlots({ includeArchived: false })[0] ?? null;
    repository.setActiveSlot(fallbackSlot?.slotId ?? null);
    const metadata = repositoryMetadata(repository);
    if (fallbackSlot) {
      set((state) => ({
        ...state,
        ...runtimeStateFromSave(
          fallbackSlot.save,
          state.corruptSavePresent,
          metadata
        )
      }));
      return;
    }

    set((state) => ({
      ...state,
      ...createDefaultPersistedState(randomSeed(), {
        activeSavePresent: false,
        corruptSavePresent: state.corruptSavePresent
      }),
      ...metadata
    }));
  },
  restoreLatestSaveBackup: (slotId) => {
    const repository = repositoryForBrowser();
    if (!repository) {
      return;
    }

    const backup = repository.listBackups(slotId)[0];
    if (!backup) {
      return;
    }

    const restored = repository.updateSlot(slotId, backup.save);
    set((state) => ({
      ...state,
      ...runtimeStateFromSave(
        restored.save,
        state.corruptSavePresent,
        repositoryMetadata(repository)
      )
    }));
  },
  createEmptySaveSlot: (name) => {
    const emptyRuntime = createDefaultPersistedState();
    const save = createPersistedSavePayload(emptyRuntime);
    const repository = repositoryForBrowser();

    if (!repository) {
      writeLegacyActiveSaveToStorage(save);
      set((state) => ({
        ...state,
        ...runtimeStateFromSave(save, state.corruptSavePresent)
      }));
      return;
    }

    const slot = repository.createSlot({
      name: name?.trim() || nextSaveName(repository),
      save
    });
    set((state) => ({
      ...state,
      ...runtimeStateFromSave(save, state.corruptSavePresent, repositoryMetadata(repository)),
      activeSaveSlotId: slot.slotId
    }));
  },
  importSaveAsSlot: (save, name) => {
    const repository = repositoryForBrowser();

    if (!repository) {
      writeLegacyActiveSaveToStorage(save);
      set((state) => ({
        ...state,
        ...runtimeStateFromSave(save, state.corruptSavePresent)
      }));
      return;
    }

    const slot = repository.createSlot({
      name: name?.trim() || `Imported ${nextSaveName(repository)}`,
      save
    });
    set((state) => ({
      ...state,
      ...runtimeStateFromSave(save, state.corruptSavePresent, repositoryMetadata(repository)),
      activeSaveSlotId: slot.slotId
    }));
  },
  deleteActiveSave: () => {
    const repository = repositoryForBrowser();
    if (repository) {
      const activeSlotId = get().activeSaveSlotId ?? repository.getActiveSlotId();
      if (activeSlotId) {
        get().deleteSaveSlot(activeSlotId);
      }
      return;
    }

    const corruptSavePresent =
      typeof window !== "undefined" && window.localStorage.getItem(CORRUPT_STORAGE_KEY) !== null;

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    set({
      ...createDefaultPersistedState(randomSeed(), {
        activeSavePresent: false,
        corruptSavePresent
      })
    });
  },
  deleteCorruptSave: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CORRUPT_STORAGE_KEY);
    }

    set((state) => ({
      ...state,
      saveRecovery: null,
      corruptSavePresent: false
    }));
  }
}));
