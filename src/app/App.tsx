import { MatchView } from "../components/MatchView";
import { OverviewView } from "../components/OverviewView";
import { SetupView } from "../components/SetupView";
import { playerMap } from "../game/content/players";
import { useTournamentStore } from "../game/store/store";

export function App() {
  const {
    phase,
    selectedPlayerId,
    plannedTacticKey,
    seed,
    tournament,
    liveMatch,
    selectPlayer,
    chooseTactic,
    startTournament,
    startManagedMatch,
    applyTalk,
    simulateNextSet,
    advanceAfterMatch,
    reset
  } = useTournamentStore();
  const selectedPlayer = playerMap[selectedPlayerId];

  return (
    <div className="app-shell">
      <div className="backdrop-glow backdrop-glow-left" />
      <div className="backdrop-glow backdrop-glow-right" />

      <header className="hero-panel">
        <p className="eyebrow">Option A Local-First Build</p>
        <h1>Badminton Manager</h1>
        <p className="hero-copy">
          A commentary-first singles tournament sim where you coach from the
          sideline, tune tactics before the match, and intervene between sets.
        </p>
        <div className="hero-meta">
          <span>Current athlete: {selectedPlayer.name}</span>
          <span>Seed: {seed}</span>
          <span>Phase: {phase}</span>
        </div>
      </header>

      <main>
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
            onApplyTalk={applyTalk}
            onSimulateNextSet={simulateNextSet}
            onAdvanceAfterMatch={advanceAfterMatch}
          />
        )}

        {phase === "complete" && tournament && (
          <section className="phase-layout">
            <div className="phase-header">
              <div>
                <p className="eyebrow">Run Complete</p>
                <h2>
                  {tournament.championId === selectedPlayerId
                    ? `${selectedPlayer.name} takes the title.`
                    : `${selectedPlayer.name} exits the draw.`}
                </h2>
                <p className="section-copy">
                  {tournament.championId === selectedPlayerId
                    ? "The bracket held, the tactic plan landed, and the athlete survived the pressure moments."
                    : "The tournament is over, but the engine and bracket state are still visible for review."}
                </p>
              </div>
              <button className="primary-button" onClick={reset}>
                Start new run
              </button>
            </div>

            <OverviewView
              tournament={tournament}
              selectedPlayerId={selectedPlayerId}
              plannedTacticKey={plannedTacticKey}
              onChooseTactic={chooseTactic}
              onReset={reset}
            />
          </section>
        )}
      </main>
    </div>
  );
}
