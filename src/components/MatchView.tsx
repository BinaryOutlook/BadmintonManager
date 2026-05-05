import { liveDirectiveOptions } from "../game/content/tactics";
import { telemetryForCompetitor } from "../game/core/intel";
import type { LiveDirective, LiveMatchSession, Side, TeamTalk } from "../game/core/models";

interface MatchViewProps {
  session: LiveMatchSession;
  managedSide: Side;
  opponentName: string;
  opponentTacticLabel: string;
  onApplyDirective: (directive: LiveDirective) => void;
  onApplyTalk: (teamTalk: TeamTalk) => void;
  onSimulateNextPoint: () => void;
  onAdvanceAfterMatch: () => void;
}

const teamTalks: Array<{ id: TeamTalk; label: string; copy: string }> = [
  { id: "encourage", label: "Encourage", copy: "Lift composure and stop the match from speeding away." },
  { id: "demand_focus", label: "Demand Focus", copy: "Sharpen concentration for the first exchanges of the next set." },
  { id: "increase_tempo", label: "Increase Tempo", copy: "Take the initiative back with earlier attacking intent." },
  { id: "calm_down", label: "Calm Down", copy: "Reduce volatility and cut the cheap misses." }
];

export function MatchView(props: MatchViewProps) {
  const managedPlayer =
    props.managedSide === "A" ? props.session.input.playerA : props.session.input.playerB;
  const opponentPlayer =
    props.managedSide === "A" ? props.session.input.playerB : props.session.input.playerA;
  const managedTelemetry = telemetryForCompetitor(
    managedPlayer,
    props.managedSide === "A" ? props.session.competitorA : props.session.competitorB,
    props.managedSide === "A" ? props.session.setsWonA : props.session.setsWonB
  );
  const opponentTelemetry = telemetryForCompetitor(
    opponentPlayer,
    props.managedSide === "A" ? props.session.competitorB : props.session.competitorA,
    props.managedSide === "A" ? props.session.setsWonB : props.session.setsWonA
  );
  const feed = [...props.session.feed].reverse().slice(0, 12);
  const activeDirective =
    props.managedSide === "A"
      ? props.session.competitorA.directive
      : props.session.competitorB.directive;
  const pendingTeamTalk =
    props.managedSide === "A" ? props.session.pendingTalkA : props.session.pendingTalkB;

  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Live</p>
          <h1 className="screen-title">Match Command Center</h1>
          <p className="screen-copy">
            {opponentPlayer.name} opened with {props.opponentTacticLabel}. Point flow is now live, with
            directives affecting only the next short tactical window.
          </p>
        </div>
        <div className="screen-meta">
          <span>Quarter-Finals</span>
          <span>Court 1</span>
          <span>T {Math.floor(props.session.clockSeconds / 60)}:{String(props.session.clockSeconds % 60).padStart(2, "0")}</span>
        </div>
      </div>

      <div className="match-command-layout">
        <section className="scoreboard-panel">
          <div className="scoreboard-topline">
            <span>Set {props.session.currentSetNumber}</span>
            <span>
              Match Score {props.session.setsWonA}-{props.session.setsWonB}
            </span>
          </div>

          <div className="scoreboard-main">
            <div className="scoreboard-athlete">
              <strong>{props.session.input.playerA.name}</strong>
              <span>{props.session.currentServer === "A" ? "Serving" : "Receiving"}</span>
            </div>

            <div className="scoreboard-points">
              <span className="score-value score-value-home">{props.session.currentScoreA}</span>
              <span className="score-divider">-</span>
              <span className="score-value">{props.session.currentScoreB}</span>
            </div>

            <div className="scoreboard-athlete scoreboard-athlete-right">
              <strong>{props.session.input.playerB.name}</strong>
              <span>{props.session.currentServer === "B" ? "Serving" : "Receiving"}</span>
            </div>
          </div>

          <div className="set-summary-row">
            {props.session.setSummaries.map((set, index) => (
              <article key={`${set.scoreA}-${set.scoreB}-${index}`} className="set-result-chip">
                <span>Set {index + 1}</span>
                <strong>
                  {set.scoreA}-{set.scoreB}
                </strong>
              </article>
            ))}
            {!props.session.complete && props.session.intermission && (
              <article className="set-result-chip set-result-chip-live">
                <span>Intermission</span>
                <strong>Set {props.session.currentSetNumber} loading</strong>
              </article>
            )}
          </div>
        </section>

        <div className="match-columns">
          <section className="command-panel telemetry-stack">
            <div className="panel-header">
              <h2>{managedTelemetry.playerName} Telemetry</h2>
              <span>{managedTelemetry.momentumLabel}</span>
            </div>

            <div className="telemetry-block">
              <div className="metric-row">
                <span>Stamina</span>
                <strong>{managedTelemetry.stamina}%</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill" style={{ width: `${managedTelemetry.stamina}%` }} />
              </div>
            </div>

            <div className="telemetry-block">
              <div className="metric-row">
                <span>Momentum</span>
                <strong>{managedTelemetry.momentumLabel}</strong>
              </div>
              <div className="momentum-bars">
                {Array.from({ length: 5 }).map((_, index) => {
                  const threshold = (index + 1) * 20;
                  return (
                    <span
                      key={threshold}
                      className={`momentum-bar ${
                        managedTelemetry.momentum >= threshold ? "momentum-bar-active" : ""
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="telemetry-mini-grid">
              <div className="telemetry-mini-card">
                <span>Peak Smash</span>
                <strong>{managedTelemetry.smashPeakKph > 0 ? `${managedTelemetry.smashPeakKph} km/h` : "N/A"}</strong>
              </div>
              <div className="telemetry-mini-card">
                <span>Errors</span>
                <strong>{managedTelemetry.errors}</strong>
              </div>
            </div>

            <div className="panel-header panel-header-inline">
              <h2>{opponentTelemetry.playerName} Telemetry</h2>
              <span>{opponentTelemetry.momentumLabel}</span>
            </div>

            <div className="telemetry-block">
              <div className="metric-row">
                <span>Stamina</span>
                <strong>{opponentTelemetry.stamina}%</strong>
              </div>
              <div className="metric-track">
                <div
                  className="metric-track-fill metric-track-fill-soft"
                  style={{ width: `${opponentTelemetry.stamina}%` }}
                />
              </div>
            </div>

            <div className="telemetry-block">
              <div className="metric-row">
                <span>Momentum</span>
                <strong>{opponentTelemetry.momentumLabel}</strong>
              </div>
              <div className="momentum-bars">
                {Array.from({ length: 5 }).map((_, index) => {
                  const threshold = (index + 1) * 20;
                  return (
                    <span
                      key={threshold}
                      className={`momentum-bar ${
                        opponentTelemetry.momentum >= threshold ? "momentum-bar-opponent" : ""
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          <section className="command-panel feed-panel">
            <div className="panel-header">
              <h2>Live Tactical Feed</h2>
              <span>{feed.length} recent events</span>
            </div>

            <div className="feed-list">
              {feed.length > 0 ? (
                feed.map((entry) => (
                  <article key={entry.id} className={`feed-card feed-card-${entry.emphasis}`}>
                    <div className="feed-card-top">
                      <span>{entry.clockLabel}</span>
                      <span className="feed-kind">{entry.kind}</span>
                    </div>
                    <strong>{entry.title}</strong>
                    {entry.detail && <p>{entry.detail}</p>}
                  </article>
                ))
              ) : (
                <p className="panel-summary">The first point will seed the live tactical feed.</p>
              )}
            </div>
          </section>

          <section className="command-panel directive-panel">
            <div className="panel-header">
              <h2>Directives</h2>
              <span>{activeDirective ? "Directive armed" : "No live directive queued"}</span>
            </div>

            <div className="directive-list">
              {liveDirectiveOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`directive-card ${activeDirective === option.id ? "directive-card-active" : ""}`}
                  onClick={() => props.onApplyDirective(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.summary}</span>
                </button>
              ))}
            </div>

            <div className="panel-header panel-header-inline">
              <h2>Between-Set Team Talk</h2>
              <span>
                {props.session.intermission && !props.session.complete
                  ? pendingTeamTalk
                    ? "Talk queued"
                    : "Live"
                  : "Locked"}
              </span>
            </div>

            {props.session.intermission && !props.session.complete ? (
              <div className="directive-list">
                {teamTalks.map((talk) => (
                  <button
                    key={talk.id}
                    type="button"
                    className={`directive-card directive-card-talk ${
                      pendingTeamTalk === talk.id ? "directive-card-active" : ""
                    }`}
                    aria-pressed={pendingTeamTalk === talk.id}
                    onClick={() => props.onApplyTalk(talk.id)}
                  >
                    <strong>{talk.label}</strong>
                    <span>{talk.copy}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="panel-summary">
                Team talks unlock only after a set has closed and before the next one begins.
              </p>
            )}

            <div className="directive-actions">
              {!props.session.complete ? (
                <button className="command-button command-button-primary" onClick={props.onSimulateNextPoint}>
                  {props.session.intermission && pendingTeamTalk
                    ? "Apply Talk + Open Next Set"
                    : props.session.intermission
                      ? "Open Next Set"
                      : "Simulate Next Point"}
                </button>
              ) : (
                <button className="command-button command-button-primary" onClick={props.onAdvanceAfterMatch}>
                  Advance Bracket
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
