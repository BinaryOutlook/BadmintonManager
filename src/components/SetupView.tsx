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

function overallFromDossier(dossier: ReturnType<typeof deriveAthleteDossier>) {
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

export function rankRosterByOverall(entries = seededPlayers) {
  const scoredEntries = entries.map((entry) => {
    const dossier = deriveAthleteDossier(entry.player);

    return {
      entry,
      dossier,
      overall: overallFromDossier(dossier)
    };
  });

  return scoredEntries
    .sort((left, right) => right.overall - left.overall || left.entry.seed - right.entry.seed)
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
}

export function SetupView(props: SetupViewProps) {
  const rankedRoster = rankRosterByOverall();
  const selected =
    rankedRoster.find((item) => item.entry.player.id === props.selectedPlayerId) ?? rankedRoster[0];

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
            <span>{rankedRoster.length} athletes - sorted by OVR</span>
          </div>
          <div className="roster-grid">
            {rankedRoster.map((item) => {
              return (
                <button
                  key={item.entry.player.id}
                  type="button"
                  className={`athlete-card ${
                    item.entry.player.id === props.selectedPlayerId ? "athlete-card-active" : ""
                  }`}
                  aria-pressed={item.entry.player.id === props.selectedPlayerId}
                  onClick={() => props.onSelectPlayer(item.entry.player.id)}
                >
                  <div className="athlete-card-header">
                    <div className="athlete-card-identity">
                      <span className="athlete-avatar">{item.entry.player.nationality}</span>
                      <strong>{item.entry.player.name}</strong>
                    </div>
                    <span className="athlete-card-rank">OVR Rank #{item.rank}</span>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill" style={{ width: `${item.overall}%` }} />
                  </div>
                  <div className="athlete-card-footer">
                    <span>{item.entry.player.styleLabel}</span>
                    <span>OVR {item.overall}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="command-panel dossier-panel">
          <div className="panel-header">
            <h2>Selected Operative</h2>
            <span>OVR Rank #{selected.rank}</span>
          </div>

          <div className="dossier-identity">
            <div>
              <p className="dossier-overline">{selected.entry.player.nationality}</p>
              <h3>{selected.entry.player.name}</h3>
              <p>{selected.entry.player.styleLabel}</p>
            </div>
            <div className="dossier-avatar">{selected.entry.player.nationality}</div>
          </div>

          <div className="dossier-metrics">
            <div>
              <div className="metric-row">
                <span>Power</span>
                <strong>{selected.dossier.power}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill metric-track-fill-neutral" style={{ width: `${selected.dossier.power}%` }} />
              </div>
            </div>
            <div>
              <div className="metric-row">
                <span>Speed</span>
                <strong>{selected.dossier.speed}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill metric-track-fill-cyan" style={{ width: `${selected.dossier.speed}%` }} />
              </div>
            </div>
            <div>
              <div className="metric-row">
                <span>Stamina</span>
                <strong>{selected.dossier.stamina}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill" style={{ width: `${selected.dossier.stamina}%` }} />
              </div>
            </div>
            <div>
              <div className="metric-row">
                <span>Control</span>
                <strong>{selected.dossier.control}</strong>
              </div>
              <div className="metric-track">
                <div className="metric-track-fill metric-track-fill-soft" style={{ width: `${selected.dossier.control}%` }} />
              </div>
            </div>
          </div>

          <div className="dossier-note">
            <span className="chip chip-primary">OVR {selected.overall}</span>
            <p className="dossier-note-title">{selected.dossier.formHeadline}</p>
            <p>{selected.dossier.formSummary}</p>
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
