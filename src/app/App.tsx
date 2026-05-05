import { useState } from "react";
import { CompleteView } from "../components/CompleteView";
import { MatchView } from "../components/MatchView";
import { OverviewView } from "../components/OverviewView";
import { SetupView } from "../components/SetupView";
import { TacticalIntelPanel } from "../components/TacticalIntelPanel";
import { playerMap } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { useTournamentStore } from "../game/store/store";

type SidebarPanel = "command" | "tactics" | "athletes" | "events" | "settings";
type TopMode = "LIVE" | "SQUAD" | "BRACKETS";

const sideNavItems: Array<{ key: SidebarPanel; label: string }> = [
  { key: "command", label: "Command" },
  { key: "tactics", label: "Tactics" },
  { key: "athletes", label: "Athletes" },
  { key: "events", label: "Events" },
  { key: "settings", label: "Settings" }
];

function sidebarPanelForTopMode(mode: TopMode): SidebarPanel {
  if (mode === "LIVE") {
    return "command";
  }

  if (mode === "SQUAD") {
    return "athletes";
  }

  return "events";
}

export function App() {
  const [intelOpen, setIntelOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("command");
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
  const selectedPlayer = playerMap[selectedPlayerId];
  const topMode = phase === "match" ? "LIVE" : phase === "setup" ? "SQUAD" : "BRACKETS";
  const selectedTactic =
    tacticOptions.find((option) => option.key === plannedTacticKey) ?? tacticOptions[0];
  const canEnterManagedMatch = phase === "overview" && Boolean(tournament);

  function activateTopMode(mode: TopMode) {
    setSidebarPanel(sidebarPanelForTopMode(mode));
  }

  return (
    <div className="command-shell">
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
        </div>
      </header>

      <div className="workspace-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">BM</div>
            <div>
              <h2>STRATEGIST_HUB</h2>
              <p>Local-first coaching console</p>
            </div>
          </div>

          <button className="command-button command-button-secondary sidebar-reset" onClick={reset}>
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
                onClick={() => setSidebarPanel(item.key)}
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
                  <button className="sidebar-mini-button" type="button" onClick={startManagedMatch}>
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
              </div>
            )}

            {sidebarPanel === "events" && (
              <div className="sidebar-option-stack">
                <strong>{tournament?.name ?? "No active event"}</strong>
                <span>
                  {tournament
                    ? `${tournament.rounds.length} bracket stage${tournament.rounds.length === 1 ? "" : "s"} loaded`
                    : "Awaiting tournament start"}
                </span>
              </div>
            )}

            {sidebarPanel === "settings" && (
              <div className="sidebar-option-stack">
                <strong>Console</strong>
                <button className="sidebar-mini-button" type="button" onClick={() => setIntelOpen(true)}>
                  Tactical Intel
                </button>
                <button className="sidebar-mini-button" type="button" onClick={reset}>
                  New Session
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-athlete">
            <span className="sidebar-caption">Managed Athlete</span>
            <strong>{selectedPlayer.name}</strong>
            <span>
              {selectedPlayer.nationality} · {selectedPlayer.styleLabel}
            </span>
          </div>
        </aside>

        <main className="main-canvas">
          {phase === "setup" && (
            <SetupView
              selectedPlayerId={selectedPlayerId}
              plannedTacticKey={plannedTacticKey}
              onSelectPlayer={selectPlayer}
              onChooseTactic={chooseTactic}
              onStartTournament={startTournament}
            />
          )}

          {phase === "overview" && tournament && (
            <OverviewView
              tournament={tournament}
              selectedPlayerId={selectedPlayerId}
              plannedTacticKey={plannedTacticKey}
              onChooseTactic={chooseTactic}
              onStartManagedMatch={startManagedMatch}
              onReset={reset}
            />
          )}

          {phase === "match" && liveMatch && (
            <MatchView
              session={liveMatch.session}
              managedSide={liveMatch.managedSide}
              opponentName={liveMatch.opponentName}
              opponentTacticLabel={liveMatch.opponentTacticLabel}
              onApplyDirective={applyDirective}
              onApplyTalk={applyTalk}
              onSimulateNextPoint={simulateNextPoint}
              onAdvanceAfterMatch={advanceAfterMatch}
            />
          )}

          {phase === "complete" && tournament && (
            <CompleteView
              tournament={tournament}
              selectedPlayerId={selectedPlayerId}
              onReset={reset}
            />
          )}
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
    </div>
  );
}
