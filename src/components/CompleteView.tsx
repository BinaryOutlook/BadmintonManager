import { playerMap } from "../game/content/players";
import { summarizeRun } from "../game/core/intel";
import type { TournamentState } from "../game/tournament/tournament";

interface CompleteViewProps {
  tournament: TournamentState;
  selectedPlayerId: string;
  onReset: () => void;
}

export function CompleteView(props: CompleteViewProps) {
  const selectedPlayer = playerMap[props.selectedPlayerId];
  const summary = summarizeRun(props.tournament, selectedPlayer);

  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Brackets</p>
          <h1 className="screen-title">{summary.headline}</h1>
          <p className="screen-copy">{summary.summary}</p>
        </div>
        <button className="command-button command-button-primary" onClick={props.onReset}>
          Start New Session
        </button>
      </div>

      <div className="complete-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Tournament Path</h2>
            <span>{props.tournament.championId === props.selectedPlayerId ? "Final stage reached" : "Run closed"}</span>
          </div>

          <div className="path-grid">
            {props.tournament.managedResults.map((result) => (
              <article key={`${result.round}-${result.opponentId}`} className="path-card">
                <span>{result.round}</span>
                <strong>{result.opponentName}</strong>
                <small>{result.scoreline}</small>
                <em>{result.won ? "Won" : "Eliminated"}</em>
              </article>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Run Telemetry</h2>
            <span>{selectedPlayer.name}</span>
          </div>

          <div className="recap-stat-list">
            {summary.telemetry.map((entry) => (
              <div key={entry.label} className="recap-stat-row">
                <span>{entry.label}</span>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
