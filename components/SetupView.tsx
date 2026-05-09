import { useEffect, useState } from "react";
import { seededPlayers } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { deriveAthleteDossier } from "../game/core/intel";
import type { TacticKey } from "../game/store/store";

interface SetupViewProps {
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  onSelectPlayer: (playerId: string) => void;
  onOpenPlayerProfile: (playerId: string) => void;
  onChooseTactic: (tacticKey: TacticKey) => void;
  onStartTournament: () => void;
}

function overallFromDossier(dossier: ReturnType<typeof deriveAthleteDossier>) {
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

type RankedAthlete = ReturnType<typeof rankRosterByOverall>[number];

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

interface RecommendationGroup {
  key: string;
  title: string;
  cue: string;
  summary: string;
  picks: RankedAthlete[];
  reasonFor: (item: RankedAthlete) => string;
}

function takeUnique(
  entries: RankedAthlete[],
  usedIds: Set<string>,
  count: number
) {
  const selected: RankedAthlete[] = [];

  for (const item of entries) {
    if (usedIds.has(item.entry.player.id)) {
      continue;
    }

    selected.push(item);
    usedIds.add(item.entry.player.id);

    if (selected.length === count) {
      break;
    }
  }

  return selected;
}

function buildRecommendationGroups(rankedRoster: RankedAthlete[]): RecommendationGroup[] {
  const usedIds = new Set<string>();
  const byAttack = [...rankedRoster].sort(
    (left, right) =>
      right.dossier.power + right.dossier.speed - (left.dossier.power + left.dossier.speed) ||
      left.rank - right.rank
  );
  const byVersatility = [...rankedRoster].sort((left, right) => {
    const leftValues = [left.dossier.power, left.dossier.speed, left.dossier.stamina, left.dossier.control];
    const rightValues = [right.dossier.power, right.dossier.speed, right.dossier.stamina, right.dossier.control];
    const leftSpread = Math.max(...leftValues) - Math.min(...leftValues);
    const rightSpread = Math.max(...rightValues) - Math.min(...rightValues);

    return leftSpread - rightSpread || right.overall - left.overall || left.rank - right.rank;
  });
  const byDefense = [...rankedRoster].sort((left, right) => {
    const leftDefense =
      left.dossier.stamina +
      left.dossier.control +
      left.entry.player.ratings.technical.defenseRetrieval +
      left.entry.player.ratings.mental.composure;
    const rightDefense =
      right.dossier.stamina +
      right.dossier.control +
      right.entry.player.ratings.technical.defenseRetrieval +
      right.entry.player.ratings.mental.composure;

    return rightDefense - leftDefense || left.rank - right.rank;
  });

  const trophyTitans = takeUnique(rankedRoster, usedIds, 3);
  const honorableMentions = takeUnique(rankedRoster.slice(3), usedIds, 2);
  const attacking = takeUnique(byAttack, usedIds, 1);
  const versatile = takeUnique(byVersatility, usedIds, 1);
  const defensive = takeUnique(byDefense, usedIds, 1);

  return [
    {
      key: "trophy-titans",
      title: "Trophy Titans",
      cue: "Safest title ceiling",
      summary: "Start here when you want the strongest opening command recommendation.",
      picks: trophyTitans,
      reasonFor: (item) => `Rank #${item.rank}, OVR ${item.overall}, title-ready baseline.`
    },
    {
      key: "honorable-mentions",
      title: "Honorable Mentions",
      cue: "Strong alternate reads",
      summary: "Near-elite choices when the top lane feels too obvious.",
      picks: honorableMentions,
      reasonFor: (item) => `OVR ${item.overall} with a distinct ${item.entry.player.styleLabel.toLowerCase()} profile.`
    },
    {
      key: "attacking",
      title: "Attacking",
      cue: "Pressure first",
      summary: "Power and speed picks for coaches who want short-rally initiative.",
      picks: attacking,
      reasonFor: (item) => `Power ${item.dossier.power} and speed ${item.dossier.speed} support early pressure.`
    },
    {
      key: "versatile",
      title: "Versatile",
      cue: "Plan-flexible",
      summary: "Balanced operators who can survive tactical changes mid-run.",
      picks: versatile,
      reasonFor: (item) =>
        `Balanced line: ${item.dossier.power}/${item.dossier.speed}/${item.dossier.stamina}/${item.dossier.control}.`
    },
    {
      key: "defensive",
      title: "Defensive",
      cue: "Absorb and reset",
      summary: "Control, stamina, and retrieval profiles for lower-volatility openings.",
      picks: defensive,
      reasonFor: (item) => `Stamina ${item.dossier.stamina} and control ${item.dossier.control} stabilize long rallies.`
    }
  ];
}

export function SetupView(props: SetupViewProps) {
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const rankedRoster = rankRosterByOverall();
  const selected =
    rankedRoster.find((item) => item.entry.player.id === props.selectedPlayerId) ?? rankedRoster[0];
  const recommendationGroups = buildRecommendationGroups(rankedRoster);

  useEffect(() => {
    if (!rosterModalOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRosterModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rosterModalOpen]);

  function selectPlayer(playerId: string) {
    props.onSelectPlayer(playerId);
    setRosterModalOpen(false);
  }

  function renderAthleteCard(item: RankedAthlete, compact = false) {
    return (
      <article
        key={item.entry.player.id}
        className={`athlete-card ${compact ? "athlete-card-compact" : ""} ${
          item.entry.player.id === props.selectedPlayerId ? "athlete-card-active" : ""
        }`}
      >
        <div className="athlete-card-header">
          <span className="athlete-avatar">{item.entry.player.nationality}</span>
          <span className="athlete-card-rank">OVR Rank #{item.rank}</span>
        </div>
        <button
          className="athlete-profile-button athlete-profile-button-block"
          type="button"
          onClick={() => props.onOpenPlayerProfile(item.entry.player.id)}
        >
          {item.entry.player.name}
        </button>
        <div className="metric-track">
          <div className="metric-track-fill" style={{ width: `${item.overall}%` }} />
        </div>
        <div className="athlete-card-footer">
          <span>{item.entry.player.styleLabel}</span>
          <span>OVR {item.overall}</span>
        </div>
        {item.entry.player.id !== props.selectedPlayerId ? (
          <button
            className="sidebar-mini-button athlete-select-button"
            type="button"
            onClick={() => selectPlayer(item.entry.player.id)}
          >
            Select Athlete
          </button>
        ) : (
          <span className="selection-chip">Selected</span>
        )}
      </article>
    );
  }

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
        <section className="command-panel command-panel-wide recommendation-panel">
          <div className="panel-header">
            <div>
              <h2>Command Recommendations</h2>
              <p className="panel-summary panel-summary-tight">
                Pick from a coached shortlist first. The full roster is still available when the
                recommendation lanes miss the plan.
              </p>
            </div>
            <button
              className="command-button command-button-secondary browse-roster-button"
              type="button"
              onClick={() => setRosterModalOpen(true)}
            >
              Browse All Athletes
            </button>
          </div>

          <div className="recommendation-grid">
            {recommendationGroups.map((group) => (
              <section className="recommendation-group" key={group.key}>
                <div className="recommendation-group-header">
                  <div>
                    <span>{group.cue}</span>
                    <h3>{group.title}</h3>
                  </div>
                  <p>{group.summary}</p>
                </div>
                <div className="recommendation-picks">
                  {group.picks.map((item) => (
                    <article
                      className={
                        item.entry.player.id === props.selectedPlayerId
                          ? "recommendation-pick recommendation-pick-active"
                          : "recommendation-pick"
                      }
                      key={`${group.key}-${item.entry.player.id}`}
                    >
                      <div className="recommendation-pick-top">
                        <span className="athlete-avatar">{item.entry.player.nationality}</span>
                        <span>Rank #{item.rank}</span>
                      </div>
                      <button
                        className="athlete-profile-button athlete-profile-button-block"
                        type="button"
                        onClick={() => props.onOpenPlayerProfile(item.entry.player.id)}
                      >
                        {item.entry.player.name}
                      </button>
                      <p>{group.reasonFor(item)}</p>
                      <div className="recommendation-pick-actions">
                        {item.entry.player.id !== props.selectedPlayerId ? (
                          <button
                            className="sidebar-mini-button"
                            type="button"
                            onClick={() => selectPlayer(item.entry.player.id)}
                          >
                            Select
                          </button>
                        ) : (
                          <span className="selection-chip">Selected</span>
                        )}
                        <span>OVR {item.overall}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
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
            <button
              className="sidebar-mini-button profile-open-button"
              type="button"
              onClick={() => props.onOpenPlayerProfile(selected.entry.player.id)}
            >
              Open Profile
            </button>
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

      {rosterModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="roster-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-roster-title"
          >
            <div className="modal-header">
              <div>
                <p className="screen-kicker">Fallback Selection</p>
                <h2 id="full-roster-title">Browse All Athletes</h2>
                <p className="modal-subcopy">
                  The recommendation lanes are the default command route. Use the full board when
                  you need a specific style, nation, or rank.
                </p>
              </div>
              <button
                className="modal-close-button"
                type="button"
                onClick={() => setRosterModalOpen(false)}
                aria-label="Close full roster"
              >
                Close
              </button>
            </div>

            <div className="panel-header panel-header-compact">
              <h3>Active Roster</h3>
              <span>{rankedRoster.length} athletes - sorted by OVR</span>
            </div>
            <div className="roster-grid roster-grid-modal">
              {rankedRoster.map((item) => renderAthleteCard(item, true))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
