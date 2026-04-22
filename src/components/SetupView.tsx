import { seededPlayers } from "../game/content/players";
import { tacticLibrary, tacticOptions } from "../game/content/tactics";
import { deriveProfile } from "../game/core/ratings";
import type { TacticKey } from "../game/store/store";

interface SetupViewProps {
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  onSelectPlayer: (playerId: string) => void;
  onChooseTactic: (tacticKey: TacticKey) => void;
  onStartTournament: () => void;
}

const tacticLabels: Record<TacticKey, string> = {
  balancedControl: "Balanced Control",
  backhandPress: "Backhand Press",
  grindingLength: "Grinding Length",
  allOutAttack: "All-Out Attack"
};

const tacticDescriptions: Record<TacticKey, string> = {
  balancedControl: "Stable tempo, strong net pressure, and low drama.",
  backhandPress: "Lean into targeted pressure and sharper interceptions.",
  grindingLength: "Pull the match long, protect stamina, and break rhythm.",
  allOutAttack: "Chase initiative early and accept the risk that comes with it."
};

export function SetupView(props: SetupViewProps) {
  const selected = seededPlayers.find((entry) => entry.player.id === props.selectedPlayerId) ?? seededPlayers[0];
  const profile = deriveProfile(selected.player);

  return (
    <section className="phase-layout">
      <div className="phase-header">
        <div>
          <p className="eyebrow">Tournament Setup</p>
          <h2>Choose the athlete and the opening tactical lens.</h2>
        </div>
        <button className="primary-button" onClick={props.onStartTournament}>
          Start tournament run
        </button>
      </div>

      <div className="setup-grid">
        <div className="surface-card">
          <p className="surface-label">Managed Player</p>
          <div className="selected-player">
            <div>
              <h3>{selected.player.name}</h3>
              <p>
                Seed {selected.seed} · {selected.player.nationality} · {selected.player.styleLabel}
              </p>
            </div>
            <div className="rating-chip">
              <strong>{Math.round(profile.attackPressure)}</strong>
              <span>Attack Pressure</span>
            </div>
          </div>

          <div className="attribute-grid">
            <div className="metric-pill">
              <span>Front Court</span>
              <strong>{Math.round(profile.frontCourtControl)}</strong>
            </div>
            <div className="metric-pill">
              <span>Recovery</span>
              <strong>{Math.round(profile.recoveryQuality)}</strong>
            </div>
            <div className="metric-pill">
              <span>Rally Tolerance</span>
              <strong>{Math.round(profile.rallyTolerance)}</strong>
            </div>
            <div className="metric-pill">
              <span>Pressure</span>
              <strong>{Math.round(profile.pressureResistance)}</strong>
            </div>
          </div>
        </div>

        <div className="surface-card">
          <p className="surface-label">Player Pool</p>
          <div className="player-grid">
            {seededPlayers.map((entry) => (
              <button
                key={entry.player.id}
                className={`player-tile ${
                  entry.player.id === props.selectedPlayerId ? "player-tile-active" : ""
                }`}
                onClick={() => props.onSelectPlayer(entry.player.id)}
              >
                <span className="player-seed">#{entry.seed}</span>
                <strong>{entry.player.name}</strong>
                <small>{entry.player.styleLabel}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <p className="surface-label">Pre-Match Identity</p>
          <div className="tactic-grid">
            {(Object.keys(tacticLibrary) as TacticKey[]).map((key) => (
              <button
                key={key}
                className={`tactic-card ${
                  props.plannedTacticKey === key ? "tactic-card-active" : ""
                }`}
                onClick={() => props.onChooseTactic(key)}
              >
                <strong>{tacticLabels[key]}</strong>
                <span>{tacticDescriptions[key]}</span>
                <small>
                  {tacticOptions.find((entry) => entry.label === tacticLabels[key])?.tempo ?? tacticLibrary[key].tempo}
                  {" · "}
                  {tacticLibrary[key].riskProfile.replace("_", " ")}
                </small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
