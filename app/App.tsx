import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  CareerRecruitmentDeskPage,
  CareerRivalCircuitPage,
  CareerScoutingNetworkPage,
  CareerStaffRoomPage,
  CareerTrainingPage,
  CareerYouthAcademyPage
} from "../components/CareerWorkbench";
import { ConfirmOverlay } from "../components/ConfirmOverlay";
import { MatchView } from "../components/MatchView";
import { OverviewView } from "../components/OverviewView";
import { SaveManagerView } from "../components/SaveManagerView";
import { SettingsOverlay, type ThemeAccent } from "../components/SettingsOverlay";
import { SetupView } from "../components/SetupView";
import { TacticalIntelPanel } from "../components/TacticalIntelPanel";
import { playerMap } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { useTournamentStore, type AppPhase } from "../game/store/store";
import type { CareerStage, CareerState } from "../game/career/models";
import type { PersistedSave } from "../game/store/save";
import { isPhaseBoundPage, pageForPhase, type AppPage } from "./pages";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { SquadPage } from "./pages/SquadPage";
import { PlayerNavigationProvider } from "./playerNavigation";

type CommandId =
  | "portal"
  | "inbox"
  | "squad"
  | "training"
  | "calendar"
  | "competitions"
  | "tactics"
  | "live"
  | "reports"
  | "scouting"
  | "staff"
  | "facilities"
  | "saveManager"
  | "settings";
type CommandGroupId = "Core" | "Program" | "Match" | "Operations" | "System";
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

const commandGroupOrder: CommandGroupId[] = ["Core", "Program", "Match", "Operations", "System"];

const advanceableCareerStages: ReadonlySet<CareerStage> = new Set([
  "planning",
  "event_entered",
  "between_rounds",
  "event_complete"
]);

export function canAdvanceCareerDate(career: CareerState | null, phase: AppPhase) {
  return Boolean(career && phase !== "match" && advanceableCareerStages.has(career.stage));
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

function commandIdForPage(page: AppPage): CommandId {
  switch (page.id) {
    case "saveManager":
      return "saveManager";
    case "squad":
    case "playerProfile":
      return "squad";
    case "season":
      return "training";
    case "calendar":
      return "calendar";
    case "games":
    case "bracket":
      return "competitions";
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
    applyCareerTraining,
    enterCareerEvent,
    advanceCareerDay,
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
    advanceAfterMatch,
    reset,
    exportActiveSave,
    replaceActiveSave,
    deleteActiveSave,
    deleteCorruptSave
  } = useTournamentStore();
  const [activePage, setActivePage] = useState<AppPage>(() =>
    career
      ? career.stage === "post_match"
        ? { id: "review" }
        : career.stage === "pre_match"
          ? { id: "bracket" }
          : { id: "home" }
      : pageForPhase(phase)
  );
  const [intelOpen, setIntelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [pendingCareerPlayerId, setPendingCareerPlayerId] = useState<string | null>(null);
  const [quickTournamentDraftPlayerId, setQuickTournamentDraftPlayerId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(loadThemeAccent);
  const selectedPlayer = playerMap[selectedPlayerId];
  const activeAthlete = career ? playerMap[career.program.managedPlayerId] : selectedPlayer;
  const setupSelectedPlayerId = career
    ? quickTournamentDraftPlayerId ?? selectedPlayerId
    : selectedPlayerId;
  const selectedTactic =
    tacticOptions.find((option) => option.key === plannedTacticKey) ?? tacticOptions[0];
  const canEnterManagedMatch = phase === "overview" && Boolean(tournament);
  const activeCommandId = commandIdForPage(activePage);
  const workspaceStyle = {
    "--sidebar-width": `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px`
  } as CSSProperties;

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

  function setThemeAccentPreference(accent: ThemeAccent) {
    setThemeAccent(accent);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, accent);
    }
  }

  function openPlayerProfile(playerId: string) {
    setActivePage({ id: "playerProfile", playerId });
  }

  function requestReset() {
    setSettingsOpen(false);
    setPendingConfirm("resetSession");
  }

  function confirmReset() {
    reset();
    setActivePage({ id: "setup" });
  }

  function performStartTournament(playerId?: string) {
    startTournament(playerId ?? quickTournamentDraftPlayerId ?? selectedPlayerId);
    setQuickTournamentDraftPlayerId(null);
    setActivePage({ id: "bracket" });
  }

  function selectSetupPlayer(playerId: string) {
    if (career) {
      setQuickTournamentDraftPlayerId(playerId);
      return;
    }

    selectPlayer(playerId);
    setQuickTournamentDraftPlayerId(playerId);
  }

  function requestStartTournament(playerId?: string) {
    const requestedPlayerId = playerId ?? quickTournamentDraftPlayerId ?? selectedPlayerId;

    if (career) {
      setQuickTournamentDraftPlayerId(requestedPlayerId);
      setPendingConfirm("startTournamentReplaceCareer");
      return;
    }

    performStartTournament(requestedPlayerId);
  }

  function performStartCareer(managedPlayerId?: string) {
    startCareer(managedPlayerId);
    setActivePage({ id: "home" });
  }

  function requestStartCareer(managedPlayerId?: string) {
    if (career || tournament || liveMatch) {
      setPendingCareerPlayerId(managedPlayerId ?? selectedPlayerId);
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
      performStartTournament();
    }

    if (pendingConfirm === "startCareerReplaceSave") {
      performStartCareer(pendingCareerPlayerId ?? selectedPlayerId);
    }

    setPendingConfirm(null);
    setPendingCareerPlayerId(null);
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
    setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "calendar" });
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

  function openCareerLiveRoute() {
    if (phase === "match") {
      setActivePage({ id: "liveMatch" });
      return;
    }

    if (career?.stage === "pre_match") {
      setActivePage({ id: "bracket" });
      return;
    }

    setActivePage({ id: "matchPlanning" });
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
      case "inbox":
        break;
      case "squad":
        setActivePage({ id: "squad" });
        break;
      case "training":
        setActivePage(career ? { id: "season" } : { id: "setup" });
        break;
      case "calendar":
        setActivePage(career ? { id: "calendar" } : { id: "games" });
        break;
      case "competitions":
        setActivePage(career ? { id: "calendar" } : tournament ? { id: "bracket" } : { id: "games" });
        break;
      case "tactics":
        setActivePage(career && phase !== "match" ? { id: "matchPlanning" } : phase === "setup" ? { id: "setup" } : pageForPhase(phase));
        break;
      case "live":
        openCareerLiveRoute();
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
    return [
      {
        id: "portal",
        group: "Core",
        label: career ? "Portal" : "Start",
        short: career ? "POR" : "STA",
        description: career ? "Career command center" : "Start screen",
        onActivate: () => activateCommand("portal")
      },
      {
        id: "inbox",
        group: "Core",
        label: "Inbox",
        short: "INB",
        description: "Task feed preview",
        disabled: true,
        preview: true,
        onActivate: () => activateCommand("inbox")
      },
      {
        id: "squad",
        group: "Program",
        label: "Squad",
        short: "SQU",
        description: career ? "Inspect locked athlete" : "Browse athletes",
        onActivate: () => activateCommand("squad")
      },
      {
        id: "training",
        group: "Program",
        label: "Training",
        short: "TRN",
        description: career ? "Load and recovery" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("training")
      },
      {
        id: "calendar",
        group: "Program",
        label: "Calendar",
        short: "CAL",
        description: career ? "Date and readiness" : "Career calendar",
        onActivate: () => activateCommand("calendar")
      },
      {
        id: "competitions",
        group: "Program",
        label: "Competitions",
        short: "CMP",
        description: tournament ? "Active bracket" : career ? "Event entries" : "Quick tournament",
        onActivate: () => activateCommand("competitions")
      },
      {
        id: "tactics",
        group: "Match",
        label: "Tactics",
        short: "TAC",
        description: career ? "Advanced match plan" : "Quick tactic setup",
        onActivate: () => activateCommand("tactics")
      },
      {
        id: "live",
        group: "Match",
        label: "Live Match",
        short: "LIV",
        description: phase === "match" ? "Point control" : career?.stage === "pre_match" ? "Opponent briefing" : "Plan first",
        onActivate: () => activateCommand("live")
      },
      {
        id: "reports",
        group: "Match",
        label: "Reports",
        short: "REP",
        description: career?.lastMatchReport ? "Post-match evidence" : "Report pending",
        disabled: !career?.lastMatchReport,
        onActivate: () => activateCommand("reports")
      },
      {
        id: "scouting",
        group: "Operations",
        label: "Scouting",
        short: "SCT",
        description: career ? "Assignments and reports" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("scouting")
      },
      {
        id: "staff",
        group: "Operations",
        label: "Staff",
        short: "STF",
        description: career ? "Staff and promises" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("staff")
      },
      {
        id: "facilities",
        group: "Operations",
        label: "Facilities",
        short: "FAC",
        description: career ? "Infrastructure" : "Career required",
        disabled: !career,
        onActivate: () => activateCommand("facilities")
      },
      {
        id: "saveManager",
        group: "System",
        label: "Save Manager",
        short: "SAV",
        description: activeSavePresent ? "Active slot online" : "Import/export",
        onActivate: () => activateCommand("saveManager")
      },
      {
        id: "settings",
        group: "System",
        label: "Settings",
        short: "SET",
        description: "Preferences overlay",
        onActivate: () => activateCommand("settings")
      }
    ];
  }

  function handleShellContinue() {
    if (canAdvanceCareerDate(career, phase)) {
      handleAdvanceCareerDay();
      return;
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
      onOpenCalendar: () => setActivePage({ id: "calendar" }),
      onOpenHome: () => setActivePage({ id: "home" }),
      onOpenLiveMatch: openCareerLiveRoute,
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
      onApplyTraining: applyCareerTraining,
      onEnterEvent: enterCareerEvent,
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
        />
      );
    }

    if (activePage.id === "saveManager") {
      return (
        <SaveManagerView
          activeSavePresent={activeSavePresent}
          corruptSavePresent={corruptSavePresent}
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
          tournament={tournament}
          liveMatchSession={liveMatch?.session}
          onBack={() => setActivePage(pageForPhase(phase))}
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

    if (activePage.id === "season") {
      return <CareerTrainingPage {...careerPageProps} />;
    }

    if (activePage.id === "calendar") {
      return <CareerCalendarPage {...careerPageProps} />;
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
  const shellDate = career?.date ?? "Local slot";
  const saveStatus = activeSavePresent
    ? career
      ? "Career save"
      : "Quick save"
    : corruptSavePresent
      ? "Recovery available"
      : "No active save";
  const careerCanAdvanceDate = canAdvanceCareerDate(career, phase);
  const continueLabel = career
    ? phase === "match"
      ? "Resume Match"
      : careerCanAdvanceDate
        ? "Advance Day"
        : career.stage === "post_match"
          ? "Review Match"
          : career.stage === "pre_match"
            ? "Open Live Desk"
            : "Continue Career"
    : activeSavePresent
      ? "Continue Save"
      : "Start";

  return (
    <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
      <div
        className={sidebarCollapsed ? "command-shell command-shell-sidebar-collapsed" : "command-shell"}
        data-accent={themeAccent}
      >
        <TopStatusBar
          activeAthleteName={activeAthlete.name}
          continueLabel={continueLabel}
          dateLabel={shellDate}
          saveStatus={saveStatus}
          onContinue={handleShellContinue}
          onOpenIntel={() => setIntelOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="workspace-shell" style={workspaceStyle}>
          <CommandSidebar
            activeAthlete={activeAthlete}
            activeCommandId={activeCommandId}
            canEnterManagedMatch={canEnterManagedMatch}
            commands={shellCommands}
            collapsed={sidebarCollapsed}
            phaseLabel={career ? career.stage.replace("_", " ") : phase}
            selectedTacticLabel={selectedTactic.label}
            onChooseTactic={chooseTactic}
            onOpenPlayerProfile={() => openPlayerProfile(activeAthlete.id)}
            onResizeStart={beginSidebarResize}
            onStartManagedMatch={handleStartManagedMatch}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            plannedTacticKey={plannedTacticKey}
          />

          <PageCanvas>{renderPage()}</PageCanvas>
        </div>

        <OverlayHost>
          <TacticalIntelPanel
            open={intelOpen}
            phase={phase}
            selectedPlayerId={selectedPlayerId}
            plannedTacticKey={plannedTacticKey}
            tournament={tournament}
            liveMatch={liveMatch}
            onClose={() => setIntelOpen(false)}
          />

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
        }}
      />
        </OverlayHost>
      </div>
    </PlayerNavigationProvider>
  );
}

function TopStatusBar(props: {
  activeAthleteName: string;
  continueLabel: string;
  dateLabel: string;
  saveStatus: string;
  onContinue: () => void;
  onOpenIntel: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand-block">
        <span className="brand-mark">BM</span>
        <label className="command-search">
          <span>Command</span>
          <input aria-label="Search or go to command" placeholder="Search or go to..." readOnly />
        </label>
      </div>

      <div className="topbar-status" aria-label="Career and save status">
        <span>{props.dateLabel}</span>
        <span>{props.saveStatus}</span>
        <span>{props.activeAthleteName}</span>
      </div>

      <div className="topbar-actions">
        <button className="icon-command-button" type="button" onClick={props.onOpenIntel}>
          Intel
        </button>
        <button className="icon-command-button" type="button" onClick={props.onOpenSettings}>
          Settings
        </button>
        <button className="command-button command-button-primary topbar-continue" type="button" onClick={props.onContinue}>
          {props.continueLabel}
        </button>
      </div>
    </header>
  );
}

function CommandSidebar(props: {
  activeAthlete: { id: string; name: string; nationality: string; styleLabel: string };
  activeCommandId: CommandId;
  canEnterManagedMatch: boolean;
  collapsed: boolean;
  commands: ShellCommand[];
  phaseLabel: string;
  selectedTacticLabel: string;
  plannedTacticKey: string;
  onChooseTactic: (tacticKey: (typeof tacticOptions)[number]["key"]) => void;
  onOpenPlayerProfile: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onStartManagedMatch: () => void;
  onToggleCollapsed: () => void;
}) {
  const activeCommand = props.commands.find((command) => command.id === props.activeCommandId);

  return (
    <aside className="sidebar command-sidebar" aria-label="Primary command sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">BM</div>
        <div>
          <h2>Command Rail</h2>
          <p>Local-first career shell</p>
        </div>
        <button
          className="sidebar-collapse-button"
          type="button"
          aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!props.collapsed}
          onClick={props.onToggleCollapsed}
        >
          {props.collapsed ? ">" : "<"}
        </button>
      </div>

      <nav className="sidenav command-groups" aria-label="Primary commands">
        {commandGroupOrder.map((group) => (
          <section className="command-group" key={group} aria-labelledby={`command-group-${group}`}>
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
                      data-short={command.short}
                      disabled={command.disabled}
                      aria-current={active ? "page" : undefined}
                      aria-label={`${command.label}${command.preview ? " preview" : ""}: ${command.description}`}
                      title={`${command.label}: ${command.description}`}
                      onClick={command.onActivate}
                    >
                      <span>{command.label}</span>
                      {command.preview && <small>Preview</small>}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </nav>

      <div className="sidebar-options" aria-label="Active command context">
        <span className="sidebar-caption">Active Command</span>
        <div className="sidebar-option-stack">
          <strong>{activeCommand?.label ?? "Portal"}</strong>
          <span>{activeCommand?.description ?? "Career command center"}</span>
          <span>State: {props.phaseLabel}</span>
          {props.canEnterManagedMatch && (
            <button className="sidebar-mini-button" type="button" onClick={props.onStartManagedMatch}>
              Go Live
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-options sidebar-tactic-stack" aria-label="Quick tactic controls">
        <span className="sidebar-caption">Tactic</span>
        <div className="sidebar-option-stack">
          <strong>{props.selectedTacticLabel}</strong>
          <div className="sidebar-option-list">
            {tacticOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={
                  props.plannedTacticKey === option.key
                    ? "sidebar-mini-button sidebar-mini-button-active"
                    : "sidebar-mini-button"
                }
                aria-pressed={props.plannedTacticKey === option.key}
                onClick={() => props.onChooseTactic(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-athlete">
        <span className="sidebar-caption">Managed Athlete</span>
        <button className="profile-name-button" type="button" onClick={props.onOpenPlayerProfile}>
          {props.activeAthlete.name}
        </button>
        <span>
          {props.activeAthlete.nationality} - {props.activeAthlete.styleLabel}
        </span>
      </div>

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
  return <main className="main-canvas">{props.children}</main>;
}

function OverlayHost(props: { children: ReactNode }) {
  return <div className="overlay-host">{props.children}</div>;
}
