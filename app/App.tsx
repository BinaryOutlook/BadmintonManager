import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject
} from "react";
import { CompleteView } from "../components/CompleteView";
import {
  CareerAthletePromisesPage,
  CareerCalendarPage,
  CareerFacilitiesPage,
  CareerHomePage,
  CareerMatchPlanningPage,
  CareerMediaObjectivesPage,
  CareerPostMatchHubPage,
  CareerPreMatchHubPage,
  CareerProgramHubPage,
  CareerRankingsPage,
  CareerRecruitmentDeskPage,
  CareerRivalCircuitPage,
  CareerScoutingNetworkPage,
  CareerStaffRoomPage,
  CareerTournamentHomePage,
  CareerTimelinePage,
  CareerTrainingPage,
  CareerYouthAcademyPage
} from "../components/CareerWorkbench";
import { ConfirmOverlay } from "../components/ConfirmOverlay";
import { MatchView } from "../components/MatchView";
import { OverviewView } from "../components/OverviewView";
import { SaveManagerView } from "../components/SaveManagerView";
import { SettingsOverlay, type ThemeAccent } from "../components/SettingsOverlay";
import { SetupView, type LaunchSaveSummary } from "../components/SetupView";
import { playerMap } from "../game/content/players";
import { getCareerDailyAction, type CareerDailyActionTone } from "../game/career/dailyAction";
import { getCareerEvent } from "../game/career/events";
import { useTournamentStore, type AppPhase, type TournamentStoreState } from "../game/store/store";
import type { CareerStage, CareerState, TournamentAddress } from "../game/career/models";
import type { PersistedSave } from "../game/store/save";
import { getManagedMatchContext, type TournamentState } from "../game/tournament/tournament";
import { isPhaseBoundPage, pageForPhase, type AppPage } from "./pages";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { SquadPage } from "./pages/SquadPage";
import { PlayerNavigationProvider } from "./playerNavigation";
import { TournamentNavigationProvider } from "./tournamentNavigation";

export type CommandId =
  | "portal"
  | "timeline"
  | "calendar"
  | "inbox"
  | "squad"
  | "training"
  | "rankings"
  | "tactics"
  | "live"
  | "reports"
  | "scouting"
  | "staff"
  | "facilities"
  | "saveManager"
  | "settings";
type CommandGroupId = "CORE" | "PROGRAM" | "MATCH" | "OPERATIONS" | "SYSTEM";
type PendingConfirm = "resetSession" | "startTournamentReplaceCareer" | "startCareerReplaceSave";

type ShellCommand = {
  id: CommandId;
  group: CommandGroupId;
  label: string;
  short: string;
  description: string;
  disabled?: boolean;
  preview?: boolean;
  onActivate: () => void;
};

const THEME_STORAGE_KEY = "badminton-manager-theme-accent";
const SIDEBAR_WIDTH_STORAGE_KEY = "sidebarWidth";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebarCollapsed";
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 340;
const SIDEBAR_COLLAPSED_WIDTH = 64;

const commandGroupOrder: CommandGroupId[] = ["CORE", "PROGRAM", "MATCH", "OPERATIONS", "SYSTEM"];

const advanceableCareerStages: ReadonlySet<CareerStage> = new Set([
  "planning",
  "event_entered",
  "between_rounds",
  "event_complete"
]);

export function canAdvanceCareerDate(career: CareerState | null, phase: AppPhase) {
  return Boolean(career && phase !== "match" && advanceableCareerStages.has(career.stage));
}

export function pageForRuntime(career: CareerState | null, phase: AppPhase): AppPage {
  if (!career) {
    return pageForPhase(phase);
  }

  if (career.stage === "post_match") {
    return { id: "review" };
  }

  if (career.stage === "pre_match") {
    return { id: "bracket" };
  }

  return { id: "home" };
}

function formatCareerStage(stage: CareerStage) {
  switch (stage) {
    case "planning":
      return "Planning";
    case "event_entered":
      return "Event entered";
    case "between_rounds":
      return "Between rounds";
    case "pre_match":
      return "Pre-match";
    case "post_match":
      return "Post-match review";
    case "event_complete":
      return "Event complete";
  }
}

function playerName(playerId: string) {
  return playerMap[playerId]?.name ?? playerId;
}

function buildLaunchSaveSummary(args: {
  activeSavePresent: boolean;
  career: CareerState | null;
  tournament: TournamentState | null;
  liveMatch: TournamentStoreState["liveMatch"];
  phase: AppPhase;
  selectedPlayerId: string;
}): LaunchSaveSummary | null {
  if (!args.activeSavePresent) {
    return null;
  }

  if (args.career) {
    const managedPlayerId = args.career.program.managedPlayerId;
    const managedName = playerName(managedPlayerId);
    const athlete = args.career.athletes.find((entry) => entry.playerId === managedPlayerId);
    const activeEvent = args.career.activeEventId
      ? getCareerEvent(args.career.events, args.career.activeEventId)
      : undefined;
    const matchContext = args.tournament ? getManagedMatchContext(args.tournament) : null;
    const dailyAction = getCareerDailyAction({
      career: args.career,
      tournament: args.tournament,
      phase: args.phase,
      liveMatchActive: Boolean(args.liveMatch)
    });
    const nextAction = dailyAction.kind === "advance_day"
      ? `Next: ${dailyAction.label} to ${dailyAction.targetDate}`
      : `Next: ${dailyAction.label}`;
    const eventContext = activeEvent
      ? `${activeEvent.name}${matchContext ? ` ${matchContext.roundName}` : ""}`
      : formatCareerStage(args.career.stage);
    const details: LaunchSaveSummary["details"] = [
      { label: "Date", value: args.career.date },
      { label: "Stage", value: formatCareerStage(args.career.stage) },
      { label: "Save Health", value: "Local slot ready" }
    ];

    if (activeEvent) {
      details.push({ label: "Event", value: activeEvent.name });
    }

    if (matchContext) {
      const opponentId = matchContext.playerAId === managedPlayerId ? matchContext.playerBId : matchContext.playerAId;
      details.push({ label: "Opponent", value: playerName(opponentId), playerId: opponentId });
    }

    if (athlete) {
      details.push({ label: "Rank", value: `#${athlete.currentRank}` });
    }

    return {
      mode: "career",
      title: "Resume Career",
      managedPlayerId,
      managedName,
      context: `${args.career.date} | ${eventContext}`,
      nextAction,
      primaryActionLabel: "Continue Career",
      details,
      readiness: athlete ? Math.round(athlete.readiness) : undefined
    };
  }

  if (args.tournament || args.liveMatch) {
    const tournament = args.tournament;
    const managedPlayerId = tournament?.managedPlayerId ?? args.selectedPlayerId;
    const matchContext = tournament ? getManagedMatchContext(tournament) : null;
    const opponentId = matchContext
      ? matchContext.playerAId === managedPlayerId
        ? matchContext.playerBId
        : matchContext.playerAId
      : null;
    const opponentName = args.liveMatch?.opponentName ?? (opponentId ? playerName(opponentId) : "Draw pending");
    const roundLabel = args.liveMatch?.roundName ?? matchContext?.roundName ?? tournament?.rounds[tournament.currentRoundIndex]?.name ?? "Bracket";
    const stageLabel = args.phase === "match"
      ? "Live match"
      : args.phase === "complete"
        ? "Complete"
        : "Bracket ready";
    const nextAction = args.phase === "match" && args.liveMatch
      ? `Next: Resume ${args.liveMatch.roundName} match`
      : args.phase === "complete"
        ? "Next: Review the completed tournament"
        : matchContext
          ? `Next: Enter ${matchContext.roundName} against ${opponentName}`
          : "Next: Review the bracket state";
    const details: LaunchSaveSummary["details"] = [
      { label: "Event", value: tournament?.name ?? "Quick tournament" },
      { label: "Stage", value: stageLabel },
      { label: "Round", value: roundLabel },
      { label: "Save Health", value: "Local slot ready" }
    ];

    if (opponentName !== "Draw pending") {
      details.push({ label: "Opponent", value: opponentName, playerId: opponentId ?? undefined });
    }

    return {
      mode: "quickTournament",
      title: "Continue Tournament",
      managedPlayerId,
      managedName: playerName(managedPlayerId),
      context: `${tournament?.name ?? "Quick tournament"} | ${roundLabel}`,
      nextAction,
      primaryActionLabel: "Continue Tournament",
      details
    };
  }

  return null;
}

function loadThemeAccent(): ThemeAccent {
  if (typeof window === "undefined") {
    return "lime";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  return stored === "cyan" || stored === "rose" || stored === "slate" || stored === "lime"
    ? stored
    : "lime";
}

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

function loadSidebarWidth() {
  if (typeof window === "undefined") {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const storedValue = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);

  if (storedValue === null) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const storedWidth = Number(storedValue);

  return Number.isFinite(storedWidth)
    ? clampSidebarWidth(storedWidth)
    : SIDEBAR_DEFAULT_WIDTH;
}

function loadSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
}

function loadMobileViewport() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 780px)").matches;
}

export function commandIdForPage(page: AppPage): CommandId {
  switch (page.id) {
    case "saveManager":
      return "saveManager";
    case "squad":
    case "playerProfile":
      return "squad";
    case "season":
      return "training";
    case "tournamentHome":
      return "calendar";
    case "games":
    case "calendar":
      return "calendar";
    case "timeline":
      return "timeline";
    case "rankings":
      return "rankings";
    case "bracket":
      return "live";
    case "matchPlanning":
      return "tactics";
    case "liveMatch":
      return "live";
    case "review":
      return "reports";
    case "scouting":
    case "recruitment":
    case "youth":
      return "scouting";
    case "staff":
    case "promises":
      return "staff";
    case "facilities":
    case "media":
    case "rivals":
      return "facilities";
    case "program":
      return "training";
    case "setup":
    case "home":
    default:
      return "portal";
  }
}

export function App() {
  const {
    phase,
    selectedPlayerId,
    plannedTacticKey,
    seed,
    tournament,
    liveMatch,
    career,
    saveRecovery,
    activeSavePresent,
    corruptSavePresent,
    startCareer,
    scheduleCareerTraining,
    enterCareerEvent,
    advanceCareerDay,
    openScheduledCareerMatch,
    continueCareerAfterPostMatch,
    commissionScoutReport,
    makeRecruitmentOffer,
    trainRosterAthlete,
    enterRosterAthleteLowerEvent,
    developYouthProspect,
    enterYouthLowerEvent,
    hireStaffMember,
    setManagedAthletePromise,
    withdrawPromise,
    advanceRivalCircuit,
    upgradeFacility,
    resolveMediaObjectives,
    updateAdvancedTacticPlan,
    refreshAssistantAdvice,
    applyAssistantAdvice,
    overrideAssistantAdvice,
    selectPlayer,
    chooseTactic,
    startTournament,
    startManagedMatch,
    applyDirective,
    applyTalk,
    simulateNextPoint,
    finishSet,
    advanceAfterMatch,
    reset,
    exportActiveSave,
    replaceActiveSave,
    deleteActiveSave,
    deleteCorruptSave
  } = useTournamentStore();
  const [activePage, setActivePage] = useState<AppPage>(() => pageForRuntime(career, phase));
  const [playerProfileReturnPage, setPlayerProfileReturnPage] = useState<AppPage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [pendingCareerPlayerId, setPendingCareerPlayerId] = useState<string | null>(null);
  const [pendingTournamentPlayerId, setPendingTournamentPlayerId] = useState<string | null>(null);
  const [quickTournamentDraftPlayerId, setQuickTournamentDraftPlayerId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(loadThemeAccent);
  const [mobileViewport, setMobileViewport] = useState(loadMobileViewport);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationToggleRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationPanelRef = useRef<HTMLElement>(null);
  const selectedPlayer = playerMap[selectedPlayerId];
  const activeAthlete = career ? playerMap[career.program.managedPlayerId] : selectedPlayer;
  const setupSelectedPlayerId = career
    ? quickTournamentDraftPlayerId ?? selectedPlayerId
    : selectedPlayerId;
  const activeCommandId = commandIdForPage(activePage);
  const workspaceStyle = {
    "--sidebar-width": `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px`
  } as CSSProperties;
  const launchSaveSummary = buildLaunchSaveSummary({
    activeSavePresent,
    career,
    tournament,
    liveMatch,
    phase,
    selectedPlayerId
  });

  useEffect(() => {
    setActivePage((currentPage) => {
      if (career?.stage === "post_match" && currentPage.id === "review") {
        return currentPage;
      }

      if (career?.stage === "pre_match" && currentPage.id === "bracket") {
        return currentPage;
      }

      if (!isPhaseBoundPage(currentPage)) {
        return currentPage;
      }

      return pageForPhase(phase);
    });
  }, [career?.stage, phase]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    }
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(max-width: 780px)");
    const updateViewport = () => setMobileViewport(query.matches);

    updateViewport();
    query.addEventListener("change", updateViewport);

    return () => query.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!mobileViewport) {
      setMobileNavigationOpen(false);
    }
  }, [mobileViewport]);

  useEffect(() => {
    if (!mobileViewport || !mobileNavigationOpen) {
      return;
    }

    const panel = mobileNavigationPanelRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusableElements = () => Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);

    document.body.style.overflow = "hidden";
    focusableElements()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavigationOpen(false);
        window.requestAnimationFrame(() => mobileNavigationToggleRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const elements = focusableElements();

      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavigationOpen, mobileViewport]);

  function closeMobileNavigation(restoreFocus = false) {
    setMobileNavigationOpen(false);

    if (restoreFocus && mobileViewport) {
      window.requestAnimationFrame(() => mobileNavigationToggleRef.current?.focus());
    }
  }

  function setThemeAccentPreference(accent: ThemeAccent) {
    setThemeAccent(accent);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, accent);
    }
  }

  function openPlayerProfile(playerId: string) {
    if (activePage.id !== "playerProfile") {
      setPlayerProfileReturnPage(activePage);
    }

    setActivePage({ id: "playerProfile", playerId });
  }

  function closePlayerProfile() {
    setActivePage(playerProfileReturnPage ?? pageForRuntime(career, phase));
    setPlayerProfileReturnPage(null);
  }

  function openTournamentHome(address: TournamentAddress) {
    setActivePage({ id: "tournamentHome", ...address });
  }

  function requestReset() {
    setSettingsOpen(false);
    setPendingConfirm("resetSession");
  }

  function confirmReset() {
    reset();
    setActivePage({ id: "setup" });
  }

  function performStartTournament(managedPlayerId: string) {
    startTournament(managedPlayerId);
    setQuickTournamentDraftPlayerId(null);
    setActivePage({ id: "bracket" });
  }

  function selectSetupPlayer(playerId: string) {
    setQuickTournamentDraftPlayerId(playerId);
  }

  function requestStartTournament(managedPlayerId?: string) {
    if (!managedPlayerId) {
      setActivePage({ id: "setup" });
      return;
    }

    if (career) {
      setPendingTournamentPlayerId(managedPlayerId);
      setPendingConfirm("startTournamentReplaceCareer");
      return;
    }

    performStartTournament(managedPlayerId);
  }

  function performStartCareer(managedPlayerId: string) {
    startCareer(managedPlayerId);
    setActivePage({ id: "home" });
  }

  function requestStartCareer(managedPlayerId?: string) {
    if (!managedPlayerId) {
      setActivePage({ id: "setup" });
      return;
    }

    if (career || tournament || liveMatch) {
      setPendingCareerPlayerId(managedPlayerId);
      setPendingConfirm("startCareerReplaceSave");
      return;
    }

    performStartCareer(managedPlayerId);
  }

  function confirmPendingAction() {
    if (pendingConfirm === "resetSession") {
      confirmReset();
    }

    if (pendingConfirm === "startTournamentReplaceCareer") {
      if (pendingTournamentPlayerId) {
        performStartTournament(pendingTournamentPlayerId);
      }
    }

    if (pendingConfirm === "startCareerReplaceSave") {
      if (pendingCareerPlayerId) {
        performStartCareer(pendingCareerPlayerId);
      }
    }

    setPendingConfirm(null);
    setPendingCareerPlayerId(null);
    setPendingTournamentPlayerId(null);
  }

  function openSaveManager() {
    setSettingsOpen(false);
    setActivePage({ id: "saveManager" });
  }

  function continueLocalSave() {
    if (career) {
      continueCareer();
      return;
    }

    setActivePage(pageForPhase(phase));
  }

  function continueCareer() {
    if (!career) {
      return;
    }

    if (phase === "match") {
      setActivePage({ id: "liveMatch" });
      return;
    }

    setActivePage(
      career.stage === "post_match" ? { id: "review" } : career.stage === "pre_match" ? { id: "bracket" } : { id: "home" }
    );
  }

  function confirmImport(save: PersistedSave) {
    replaceActiveSave(save);
    const next = useTournamentStore.getState();
    setActivePage(
      next.career
        ? next.career.stage === "post_match"
          ? { id: "review" }
          : next.career.stage === "pre_match"
            ? { id: "bracket" }
            : { id: "home" }
        : pageForPhase(next.phase)
    );
  }

  function handleDeleteActiveSave() {
    deleteActiveSave();
    setActivePage({ id: "setup" });
  }

  function handleAdvanceCareerDay() {
    advanceCareerDay();
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "timeline" });
  }

  function handleOpenScheduledCareerMatch(eventId?: string) {
    openScheduledCareerMatch(eventId);
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "timeline" });
  }

  function handleContinueCareerAfterPostMatch() {
    continueCareerAfterPostMatch();
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "home" });
  }

  function handleStartManagedMatch() {
    startManagedMatch();
    setActivePage({ id: "liveMatch" });
  }

  function openLiveMatchRoute() {
    if (phase === "match" || liveMatch) {
      setActivePage({ id: "liveMatch" });
      return;
    }

    if (career) {
      if (career.stage === "pre_match") {
        setActivePage({ id: "bracket" });
        return;
      }

      const action = getCareerDailyAction({
        career,
        tournament,
        phase,
        liveMatchActive: false
      });

      if (action.kind === "play_scheduled_match") {
        handleOpenScheduledCareerMatch(action.eventId);
        return;
      }

      setActivePage({ id: "matchPlanning" });
      return;
    }

    if (tournament && phase === "overview") {
      setActivePage({ id: "bracket" });
      return;
    }

    setActivePage(pageForPhase(phase));
  }

  function openCareerPostMatchRoute() {
    setActivePage({ id: "review" });
  }

  function handleAdvanceAfterMatch() {
    advanceAfterMatch();
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "post_match" ? { id: "review" } : pageForPhase(next.phase));
  }

  function activateCommand(commandId: CommandId) {
    switch (commandId) {
      case "portal":
        setActivePage(career && phase !== "match" ? { id: "home" } : pageForPhase(phase));
        break;
      case "timeline":
        setActivePage({ id: "timeline" });
        break;
      case "calendar":
        setActivePage({ id: "calendar" });
        break;
      case "inbox":
        break;
      case "squad":
        setActivePage({ id: "squad" });
        break;
      case "training":
        setActivePage(career ? { id: "season" } : { id: "setup" });
        break;
      case "rankings":
        setActivePage({ id: "rankings" });
        break;
      case "tactics":
        setActivePage(career && phase !== "match" ? { id: "matchPlanning" } : phase === "setup" ? { id: "setup" } : pageForPhase(phase));
        break;
      case "live":
        openLiveMatchRoute();
        break;
      case "reports":
        openCareerPostMatchRoute();
        break;
      case "scouting":
        setActivePage(career ? { id: "scouting" } : { id: "setup" });
        break;
      case "staff":
        setActivePage(career ? { id: "staff" } : { id: "setup" });
        break;
      case "facilities":
        setActivePage(career ? { id: "facilities" } : { id: "setup" });
        break;
      case "saveManager":
        openSaveManager();
        break;
      case "settings":
        setSettingsOpen(true);
        break;
    }
  }

  function buildShellCommands(): ShellCommand[] {
    const liveMatchDescription =
      phase === "match" || liveMatch
        ? "Point control"
        : career?.stage === "pre_match"
          ? "Opponent briefing"
          : career &&
              getCareerDailyAction({
                career,
                tournament,
                phase,
                liveMatchActive: false
              }).kind === "play_scheduled_match"
            ? "Opponent briefing"
            : !career && tournament && phase === "overview"
              ? "Bracket overview"
              : "Match planning";

    return [
      {
        id: "portal",
        group: "CORE",
        label: career ? "Portal" : "Start",
        short: career ? "POR" : "STA",
        description: career ? "Career command center" : "Start screen",
        onActivate: () => activateCommand("portal")
      },
      {
        id: "timeline",
        group: "CORE",
        label: "Timeline",
        short: "TIM",
        description: career ? "Chronological event log" : "Career required",
        onActivate: () => activateCommand("timeline")
      },
      {
        id: "calendar",
        group: "CORE",
        label: "Calendar",
        short: "CAL",
        description: career ? "Confirmed month grid" : "Career schedule",
        onActivate: () => activateCommand("calendar")
      },
      {
        id: "inbox",
        group: "CORE",
        label: "Inbox Preview",
        short: "INB",
        description: "Preview only - not live",
        disabled: true,
        preview: true,
        onActivate: () => activateCommand("inbox")
      },
      {
        id: "squad",
        group: "PROGRAM",
        label: "Squad",
        short: "SQU",
        description: career ? "Inspect locked athlete" : "Browse athletes",
        onActivate: () => activateCommand("squad")
      },
      {
        id: "training",
        group: "PROGRAM",
        label: "Training",
        short: "TRN",
        description: career ? "Load and recovery" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("training")
      },
      {
        id: "tactics",
        group: "PROGRAM",
        label: "Tactics",
        short: "TAC",
        description: career ? "Advanced match plan" : "Quick tactic setup",
        onActivate: () => activateCommand("tactics")
      },
      {
        id: "rankings",
        group: "PROGRAM",
        label: "Rankings",
        short: "RNK",
        description: "Circuit table",
        onActivate: () => activateCommand("rankings")
      },
      {
        id: "live",
        group: "MATCH",
        label: "Live Match",
        short: "LIV",
        description: liveMatchDescription,
        onActivate: () => activateCommand("live")
      },
      {
        id: "reports",
        group: "MATCH",
        label: "Reports",
        short: "REP",
        description: career?.lastMatchReport ? "Post-match evidence" : "Report pending",
        disabled: !career?.lastMatchReport,
        onActivate: () => activateCommand("reports")
      },
      {
        id: "scouting",
        group: "MATCH",
        label: "Scouting",
        short: "SCT",
        description: career ? "Assignments and reports" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("scouting")
      },
      {
        id: "staff",
        group: "OPERATIONS",
        label: "Staff",
        short: "STF",
        description: career ? "Staff and promises" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("staff")
      },
      {
        id: "facilities",
        group: "OPERATIONS",
        label: "Facilities",
        short: "FAC",
        description: career ? "Infrastructure" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("facilities")
      },
      {
        id: "saveManager",
        group: "SYSTEM",
        label: "Save Manager",
        short: "SAV",
        description: activeSavePresent ? "Active slot online" : "Import/export",
        onActivate: () => activateCommand("saveManager")
      },
      {
        id: "settings",
        group: "SYSTEM",
        label: "Settings",
        short: "SET",
        description: "Preferences overlay",
        onActivate: () => activateCommand("settings")
      }
    ];
  }

  function handleShellContinue() {
    if (career) {
      const action = getCareerDailyAction({
        career,
        tournament,
        phase,
        liveMatchActive: Boolean(liveMatch)
      });

      switch (action.kind) {
        case "advance_day":
          handleAdvanceCareerDay();
          return;
        case "play_scheduled_match":
          handleOpenScheduledCareerMatch(action.eventId);
          return;
        case "resume_live_match":
          setActivePage({ id: "liveMatch" });
          return;
        case "review_match":
          setActivePage({ id: "review" });
          return;
        case "unavailable":
          break;
      }
    }

    if (career) {
      continueCareer();
      return;
    }

    if (activeSavePresent) {
      continueLocalSave();
      return;
    }

    setActivePage(pageForPhase(phase));
  }

  function renderSystemOverlays() {
    return (
      <OverlayHost>
        <SettingsOverlay
          open={settingsOpen}
          themeAccent={themeAccent}
          onThemeAccentChange={setThemeAccentPreference}
          onRequestReset={requestReset}
          onOpenSaveManager={openSaveManager}
          onClose={() => setSettingsOpen(false)}
        />

        <ConfirmOverlay
          open={pendingConfirm !== null}
          title={
            pendingConfirm === "startTournamentReplaceCareer"
              ? "Start tournament and replace career?"
              : pendingConfirm === "startCareerReplaceSave"
                ? "Start a new career?"
                : career
                  ? "Reset tournament state?"
                  : "Start a new session?"
          }
          message={
            pendingConfirm === "startTournamentReplaceCareer"
              ? "Starting a tournament writes to the single active local slot and removes the current career save. Export JSON first if you want a backup."
              : pendingConfirm === "startCareerReplaceSave"
                ? "This creates a new career in the single active local slot and clears the current tournament/live match state. Export JSON first if you want a backup."
                : career
                  ? "This clears the current tournament or live-match state and returns to athlete selection. Your career save remains in the active local slot."
                  : "This clears the current local tournament run and returns the app to athlete selection."
          }
          confirmLabel={
            pendingConfirm === "startTournamentReplaceCareer"
              ? "Start Tournament"
              : pendingConfirm === "startCareerReplaceSave"
                ? "Start New Career"
                : "Start New Session"
          }
          onConfirm={confirmPendingAction}
          onCancel={() => {
            setPendingConfirm(null);
            setPendingCareerPlayerId(null);
            setPendingTournamentPlayerId(null);
          }}
        />
      </OverlayHost>
    );
  }

  function beginSidebarResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = sidebarCollapsed ? SIDEBAR_DEFAULT_WIDTH : sidebarWidth;

    setSidebarCollapsed(false);
    handle.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function renderPage() {
    const careerPageProps = {
      career,
      tournament,
      saveRecovery,
      activeSavePresent,
      corruptSavePresent,
      onStartCareer: requestStartCareer,
      onOpenTraining: () => setActivePage({ id: "season" }),
      onOpenCalendar: () => setActivePage({ id: "timeline" }),
      onOpenTournamentHome: openTournamentHome,
      onOpenHome: () => setActivePage({ id: "home" }),
      onOpenLiveMatch: openLiveMatchRoute,
      onOpenPostMatch: openCareerPostMatchRoute,
      onOpenProgram: () => setActivePage({ id: "program" }),
      onOpenRivals: () => setActivePage({ id: "rivals" }),
      onOpenMatchPlanning: () => setActivePage({ id: "matchPlanning" }),
      onOpenSaveManager: openSaveManager,
      onRequestNewSession: requestReset,
      onOpenFacilities: () => setActivePage({ id: "facilities" }),
      onOpenMedia: () => setActivePage({ id: "media" }),
      onOpenScouting: () => setActivePage({ id: "scouting" }),
      onOpenRecruitment: () => setActivePage({ id: "recruitment" }),
      onOpenYouth: () => setActivePage({ id: "youth" }),
      onOpenStaff: () => setActivePage({ id: "staff" }),
      onOpenPromises: () => setActivePage({ id: "promises" }),
      onOpenPlayerProfile: openPlayerProfile,
      onApplyTraining: scheduleCareerTraining,
      onEnterEvent: enterCareerEvent,
      onOpenScheduledCareerMatch: handleOpenScheduledCareerMatch,
      onStartManagedMatch: handleStartManagedMatch,
      onContinueAfterPostMatch: handleContinueCareerAfterPostMatch,
      onCommissionScoutReport: commissionScoutReport,
      onMakeRecruitmentOffer: makeRecruitmentOffer,
      onTrainRosterAthlete: trainRosterAthlete,
      onEnterRosterAthleteLowerEvent: enterRosterAthleteLowerEvent,
      onDevelopYouthProspect: developYouthProspect,
      onEnterYouthLowerEvent: enterYouthLowerEvent,
      onHireStaffMember: hireStaffMember,
      onSetManagedAthletePromise: setManagedAthletePromise,
      onWithdrawPromise: withdrawPromise,
      onAdvanceRivalCircuit: advanceRivalCircuit,
      onUpgradeFacility: upgradeFacility,
      onResolveMediaObjectives: resolveMediaObjectives,
      onUpdateAdvancedTacticPlan: updateAdvancedTacticPlan,
      onRefreshAssistantAdvice: refreshAssistantAdvice,
      onApplyAssistantAdvice: applyAssistantAdvice,
      onOverrideAssistantAdvice: overrideAssistantAdvice
    };

    if (activePage.id === "setup") {
      return (
        <SetupView
          selectedPlayerId={setupSelectedPlayerId}
          plannedTacticKey={plannedTacticKey}
          onSelectPlayer={selectSetupPlayer}
          onOpenPlayerProfile={openPlayerProfile}
          onChooseTactic={chooseTactic}
          onStartTournament={requestStartTournament}
          onStartCareer={requestStartCareer}
          onContinueLocalSave={continueLocalSave}
          onOpenSaveManager={openSaveManager}
          onOpenPreferences={() => setSettingsOpen(true)}
          activeSavePresent={activeSavePresent}
          careerPresent={Boolean(career)}
          corruptSavePresent={corruptSavePresent}
          saveRecoveryPresent={Boolean(saveRecovery)}
          launchSaveSummary={launchSaveSummary}
        />
      );
    }

    if (activePage.id === "saveManager") {
      return (
        <SaveManagerView
          activeSavePresent={activeSavePresent}
          corruptSavePresent={corruptSavePresent}
          saveRecovery={saveRecovery}
          phase={phase}
          selectedPlayerId={selectedPlayerId}
          plannedTacticKey={plannedTacticKey}
          seed={seed}
          tournament={tournament}
          liveMatchActive={Boolean(liveMatch)}
          career={career}
          onContinueLocalSave={continueLocalSave}
          onContinueCareer={continueCareer}
          onStartTournament={requestStartTournament}
          onStartNewCareer={() => setActivePage({ id: "setup" })}
          onExportSave={exportActiveSave}
          onConfirmImport={confirmImport}
          onDeleteActiveSave={handleDeleteActiveSave}
          onDeleteCorruptSave={deleteCorruptSave}
        />
      );
    }

    if (activePage.id === "home") {
      return <CareerHomePage {...careerPageProps} />;
    }

    if (activePage.id === "program") {
      return <CareerProgramHubPage {...careerPageProps} />;
    }

    if (activePage.id === "rivals") {
      return <CareerRivalCircuitPage {...careerPageProps} />;
    }

    if (activePage.id === "matchPlanning") {
      return <CareerMatchPlanningPage {...careerPageProps} />;
    }

    if (activePage.id === "facilities") {
      return <CareerFacilitiesPage {...careerPageProps} />;
    }

    if (activePage.id === "media") {
      return <CareerMediaObjectivesPage {...careerPageProps} />;
    }

    if (activePage.id === "scouting") {
      return <CareerScoutingNetworkPage {...careerPageProps} />;
    }

    if (activePage.id === "recruitment") {
      return <CareerRecruitmentDeskPage {...careerPageProps} />;
    }

    if (activePage.id === "youth") {
      return <CareerYouthAcademyPage {...careerPageProps} />;
    }

    if (activePage.id === "staff") {
      return <CareerStaffRoomPage {...careerPageProps} />;
    }

    if (activePage.id === "promises") {
      return <CareerAthletePromisesPage {...careerPageProps} />;
    }

    if (activePage.id === "playerProfile") {
      return (
        <PlayerProfilePage
          playerId={activePage.playerId}
          selectedPlayerId={career ? career.program.managedPlayerId : selectedPlayerId}
          phase={phase}
          careerPresent={Boolean(career)}
          career={career}
          tournament={tournament}
          liveMatchSession={liveMatch?.session}
          onBack={closePlayerProfile}
          onSelectPlayer={selectPlayer}
        />
      );
    }

    if (activePage.id === "squad") {
      return (
        <SquadPage
          selectedPlayerId={career ? career.program.managedPlayerId : selectedPlayerId}
          phase={phase}
          careerPresent={Boolean(career)}
          tournament={tournament}
          liveMatchSession={liveMatch?.session}
          onOpenPlayerProfile={openPlayerProfile}
          onSelectPlayer={selectPlayer}
        />
      );
    }

    if (activePage.id === "games") {
      return <CareerCalendarPage {...careerPageProps} />;
    }

    if (activePage.id === "timeline") {
      return <CareerTimelinePage {...careerPageProps} />;
    }

    if (activePage.id === "season") {
      return <CareerTrainingPage {...careerPageProps} />;
    }

    if (activePage.id === "calendar") {
      return <CareerCalendarPage {...careerPageProps} initialMonthCursor={activePage.monthCursor} />;
    }

    if (activePage.id === "rankings") {
      return <CareerRankingsPage {...careerPageProps} />;
    }

    if (activePage.id === "tournamentHome") {
      return <CareerTournamentHomePage {...careerPageProps} seasonId={activePage.seasonId} eventId={activePage.eventId} />;
    }

    if (activePage.id === "review" && career) {
      return <CareerPostMatchHubPage {...careerPageProps} />;
    }

    if (phase === "setup") {
      return (
        <SetupView
          selectedPlayerId={setupSelectedPlayerId}
          plannedTacticKey={plannedTacticKey}
          onSelectPlayer={selectSetupPlayer}
          onOpenPlayerProfile={openPlayerProfile}
          onChooseTactic={chooseTactic}
          onStartTournament={requestStartTournament}
          onStartCareer={requestStartCareer}
          onContinueLocalSave={continueLocalSave}
          onOpenSaveManager={openSaveManager}
          onOpenPreferences={() => setSettingsOpen(true)}
          activeSavePresent={activeSavePresent}
          careerPresent={Boolean(career)}
          corruptSavePresent={corruptSavePresent}
          saveRecoveryPresent={Boolean(saveRecovery)}
          launchSaveSummary={launchSaveSummary}
        />
      );
    }

    if (career?.stage === "post_match") {
      return <CareerPostMatchHubPage {...careerPageProps} />;
    }

    if (phase === "overview" && tournament) {
      if (career?.stage === "pre_match") {
        return <CareerPreMatchHubPage {...careerPageProps} />;
      }

      return (
        <OverviewView
          tournament={tournament}
          selectedPlayerId={selectedPlayerId}
          plannedTacticKey={plannedTacticKey}
          onChooseTactic={chooseTactic}
          onOpenPlayerProfile={openPlayerProfile}
          onStartManagedMatch={handleStartManagedMatch}
          onReset={requestReset}
        />
      );
    }

    if (phase === "match" && liveMatch) {
      return (
        <MatchView
          session={liveMatch.session}
          managedSide={liveMatch.managedSide}
          opponentName={liveMatch.opponentName}
          opponentTacticLabel={liveMatch.opponentTacticLabel}
          onApplyDirective={applyDirective}
          onApplyTalk={applyTalk}
          onSimulateNextPoint={simulateNextPoint}
          onFinishSet={finishSet}
          onAdvanceAfterMatch={handleAdvanceAfterMatch}
          onOpenPlayerProfile={openPlayerProfile}
        />
      );
    }

    if (phase === "complete" && tournament) {
      return (
        <CompleteView
          tournament={tournament}
          selectedPlayerId={selectedPlayerId}
          onOpenPlayerProfile={openPlayerProfile}
          onReset={requestReset}
        />
      );
    }

    return null;
  }

  const shellCommands = buildShellCommands();
  const careerDailyAction = career
    ? getCareerDailyAction({
        career,
        tournament,
        phase,
        liveMatchActive: Boolean(liveMatch)
      })
    : null;
  const shellDate = career?.date ?? "Local slot";
  const saveStatus = activeSavePresent
    ? career
      ? "Career save"
      : "Quick save"
    : corruptSavePresent
      ? "Recovery available"
      : "No active save";
  const saveButtonLabel = career
    ? "Career Save"
    : activeSavePresent
      ? "Quick Save"
      : "Save Manager";
  const continueLabel = careerDailyAction
    ? careerDailyAction.label
    : activeSavePresent
      ? "Continue Save"
      : "Start";
  const continueTone: CareerDailyActionTone = careerDailyAction?.tone ?? "ready";
  const shouldRenderLaunchShell =
    activePage.id === "setup" ||
    (!activeSavePresent &&
      !career &&
      !tournament &&
      !liveMatch &&
      phase === "setup" &&
      (activePage.id === "saveManager" || activePage.id === "playerProfile"));
  const launchSaveStatus = launchSaveSummary
    ? launchSaveSummary.mode === "career"
      ? "Save: Career loaded"
      : "Save: Tournament loaded"
    : corruptSavePresent
      ? "Save: Needs review"
      : activeSavePresent
        ? "Save: Setup draft"
        : "Save: Empty";

  if (shouldRenderLaunchShell) {
    return (
      <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
        <TournamentNavigationProvider onOpenTournamentHome={openTournamentHome}>
          <div className="command-shell command-shell-launch" data-accent={themeAccent}>
            <LaunchTopBar saveStatus={launchSaveStatus} onOpenSettings={() => setSettingsOpen(true)} />
            <PageCanvas>{renderPage()}</PageCanvas>
            {renderSystemOverlays()}
          </div>
        </TournamentNavigationProvider>
      </PlayerNavigationProvider>
    );
  }

  return (
    <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
      <TournamentNavigationProvider onOpenTournamentHome={openTournamentHome}>
        <div
          className={sidebarCollapsed ? "command-shell command-shell-sidebar-collapsed" : "command-shell"}
          data-accent={themeAccent}
        >
          <TopStatusBar
            activeAthleteName={activeAthlete.name}
            continueLabel={continueLabel}
            continueTone={continueTone}
            dateLabel={shellDate}
            saveButtonLabel={saveButtonLabel}
            saveStatus={saveStatus}
            navigationOpen={mobileNavigationOpen}
            navigationToggleRef={mobileNavigationToggleRef}
            onToggleNavigation={() => setMobileNavigationOpen((current) => !current)}
            onContinue={handleShellContinue}
            onOpenSaveManager={openSaveManager}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <div
            className={[
              "workspace-shell",
              activePage.id === "playerProfile" ? "workspace-shell-profile" : "",
              mobileNavigationOpen ? "workspace-shell-mobile-nav-open" : ""
            ].filter(Boolean).join(" ")}
            style={workspaceStyle}
          >
            <button
              className="mobile-navigation-scrim"
              type="button"
              aria-label="Close navigation menu"
              onClick={() => closeMobileNavigation(true)}
            />
            <CommandSidebar
              activeCommandId={activeCommandId}
              commands={shellCommands}
              collapsed={sidebarCollapsed}
              mobileMode={mobileViewport}
              mobileOpen={mobileNavigationOpen}
              mobilePanelRef={mobileNavigationPanelRef}
              onCloseMobile={() => closeMobileNavigation(true)}
              onResizeStart={beginSidebarResize}
              onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            />

            <PageCanvas>{renderPage()}</PageCanvas>
          </div>

          {renderSystemOverlays()}
        </div>
      </TournamentNavigationProvider>
    </PlayerNavigationProvider>
  );
}

function LaunchTopBar(props: {
  saveStatus: string;
  onOpenSettings: () => void;
}) {
  return (
    <header className="topbar launch-topbar">
      <div className="topbar-brand-block">
        <span className="brand-mark">BM</span>
        <span className="brand-lockup" aria-label="Badminton Manager">
          <strong>Badminton Manager</strong>
          <span>Coach OS</span>
        </span>
        <label className="command-search">
          <span>Command</span>
          <input aria-label="Search or go to command" placeholder="Search or go to..." readOnly />
        </label>
      </div>

      <div className="topbar-status launch-topbar-status" aria-label="Launch save status">
        <span>{props.saveStatus}</span>
        <span>Launch mode</span>
      </div>

      <div className="topbar-actions launch-topbar-actions">
        <button className="icon-command-button" type="button" onClick={props.onOpenSettings}>
          Settings
        </button>
      </div>
    </header>
  );
}

function TopStatusBar(props: {
  activeAthleteName: string;
  continueLabel: string;
  continueTone: CareerDailyActionTone;
  dateLabel: string;
  saveButtonLabel: string;
  saveStatus: string;
  navigationOpen: boolean;
  navigationToggleRef: RefObject<HTMLButtonElement | null>;
  onToggleNavigation: () => void;
  onContinue: () => void;
  onOpenSaveManager: () => void;
  onOpenSettings: () => void;
}) {
  const continueClass = [
    "command-button",
    "topbar-continue",
    props.continueTone === "required"
      ? "topbar-continue-required"
      : props.continueTone === "disabled"
        ? "topbar-continue-disabled"
        : "topbar-continue-ready"
  ].join(" ");

  return (
    <header className="topbar">
      <div className="topbar-brand-block">
        <span className="brand-mark">BM</span>
        <span className="brand-lockup" aria-label="Badminton Manager">
          <strong>Badminton Manager</strong>
          <span>Coach OS</span>
        </span>
        <button
          ref={props.navigationToggleRef}
          className="mobile-navigation-toggle"
          type="button"
          aria-label={props.navigationOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={props.navigationOpen}
          onClick={props.onToggleNavigation}
        >
          Menu
        </button>
        <span className="topbar-athlete-chip" aria-label="Managed athlete">
          <span>Managed</span>
          <strong>{props.activeAthleteName}</strong>
        </span>
        <label className="command-search">
          <span>Command</span>
          <input aria-label="Search or go to command" placeholder="Search or go to..." readOnly />
        </label>
      </div>

      <div className="topbar-command-zone" aria-label="Topbar career controls">
        <div className="topbar-actions" aria-label="Career utility controls">
          <button
            className="icon-command-button topbar-save-button"
            type="button"
            title={`Open Save Manager - ${props.saveStatus}`}
            onClick={props.onOpenSaveManager}
          >
            {props.saveButtonLabel}
          </button>
          <button className="icon-command-button" type="button" onClick={props.onOpenSettings}>
            Settings
          </button>
        </div>

        <div className="topbar-daily-cluster" aria-label="Career clock control">
          <span className="topbar-date" aria-label={`Career date ${props.dateLabel}`}>
            {props.dateLabel}
          </span>
          <button className={continueClass} data-tone={props.continueTone} type="button" onClick={props.onContinue}>
            {props.continueLabel}
          </button>
        </div>
      </div>
    </header>
  );
}

function CommandSidebar(props: {
  activeCommandId: CommandId;
  collapsed: boolean;
  commands: ShellCommand[];
  mobileMode: boolean;
  mobileOpen: boolean;
  mobilePanelRef: RefObject<HTMLElement | null>;
  onCloseMobile: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      ref={props.mobilePanelRef}
      className={props.mobileOpen ? "sidebar command-sidebar command-sidebar-mobile-open" : "sidebar command-sidebar"}
      aria-label="Primary command sidebar"
      inert={props.mobileMode && !props.mobileOpen}
    >
      <button className="mobile-navigation-close" type="button" onClick={props.onCloseMobile}>
        Close Menu
      </button>
      <nav className="sidenav command-groups" aria-label="Primary commands">
        {commandGroupOrder.map((group) => (
          <section className="command-group" key={group} data-group={group} aria-labelledby={`command-group-${group}`}>
            <h3 id={`command-group-${group}`}>{group}</h3>
            <div className="command-group-list">
              {props.commands
                .filter((command) => command.group === group)
                .map((command) => {
                  const active = command.id === props.activeCommandId;

                  return (
                    <button
                      key={command.id}
                      type="button"
                      className={active ? "sidenav-item sidenav-item-active" : "sidenav-item"}
                      data-command={command.id}
                      data-short={command.short}
                      disabled={command.disabled}
                      aria-current={active ? "page" : undefined}
                      aria-label={`${command.label}${command.preview ? " preview-only" : ""}: ${command.description}`}
                      title={`${command.label}: ${command.description}`}
                      onClick={() => {
                        command.onActivate();
                        props.onCloseMobile();
                      }}
                    >
                      <span>{command.label}</span>
                      {command.preview && <small>Preview only</small>}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </nav>

      <button
        className="sidebar-collapse-button"
        type="button"
        aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!props.collapsed}
        onClick={props.onToggleCollapsed}
      >
        {props.collapsed ? ">" : "<"}
      </button>

      <button
        className="sidebar-resize-handle"
        type="button"
        aria-label="Resize sidebar"
        onPointerDown={props.onResizeStart}
      />
    </aside>
  );
}

function PageCanvas(props: { children: ReactNode }) {
  return <main className="main-canvas page-canvas">{props.children}</main>;
}

function OverlayHost(props: { children: ReactNode }) {
  return <div className="overlay-host">{props.children}</div>;
}
