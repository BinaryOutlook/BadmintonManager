import { playerMap } from "../game/content/players";
import { tacticDefinitions } from "../game/content/tactics";
import { deriveAthleteDossier, deriveThreatReport, summarizeTacticPlan } from "../game/core/intel";
import type { TournamentState } from "../game/tournament/tournament";
import type { TacticKey } from "../game/store/store";
import type { LiveMatchSession, Side } from "../game/core/models";

interface TacticalIntelPanelProps {
  open: boolean;
  phase: "setup" | "overview" | "match" | "complete";
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  tournament: TournamentState | null;
  liveMatch: { managedSide: Side; session: LiveMatchSession } | null;
  onClose: () => void;
}

export function TacticalIntelPanel(props: TacticalIntelPanelProps) {
  const selectedPlayer = playerMap[props.selectedPlayerId];
  const tactic = tacticDefinitions[props.plannedTacticKey];
  const dossier = deriveAthleteDossier(selectedPlayer);
  const tacticPlan = summarizeTacticPlan(selectedPlayer, tactic.tactic);

  let opponent = null;

  if (props.liveMatch) {
    opponent =
      props.liveMatch.managedSide === "A"
        ? props.liveMatch.session.input.playerB
        : props.liveMatch.session.input.playerA;
  } else if (props.tournament) {
    const currentRound = props.tournament.rounds[props.tournament.currentRoundIndex];
    const managedMatch = currentRound.matches.find((match) => match.managed);
    const opponentId =
      managedMatch?.sideAId === props.selectedPlayerId ? managedMatch.sideBId : managedMatch?.sideAId;
    opponent = opponentId ? playerMap[opponentId] : null;
  }

  const threat = opponent ? deriveThreatReport(selectedPlayer, opponent) : null;

  return (
    <aside className={`intel-drawer ${props.open ? "intel-drawer-open" : ""}`}>
      <div className="intel-drawer-header">
        <div>
          <p className="screen-kicker">Tactical Intel</p>
          <h2>Context Layer</h2>
        </div>
        <button className="command-button command-button-secondary" onClick={props.onClose}>
          Close
        </button>
      </div>

      <div className="intel-section">
        <h3>Managed Athlete</h3>
        <p className="intel-title">{selectedPlayer.name}</p>
        <p>
          {selectedPlayer.nationality} · {selectedPlayer.styleLabel}
        </p>
        <ul className="intel-list">
          <li>Power: {dossier.power}</li>
          <li>Speed: {dossier.speed}</li>
          <li>Stamina: {dossier.stamina}</li>
          <li>Control: {dossier.control}</li>
        </ul>
      </div>

      <div className="intel-section">
        <h3>Chosen Plan</h3>
        <p className="intel-title">{tactic.label}</p>
        <p>{tactic.summary}</p>
        <p className="intel-note">
          {tacticPlan.title} {tacticPlan.summary}
        </p>
      </div>

      {threat && (
        <div className="intel-section">
          <h3>Opponent Threat</h3>
          <p className="intel-title">
            {opponent?.name} · {threat.level}
          </p>
          <p>{threat.matchupSummary}</p>
          <ul className="intel-list">
            {threat.strengths.map((strength) => (
              <li key={strength.label}>
                {strength.label}: {strength.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.phase === "match" && props.liveMatch && (
        <div className="intel-section">
          <h3>Live Read</h3>
          <p className="intel-note">
            Directives influence only a short tactical burst. Team talks stay reserved for set breaks.
          </p>
          <ul className="intel-list">
            <li>
              Match Score: {props.liveMatch.session.setsWonA}-{props.liveMatch.session.setsWonB}
            </li>
            <li>
              Current Set: {props.liveMatch.session.currentSetNumber} (
              {props.liveMatch.session.currentScoreA}-{props.liveMatch.session.currentScoreB})
            </li>
            <li>Feed Events Logged: {props.liveMatch.session.feed.length}</li>
          </ul>
        </div>
      )}
    </aside>
  );
}
