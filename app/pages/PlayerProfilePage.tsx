import { useState } from "react";
import { PlayerLink, SmartPlayerText } from "../../components/PlayerLink";
import { createPlayerProfileViewModel } from "../../game/selectors/player";
import type { AppPhase } from "../../game/store/store";
import type { CareerState } from "../../game/career/models";
import type { LiveMatchSession } from "../../game/core/models";
import type { TournamentState } from "../../game/tournament/tournament";

type ProfileTab = "overview" | "attributes" | "performance" | "career";

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

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "attributes", label: "Attributes" },
  { id: "performance", label: "Performance" },
  { id: "career", label: "Career" }
];

const derivedAxisLabels: Record<string, string> = {
  attackPressure: "Attack",
  frontCourtControl: "Front Court",
  recoveryQuality: "Recovery",
  rallyTolerance: "Rally",
  pressureResistance: "Pressure",
  judgment: "Judgment"
};

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

function AttributeRows(props: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  tone?: "neutral" | "cyan" | "soft";
}) {
  const fillClass =
    props.tone === "cyan"
      ? "metric-track-fill metric-track-fill-cyan"
      : props.tone === "soft"
        ? "metric-track-fill metric-track-fill-soft"
        : "metric-track-fill";

  return (
    <section className="profile-attribute-group">
      <h3>{props.title}</h3>
      <div className="profile-attribute-list">
        {props.rows.map((row) => (
          <div key={row.label} className="profile-attribute-row">
            <div className="metric-row">
              <span>{row.label}</span>
              <strong>
                {Math.round(row.value)} <em>{attributeBenchmark(row.value)}</em>
              </strong>
            </div>
            <div className="metric-track">
              <div className={fillClass} style={{ width: `${Math.round(row.value)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function attributeBenchmark(value: number) {
  if (value >= 88) {
    return "Elite";
  }

  if (value >= 80) {
    return "Strong";
  }

  if (value >= 70) {
    return "Average";
  }

  return "Weak";
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

export function PlayerProfilePage(props: PlayerProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const model = createPlayerProfileViewModel({
    playerId: props.playerId,
    selectedPlayerId: props.selectedPlayerId,
    tournament: props.tournament,
    liveMatch: props.liveMatchSession,
    career: props.career
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

  const { player, derived } = model;
  const canSelect = !props.careerPresent && props.phase === "setup" && player.id !== props.selectedPlayerId;
  const technicalRows = [
    { label: "Smash", value: player.ratings.technical.smash },
    { label: "Net Play", value: player.ratings.technical.netPlay },
    { label: "Clear / Lob", value: player.ratings.technical.clearLob },
    { label: "Drop Shot", value: player.ratings.technical.dropShot },
    { label: "Defense / Retrieval", value: player.ratings.technical.defenseRetrieval },
    { label: "Serve / Return", value: player.ratings.technical.serveReturn }
  ];
  const physicalRows = [
    { label: "Stamina", value: player.ratings.physical.stamina },
    { label: "Footwork Speed", value: player.ratings.physical.footworkSpeed },
    { label: "Explosiveness / Jump", value: player.ratings.physical.explosivenessJump },
    { label: "Agility / Balance", value: player.ratings.physical.agilityBalance }
  ];
  const mentalRows = [
    { label: "Anticipation", value: player.ratings.mental.anticipation },
    { label: "Composure", value: player.ratings.mental.composure },
    { label: "Focus", value: player.ratings.mental.focus },
    { label: "Aggression", value: player.ratings.mental.aggression }
  ];
  const derivedRows = Object.entries(derived).map(([key, value]) => ({
    label: derivedAxisLabels[key] ?? key,
    value
  }));
  const visibleStrengths = model.coachReport.strengths.slice(0, 2);
  const visibleWeaknesses = model.coachReport.weaknesses.slice(0, 2);
  const visibleRiskFlags = model.coachReport.riskFlags.slice(0, 2);
  const hiddenRiskFlagCount = Math.max(0, model.coachReport.riskFlags.length - visibleRiskFlags.length);

  return (
    <section className="screen-shell player-profile-page">
      <header className={`player-profile-hero player-profile-hero-${model.context.tone}`}>
        <div className="player-profile-avatar">{player.nationality}</div>
        <div className="player-profile-heading">
          <p className="screen-kicker">{model.context.label}</p>
          <h1>{player.name}</h1>
          <div className="player-profile-meta">
            <span>{player.nationality}</span>
            <span>{player.age} years old</span>
            <span>{player.handedness === "left" ? "Left-handed" : "Right-handed"}</span>
            <span>{model.coachReport.archetype}</span>
          </div>
        </div>
        <div className="player-profile-score">
          <span>OVR</span>
          <strong>{model.overall}</strong>
        </div>
      </header>

      <div className="player-profile-toolbar">
        <div className="profile-tab-list" role="tablist" aria-label="Player profile sections">
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "profile-tab profile-tab-active" : "profile-tab"}
              onClick={() => setActiveTab(tab.id)}
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

      {activeTab === "overview" && (
        <div className="player-profile-grid player-profile-grid-overview">
          <section className="command-panel profile-radar-panel">
            <div className="panel-header">
              <h2>Radar Profile</h2>
              <span>{model.coachReport.archetype}</span>
            </div>
            <RadarChart metrics={model.radar} />
          </section>

          <section className="command-panel profile-scout-panel">
            <div className="panel-header">
              <h2>Coach Report</h2>
              <span>{model.context.label}</span>
            </div>
            <p className="profile-context-copy">
              <SmartPlayerText text={model.coachReport.summary} />
            </p>
            <div className="profile-report-columns">
              <div>
                <h3>Strengths</h3>
                <ul>
                  {visibleStrengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Weaknesses</h3>
                <ul>
                  {visibleWeaknesses.map((weakness) => (
                    <li key={weakness}>{weakness}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="profile-decision-box">
              <span>Selection Recommendation</span>
              <strong>{model.coachReport.selectionRecommendation}</strong>
              <p>
                <SmartPlayerText text={model.coachReport.bestUse} />
              </p>
            </div>
          </section>

          <section className="command-panel command-panel-full profile-fit-panel">
            <div className="panel-header">
              <h2>Tactical Fit</h2>
              <span>Interpretation + drivers</span>
            </div>
            <div className="profile-tactic-grid">
              {model.tacticFits.map((fit) => (
                <article key={fit.key} className="profile-tactic-card">
                  <div className="profile-tactic-card-top">
                    <strong>{fit.label}</strong>
                    <span>{fit.score}</span>
                  </div>
                  <p>{fit.headline}</p>
                  <small>{fit.risk}</small>
                  <span className="profile-driver-line">Drivers: {fit.drivers.join(" · ")}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="command-panel profile-risk-panel">
            <div className="panel-header">
              <h2>Risk Flags</h2>
              <span>Managerial caution</span>
            </div>
            <ul className="profile-risk-list">
              {visibleRiskFlags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
              {hiddenRiskFlagCount > 0 && <li>+{hiddenRiskFlagCount} more scouting notes</li>}
            </ul>
          </section>

          <section className="command-panel profile-readiness-panel">
            <div className="panel-header">
              <h2>Recent Readiness</h2>
              <span>Current run</span>
            </div>
            <div className="profile-readiness-grid">
              {model.coachReport.readiness.map((entry) => (
                <div key={entry.label}>
                  <span>{entry.label}</span>
                  <strong>{entry.value}</strong>
                  <small>{entry.detail}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "attributes" && (
        <div className="profile-attributes-grid">
          <AttributeRows title="Technical" rows={technicalRows} />
          <AttributeRows title="Physical" rows={physicalRows} tone="cyan" />
          <AttributeRows title="Mental" rows={mentalRows} tone="soft" />
          <AttributeRows title="Derived Profile" rows={derivedRows} />
        </div>
      )}

      {activeTab === "performance" && (
        <div className="profile-performance-grid">
          <section className="command-panel command-panel-wide">
            <div className="panel-header">
              <h2>Current-Run Evidence</h2>
              <span>{model.performance.formLabel}</span>
            </div>
            <div className="profile-form-strip">
              <span>Recent Form</span>
              {model.performance.recentForm.length > 0 ? (
                <div>
                  {model.performance.recentForm.map((result, index) => (
                    <strong
                      key={`${result}-${index}`}
                      className={result === "W" ? "form-chip form-chip-win" : "form-chip form-chip-loss"}
                    >
                      {result}
                    </strong>
                  ))}
                </div>
              ) : (
                <p>No current-run form line.</p>
              )}
            </div>
            {model.performance.entries.length > 0 ? (
              <div className="path-grid">
                {model.performance.entries.map((entry) => (
                  <article key={`${entry.label}-${entry.detail}`} className={`path-card path-card-${entry.result}`}>
                    <span>{entry.label}</span>
                    <strong>{entry.result}</strong>
                    <small>
                      <SmartPlayerText text={entry.detail} />
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <ProfileEmptyState
                title="No match evidence yet."
                copy="Select this athlete for a managed match to unlock performance telemetry, form trends, and opponent-specific analysis."
              />
            )}
          </section>

          <section className="command-panel">
            <div className="panel-header">
              <h2>Managed Telemetry</h2>
              <span>{player.id === props.selectedPlayerId ? "Available when played" : "Opponent context"}</span>
            </div>
            {model.performance.aggregateStats.length > 0 ? (
              <div className="recap-stat-list">
                {model.performance.aggregateStats.map((entry) => (
                  <div key={entry.label} className="recap-stat-row">
                    <span>{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <ProfileEmptyState
                title="Telemetry locked."
                copy="Managed match stats will appear here after this athlete creates real winners, errors, stamina, and rally evidence."
              />
            )}
          </section>
        </div>
      )}

      {activeTab === "career" && (
        <section className="command-panel">
          <div className="panel-header">
            <h2>Career Record</h2>
            <span>{model.career.stage}</span>
          </div>
          <div className="profile-career-state">
            <p>
              <SmartPlayerText text={model.career.narrative} />
            </p>
            <div className="profile-career-grid">
              <div className="profile-career-facts">
                {model.career.recordCards.map((card) => (
                  <span key={card.label} title={`${card.label}: ${card.value}`}>
                    {card.label}: {card.value}
                  </span>
                ))}
              </div>
              <div className="profile-career-milestones">
                <h3>Milestones</h3>
                <ul>
                  {model.career.milestones.map((milestone) => (
                    <li key={milestone}>{milestone}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="profile-career-archive-grid">
              <section className="profile-career-archive-block">
                <h3>Titles</h3>
                {model.career.titles.length > 0 ? (
                  <div className="profile-achievement-list">
                    {model.career.titles.map((achievement) => (
                      <div key={`${achievement.eventId}-${achievement.result}`} className="profile-achievement-row">
                        <strong>{achievement.eventName}</strong>
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
                        <strong>{achievement.eventName}</strong>
                        <span>{achievement.date} / {achievement.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No runner-up finishes recorded.</p>
                )}
              </section>
            </div>
            <section className="profile-career-archive-block profile-career-h2h-block">
              <h3>Head-To-Head</h3>
              {model.career.headToHead.length > 0 ? (
                <table className="profile-h2h-table" aria-label="Head-to-head records">
                  <thead>
                    <tr>
                      <th>Opponent</th>
                      <th>Played</th>
                      <th>W-L</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.career.headToHead.map((entry) => (
                      <tr key={entry.opponentId}>
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
    </section>
  );
}
