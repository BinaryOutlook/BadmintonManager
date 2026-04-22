import { playerMap, seededPlayers } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { deriveThreatReport } from "../game/core/intel";
import type { TournamentState } from "../game/tournament/tournament";
import type { TacticKey } from "../game/store/store";

interface OverviewViewProps {
  tournament: TournamentState;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  onChooseTactic: (tacticKey: TacticKey) => void;
  onStartManagedMatch?: () => void;
  onReset: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function OverviewView(props: OverviewViewProps) {
  const selected =
    seededPlayers.find((entry) => entry.player.id === props.selectedPlayerId) ?? seededPlayers[0];
  const currentRound = props.tournament.rounds[props.tournament.currentRoundIndex];
  const managedMatch = currentRound.matches.find((match) => match.managed);
  const opponentId =
    managedMatch?.sideAId === props.selectedPlayerId ? managedMatch.sideBId : managedMatch?.sideAId;
  const opponent = opponentId ? playerMap[opponentId] : undefined;
  const threatReport = opponent ? deriveThreatReport(selected.player, opponent) : null;

  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">
            {props.tournament.name} - {props.tournament.tier}
          </p>
          <h1 className="screen-title">Tournament Command Center</h1>
          <p className="screen-copy">
            Quarter-by-quarter visibility on the bracket, the next opponent, and the tactic lock-in
            before the managed tie begins.
          </p>
        </div>
        <div className="screen-meta">
          <span>Round: {currentRound.name}</span>
          <span>Prize Pool: ${props.tournament.prizePoolUsd.toLocaleString()}</span>
        </div>
      </div>

      <div className="overview-grid-v2">
        <section className="command-panel">
          <div className="panel-header">
            <h2>Next Opponent</h2>
            <span className={`chip chip-threat-${threatReport?.level.toLowerCase() ?? "low"}`}>
              Threat: {threatReport?.level ?? "LOW"}
            </span>
          </div>

          {opponent ? (
            <>
              <div className="opponent-identity">
                <div className="dossier-avatar dossier-avatar-small">{initials(opponent.name)}</div>
                <div>
                  <h3>{opponent.name}</h3>
                  <p>
                    {opponent.nationality} · {opponent.styleLabel}
                  </p>
                </div>
              </div>

              <div className="dossier-metrics compact-metrics">
                {threatReport?.strengths.map((strength) => (
                  <div key={strength.label}>
                    <div className="metric-row">
                      <span>{strength.label}</span>
                      <strong>{strength.value}</strong>
                    </div>
                    <div className="metric-track">
                      <div
                        className={`metric-track-fill metric-track-fill-${strength.accent}`}
                        style={{ width: `${strength.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="panel-summary">{threatReport?.matchupSummary}</p>
            </>
          ) : (
            <p className="panel-summary">The bracket is waiting on your managed match result.</p>
          )}
        </section>

        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Tactic Lock-In</h2>
            <span>Enter the match with a clear identity</span>
          </div>

          <div className="tactic-option-grid tactic-option-grid-wide">
            {tacticOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`tactic-option-card ${
                  props.plannedTacticKey === option.key ? "tactic-option-card-active" : ""
                }`}
                aria-pressed={props.plannedTacticKey === option.key}
                onClick={() => props.onChooseTactic(option.key)}
              >
                <div className="tactic-option-top">
                  <span className={`accent-dot accent-dot-${option.accent}`} />
                  <span className="tactic-cue">{option.cue}</span>
                </div>
                <strong>{option.label}</strong>
                <p>{option.summary}</p>
              </button>
            ))}
          </div>

          <div className="match-launch-row">
            <div className="managed-chip">
              <span className="dossier-avatar dossier-avatar-tiny">{initials(selected.player.name)}</span>
              <div>
                <small>Your Athlete</small>
                <strong>{selected.player.name}</strong>
              </div>
            </div>

            <div className="match-launch-actions">
              <button className="command-button command-button-secondary" onClick={props.onReset}>
                Reset Run
              </button>
              {props.onStartManagedMatch && (
                <button className="command-button command-button-primary" onClick={props.onStartManagedMatch}>
                  Enter Match
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Knockout Tree</h2>
            <span>The managed lane stays highlighted as the tournament resolves</span>
          </div>

          <div className="bracket-columns">
            {props.tournament.rounds.map((round) => (
              <div key={round.name} className="bracket-round">
                <h3>{round.name}</h3>
                <div className="bracket-stack">
                  {round.matches.map((match) => {
                    const sideA = playerMap[match.sideAId];
                    const sideB = playerMap[match.sideBId];
                    const pendingManaged = match.managed && !match.completed;

                    return (
                      <article
                        key={match.id}
                        className={`bracket-card ${match.managed ? "bracket-card-managed" : ""}`}
                      >
                        <div className="bracket-row">
                          <span>{sideA.name}</span>
                          <span>
                            {match.completed && match.winnerId === sideA.id
                              ? "W"
                              : pendingManaged && sideA.id === props.selectedPlayerId
                                ? "UP NEXT"
                                : ""}
                          </span>
                        </div>
                        <div className="bracket-row">
                          <span>{sideB.name}</span>
                          <span>
                            {match.completed && match.winnerId === sideB.id
                              ? "W"
                              : pendingManaged && sideB.id === props.selectedPlayerId
                                ? "UP NEXT"
                                : pendingManaged
                                  ? "LIVE"
                                  : ""}
                          </span>
                        </div>
                        <small>{match.completed ? match.scoreline : "Managed match pending"}</small>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
