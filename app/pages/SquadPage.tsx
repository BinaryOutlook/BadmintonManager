import { seededPlayers } from "../../game/content/players";
import { createPlayerProfileViewModel } from "../../game/selectors/player";
import type { AppPhase } from "../../game/store/store";
import type { LiveMatchSession } from "../../game/core/models";
import type { TournamentState } from "../../game/tournament/tournament";

interface SquadPageProps {
  selectedPlayerId: string;
  phase: AppPhase;
  tournament: TournamentState | null;
  liveMatchSession?: LiveMatchSession | null;
  onOpenPlayerProfile: (playerId: string) => void;
  onSelectPlayer: (playerId: string) => void;
}

export function SquadPage(props: SquadPageProps) {
  const roster = seededPlayers
    .map((entry) => {
      const profile = createPlayerProfileViewModel({
        playerId: entry.player.id,
        selectedPlayerId: props.selectedPlayerId,
        tournament: props.tournament,
        liveMatch: props.liveMatchSession
      });

      return profile ? { entry, profile } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.profile.overall - left.profile.overall || left.entry.seed - right.entry.seed);

  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Squad</p>
          <h1 className="screen-title">Athlete Directory</h1>
          <p className="screen-copy">
            Browse the local fictional player pool and open a generated profile for any athlete.
          </p>
        </div>
        <div className="screen-meta">
          <span>{roster.length} athletes</span>
          <span>{props.phase === "setup" ? "Selection editable" : "Run athlete locked"}</span>
        </div>
      </div>

      <section className="command-panel">
        <div className="panel-header">
          <h2>Player Pool</h2>
          <span>Sorted by OVR</span>
        </div>
        <div className="squad-directory-grid">
          {roster.map(({ entry, profile }, index) => (
            <article
              key={entry.player.id}
              className={`athlete-card ${entry.player.id === props.selectedPlayerId ? "athlete-card-active" : ""}`}
            >
              <div className="athlete-card-header">
                <span className="athlete-avatar">{entry.player.nationality}</span>
                <span className="athlete-card-rank">OVR #{index + 1}</span>
              </div>
              <button
                className="athlete-profile-button athlete-profile-button-block"
                type="button"
                onClick={() => props.onOpenPlayerProfile(entry.player.id)}
              >
                {entry.player.name}
              </button>
              <div className="metric-track">
                <div className="metric-track-fill" style={{ width: `${profile.overall}%` }} />
              </div>
              <div className="athlete-card-footer">
                <span>{entry.player.styleLabel}</span>
                <span>OVR {profile.overall}</span>
              </div>
              {props.phase === "setup" && entry.player.id !== props.selectedPlayerId && (
                <button
                  className="sidebar-mini-button athlete-select-button"
                  type="button"
                  onClick={() => props.onSelectPlayer(entry.player.id)}
                >
                  Select Athlete
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
