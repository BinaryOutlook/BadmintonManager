import { useState } from "react";
import { CompleteView } from "../components/CompleteView";
import { MatchView } from "../components/MatchView";
import { OverviewView } from "../components/OverviewView";
import { SetupView } from "../components/SetupView";
import { TacticalIntelPanel } from "../components/TacticalIntelPanel";
import { playerMap } from "../game/content/players";
import { useTournamentStore } from "../game/store/store";

export function App() {
  const [intelOpen, setIntelOpen] = useState(false);
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

  return (
    <div className="command-shell">
      <header className="topbar">
        <div className="brand-row">
          <span className="brand-mark">SMASH_COMMAND</span>
          <nav className="topnav" aria-label="Primary">
            <span className={topMode === "LIVE" ? "nav-pill nav-pill-active" : "nav-pill"}>LIVE</span>
            <span className={topMode === "SQUAD" ? "nav-pill nav-pill-active" : "nav-pill"}>SQUAD</span>
            <span className={topMode === "BRACKETS" ? "nav-pill nav-pill-active" : "nav-pill"}>
              BRACKETS
            </span>
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
            <span className={phase === "match" ? "sidenav-item sidenav-item-active" : "sidenav-item"}>Command</span>
            <span className={phase === "setup" ? "sidenav-item sidenav-item-active" : "sidenav-item"}>Tactics</span>
            <span className="sidenav-item">Athletes</span>
            <span className={phase !== "setup" ? "sidenav-item sidenav-item-active" : "sidenav-item"}>Events</span>
            <span className="sidenav-item">Settings</span>
          </nav>

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
