import { liveDirectiveOptions } from "../game/content/tactics.js";
import { telemetryForCompetitor } from "../game/core/intel.js";
import type { LiveDirective, LiveMatchSession, Side, TeamTalk } from "../game/core/models.js";
import { projectTacticalViewerFromSession } from "../game/career/tacticalViewer.js";
import { TacticalMatchViewer } from "./TacticalMatchViewer.js";

interface MatchViewProps {
  session: LiveMatchSession;
  managedSide: Side;
  opponentName: string;
  opponentTacticLabel: string;
  onApplyDirective: (directive: LiveDirective) => void;
  onApplyTalk: (teamTalk: TeamTalk) => void;
  onSimulateNextPoint: () => void;
  onAdvanceAfterMatch: () => void;
  onOpenPlayerProfile: (playerId: string) => void;
}

type CompetitorTelemetry = ReturnType<typeof telemetryForCompetitor>;
type MatchActionLabel = "Advance Bracket" | "Apply Talk + Open Next Set" | "Open Next Set" | "Simulate Next Point";

const teamTalks: Array<{ id: TeamTalk; label: string; copy: string }> = [
  { id: "encourage", label: "Encourage", copy: "Lift composure and stop the match from speeding away." },
  { id: "demand_focus", label: "Demand Focus", copy: "Sharpen concentration for the first exchanges of the next set." },
  { id: "increase_tempo", label: "Increase Tempo", copy: "Take the initiative back with earlier attacking intent." },
  { id: "calm_down", label: "Calm Down", copy: "Reduce volatility and cut the cheap misses." }
];

function matchActionLabel(session: LiveMatchSession, pendingTeamTalk?: TeamTalk): MatchActionLabel {
  if (session.complete) {
    return "Advance Bracket";
  }

  if (session.intermission && pendingTeamTalk) {
    return "Apply Talk + Open Next Set";
  }

  if (session.intermission) {
    return "Open Next Set";
  }

  return "Simulate Next Point";
}

function statusActionLabel(session: LiveMatchSession) {
  if (session.complete) {
    return "Advance bracket";
  }

  if (session.intermission) {
    return "Open next set";
  }

  return "Simulate point";
}

interface ScoreboardPanelProps {
  session: LiveMatchSession;
  onOpenPlayerProfile: (playerId: string) => void;
}

function ScoreboardPanel(props: ScoreboardPanelProps) {
  const shouldShowSetSummary = props.session.setSummaries.length > 0 || (!props.session.complete && props.session.intermission);

  return (
    <section className="scoreboard-panel match-scoreboard-panel" aria-label="Compact scoreboard">
      <div className="scoreboard-topline">
        <span>Set {props.session.currentSetNumber}</span>
        <span>
          Match {props.session.setsWonA}-{props.session.setsWonB}
        </span>
      </div>

      <div className="scoreboard-main">
        <div className="scoreboard-athlete">
          <button
            className="profile-name-button profile-name-button-large"
            type="button"
            onClick={() => props.onOpenPlayerProfile(props.session.input.playerA.id)}
          >
            {props.session.input.playerA.name}
          </button>
          <span>{props.session.currentServer === "A" ? "Serving" : "Receiving"}</span>
        </div>

        <div className="scoreboard-points" aria-label="Current point score">
          <span className="score-value score-value-home">{props.session.currentScoreA}</span>
          <span className="score-divider">-</span>
          <span className="score-value">{props.session.currentScoreB}</span>
        </div>

        <div className="scoreboard-athlete scoreboard-athlete-right">
          <button
            className="profile-name-button profile-name-button-large"
            type="button"
            onClick={() => props.onOpenPlayerProfile(props.session.input.playerB.id)}
          >
            {props.session.input.playerB.name}
          </button>
          <span>{props.session.currentServer === "B" ? "Serving" : "Receiving"}</span>
        </div>
      </div>

      {shouldShowSetSummary && (
        <div className="set-summary-row" aria-label="Set summary">
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
      )}
    </section>
  );
}

interface PrimaryMatchActionProps {
  session: LiveMatchSession;
  pendingTeamTalk?: TeamTalk;
  activeDirective?: LiveDirective;
  opponentName: string;
  onSimulateNextPoint: () => void;
  onAdvanceAfterMatch: () => void;
}

function PrimaryMatchAction(props: PrimaryMatchActionProps) {
  const label = matchActionLabel(props.session, props.pendingTeamTalk);
  const onClick = props.session.complete ? props.onAdvanceAfterMatch : props.onSimulateNextPoint;
  const helperCopy = props.session.complete
    ? "Match complete. Return to the bracket path."
    : props.session.intermission
      ? props.pendingTeamTalk
        ? "Queued talk applies as the next set opens."
        : "Open the next set when the interval read is complete."
      : `Resolve the next rally window against ${props.opponentName}.`;

  return (
    <section className="command-panel primary-match-action" aria-label="Primary match action">
      <div>
        <span className="action-kicker">Next Command</span>
        <h2>{label}</h2>
        <p>{helperCopy}</p>
      </div>
      <button className="command-button command-button-primary" type="button" onClick={onClick}>
        {label}
      </button>
      <div className="primary-action-meta" aria-label="Primary action context">
        <span>Set {props.session.currentSetNumber}</span>
        <span>
          Match {props.session.setsWonA}-{props.session.setsWonB}
        </span>
        <span>{props.activeDirective ?? "No directive"}</span>
      </div>
    </section>
  );
}

interface MatchStatusStripProps {
  session: LiveMatchSession;
  activeDirective?: LiveDirective;
}

function MatchStatusStrip(props: MatchStatusStripProps) {
  return (
    <section className="management-status-strip match-status-strip" aria-label="Live match status">
      <div>
        <span>Score</span>
        <strong>{props.session.currentScoreA}-{props.session.currentScoreB}</strong>
      </div>
      <div>
        <span>Match</span>
        <strong>{props.session.setsWonA}-{props.session.setsWonB}</strong>
      </div>
      <div>
        <span>Directive</span>
        <strong>{props.activeDirective ?? "None"}</strong>
      </div>
      <div>
        <span>Server</span>
        <strong>{props.session.currentServer === "A" ? props.session.input.playerA.name : props.session.input.playerB.name}</strong>
      </div>
      <div>
        <span>Next action</span>
        <strong>{statusActionLabel(props.session)}</strong>
      </div>
    </section>
  );
}

interface LiveFeedPanelProps {
  session: LiveMatchSession;
}

function LiveFeedPanel(props: LiveFeedPanelProps) {
  const feed = [...props.session.feed].reverse().slice(0, 12);

  return (
    <section className="command-panel feed-panel match-feed-panel">
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
  );
}

interface TelemetryPanelProps {
  telemetry: CompetitorTelemetry;
  tone: "managed" | "opponent";
}

function TelemetryPanel(props: TelemetryPanelProps) {
  return (
    <section className={`command-panel telemetry-card telemetry-card-${props.tone}`}>
      <div className="panel-header telemetry-card-header">
        <h2>{props.telemetry.playerName} Telemetry</h2>
        <span>{props.telemetry.momentumLabel}</span>
      </div>

      <div className="telemetry-block">
        <div className="metric-row">
          <span>Stamina</span>
          <strong>{props.telemetry.stamina}%</strong>
        </div>
        <div className="metric-track">
          <div
            className={`metric-track-fill ${props.tone === "opponent" ? "metric-track-fill-soft" : ""}`}
            style={{ width: `${props.telemetry.stamina}%` }}
          />
        </div>
      </div>

      <div className="telemetry-block">
        <div className="metric-row">
          <span>Momentum</span>
          <strong>{props.telemetry.momentumLabel}</strong>
        </div>
        <div className="momentum-bars">
          {Array.from({ length: 5 }).map((_, index) => {
            const threshold = (index + 1) * 20;
            return (
              <span
                key={threshold}
                className={`momentum-bar ${
                  props.telemetry.momentum >= threshold
                    ? props.tone === "opponent"
                      ? "momentum-bar-opponent"
                      : "momentum-bar-active"
                    : ""
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="telemetry-mini-grid">
        <div className="telemetry-mini-card">
          <span>Peak Smash</span>
          <strong>{props.telemetry.smashPeakKph > 0 ? `${props.telemetry.smashPeakKph} km/h` : "N/A"}</strong>
        </div>
        <div className="telemetry-mini-card">
          <span>Errors</span>
          <strong>{props.telemetry.errors}</strong>
        </div>
      </div>
    </section>
  );
}

interface TacticalOptionsPanelProps {
  session: LiveMatchSession;
  activeDirective?: LiveDirective;
  pendingTeamTalk?: TeamTalk;
  onApplyDirective: (directive: LiveDirective) => void;
  onApplyTalk: (teamTalk: TeamTalk) => void;
}

function TacticalOptionsPanel(props: TacticalOptionsPanelProps) {
  const teamTalkUnlocked = props.session.intermission && !props.session.complete;

  return (
    <section className="command-panel directive-panel tactical-options-panel" aria-label="Tactical options">
      <div className="panel-header">
        <h2>Tactical Options</h2>
        <span>{props.activeDirective ? "Directive armed" : "No live directive queued"}</span>
      </div>

      <div className="tactical-option-group">
        <h3>Directives</h3>
        <div className="directive-list directive-list-compact">
          {liveDirectiveOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`directive-card ${props.activeDirective === option.id ? "directive-card-active" : ""}`}
              onClick={() => props.onApplyDirective(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.summary}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tactical-option-group tactical-option-group-talk">
        <div className="panel-header panel-header-inline panel-header-compact">
          <h3>Between-Set Team Talk</h3>
          <span>{teamTalkUnlocked ? (props.pendingTeamTalk ? "Talk queued" : "Live") : "Locked"}</span>
        </div>

        {teamTalkUnlocked ? (
          <div className="directive-list directive-list-compact team-talk-grid">
            {teamTalks.map((talk) => (
              <button
                key={talk.id}
                type="button"
                className={`directive-card directive-card-talk ${
                  props.pendingTeamTalk === talk.id ? "directive-card-active" : ""
                }`}
                aria-pressed={props.pendingTeamTalk === talk.id}
                onClick={() => props.onApplyTalk(talk.id)}
              >
                <strong>{talk.label}</strong>
                <span>{talk.copy}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="panel-summary">Team talks unlock only between sets.</p>
        )}
      </div>
    </section>
  );
}

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
  const activeDirective =
    props.managedSide === "A"
      ? props.session.competitorA.directive
      : props.session.competitorB.directive;
  const pendingTeamTalk =
    props.managedSide === "A" ? props.session.pendingTalkA : props.session.pendingTalkB;
  const tacticalFrame = projectTacticalViewerFromSession({
    session: props.session,
    managedSide: props.managedSide
  });

  return (
    <section className="screen-shell match-screen">
      <div className="screen-header match-screen-header">
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

      <div className="match-command-layout match-command-layout-v2" aria-label="Match command surface">
        <ScoreboardPanel session={props.session} onOpenPlayerProfile={props.onOpenPlayerProfile} />

        <PrimaryMatchAction
          session={props.session}
          pendingTeamTalk={pendingTeamTalk}
          activeDirective={activeDirective}
          opponentName={props.opponentName}
          onSimulateNextPoint={props.onSimulateNextPoint}
          onAdvanceAfterMatch={props.onAdvanceAfterMatch}
        />

        <MatchStatusStrip session={props.session} activeDirective={activeDirective} />

        <LiveFeedPanel session={props.session} />

        <section className="command-panel tactical-viewer-live-panel match-command-viewer">
          <TacticalMatchViewer
            frame={tacticalFrame}
            title="2D Tactical Viewer"
            statusLabel={props.session.complete ? "Final frame" : `${tacticalFrame.sequence} rally frames`}
          />
        </section>

        <aside className="match-side-column" aria-label="Managed and opponent telemetry with tactical options">
          <TelemetryPanel telemetry={managedTelemetry} tone="managed" />
          <TelemetryPanel telemetry={opponentTelemetry} tone="opponent" />
          <TacticalOptionsPanel
            session={props.session}
            activeDirective={activeDirective}
            pendingTeamTalk={pendingTeamTalk}
            onApplyDirective={props.onApplyDirective}
            onApplyTalk={props.onApplyTalk}
          />
        </aside>
      </div>
    </section>
  );
}
