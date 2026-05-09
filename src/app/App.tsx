import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { CompleteView } from "../components/CompleteView";
import { ConfirmOverlay } from "../components/ConfirmOverlay";
import { MatchView } from "../components/MatchView";
import { OverviewView } from "../components/OverviewView";
import { SettingsOverlay, type ThemeAccent } from "../components/SettingsOverlay";
import { SetupView } from "../components/SetupView";
import { TacticalIntelPanel } from "../components/TacticalIntelPanel";
import { playerMap } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { useTournamentStore } from "../game/store/store";
import { isPhaseBoundPage, pageForPhase, type AppPage } from "./pages";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { SquadPage } from "./pages/SquadPage";
import { PlayerNavigationProvider } from "./playerNavigation";

type SidebarPanel = "command" | "tactics" | "athletes" | "events" | "settings";
type TopMode = "LIVE" | "SQUAD" | "BRACKETS";

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

function topModeForPage(page: AppPage, fallback: TopMode): TopMode {
  switch (page.id) {
    case "setup":
    case "squad":
    case "playerProfile":
      return "SQUAD";
    case "liveMatch":
      return "LIVE";
    case "bracket":
    case "review":
    case "games":
    case "season":
    case "calendar":
    case "home":
      return "BRACKETS";
    default:
      return fallback;
  }
}

function FeaturePlaceholder(props: { title: string; kicker: string; copy: string; onBack: () => void }) {
  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">{props.kicker}</p>
          <h1 className="screen-title">{props.title}</h1>
          <p className="screen-copy">{props.copy}</p>
        </div>
        <button className="command-button command-button-secondary" type="button" onClick={props.onBack}>
          Back To Current Run
        </button>
      </div>
      <section className="command-panel">
        <div className="panel-header">
          <h2>Scaffold</h2>
          <span>v0.2.4 framework</span>
        </div>
        <p className="panel-summary">
          This workspace now has a page home. The season and event simulation underneath it will be
          filled in after the UI framework stops everything from competing in one console.
        </p>
      </section>
    </section>
  );
}

export function App() {
  const {
    phase,
    selectedPlayerId,
    plannedTacticKey,
    tournament,
    liveMatch,
    selectPlayer,
    chooseTactic,
    startTournament,
    startManagedMatch,
    applyDirective,
    applyTalk,
    simulateNextPoint,
    advanceAfterMatch,
    reset
  } = useTournamentStore();
  const [activePage, setActivePage] = useState<AppPage>(() => pageForPhase(phase));
  const [intelOpen, setIntelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("command");
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(loadThemeAccent);
  const selectedPlayer = playerMap[selectedPlayerId];
  const phaseTopMode = phase === "match" ? "LIVE" : phase === "setup" ? "SQUAD" : "BRACKETS";
  const topMode = topModeForPage(activePage, phaseTopMode);
  const selectedTactic =
    tacticOptions.find((option) => option.key === plannedTacticKey) ?? tacticOptions[0];
  const canEnterManagedMatch = phase === "overview" && Boolean(tournament);
  const workspaceStyle = {
    "--sidebar-width": `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px`
  } as CSSProperties;

  useEffect(() => {
    setActivePage((currentPage) => {
      if (!isPhaseBoundPage(currentPage)) {
        return currentPage;
      }

      return pageForPhase(phase);
    });
  }, [phase]);

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
    setConfirmResetOpen(true);
  }

  function confirmReset() {
    reset();
    setConfirmResetOpen(false);
    setActivePage({ id: "setup" });
    setSidebarPanel("command");
  }

  function handleStartTournament() {
    startTournament();
    setActivePage({ id: "bracket" });
    setSidebarPanel("events");
  }

  function handleStartManagedMatch() {
    startManagedMatch();
    setActivePage({ id: "liveMatch" });
    setSidebarPanel("command");
  }

  function handleAdvanceAfterMatch() {
    advanceAfterMatch();
    setActivePage(pageForPhase(useTournamentStore.getState().phase));
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

    setActivePage(pageForPhase(phase));
    setSidebarPanel("events");
  }

  function activateSidebarPanel(panel: SidebarPanel) {
    setSidebarPanel(panel);

    switch (panel) {
      case "command":
        setActivePage(pageForPhase(phase));
        break;
      case "tactics":
        setActivePage(phase === "setup" ? { id: "setup" } : pageForPhase(phase));
        break;
      case "athletes":
        setActivePage({ id: "squad" });
        break;
      case "events":
        setActivePage(tournament ? { id: "bracket" } : { id: "games" });
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
      return (
        <FeaturePlaceholder
          kicker="Events"
          title="Games Workspace"
          copy="Event selection is getting its own page home before the season model grows larger."
          onBack={() => setActivePage(pageForPhase(phase))}
        />
      );
    }

    if (activePage.id === "season") {
      return (
        <FeaturePlaceholder
          kicker="Season"
          title="Season Hub"
          copy="The season page is reserved for multi-event progression, records, and event queues."
          onBack={() => setActivePage(pageForPhase(phase))}
        />
      );
    }

    if (activePage.id === "calendar") {
      return (
        <FeaturePlaceholder
          kicker="Calendar"
          title="Calendar"
          copy="Calendar structure will share event definitions with Games and Season once event data lands."
          onBack={() => setActivePage(pageForPhase(phase))}
        />
      );
    }

    if (phase === "setup") {
      return (
        <SetupView
          selectedPlayerId={selectedPlayerId}
          plannedTacticKey={plannedTacticKey}
          onSelectPlayer={selectPlayer}
          onOpenPlayerProfile={openPlayerProfile}
          onChooseTactic={chooseTactic}
          onStartTournament={handleStartTournament}
        />
      );
    }

    if (phase === "overview" && tournament) {
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
            {(["LIVE", "SQUAD", "BRACKETS"] as TopMode[]).map((mode) => (
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

        <main className="main-canvas">{renderPage()}</main>
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
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmOverlay
        open={confirmResetOpen}
        title="Start a new session?"
        message="This clears the current local tournament run and returns the app to athlete selection."
        confirmLabel="Start New Session"
        onConfirm={confirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
      </div>
    </PlayerNavigationProvider>
  );
}
