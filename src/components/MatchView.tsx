import { playerMap } from "../game/content/players";
import type { LiveMatchSession, Side, TeamTalk } from "../game/core/models";

interface MatchViewProps {
  session: LiveMatchSession;
  managedSide: Side;
  opponentName: string;
  opponentTacticLabel: string;
  onApplyTalk: (teamTalk: TeamTalk) => void;
  onSimulateNextSet: () => void;
  onAdvanceAfterMatch: () => void;
}

const teamTalks: Array<{ id: TeamTalk; label: string; copy: string }> = [
  { id: "encourage", label: "Encourage", copy: "Lift composure and keep the athlete settled." },
  { id: "demand_focus", label: "Demand Focus", copy: "Sharpen concentration and accept the edge." },
  { id: "increase_tempo", label: "Increase Tempo", copy: "Push pace and try to seize initiative." },
  { id: "calm_down", label: "Calm Down", copy: "Lower volatility and cut the loose errors." }
];

export function MatchView(props: MatchViewProps) {
  const managedPlayer =
    props.managedSide === "A" ? props.session.input.playerA : props.session.input.playerB;
  const opponentPlayer = props.managedSide === "A" ? props.session.input.playerB : props.session.input.playerA;
  const commentary = props.session.setSummaries.flatMap((set, index) =>
    set.points.map((point) => ({
      id: `${index}-${point.scoreboard}-${point.rallyLength}`,
      label: `Set ${index + 1} · ${point.scoreboard}`,
      summary: point.summary
    }))
  );
  const commentaryTail = commentary.slice(-14).reverse();
  const talkWindow = props.session.setSummaries.length > 0 && !props.session.complete;
  const currentStaminaManaged =
    props.managedSide === "A" ? props.session.competitorA.stamina : props.session.competitorB.stamina;
  const currentStaminaOpponent =
    props.managedSide === "A" ? props.session.competitorB.stamina : props.session.competitorA.stamina;

  return (
    <section className="phase-layout">
      <div className="phase-header">
        <div>
          <p className="eyebrow">Live Match</p>
          <h2>
            {managedPlayer.name} vs {opponentPlayer.name}
          </h2>
          <p className="section-copy">
            Opponent default tactic: {props.opponentTacticLabel}. The engine resolves one set at a time so you can
            intervene between intervals.
          </p>
        </div>
        <div className="header-actions">
          {!props.session.complete ? (
            <button className="primary-button" onClick={props.onSimulateNextSet}>
              Simulate next set
            </button>
          ) : (
            <button className="primary-button" onClick={props.onAdvanceAfterMatch}>
              Advance bracket
            </button>
          )}
        </div>
      </div>

      <div className="match-grid">
        <div className="surface-card surface-card-wide">
          <p className="surface-label">Scoreboard</p>
          <div className="scoreboard">
            <div className="score-lane">
              <div>
                <h3>{props.session.input.playerA.name}</h3>
                <p>{playerMap[props.session.input.playerA.id]?.styleLabel}</p>
              </div>
              <strong>{props.session.setsWonA}</strong>
            </div>
            <div className="score-divider">:</div>
            <div className="score-lane">
              <strong>{props.session.setsWonB}</strong>
              <div className="score-lane-right">
                <h3>{props.session.input.playerB.name}</h3>
                <p>{playerMap[props.session.input.playerB.id]?.styleLabel}</p>
              </div>
            </div>
          </div>

          <div className="stamina-row">
            <div className="stamina-track">
              <span>{managedPlayer.name}</span>
              <div className="stamina-bar">
                <div className="stamina-fill" style={{ width: `${currentStaminaManaged}%` }} />
              </div>
              <strong>{Math.round(currentStaminaManaged)}</strong>
            </div>
            <div className="stamina-track">
              <span>{opponentPlayer.name}</span>
              <div className="stamina-bar stamina-bar-opponent">
                <div className="stamina-fill stamina-fill-opponent" style={{ width: `${currentStaminaOpponent}%` }} />
              </div>
              <strong>{Math.round(currentStaminaOpponent)}</strong>
            </div>
          </div>

          <div className="set-history">
            {props.session.setSummaries.map((set, index) => (
              <article key={`${set.scoreA}-${set.scoreB}-${index}`} className="set-card">
                <span>Set {index + 1}</span>
                <strong>
                  {set.scoreA}-{set.scoreB}
                </strong>
                <small>{set.winner === "A" ? props.session.input.playerA.name : props.session.input.playerB.name} closed it.</small>
              </article>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <p className="surface-label">Team Talk</p>
          {talkWindow ? (
            <div className="talk-grid">
              {teamTalks.map((talk) => (
                <button key={talk.id} className="talk-card" onClick={() => props.onApplyTalk(talk.id)}>
                  <strong>{talk.label}</strong>
                  <span>{talk.copy}</span>
                </button>
              ))}
            </div>
          ) : (
            <p>Team talks unlock after a completed set and disappear once the match is settled.</p>
          )}
        </div>

        <div className="surface-card">
          <p className="surface-label">Commentary Feed</p>
          <div className="commentary-list">
            {commentaryTail.length > 0 ? (
              commentaryTail.map((entry) => (
                <article key={entry.id} className="commentary-card">
                  <small>{entry.label}</small>
                  <p>{entry.summary}</p>
                </article>
              ))
            ) : (
              <p>The first set will populate the rally feed.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
