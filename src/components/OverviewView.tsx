import { playerMap, seededPlayers } from "../game/content/players";
import { tacticLibrary } from "../game/content/tactics";
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

const tacticKeyList = Object.keys(tacticLibrary) as TacticKey[];

export function OverviewView(props: OverviewViewProps) {
  const selected = seededPlayers.find((entry) => entry.player.id === props.selectedPlayerId) ?? seededPlayers[0];
  const currentRound = props.tournament.rounds[props.tournament.currentRoundIndex];
  const managedMatch = currentRound.matches.find((match) => match.managed);
  const opponentId =
    managedMatch?.sideAId === props.selectedPlayerId ? managedMatch.sideBId : managedMatch?.sideAId;
  const opponent = opponentId ? playerMap[opponentId] : undefined;

  return (
    <section className="phase-layout">
      <div className="phase-header">
        <div>
          <p className="eyebrow">Bracket Overview</p>
          <h2>
            {selected.player.name} is live in the {currentRound.name}.
          </h2>
          <p className="section-copy">
            Every non-managed match has already been resolved. You only play the tie your athlete reaches.
          </p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={props.onReset}>
            Reset run
          </button>
          {props.onStartManagedMatch && (
            <button className="primary-button" onClick={props.onStartManagedMatch}>
              Start managed match
            </button>
          )}
        </div>
      </div>

      <div className="overview-grid">
        <div className="surface-card">
          <p className="surface-label">Next Opponent</p>
          {opponent ? (
            <div className="selected-player">
              <div>
                <h3>{opponent.name}</h3>
                <p>
                  {opponent.nationality} · {opponent.styleLabel}
                </p>
              </div>
              <div className="rating-chip">
                <strong>{currentRound.name}</strong>
                <span>Round</span>
              </div>
            </div>
          ) : (
            <p>The tournament is waiting on your result.</p>
          )}
        </div>

        <div className="surface-card">
          <p className="surface-label">Tactic Lock-In</p>
          <div className="tactic-grid">
            {tacticKeyList.map((key) => (
              <button
                key={key}
                className={`tactic-card ${
                  props.plannedTacticKey === key ? "tactic-card-active" : ""
                }`}
                onClick={() => props.onChooseTactic(key)}
              >
                <strong>{tacticLibrary[key].label}</strong>
                <span>
                  {tacticLibrary[key].tempo} tempo · {tacticLibrary[key].riskProfile.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-card surface-card-wide">
          <p className="surface-label">Tournament Path</p>
          <div className="round-columns">
            {props.tournament.rounds.map((round) => (
              <div key={round.name} className="round-column">
                <h3>{round.name}</h3>
                <div className="match-stack">
                  {round.matches.map((match) => {
                    const sideA = playerMap[match.sideAId];
                    const sideB = playerMap[match.sideBId];
                    return (
                      <article
                        key={match.id}
                        className={`match-card ${match.managed ? "match-card-managed" : ""}`}
                      >
                        <div className="match-row">
                          <strong>{sideA.name}</strong>
                          {match.winnerId === sideA.id && <span className="winner-badge">W</span>}
                        </div>
                        <div className="match-row">
                          <strong>{sideB.name}</strong>
                          {match.winnerId === sideB.id && <span className="winner-badge">W</span>}
                        </div>
                        <small>{match.completed ? match.scoreline : "Managed match pending"}</small>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
