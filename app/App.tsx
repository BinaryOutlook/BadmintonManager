import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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
import { useTournamentStore } from "../game/store/store";
import type { PersistedSave } from "../game/store/save";
import { isPhaseBoundPage, pageForPhase, type AppPage } from "./pages";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { SquadPage } from "./pages/SquadPage";
import { PlayerNavigationProvider } from "./playerNavigation";

type SidebarPanel = "command" | "tactics" | "athletes" | "events" | "saves" | "settings";
type TopMode = "LIVE" | "SQUAD" | "CAREER" | "BRACKETS" | "SAVES";
type PendingConfirm = "resetSession" | "startTournamentReplaceCareer" | "startCareerReplaceSave";
type CareerRouteKey =
  | "home"
  | "training"
  | "calendar"
  | "matchPlanning"
  | "liveMatch"
  | "postMatch"
  | "saveManager";

const THEME_STORAGE_KEY = "badminton-manager-theme-accent";
const SIDEBAR_WIDTH_STORAGE_KEY = "sidebarWidth";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebarCollapsed";
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 340;
const SIDEBAR_COLLAPSED_WIDTH = 64;

const sideNavItems: Array<{ key: SidebarPanel; label: string; short: string }> = [
  { key: "command", label: "Command", short: "CMD" },
  { key: "tactics", label: "Tactics", short: "TAC" },
  { key: "athletes", label: "Athletes", short: "ATH" },
  { key: "events", label: "Events", short: "EVT" },
  { key: "saves", label: "Saves", short: "SAV" },
  { key: "settings", label: "Settings", short: "SET" }
];

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

function topModeForPage(page: AppPage, fallback: TopMode, hasCareer: boolean): TopMode {
  switch (page.id) {
    case "setup":
    case "squad":
    case "playerProfile":
      return "SQUAD";
    case "liveMatch":
      return "LIVE";
    case "saveManager":
      return "SAVES";
    case "home":
    case "season":
    case "calendar":
    case "program":
    case "rivals":
    case "matchPlanning":
    case "facilities":
    case "media":
    case "scouting":
    case "recruitment":
    case "youth":
    case "staff":
    case "promises":
      return "CAREER";
    case "bracket":
    case "review":
      return hasCareer ? "CAREER" : "BRACKETS";
    case "games":
      return "BRACKETS";
    default:
      return fallback;
  }
}

function careerRouteKeyForPage(page: AppPage, phase: string, hasCareer: boolean): CareerRouteKey | null {
  if (page.id === "saveManager") {
    return "saveManager";
  }

  if (!hasCareer) {
    return null;
  }

  if (page.id === "season") {
    return "training";
  }

  if (page.id === "calendar" || page.id === "games") {
    return "calendar";
  }

  if (page.id === "matchPlanning") {
    return "matchPlanning";
  }

  if (page.id === "liveMatch" || phase === "match") {
    return "liveMatch";
  }

  if (page.id === "review") {
    return "postMatch";
  }

  if (page.id === "bracket") {
    return "liveMatch";
  }

  if (page.id === "home") {
    return "home";
  }

  return null;
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
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("command");
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(loadThemeAccent);
  const selectedPlayer = playerMap[selectedPlayerId];
  const phaseTopMode = phase === "match" ? "LIVE" : phase === "setup" ? "SQUAD" : "BRACKETS";
  const topMode = topModeForPage(activePage, phaseTopMode, Boolean(career));
  const selectedTactic =
    tacticOptions.find((option) => option.key === plannedTacticKey) ?? tacticOptions[0];
  const canEnterManagedMatch = phase === "overview" && Boolean(tournament);
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
    setSidebarPanel("athletes");
  }

  function requestReset() {
    setSettingsOpen(false);
    setPendingConfirm("resetSession");
  }

  function confirmReset() {
    reset();
    setActivePage({ id: "setup" });
    setSidebarPanel("command");
  }

  function performStartTournament() {
    startTournament();
    setActivePage({ id: "bracket" });
    setSidebarPanel("events");
  }

  function requestStartTournament() {
    if (career) {
      setPendingConfirm("startTournamentReplaceCareer");
      return;
    }

    performStartTournament();
  }

  function performStartCareer() {
    startCareer();
    setActivePage({ id: "home" });
    setSidebarPanel("command");
  }

  function requestStartCareer() {
    if (career || tournament || liveMatch) {
      setPendingConfirm("startCareerReplaceSave");
      return;
    }

    performStartCareer();
  }

  function confirmPendingAction() {
    if (pendingConfirm === "resetSession") {
      confirmReset();
    }

    if (pendingConfirm === "startTournamentReplaceCareer") {
      performStartTournament();
    }

    if (pendingConfirm === "startCareerReplaceSave") {
      performStartCareer();
    }

    setPendingConfirm(null);
  }

  function openSaveManager() {
    setSettingsOpen(false);
    setActivePage({ id: "saveManager" });
    setSidebarPanel("saves");
  }

  function continueLocalSave() {
    if (career?.stage === "post_match") {
      setActivePage({ id: "review" });
    } else if (career?.stage === "pre_match") {
      setActivePage({ id: "bracket" });
    } else if (career) {
      setActivePage({ id: "home" });
    } else {
      setActivePage(pageForPhase(phase));
    }

    setSidebarPanel(career ? "command" : "events");
  }

  function continueCareer() {
    if (!career) {
      return;
    }

    setActivePage(career.stage === "post_match" ? { id: "review" } : career.stage === "pre_match" ? { id: "bracket" } : { id: "home" });
    setSidebarPanel("command");
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
    setSidebarPanel(next.career ? "command" : "events");
  }

  function handleDeleteActiveSave() {
    deleteActiveSave();
    setActivePage({ id: "setup" });
    setSidebarPanel("command");
  }

  function handleAdvanceCareerDay() {
    advanceCareerDay();
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "calendar" });
    setSidebarPanel("events");
  }

  function handleContinueCareerAfterPostMatch() {
    continueCareerAfterPostMatch();
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "home" });
    setSidebarPanel("command");
  }

  function handleStartManagedMatch() {
    startManagedMatch();
    setActivePage({ id: "liveMatch" });
    setSidebarPanel("command");
  }

  function openCareerLiveRoute() {
    if (phase === "match") {
      setActivePage({ id: "liveMatch" });
      setSidebarPanel("command");
      return;
    }

    if (career?.stage === "pre_match") {
      setActivePage({ id: "bracket" });
      setSidebarPanel("command");
      return;
    }

    setActivePage({ id: "matchPlanning" });
    setSidebarPanel("tactics");
  }

  function openCareerPostMatchRoute() {
    setActivePage({ id: "review" });
    setSidebarPanel("command");
  }

  function handleAdvanceAfterMatch() {
    advanceAfterMatch();
    const next = useTournamentStore.getState();
    setActivePage(next.career?.stage === "post_match" ? { id: "review" } : pageForPhase(next.phase));
  }

  function activateTopMode(mode: TopMode) {
    if (mode === "SQUAD") {
      setActivePage({ id: "squad" });
      setSidebarPanel("athletes");
      return;
    }

    if (mode === "LIVE") {
      setActivePage(phase === "match" ? { id: "liveMatch" } : pageForPhase(phase));
      setSidebarPanel("command");
      return;
    }

    if (mode === "CAREER") {
      setActivePage(career ? { id: "home" } : { id: "games" });
      setSidebarPanel(career ? "command" : "events");
      return;
    }

    if (mode === "SAVES") {
      openSaveManager();
      return;
    }

    setActivePage(career ? { id: "home" } : pageForPhase(phase));
    setSidebarPanel("events");
  }

  function activateSidebarPanel(panel: SidebarPanel) {
    setSidebarPanel(panel);

    switch (panel) {
      case "command":
        setActivePage(career && phase !== "match" ? { id: "home" } : pageForPhase(phase));
        break;
      case "tactics":
        setActivePage(career && phase !== "match" ? { id: "matchPlanning" } : phase === "setup" ? { id: "setup" } : pageForPhase(phase));
        break;
      case "athletes":
        setActivePage({ id: "squad" });
        break;
      case "events":
        setActivePage(career ? { id: "calendar" } : tournament ? { id: "bracket" } : { id: "games" });
        break;
      case "saves":
        setActivePage({ id: "saveManager" });
        break;
      case "settings":
        setSettingsOpen(true);
        break;
    }
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
      saveRecovery,
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
      onApplyTraining: applyCareerTraining,
      onEnterEvent: enterCareerEvent,
      onAdvanceDay: handleAdvanceCareerDay,
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
          onStartNewCareer={requestStartCareer}
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
          selectedPlayerId={selectedPlayerId}
          phase={phase}
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
          selectedPlayerId={selectedPlayerId}
          phase={phase}
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
          selectedPlayerId={selectedPlayerId}
          plannedTacticKey={plannedTacticKey}
          onSelectPlayer={selectPlayer}
          onOpenPlayerProfile={openPlayerProfile}
          onChooseTactic={chooseTactic}
          onStartTournament={requestStartTournament}
          onStartCareer={requestStartCareer}
          onOpenSaveManager={openSaveManager}
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

  function openCareerRoute(route: CareerRouteKey) {
    switch (route) {
      case "home":
        setActivePage({ id: "home" });
        setSidebarPanel("command");
        break;
      case "training":
        setActivePage({ id: "season" });
        setSidebarPanel("command");
        break;
      case "calendar":
        setActivePage({ id: "calendar" });
        setSidebarPanel("events");
        break;
      case "matchPlanning":
        setActivePage({ id: "matchPlanning" });
        setSidebarPanel("tactics");
        break;
      case "liveMatch":
        openCareerLiveRoute();
        break;
      case "postMatch":
        openCareerPostMatchRoute();
        break;
      case "saveManager":
        openSaveManager();
        break;
    }
  }

  function renderCareerRouteChrome() {
    const activeCareerRoute = careerRouteKeyForPage(activePage, phase, Boolean(career));

    if (!career && activePage.id !== "saveManager") {
      return null;
    }

    const athlete = career ? playerMap[career.program.managedPlayerId] : selectedPlayer;
    const routeItems: Array<{ key: CareerRouteKey; label: string; contract: string; disabled?: boolean }> = [
      { key: "home", label: "Career Home", contract: "management map", disabled: !career },
      { key: "training", label: "Training", contract: "load and recovery", disabled: !career },
      { key: "calendar", label: "Calendar / Event Desk", contract: "entry and date control", disabled: !career },
      { key: "matchPlanning", label: "Match Planning", contract: "tactic plan", disabled: !career },
      {
        key: "liveMatch",
        label: career?.stage === "pre_match" ? "Pre-Match / Live" : "Live Match",
        contract: phase === "match" ? "point control" : career?.stage === "pre_match" ? "opponent briefing" : "plan first",
        disabled: !career
      },
      {
        key: "postMatch",
        label: "Post-Match Review",
        contract: career?.lastMatchReport ? "evidence review" : "report pending",
        disabled: !career
      },
      { key: "saveManager", label: "Save Manager", contract: "local slot trust" }
    ];

    return (
      <section className="career-route-chrome" aria-label="Career workspace navigation">
        <div className="career-route-summary">
          <span>Career route</span>
          <strong>{routeItems.find((item) => item.key === activeCareerRoute)?.label ?? "Save Manager"}</strong>
          <small>
            {career
              ? `${career.date} / ${athlete.name} / ${career.stage.replace("_", " ")}`
              : activeSavePresent
                ? "Local save controls"
                : "No active local career"}
          </small>
        </div>
        <div className="career-route-tabs" role="group" aria-label="Career route family">
          {routeItems.map((item) => (
            <button
              key={item.key}
              className={
                item.key === activeCareerRoute
                  ? "career-route-tab career-route-tab-active"
                  : "career-route-tab"
              }
              type="button"
              disabled={item.disabled}
              aria-label={`Career route ${item.key}`}
              aria-current={item.key === activeCareerRoute ? "page" : undefined}
              onClick={() => openCareerRoute(item.key)}
            >
              <span>{item.label}</span>
              <small>{item.contract}</small>
            </button>
          ))}
        </div>
        <button className="command-button command-button-secondary career-route-reset" type="button" onClick={requestReset}>
          New Session
        </button>
      </section>
    );
  }

  return (
    <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
      <div
        className={sidebarCollapsed ? "command-shell command-shell-sidebar-collapsed" : "command-shell"}
        data-accent={themeAccent}
      >
      <header className="topbar">
        <div className="brand-row">
          <span className="brand-mark">SMASH_COMMAND</span>
          <nav className="topnav" aria-label="Primary">
            {(["LIVE", "SQUAD", "CAREER", "BRACKETS", "SAVES"] as TopMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={topMode === mode ? "nav-pill nav-pill-active" : "nav-pill"}
                aria-current={topMode === mode ? "page" : undefined}
                onClick={() => activateTopMode(mode)}
              >
                {mode}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-actions">
          <button className="command-button command-button-secondary" onClick={() => setIntelOpen(true)}>
            TACTICAL_INTEL
          </button>
          <button className="command-button command-button-secondary" onClick={() => setSettingsOpen(true)}>
            SETTINGS
          </button>
          <button className="command-button command-button-secondary" onClick={openSaveManager}>
            SAVE_MANAGER
          </button>
        </div>
      </header>

      <div className="workspace-shell" style={workspaceStyle}>
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">BM</div>
            <div>
              <h2>STRATEGIST_HUB</h2>
              <p>Local-first coaching console</p>
            </div>
            <button
              className="sidebar-collapse-button"
              type="button"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>

          <button className="command-button command-button-secondary sidebar-reset" onClick={requestReset}>
            NEW_SESSION
          </button>

          <nav className="sidenav" aria-label="Section">
            {sideNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={
                  sidebarPanel === item.key ? "sidenav-item sidenav-item-active" : "sidenav-item"
                }
                aria-pressed={sidebarPanel === item.key}
                data-short={item.short}
                onClick={() => activateSidebarPanel(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-options">
            <span className="sidebar-caption">Console Options</span>
            {sidebarPanel === "command" && (
              <div className="sidebar-option-stack">
                <strong>{phase === "match" ? "Live Desk" : "Match Desk"}</strong>
                <span>
                  {phase === "match"
                    ? "Point control online"
                    : phase === "overview"
                      ? "Opponent scouted"
                      : phase === "complete"
                        ? "Run archived"
                        : "Deployment pending"}
                </span>
                {canEnterManagedMatch && (
                  <button className="sidebar-mini-button" type="button" onClick={handleStartManagedMatch}>
                    Go Live
                  </button>
                )}
              </div>
            )}

            {sidebarPanel === "tactics" && (
              <div className="sidebar-option-stack">
                <strong>{selectedTactic.label}</strong>
                <div className="sidebar-option-list">
                  {tacticOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={
                        plannedTacticKey === option.key
                          ? "sidebar-mini-button sidebar-mini-button-active"
                          : "sidebar-mini-button"
                      }
                      aria-pressed={plannedTacticKey === option.key}
                      onClick={() => chooseTactic(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sidebarPanel === "athletes" && (
              <div className="sidebar-option-stack">
                <strong>{selectedPlayer.name}</strong>
                <span>{phase === "setup" ? "Selection editable" : "Run athlete locked"}</span>
                <button
                  className="sidebar-mini-button"
                  type="button"
                  onClick={() => openPlayerProfile(selectedPlayer.id)}
                >
                  Open Profile
                </button>
              </div>
            )}

            {sidebarPanel === "events" && (
              <div className="sidebar-option-stack">
                <strong>{tournament?.name ?? "Event workspace"}</strong>
                <span>
                  {tournament
                    ? `${tournament.rounds.length} bracket stage${tournament.rounds.length === 1 ? "" : "s"} loaded`
                    : "Games page scaffold ready"}
                </span>
                <button
                  className="sidebar-mini-button"
                  type="button"
                  onClick={() => setActivePage(tournament ? { id: "bracket" } : { id: "games" })}
                >
                  {tournament ? "Open Bracket" : "Open Games"}
                </button>
              </div>
            )}

            {sidebarPanel === "saves" && (
              <div className="sidebar-option-stack">
                <strong>{activeSavePresent ? "Active slot online" : "No active slot"}</strong>
                <span>{corruptSavePresent ? "Quarantine backup present" : "Import/export desk ready"}</span>
                <button className="sidebar-mini-button" type="button" onClick={openSaveManager}>
                  Open Save Manager
                </button>
              </div>
            )}

            {sidebarPanel === "settings" && (
              <div className="sidebar-option-stack">
                <strong>Preferences</strong>
                <span>Theme and session controls live in one pop-up window.</span>
                <button className="sidebar-mini-button" type="button" onClick={() => setSettingsOpen(true)}>
                  Open Settings
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-athlete">
            <span className="sidebar-caption">Managed Athlete</span>
            <button
              className="profile-name-button"
              type="button"
              onClick={() => openPlayerProfile(selectedPlayer.id)}
            >
              {selectedPlayer.name}
            </button>
            <span>
              {selectedPlayer.nationality} · {selectedPlayer.styleLabel}
            </span>
          </div>
          <button
            className="sidebar-resize-handle"
            type="button"
            aria-label="Resize sidebar"
            onPointerDown={beginSidebarResize}
          />
        </aside>

        <main className="main-canvas">
          {renderCareerRouteChrome()}
          {renderPage()}
        </main>
      </div>

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
        onCancel={() => setPendingConfirm(null)}
      />
      </div>
    </PlayerNavigationProvider>
  );
}
