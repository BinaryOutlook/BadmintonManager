import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PlayerLink, SmartPlayerText } from "../../components/PlayerLink";
import { TournamentLink } from "../../components/TournamentLink";
import {
  createPlayerProfileViewModel,
  type PlayerAttributeGroup,
  type PlayerAttributeRow,
  type PlayerDecisionItem,
  type PlayerEvidenceItem,
  type ProfileStatusTone,
  type TacticFitSummary
} from "../../game/selectors/player";
import type { AppPhase } from "../../game/store/store";
import type { CareerState } from "../../game/career/models";
import type { LiveMatchSession } from "../../game/core/models";
import type { TournamentState } from "../../game/tournament/tournament";

type ProfileTab = "overview" | "attributes" | "performance" | "career" | "future";

interface PlayerProfilePageProps {
  playerId: string;
  selectedPlayerId: string;
  phase: AppPhase;
  careerPresent: boolean;
  career: CareerState | null;
  tournament: TournamentState | null;
  liveMatchSession?: LiveMatchSession | null;
  onBack: () => void;
  onSelectPlayer: (playerId: string) => void;
}

const radarLabelAbbreviations: Record<string, string> = {
  Attack: "ATK",
  Defense: "DEF",
  Movement: "MOV",
  Control: "CTRL",
  Mentality: "MENT",
  Endurance: "END"
};

const radarLabelPositions = [
  { x: 210, y: 44, anchor: "middle" },
  { x: 342, y: 126, anchor: "middle" },
  { x: 342, y: 294, anchor: "middle" },
  { x: 210, y: 376, anchor: "middle" },
  { x: 78, y: 294, anchor: "middle" },
  { x: 78, y: 126, anchor: "middle" }
] as const;

function toneClass(prefix: string, tone: ProfileStatusTone) {
  return `${prefix} ${prefix}-${tone}`;
}

function ProfileEmptyState(props: { title: string; copy: string }) {
  return (
    <div className="profile-empty-state" role="status">
      <strong>{props.title}</strong>
      <p>{props.copy}</p>
    </div>
  );
}

function RadarChart(props: { metrics: Array<{ label: string; value: number }> }) {
  const center = 210;
  const radius = 118;
  const points = props.metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / props.metrics.length;
    const scaledRadius = radius * (metric.value / 100);
    const labelPosition = radarLabelPositions[index] ?? {
      x: center + Math.cos(angle) * (radius + 58),
      y: center + Math.sin(angle) * (radius + 58),
      anchor: "middle" as const
    };

    return {
      label: metric.label,
      value: metric.value,
      shortLabel: radarLabelAbbreviations[metric.label] ?? metric.label.slice(0, 3).toUpperCase(),
      x: center + Math.cos(angle) * scaledRadius,
      y: center + Math.sin(angle) * scaledRadius,
      labelX: labelPosition.x,
      labelY: labelPosition.y,
      labelAnchor: labelPosition.anchor,
      gridX: center + Math.cos(angle) * radius,
      gridY: center + Math.sin(angle) * radius
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const gridPolygons = [0.35, 0.7, 1].map((scale) =>
    props.metrics
      .map((_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / props.metrics.length;

        return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
      })
      .join(" ")
  );

  return (
    <div className="profile-radar" aria-label="Badminton radar profile">
      <svg
        className="profile-radar-svg"
        viewBox="0 0 420 420"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Radar profile chart"
      >
        <title>Badminton radar profile</title>
        {gridPolygons.map((gridPolygon) => (
          <polygon key={gridPolygon} className="profile-radar-grid" points={gridPolygon} />
        ))}
        {points.map((point) => (
          <line
            key={`axis-${point.label}`}
            className="profile-radar-axis"
            x1={center}
            y1={center}
            x2={point.gridX}
            y2={point.gridY}
          />
        ))}
        <polygon className="profile-radar-shape" points={polygon} />
        {points.map((point) => (
          <g key={point.label}>
            <circle className="profile-radar-point" cx={point.x} cy={point.y} r="3" />
            <text
              className="profile-radar-label profile-radar-label-full"
              x={point.labelX}
              y={point.labelY}
              textAnchor={point.labelAnchor}
              dominantBaseline="middle"
              aria-hidden="true"
            >
              {point.label}
            </text>
            <text
              className="profile-radar-label profile-radar-label-short"
              x={point.labelX}
              y={point.labelY}
              textAnchor={point.labelAnchor}
              dominantBaseline="middle"
              aria-hidden="true"
            >
              {point.shortLabel}
            </text>
          </g>
        ))}
      </svg>
      <div className="profile-radar-values">
        {props.metrics.map((metric) => (
          <div key={metric.label} title={`${metric.label}: ${metric.value}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttributeRows(props: { group: PlayerAttributeGroup }) {
  const fillClass =
    props.group.tone === "cyan"
      ? "metric-track-fill metric-track-fill-cyan"
      : props.group.tone === "soft"
        ? "metric-track-fill metric-track-fill-soft"
        : "metric-track-fill";

  return (
    <section className="profile-attribute-group">
      <h3>{props.group.title}</h3>
      <div className="profile-attribute-list">
        {props.group.rows.map((row: PlayerAttributeRow) => (
          <div key={row.label} className="profile-attribute-row">
            <div className="metric-row profile-attribute-row-head">
              <span>{row.label}</span>
              <strong>
                {Math.round(row.value)} <em>{row.benchmark}</em>
              </strong>
            </div>
            <div className="metric-track" aria-label={`${row.label} ${Math.round(row.value)}`}>
              <div className={fillClass} style={{ width: `${Math.round(row.value)}%` }} />
            </div>
            <p className={toneClass("profile-attribute-context", row.tone)}>{row.context}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionGrid(props: { items: PlayerDecisionItem[]; compact?: boolean }) {
  return (
    <div className={props.compact ? "profile-decision-grid profile-decision-grid-compact" : "profile-decision-grid"}>
      {props.items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={toneClass("profile-decision-item", item.tone)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  );
}

function EvidenceGrid(props: { items: PlayerEvidenceItem[]; emptyTitle: string; emptyCopy: string }) {
  if (props.items.length === 0) {
    return <ProfileEmptyState title={props.emptyTitle} copy={props.emptyCopy} />;
  }

  return (
    <div className="profile-evidence-list">
      {props.items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={toneClass("profile-evidence-item", item.tone)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function TacticCard(props: { fit: TacticFitSummary; recommended?: boolean }) {
  return (
    <article className={props.recommended ? "profile-tactic-card profile-tactic-card-best" : "profile-tactic-card"}>
      <div className="profile-tactic-card-top">
        <span>{props.recommended ? "Recommended tactic" : `Alternative #${props.fit.rank}`}</span>
        <strong>{props.fit.score}</strong>
      </div>
      <h3>{props.fit.label}</h3>
      <p>{props.fit.fitLabel}</p>
      <small>{props.fit.risk}</small>
      <span className="profile-driver-line">Drivers: {props.fit.drivers.join(" · ")}</span>
      <em>{props.fit.intention}</em>
    </article>
  );
}

function TacticPlan(props: { recommended: TacticFitSummary; alternatives: TacticFitSummary[]; counterPlan: string }) {
  return (
    <section className="command-panel command-panel-full profile-fit-panel">
      <div className="panel-header">
        <h2>Tactical Plan</h2>
        <span>Best fit first / Counter: {props.counterPlan}</span>
      </div>
      <div className="profile-tactic-layout">
        <TacticCard fit={props.recommended} recommended />
        <div className="profile-tactic-grid profile-tactic-grid-alternatives">
          {props.alternatives.map((fit) => (
            <TacticCard key={fit.key} fit={fit} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TextList(props: { items: string[]; empty: string }) {
  if (props.items.length === 0) {
    return <p>{props.empty}</p>;
  }

  return (
    <ul>
      {props.items.map((item) => (
        <li key={item}>
          <SmartPlayerText text={item} />
        </li>
      ))}
    </ul>
  );
}

export function PlayerProfilePage(props: PlayerProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const canSelect = !props.careerPresent && props.phase === "setup" && props.playerId !== props.selectedPlayerId;
  const model = createPlayerProfileViewModel({
    playerId: props.playerId,
    selectedPlayerId: props.selectedPlayerId,
    tournament: props.tournament,
    liveMatch: props.liveMatchSession,
    career: props.career,
    canSelect
  });

  if (!model) {
    return (
      <section className="screen-shell">
        <div className="screen-header">
          <div>
            <p className="screen-kicker">Player Profile</p>
            <h1 className="screen-title">Player Not Found</h1>
            <p className="screen-copy">This profile cannot be generated from the current roster.</p>
          </div>
          <button className="command-button command-button-secondary" type="button" onClick={props.onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  const { player } = model;
  const profileTabs: Array<{ id: ProfileTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "attributes", label: "Attributes" },
    { id: "performance", label: "Performance" },
    { id: "career", label: "Career" },
    { id: "future", label: model.context.fifthTabLabel }
  ];
  const activeTabLabel = profileTabs.find((tab) => tab.id === activeTab)?.label ?? "Overview";
  const managedPlayerSpotlight = model.career.managedPlayerSpotlight;
  const managedPlayerSpotlightLabel = managedPlayerSpotlight
    ? `${managedPlayerSpotlight.opponentName}: ${managedPlayerSpotlight.wins}-${managedPlayerSpotlight.losses} (${managedPlayerSpotlight.winPercentageLabel})`
    : null;

  function handleTabKey(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const keyMap: Record<string, number> = {
      ArrowRight: currentIndex + 1,
      ArrowLeft: currentIndex - 1,
      Home: 0,
      End: profileTabs.length - 1
    };
    const requestedIndex = keyMap[event.key];

    if (typeof requestedIndex !== "number") {
      return;
    }

    event.preventDefault();
    const nextIndex = (requestedIndex + profileTabs.length) % profileTabs.length;
    const nextTab = profileTabs[nextIndex];
    setActiveTab(nextTab.id);
    window.requestAnimationFrame(() => document.getElementById(`profile-tab-${nextTab.id}`)?.focus());
  }

  return (
    <section className="screen-shell player-profile-page">
      <header className={`player-profile-hero player-profile-hero-${model.context.tone}`}>
        <div className="player-profile-avatar">{player.nationality}</div>
        <div className="player-profile-heading">
          <p className="screen-kicker">{model.context.label}</p>
          <h1>{player.name}</h1>
          <div className="player-profile-meta" aria-label="Player identity and status">
            <span>{player.nationality}</span>
            <span>{player.age} years old</span>
            <span>{player.handedness === "left" ? "Left-handed" : "Right-handed"}</span>
            <span>{model.coachReport.archetype}</span>
            {model.headerStatus.ranking && <span>Rank {model.headerStatus.ranking}</span>}
            <span>{model.headerStatus.currentRunRole}</span>
            {model.headerStatus.nextMatch && <span>{model.headerStatus.nextMatch}</span>}
            <span>Form {model.headerStatus.recentForm}</span>
            <span>{model.headerStatus.readinessSummary}</span>
          </div>
        </div>
        <div className="player-profile-score">
          <span>OVR</span>
          <strong>{model.overall}</strong>
        </div>
      </header>

      <div className="player-profile-toolbar">
        <div className="profile-tab-list" role="tablist" aria-label="Player profile sections">
          {profileTabs.map((tab, index) => (
            <button
              id={`profile-tab-${tab.id}`}
              key={tab.id}
              type="button"
              role="tab"
              aria-controls={`profile-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={activeTab === tab.id ? "profile-tab profile-tab-active" : "profile-tab"}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="player-profile-actions">
          {canSelect && (
            <button
              className="command-button command-button-primary"
              type="button"
              onClick={() => props.onSelectPlayer(player.id)}
            >
              Select Athlete
            </button>
          )}
          <button className="command-button command-button-secondary" type="button" onClick={props.onBack}>
            Back
          </button>
        </div>
      </div>

      <div
        id={`profile-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeTab}`}
        className="profile-tab-panel"
      >
        {activeTab === "overview" && model.overview.kind === "managed" && model.overview.managerVerdict && (
          <div className="player-profile-grid player-profile-grid-overview profile-overview-managed">
            <section className={toneClass("command-panel profile-verdict-panel", model.overview.managerVerdict.tone)}>
              <div className="panel-header">
                <h2>Manager Verdict</h2>
                <span>Selection / tactic / next workflow</span>
              </div>
              <strong>{model.overview.managerVerdict.action}</strong>
              <p>Best tactic: {model.overview.managerVerdict.tacticLabel}</p>
              <small>{model.overview.managerVerdict.reason}</small>
              <div className="profile-route-chip">
                <span>{model.overview.managerVerdict.ctaLabel}</span>
                <em>{model.overview.managerVerdict.ctaDetail}</em>
              </div>
            </section>

            <section className="command-panel profile-readiness-panel">
              <div className="panel-header">
                <h2>Readiness Strip</h2>
                <span>Fitness / form / morale / load</span>
              </div>
              <DecisionGrid items={model.overview.readinessStrip} compact />
            </section>

            <TacticPlan
              recommended={model.overview.tacticalPlan.recommended}
              alternatives={model.overview.tacticalPlan.alternatives}
              counterPlan={model.overview.tacticalPlan.counterPlan}
            />

            {model.overview.trainingRecommendation && (
              <section className="command-panel profile-training-panel">
                <div className="panel-header">
                  <h2>Training Recommendation</h2>
                  <span>Development route, not a direct command</span>
                </div>
                <div className="profile-plan-card">
                  <span>Current recommendation</span>
                  <strong>{model.overview.trainingRecommendation.planLabel}</strong>
                  <p>{model.overview.trainingRecommendation.expectedGain}</p>
                  <small>{model.overview.trainingRecommendation.workload}</small>
                  <em>{model.overview.trainingRecommendation.risk}</em>
                </div>
              </section>
            )}

            <section className="command-panel profile-risk-panel">
              <div className="panel-header">
                <h2>Risk Flags</h2>
                <span>Overuse / matchup / error profile</span>
              </div>
              <DecisionGrid items={model.overview.riskFlags} />
            </section>

            <section className="command-panel profile-evidence-panel">
              <div className="panel-header">
                <h2>Recent Evidence</h2>
                <span>{model.performance.formLabel}</span>
              </div>
              <DecisionGrid items={model.overview.recentEvidence} />
            </section>
          </div>
        )}

        {activeTab === "overview" && model.overview.kind === "scouting" && model.overview.scoutingVerdict && (
          <div className="player-profile-grid player-profile-grid-overview profile-overview-scouting">
            <section className={toneClass("command-panel profile-verdict-panel", model.overview.scoutingVerdict.tone)}>
              <div className="panel-header">
                <h2>Scouting Verdict</h2>
                <span>Fit / threat / next scout action</span>
              </div>
              <strong>{model.overview.scoutingVerdict.action}</strong>
              <p>Primary threat: {model.overview.scoutingVerdict.primaryThreat}</p>
              <p>Recommended counter: {model.overview.scoutingVerdict.recommendedCounter}</p>
              <small>
                Scouting confidence: {model.overview.scoutingVerdict.confidence}% — {model.overview.scoutingVerdict.reason}
              </small>
              {canSelect && (
                <button
                  className="command-button command-button-primary profile-verdict-action"
                  type="button"
                  onClick={() => props.onSelectPlayer(player.id)}
                >
                  Select Athlete
                </button>
              )}
            </section>

            <section className="command-panel profile-threat-panel">
              <div className="panel-header">
                <h2>Threat / Fit Summary</h2>
                <span>{model.context.label}</span>
              </div>
              <DecisionGrid items={model.overview.threatSummary} />
            </section>

            <section className="command-panel profile-win-plan-panel">
              <div className="panel-header">
                <h2>How They Win</h2>
                <span>Plain badminton language</span>
              </div>
              <TextList items={model.overview.howTheyWin} empty="No tactical identity found." />
            </section>

            <section className="command-panel profile-counter-panel">
              <div className="panel-header">
                <h2>How To Beat Them</h2>
                <span>Counterplan</span>
              </div>
              <TextList items={model.overview.howToBeat} empty="Counterplan unlocks when enough opponent context exists." />
            </section>

            <TacticPlan
              recommended={model.overview.tacticalPlan.recommended}
              alternatives={model.overview.tacticalPlan.alternatives}
              counterPlan={model.overview.tacticalPlan.counterPlan}
            />

            <section className="command-panel profile-unknowns-panel">
              <div className="panel-header">
                <h2>Known Strengths And Unknowns</h2>
                <span>Confidence-aware</span>
              </div>
              <div className="profile-report-columns">
                <div>
                  <h3>Known strengths</h3>
                  <TextList items={model.overview.knownStrengths.slice(0, 4)} empty="No strengths verified." />
                </div>
                <div>
                  <h3>Unknowns</h3>
                  <TextList items={model.overview.unknowns.slice(0, 4)} empty="No uncertainty notes." />
                </div>
              </div>
            </section>

            <section className="command-panel profile-scout-action-panel">
              <div className="panel-header">
                <h2>Next Scout Action</h2>
                <span>{model.scouting.confidence}% confidence</span>
              </div>
              <DecisionGrid items={[model.overview.nextAction]} />
              <p>{model.scouting.recommendation}</p>
            </section>
          </div>
        )}

        {activeTab === "attributes" && (
          <div className="profile-attributes-grid">
            {model.attributeGroups.map((group) => (
              <AttributeRows key={group.title} group={group} />
            ))}
          </div>
        )}

        {activeTab === "performance" && (
          <div className="profile-performance-grid profile-performance-grid-analytical">
            <section className="command-panel command-panel-wide">
              <div className="panel-header">
                <h2>Recent Form</h2>
                <span>{model.performance.formLabel}</span>
              </div>
              {model.performance.recentMatches.length > 0 ? (
                <div className="profile-match-list" aria-label="Recent match results">
                  {model.performance.recentMatches.map((match) => (
                    <article key={match.id} className={`profile-match-row profile-match-row-${match.result.toLowerCase()}`}>
                      <span>{match.result}</span>
                      <strong>
                        {match.eventName} {match.round}
                      </strong>
                      <p>
                        vs <PlayerLink playerId={match.opponentId}>{match.opponentName}</PlayerLink> / {match.scoreline}
                      </p>
                      <small>{match.date} · {match.context}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <ProfileEmptyState title="No recent form yet." copy={model.performance.emptyState} />
              )}
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Last Match Evidence</h2>
                <span>{model.performance.telemetryState.value}</span>
              </div>
              <EvidenceGrid
                items={model.performance.lastMatchEvidence}
                emptyTitle="Last match evidence locked."
                emptyCopy={model.performance.emptyState}
              />
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Shot Profile</h2>
                <span>Smash / net / retrieval / rally</span>
              </div>
              <EvidenceGrid
                items={model.performance.shotProfile}
                emptyTitle="Shot profile unavailable."
                emptyCopy="Detailed winners, errors, smash pressure, and rally-length telemetry unlock after managed match evidence exists."
              />
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Tactical Results</h2>
                <span>Outcome by tactic evidence</span>
              </div>
              <EvidenceGrid
                items={model.performance.tacticalResults}
                emptyTitle="No tactical result sample."
                emptyCopy="Completed match summary events will appear here when the engine records decisive patterns."
              />
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Trend Summary</h2>
                <span>Winners / errors / stamina</span>
              </div>
              <EvidenceGrid
                items={model.performance.trendSummary}
                emptyTitle="Trend locked."
                emptyCopy="Trend lines need either persisted match history or managed match telemetry."
              />
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Telemetry State</h2>
                <span>Known / unavailable / opponent-only</span>
              </div>
              <DecisionGrid
                items={[
                  {
                    label: model.performance.telemetryState.label,
                    value: model.performance.telemetryState.value,
                    detail: model.performance.telemetryState.detail,
                    tone: model.performance.telemetryState.tone
                  }
                ]}
              />
            </section>
          </div>
        )}

        {activeTab === "career" && (
          <section className="command-panel profile-career-panel">
            <div className="panel-header">
              <h2>Career Record</h2>
              <span>{model.career.stage} / {model.career.trajectory}</span>
            </div>
            <div className="profile-career-state">
              <p>
                <SmartPlayerText text={model.career.narrative} />
              </p>
              <div className="profile-career-summary-strip">
                {model.career.recordCards.map((card) => (
                  <span key={card.label} title={`${card.label}: ${card.value}`}>
                    {card.label}: {card.value}
                  </span>
                ))}
              </div>
              <div className="profile-career-grid">
                <section className="profile-career-archive-block">
                  <h3>Prime / Age Curve</h3>
                  <p>{model.career.primeNote}</p>
                </section>
                <section className="profile-career-archive-block profile-career-milestones">
                  <h3>Milestones</h3>
                  <TextList items={model.career.milestones} empty="No milestones recorded." />
                </section>
              </div>

              <section className="profile-career-archive-block">
                <h3>Tournament Timeline</h3>
                {model.career.timeline.length > 0 ? (
                  <div className="profile-timeline-list">
                    {model.career.timeline.map((entry) => (
                      <div key={entry.id} className={toneClass("profile-timeline-row", entry.tone)}>
                        <span>{entry.date}</span>
                        <strong>
                          <TournamentLink seasonId={props.career?.seasonId} eventId={entry.eventId}>
                            {entry.eventName}
                          </TournamentLink>
                        </strong>
                        <p>{entry.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No chronological tournament records yet.</p>
                )}
              </section>

              <div className="profile-career-archive-grid">
                <section className="profile-career-archive-block">
                  <h3>Titles</h3>
                  {model.career.titles.length > 0 ? (
                    <div className="profile-achievement-list">
                      {model.career.titles.map((achievement) => (
                        <div key={`${achievement.eventId}-${achievement.result}`} className="profile-achievement-row">
                          <strong>
                            <TournamentLink seasonId={props.career?.seasonId} eventId={achievement.eventId}>
                              {achievement.eventName}
                            </TournamentLink>
                          </strong>
                          <span>{achievement.date} / {achievement.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No titles recorded.</p>
                  )}
                </section>
                <section className="profile-career-archive-block">
                  <h3>Runner-Up Finishes</h3>
                  {model.career.runnerUpFinishes.length > 0 ? (
                    <div className="profile-achievement-list">
                      {model.career.runnerUpFinishes.map((achievement) => (
                        <div key={`${achievement.eventId}-${achievement.result}`} className="profile-achievement-row">
                          <strong>
                            <TournamentLink seasonId={props.career?.seasonId} eventId={achievement.eventId}>
                              {achievement.eventName}
                            </TournamentLink>
                          </strong>
                          <span>{achievement.date} / {achievement.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No runner-up finishes recorded.</p>
                  )}
                </section>
              </div>

              <div className="profile-career-archive-grid">
                <section className="profile-career-archive-block">
                  <h3>Biggest Wins</h3>
                  {model.career.biggestWins.length > 0 ? (
                    <div className="profile-achievement-list">
                      {model.career.biggestWins.map((result) => (
                        <div key={result.id} className="profile-achievement-row">
                          <strong>
                            <PlayerLink playerId={result.opponentId}>{result.opponentName}</PlayerLink>
                          </strong>
                          <span>{result.eventName} {result.round} / {result.scoreline} / Opp OVR {result.opponentOverall}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No recorded wins to interpret.</p>
                  )}
                </section>
                <section className="profile-career-archive-block">
                  <h3>Worst Losses</h3>
                  {model.career.worstLosses.length > 0 ? (
                    <div className="profile-achievement-list">
                      {model.career.worstLosses.map((result) => (
                        <div key={result.id} className="profile-achievement-row">
                          <strong>
                            <PlayerLink playerId={result.opponentId}>{result.opponentName}</PlayerLink>
                          </strong>
                          <span>{result.eventName} {result.round} / {result.scoreline} / Opp OVR {result.opponentOverall}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No recorded losses to interpret.</p>
                  )}
                </section>
              </div>

              {managedPlayerSpotlight && managedPlayerSpotlightLabel && (
                <section className="profile-career-archive-block profile-managed-spotlight">
                  <h3>Vs Managed Player</h3>
                  <p>
                    <PlayerLink playerId={managedPlayerSpotlight.opponentId}>{managedPlayerSpotlightLabel}</PlayerLink>
                  </p>
                </section>
              )}

              <section className="profile-career-archive-block profile-career-h2h-block">
                <h3>Rivalries And Head-To-Head</h3>
                {model.career.rivalries.length > 0 ? (
                  <table className="profile-h2h-table" aria-label="Head-to-head records">
                    <thead>
                      <tr>
                        <th>Relationship</th>
                        <th>Opponent</th>
                        <th>Played</th>
                        <th>W-L</th>
                        <th>Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.career.rivalries.map((entry) => (
                        <tr key={entry.opponentId}>
                          <td>
                            <strong>{entry.rivalryLabel}</strong>
                            <small>{entry.interpretation}</small>
                          </td>
                          <td>
                            <PlayerLink playerId={entry.opponentId}>{entry.opponentName}</PlayerLink>
                          </td>
                          <td>{entry.played}</td>
                          <td>{entry.wins}-{entry.losses}</td>
                          <td>{entry.winPercentageLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No completed head-to-head matches recorded.</p>
                )}
              </section>
              {!model.career.hasRecordedHistory && (
                <ProfileEmptyState
                  title="No persisted career history yet."
                  copy="Completed career matches and final results will populate this archive without fabricating past records."
                />
              )}
            </div>
          </section>
        )}

        {activeTab === "future" && model.context.isManaged && (
          <div className="profile-future-grid">
            <section className="command-panel profile-development-panel">
              <div className="panel-header">
                <h2>Development Plan</h2>
                <span>How should I improve this athlete next?</span>
              </div>
              <div className="profile-plan-card profile-plan-card-large">
                <span>Current Plan</span>
                <strong>{model.development.currentPlan}</strong>
                <p>Recommended focus: {model.development.recommendedFocus}</p>
                <small>Expected Gain: {model.development.expectedGain}</small>
                <em>{model.development.workloadImplication}</em>
              </div>
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Potential And Age Curve</h2>
                <span>{model.career.stage}</span>
              </div>
              <p className="profile-context-copy">{model.development.potentialNote}</p>
              <div className="profile-route-chip profile-route-chip-warning">
                <span>Injury / Overuse Risk</span>
                <em>{model.development.injuryRisk}</em>
              </div>
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Cumulative Development</h2>
                <span>Against earliest honest baseline</span>
              </div>
              <TextList items={model.development.cumulativeDevelopment} empty="No development baseline recorded." />
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Development History</h2>
                <span>Dated persisted outcomes only</span>
              </div>
              <TextList items={model.development.recentTrainingGains} empty="No preparation outcomes recorded." />
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Coach Notes</h2>
                <span>Workload implications</span>
              </div>
              <TextList items={model.development.coachNotes} empty="No coach notes available." />
            </section>
          </div>
        )}

        {activeTab === "future" && !model.context.isManaged && (
          <div className="profile-future-grid">
            <section className="command-panel profile-scouting-panel">
              <div className="panel-header">
                <h2>Scouting Confidence</h2>
                <span>What do I know?</span>
              </div>
              <div className="profile-plan-card profile-plan-card-large">
                <span>Confidence</span>
                <strong>{model.scouting.confidence}%</strong>
                <p>{model.scouting.recommendation}</p>
                <small>{model.scouting.comparison}</small>
                <em>Next Scout Focus: {model.scouting.nextFocus}</em>
              </div>
              {canSelect && (
                <button className="command-button command-button-primary" type="button" onClick={() => props.onSelectPlayer(player.id)}>
                  Select Athlete
                </button>
              )}
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Discovered Strengths</h2>
                <span>Known</span>
              </div>
              <TextList items={model.scouting.discoveredStrengths} empty="No strengths verified." />
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Uncertain Areas</h2>
                <span>Unknown</span>
              </div>
              <TextList items={model.scouting.uncertainAreas} empty="No uncertainty notes." />
            </section>
            <section className="command-panel">
              <div className="panel-header">
                <h2>Opponent Preparation Notes</h2>
                <span>{model.scouting.affordanceLabel}</span>
              </div>
              <TextList items={model.scouting.opponentPreparation} empty="Opponent preparation unlocks from matchup context." />
            </section>
          </div>
        )}
      </div>

      <span className="sr-only">Active profile tab: {activeTabLabel}</span>
    </section>
  );
}
