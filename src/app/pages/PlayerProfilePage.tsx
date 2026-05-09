import { useState } from "react";
import { createPlayerProfileViewModel } from "../../game/selectors/player";
import type { AppPhase } from "../../game/store/store";
import type { LiveMatchSession } from "../../game/core/models";
import type { TournamentState } from "../../game/tournament/tournament";

type ProfileTab = "overview" | "attributes" | "performance" | "career";

interface PlayerProfilePageProps {
  playerId: string;
  selectedPlayerId: string;
  phase: AppPhase;
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
              <strong>{Math.round(row.value)}</strong>
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

export function PlayerProfilePage(props: PlayerProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const model = createPlayerProfileViewModel({
    playerId: props.playerId,
    selectedPlayerId: props.selectedPlayerId,
    tournament: props.tournament,
    liveMatch: props.liveMatchSession
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

  const { player, dossier, derived } = model;
  const canSelect = props.phase === "setup" && player.id !== props.selectedPlayerId;
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
            <span>{player.styleLabel}</span>
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
        <div className="player-profile-grid">
          <section className="command-panel profile-identity-panel">
            <div className="panel-header">
              <h2>Coach Read</h2>
              <span>{model.context.label}</span>
            </div>
            <p className="profile-context-copy">{model.context.detail}</p>

            <div className="profile-dossier-grid">
              <div>
                <span>Power</span>
                <strong>{dossier.power}</strong>
              </div>
              <div>
                <span>Speed</span>
                <strong>{dossier.speed}</strong>
              </div>
              <div>
                <span>Stamina</span>
                <strong>{dossier.stamina}</strong>
              </div>
              <div>
                <span>Control</span>
                <strong>{dossier.control}</strong>
              </div>
            </div>

            <div className="dossier-note">
              <span className="chip chip-primary">{dossier.formHeadline}</span>
              <p>{dossier.formSummary}</p>
            </div>
          </section>

          <section className="command-panel profile-strength-panel">
            <div className="panel-header">
              <h2>Top Weapons</h2>
              <span>Ratings-backed</span>
            </div>
            <div className="profile-strength-list">
              {model.strengths.map((strength) => (
                <div key={`${strength.group}-${strength.label}`} className="profile-strength-row">
                  <div>
                    <strong>{strength.label}</strong>
                    <span>{strength.group}</span>
                  </div>
                  <span>{strength.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="command-panel command-panel-full">
            <div className="panel-header">
              <h2>Tactical Fit</h2>
              <span>Generated from badminton attributes</span>
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
                </article>
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
        <div className="complete-grid">
          <section className="command-panel command-panel-wide">
            <div className="panel-header">
              <h2>Current-Run Evidence</h2>
              <span>{model.performance.entries.length} entries</span>
            </div>
            {model.performance.entries.length > 0 ? (
              <div className="path-grid">
                {model.performance.entries.map((entry) => (
                  <article key={`${entry.label}-${entry.detail}`} className={`path-card path-card-${entry.result}`}>
                    <span>{entry.label}</span>
                    <strong>{entry.result}</strong>
                    <small>{entry.detail}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="panel-summary">No match record exists for this athlete in the current run.</p>
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
              <p className="panel-summary">Detailed telemetry appears after managed matches create real evidence.</p>
            )}
          </section>
        </div>
      )}

      {activeTab === "career" && (
        <section className="command-panel">
          <div className="panel-header">
            <h2>Career Scaffold</h2>
            <span>Season-ready</span>
          </div>
          <div className="profile-career-state">
            <p>
              Long-term records will connect here once seasons, calendar progression, and career
              persistence are implemented.
            </p>
            <div className="profile-career-facts">
              <span>{player.nationality}</span>
              <span>{player.styleLabel}</span>
              <span>{model.traits.length > 0 ? `${model.traits.length} traits` : "No traits listed"}</span>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
