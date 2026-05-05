import { playerMap, seededPlayers } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { deriveAthleteDossier, deriveThreatReport } from "../game/core/intel";
import type { RoundName, TournamentState } from "../game/tournament/tournament";
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

const bracketRounds: Array<{ name: RoundName; label: string; matchCount: number }> = [
  { name: "R16", label: "Round of 16", matchCount: 8 },
  { name: "QF", label: "Quarter-Finals", matchCount: 4 },
  { name: "SF", label: "Semi-Finals", matchCount: 2 },
  { name: "F", label: "Final", matchCount: 1 }
];

const previousRoundName: Record<RoundName, RoundName | null> = {
  R16: null,
  QF: "R16",
  SF: "QF",
  F: "SF"
};

function placeholderLabel(
  tournament: TournamentState,
  roundName: RoundName,
  matchIndex: number,
  side: "A" | "B"
) {
  const previousRound = previousRoundName[roundName];

  if (!previousRound) {
    return `Seed slot ${matchIndex * 2 + (side === "A" ? 1 : 2)}`;
  }

  const sourceMatchIndex = matchIndex * 2 + (side === "A" ? 0 : 1);
  const sourceRound = tournament.rounds.find((entry) => entry.name === previousRound);
  const winnerId = sourceRound?.matches[sourceMatchIndex]?.winnerId;

  if (winnerId) {
    return playerMap[winnerId].name;
  }

  return `Winner ${previousRound}-${sourceMatchIndex + 1}`;
}

function gridRowForMatch(roundIndex: number, matchIndex: number) {
  const roundSize = 2 ** (roundIndex + 1);
  const rowStart = matchIndex * roundSize + 1 + Math.floor((roundSize - 2) / 2);

  return `${rowStart} / span 2`;
}

function overallFromDossier(dossier: ReturnType<typeof deriveAthleteDossier>) {
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
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
  const selectedDossier = deriveAthleteDossier(selected.player);
  const opponentDossier = opponent ? deriveAthleteDossier(opponent) : null;
  const selectedOverall = overallFromDossier(selectedDossier);
  const opponentOverall = opponentDossier ? overallFromDossier(opponentDossier) : 0;
  const comparisonMetrics = opponentDossier
    ? [
        { label: "Overall", managed: selectedOverall, opponent: opponentOverall },
        { label: "Power", managed: selectedDossier.power, opponent: opponentDossier.power },
        { label: "Speed", managed: selectedDossier.speed, opponent: opponentDossier.speed },
        { label: "Stamina", managed: selectedDossier.stamina, opponent: opponentDossier.stamina },
        { label: "Control", managed: selectedDossier.control, opponent: opponentDossier.control }
      ]
    : [];

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
        <section className="command-panel matchup-panel">
          <div className="panel-header">
            <h2>Next Opponent</h2>
            <span className={`chip chip-threat-${threatReport?.level.toLowerCase() ?? "low"}`}>
              Threat: {threatReport?.level ?? "LOW"}
            </span>
          </div>

          {opponent ? (
            <>
              <div className="matchup-grid" aria-label="Head to head comparison">
                <article className="matchup-competitor matchup-competitor-managed">
                  <div className="dossier-avatar dossier-avatar-small">{initials(selected.player.name)}</div>
                  <div>
                    <span className="matchup-side-label">Your Athlete</span>
                    <h3>{selected.player.name}</h3>
                    <p>
                      {selected.player.nationality} · {selected.player.styleLabel}
                    </p>
                  </div>
                  <strong className="matchup-overall">OVR {selectedOverall}</strong>
                </article>

                <div className="matchup-metrics">
                  {comparisonMetrics.map((metric) => {
                    const managedWidth = Math.max(8, metric.managed);
                    const opponentWidth = Math.max(8, metric.opponent);

                    return (
                      <div key={metric.label} className="matchup-metric">
                        <div className="matchup-metric-top">
                          <strong>{metric.managed}</strong>
                          <span>{metric.label}</span>
                          <strong>{metric.opponent}</strong>
                        </div>
                        <div className="matchup-bars">
                          <div className="matchup-bar matchup-bar-managed">
                            <span style={{ width: `${managedWidth}%` }} />
                          </div>
                          <div className="matchup-bar matchup-bar-opponent">
                            <span style={{ width: `${opponentWidth}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <article className="matchup-competitor matchup-competitor-opponent">
                  <div className="dossier-avatar dossier-avatar-small">{initials(opponent.name)}</div>
                  <div>
                    <span className="matchup-side-label">Opponent</span>
                    <h3>{opponent.name}</h3>
                    <p>
                      {opponent.nationality} · {opponent.styleLabel}
                    </p>
                  </div>
                  <strong className="matchup-overall">OVR {opponentOverall}</strong>
                </article>
              </div>

              <div className="matchup-key-grid">
                {threatReport?.strengths.map((strength) => (
                  <div key={strength.label} className="matchup-key-card">
                    <span>{strength.label}</span>
                    <strong>{strength.value}</strong>
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

        <section className="command-panel tactic-lock-panel">
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
            <span>Full binary path to the final</span>
          </div>

          <div className="bracket-tree" aria-label="Knockout tree">
            <div className="bracket-round-labels">
              {bracketRounds.map((roundSlot) => (
                <h3 key={roundSlot.name}>{roundSlot.label}</h3>
              ))}
            </div>

            <div className="bracket-match-grid">
              {bracketRounds.map((roundSlot, roundIndex) => {
                const round = props.tournament.rounds.find((entry) => entry.name === roundSlot.name);

                return Array.from({ length: roundSlot.matchCount }).map((_, matchIndex) => {
                      const match = round?.matches[matchIndex];
                      const nodeClassName = `bracket-node bracket-node-col-${roundIndex} ${
                        roundIndex === 0 ? "bracket-node-opening" : ""
                      } ${roundIndex === bracketRounds.length - 1 ? "bracket-node-final" : ""}`;
                      const nodeStyle = {
                        gridColumn: roundIndex + 1,
                        gridRow: gridRowForMatch(roundIndex, matchIndex)
                      };

                      if (!match) {
                        return (
                          <div
                            key={`${roundSlot.name}-${matchIndex + 1}`}
                            className={nodeClassName}
                            style={nodeStyle}
                          >
                            <article className="bracket-card bracket-card-tree bracket-card-placeholder">
                              <div className="bracket-row">
                                <span>{placeholderLabel(props.tournament, roundSlot.name, matchIndex, "A")}</span>
                                <span>TBD</span>
                              </div>
                              <div className="bracket-row">
                                <span>{placeholderLabel(props.tournament, roundSlot.name, matchIndex, "B")}</span>
                                <span>TBD</span>
                              </div>
                              <small>Awaiting previous winners</small>
                            </article>
                          </div>
                        );
                      }

                      const sideA = playerMap[match.sideAId];
                      const sideB = playerMap[match.sideBId];
                      const pendingManaged = match.managed && !match.completed;
                      const finalChampion = roundSlot.name === "F" && match.completed;

                      return (
                        <div
                          key={match.id}
                          className={nodeClassName}
                          style={nodeStyle}
                        >
                          <article
                            className={`bracket-card bracket-card-tree ${
                              match.managed ? "bracket-card-managed" : ""
                            } ${match.completed ? "bracket-card-complete" : ""} ${
                              finalChampion ? "bracket-card-champion" : ""
                            }`}
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
                            <small>
                              {match.completed
                                ? finalChampion
                                  ? `Champion decided - ${match.scoreline}`
                                  : match.scoreline
                                : "Managed match pending"}
                            </small>
                          </article>
                        </div>
                      );
                    });
              })}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
