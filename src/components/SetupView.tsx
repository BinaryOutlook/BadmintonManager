import { seededPlayers } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { deriveAthleteDossier } from "../game/core/intel";
import type { TacticKey } from "../game/store/store";

interface SetupViewProps {
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  onSelectPlayer: (playerId: string) => void;
  onChooseTactic: (tacticKey: TacticKey) => void;
  onStartTournament: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function overallFromDossier(dossier: ReturnType<typeof deriveAthleteDossier>) {
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

export function SetupView(props: SetupViewProps) {
  const selected =
    seededPlayers.find((entry) => entry.player.id === props.selectedPlayerId) ?? seededPlayers[0];
  const dossier = deriveAthleteDossier(selected.player);
  const overall = overallFromDossier(dossier);

  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Squad</p>
          <h1 className="screen-title">Tournament Deployment</h1>
          <p className="screen-copy">
            Configure the managed athlete and opening tactical override for the next tournament run.
          </p>
        </div>
        <button className="command-button command-button-primary" onClick={props.onStartTournament}>
          Start Tournament
        </button>
      </div>

      <div className="deployment-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Active Roster</h2>
            <span>{seededPlayers.length} athletes loaded</span>
          </div>
          <div className="roster-grid">
            {seededPlayers.map((entry) => {
              const entryDossier = deriveAthleteDossier(entry.player);
              const entryOverall = overallFromDossier(entryDossier);

              return (
                <button
                  key={entry.player.id}
                  type="button"
                  className={`athlete-card ${
                    entry.player.id === props.selectedPlayerId ? "athlete-card-active" : ""
                  }`}
                  aria-pressed={entry.player.id === props.selectedPlayerId}
                  onClick={() => props.onSelectPlayer(entry.player.id)}
                >
                  <div className="athlete-card-header">
                    <span className="athlete-avatar">{initials(entry.player.name)}</span>
                    <div>
                      <strong>{entry.player.name}</strong>
                      <span>Seed #{entry.seed}</span>
                    </div>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill" style={{ width: `${entryOverall}%` }} />
                  </div>
                  <div className="athlete-card-footer">
                    <span>{entry.player.styleLabel}</span>
                    <span>OVR {entryOverall}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="command-panel dossier-panel">
          <div className="panel-header">
            <h2>Selected Operative</h2>
            <span>World #{selected.seed}</span>
          </div>

          <div className="dossier-identity">
            <div>
              <p className="dossier-overline">{selected.player.nationality}</p>
              <h3>{selected.player.name}</h3>
              <p>{selected.player.styleLabel}</p>
            </div>
            <div className="dossier-avatar">{initials(selected.player.name)}</div>
          </div>

          <div className="dossier-metrics">
            <div>
              <div className="metric-row">
                <span>Power</span>
                <strong>{dossier.power}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill metric-track-fill-neutral" style={{ width: `${dossier.power}%` }} />
              </div>
            </div>
            <div>
              <div className="metric-row">
                <span>Speed</span>
                <strong>{dossier.speed}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill metric-track-fill-cyan" style={{ width: `${dossier.speed}%` }} />
              </div>
            </div>
            <div>
              <div className="metric-row">
                <span>Stamina</span>
                <strong>{dossier.stamina}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill" style={{ width: `${dossier.stamina}%` }} />
              </div>
            </div>
            <div>
              <div className="metric-row">
                <span>Control</span>
                <strong>{dossier.control}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill metric-track-fill-soft" style={{ width: `${dossier.control}%` }} />
              </div>
            </div>
          </div>

          <div className="dossier-note">
            <span className="chip chip-primary">OVR {overall}</span>
            <p className="dossier-note-title">{dossier.formHeadline}</p>
            <p>{dossier.formSummary}</p>
          </div>
        </aside>

        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Strategic Override</h2>
            <span>Commit the opening coaching stance</span>
          </div>
          <div className="tactic-option-grid">
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
        </section>
      </div>
    </section>
  );
}
