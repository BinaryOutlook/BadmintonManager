import { useMemo, useState } from "react";
import { seededPlayers } from "../game/content/players";
import { tacticOptions } from "../game/content/tactics";
import { deriveAthleteDossier } from "../game/core/intel";
import type { TacticKey } from "../game/store/store";
import { useModalFocus } from "./useModalFocus";

interface SetupViewProps {
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  onSelectPlayer: (playerId: string) => void;
  onOpenPlayerProfile: (playerId: string) => void;
  onChooseTactic: (tacticKey: TacticKey) => void;
  onStartTournament: (selectedPlayerId: string) => void;
  onStartCareer: (managedPlayerId: string) => void;
  onContinueLocalSave: () => void;
  onOpenSaveManager: () => void;
  onOpenPreferences: () => void;
  activeSavePresent: boolean;
  careerPresent: boolean;
  corruptSavePresent: boolean;
}

function overallFromDossier(dossier: ReturnType<typeof deriveAthleteDossier>) {
  return Math.round((dossier.power + dossier.speed + dossier.stamina + dossier.control) / 4);
}

type RankedAthlete = ReturnType<typeof rankRosterByOverall>[number];

type RecommendationModeKey = "best" | "attack" | "control" | "rally" | "underdog";
type ArchetypeKey = "attack" | "control" | "rally" | "balanced";
type ArchetypeFilter = "all" | ArchetypeKey;
type TierKey = "elite" | "contender" | "underdog";
type TierFilter = "all" | TierKey;
type BrowseSortKey = "overall" | "rank" | "power" | "speed" | "stamina" | "control";

interface RecommendationMode {
  key: RecommendationModeKey;
  label: string;
  cue: string;
  summary: string;
  picks: RankedAthlete[];
  reasonFor: (item: RankedAthlete) => string;
}

interface FeaturedRecommendationCopy {
  headline: string;
  body: string;
  tacticalRead: string;
  metrics: Array<{ label: string; value: number | string }>;
}

const archetypeLabels: Record<ArchetypeKey, string> = {
  attack: "Attack First",
  control: "Control Artist",
  rally: "Rally Engine",
  balanced: "All-Rounder"
};

const tierLabels: Record<TierKey, string> = {
  elite: "Elite",
  contender: "Contender",
  underdog: "Underdog"
};

const sortLabels: Record<BrowseSortKey, string> = {
  overall: "OVR",
  rank: "Rank",
  power: "Power",
  speed: "Speed",
  stamina: "Stamina",
  control: "Control"
};

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

function attackScore(item: RankedAthlete) {
  return (
    item.dossier.power +
    item.dossier.speed +
    item.entry.player.ratings.technical.smash +
    item.entry.player.ratings.mental.aggression
  );
}

function controlScore(item: RankedAthlete) {
  return (
    item.dossier.control +
    item.entry.player.ratings.technical.netPlay +
    item.entry.player.ratings.technical.dropShot +
    item.entry.player.ratings.technical.serveReturn +
    item.entry.player.ratings.mental.anticipation
  );
}

function rallyScore(item: RankedAthlete) {
  return (
    item.dossier.stamina +
    item.entry.player.ratings.physical.footworkSpeed +
    item.entry.player.ratings.technical.defenseRetrieval +
    item.entry.player.ratings.mental.focus +
    item.entry.player.ratings.mental.composure
  );
}

function getArchetype(item: RankedAthlete): ArchetypeKey {
  const values = [item.dossier.power, item.dossier.speed, item.dossier.stamina, item.dossier.control];
  const spread = Math.max(...values) - Math.min(...values);

  if (spread <= 5 && item.overall >= 82) {
    return "balanced";
  }

  const scores: Array<{ key: ArchetypeKey; value: number }> = [
    { key: "attack", value: attackScore(item) },
    { key: "control", value: controlScore(item) },
    { key: "rally", value: rallyScore(item) }
  ];

  return scores.sort((left, right) => right.value - left.value)[0].key;
}

function getTier(item: RankedAthlete): TierKey {
  if (item.overall >= 88) {
    return "elite";
  }

  if (item.overall >= 84) {
    return "contender";
  }

  return "underdog";
}

function topPicks(entries: RankedAthlete[], count = 5) {
  return entries.slice(0, count);
}

function buildRecommendationModes(rankedRoster: RankedAthlete[]): RecommendationMode[] {
  const byAttack = [...rankedRoster].sort(
    (left, right) => attackScore(right) - attackScore(left) || left.rank - right.rank
  );
  const byControl = [...rankedRoster].sort(
    (left, right) => controlScore(right) - controlScore(left) || left.rank - right.rank
  );
  const byRally = [...rankedRoster].sort(
    (left, right) => rallyScore(right) - rallyScore(left) || left.rank - right.rank
  );
  const byUnderdogUpside = [...rankedRoster]
    .filter((item) => item.overall <= 86)
    .sort((left, right) => {
      const leftUpside = Math.max(attackScore(left), controlScore(left), rallyScore(left));
      const rightUpside = Math.max(attackScore(right), controlScore(right), rallyScore(right));

      return rightUpside - leftUpside || right.overall - left.overall || left.rank - right.rank;
    });

  return [
    {
      key: "best",
      label: "Best Overall",
      cue: "Safest title",
      summary: "Strongest opening picks when you want a confident first run.",
      picks: topPicks(rankedRoster),
      reasonFor: (item) => `Rank #${item.rank}, OVR ${item.overall}, ${tierLabels[getTier(item)].toLowerCase()} baseline.`
    },
    {
      key: "attack",
      label: "Attack First",
      cue: "Pressure",
      summary: "Power, speed, and aggression-forward athletes for short-rally initiative.",
      picks: topPicks(byAttack),
      reasonFor: (item) => `Power ${item.dossier.power}, speed ${item.dossier.speed}, aggression ${item.entry.player.ratings.mental.aggression}.`
    },
    {
      key: "control",
      label: "Control Artist",
      cue: "Court craft",
      summary: "Net skill, anticipation, and precision profiles for tactical command.",
      picks: topPicks(byControl),
      reasonFor: (item) => `Control ${item.dossier.control}, net ${item.entry.player.ratings.technical.netPlay}, anticipation ${item.entry.player.ratings.mental.anticipation}.`
    },
    {
      key: "rally",
      label: "Rally Engine",
      cue: "Endurance",
      summary: "Stamina, retrieval, and focus picks for long-rally reliability.",
      picks: topPicks(byRally),
      reasonFor: (item) => `Stamina ${item.dossier.stamina}, retrieval ${item.entry.player.ratings.technical.defenseRetrieval}, focus ${item.entry.player.ratings.mental.focus}.`
    },
    {
      key: "underdog",
      label: "Underdog",
      cue: "Challenge",
      summary: "Lower-OVR athletes with one clear weapon for a sharper campaign.",
      picks: topPicks(byUnderdogUpside),
      reasonFor: (item) => `${archetypeLabels[getArchetype(item)]} upside at OVR ${item.overall}.`
    }
  ];
}

function filterAndSortRoster(
  rankedRoster: RankedAthlete[],
  query: string,
  countryFilter: string,
  tierFilter: TierFilter,
  archetypeFilter: ArchetypeFilter,
  sortKey: BrowseSortKey
) {
  const normalizedQuery = query.trim().toLowerCase();

  return rankedRoster
    .filter((item) => {
      const haystack = [
        item.entry.player.name,
        item.entry.player.nationality,
        item.entry.player.styleLabel,
        archetypeLabels[getArchetype(item)],
        tierLabels[getTier(item)]
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (countryFilter === "all" || item.entry.player.nationality === countryFilter) &&
        (tierFilter === "all" || getTier(item) === tierFilter) &&
        (archetypeFilter === "all" || getArchetype(item) === archetypeFilter)
      );
    })
    .sort((left, right) => {
      if (sortKey === "rank" || sortKey === "overall") {
        return left.rank - right.rank;
      }

      return right.dossier[sortKey] - left.dossier[sortKey] || left.rank - right.rank;
    });
}

function buildFeaturedRecommendationCopy(
  modeKey: RecommendationModeKey,
  item: RankedAthlete
): FeaturedRecommendationCopy {
  const player = item.entry.player;
  const tier = tierLabels[getTier(item)].toLowerCase();

  if (modeKey === "attack") {
    return {
      headline: "Best fit when you want to seize initiative early.",
      body: `${player.name} is the strongest attacking read because the power-speed base is backed by elite smash output and a fearless aggression profile. This is the pick for a coach who wants short rallies, first-strike pressure, and fewer neutral exchanges.`,
      tacticalRead: "Open with forward tempo, hunt short lifts, and accept a little volatility in exchange for constant scoreboard pressure.",
      metrics: [
        { label: "Power", value: item.dossier.power },
        { label: "Speed", value: item.dossier.speed },
        { label: "Smash", value: player.ratings.technical.smash },
        { label: "Aggression", value: player.ratings.mental.aggression }
      ]
    };
  }

  if (modeKey === "control") {
    return {
      headline: "Best fit when you want the match on your terms.",
      body: `${player.name} leads this lane because the control profile combines front-court precision, serve-return quality, and anticipation. The upside is not just clean technique; it is the ability to keep the opponent reacting instead of choosing.`,
      tacticalRead: "Use patient placement, crowd the net after weak replies, and make the opponent solve one uncomfortable shot after another.",
      metrics: [
        { label: "Control", value: item.dossier.control },
        { label: "Net", value: player.ratings.technical.netPlay },
        { label: "Drop", value: player.ratings.technical.dropShot },
        { label: "Anticipation", value: player.ratings.mental.anticipation }
      ]
    };
  }

  if (modeKey === "rally") {
    return {
      headline: "Best fit when you want to stretch the match.",
      body: `${player.name} is the safest rally-engine choice because stamina, retrieval, focus, and movement all support repeated long exchanges. This profile is built to absorb pressure without letting the tactical shape collapse late in games.`,
      tacticalRead: "Extend rallies, deny cheap winners, and let the opponent's risk profile become the problem over time.",
      metrics: [
        { label: "Stamina", value: item.dossier.stamina },
        { label: "Retrieval", value: player.ratings.technical.defenseRetrieval },
        { label: "Focus", value: player.ratings.mental.focus },
        { label: "Footwork", value: player.ratings.physical.footworkSpeed }
      ]
    };
  }

  if (modeKey === "underdog") {
    return {
      headline: "Best fit when you want a dangerous challenge run.",
      body: `${player.name} is the most interesting underdog recommendation because one standout weapon gives the coach a real plan despite the lower OVR. This is not the safest route; it is the route with a sharp identity.`,
      tacticalRead: "Protect the weak phase, lean hard into the standout trait, and force opponents to answer the same problem repeatedly.",
      metrics: [
        { label: "OVR", value: item.overall },
        { label: "Power", value: item.dossier.power },
        { label: "Control", value: item.dossier.control },
        { label: "Style", value: archetypeLabels[getArchetype(item)] }
      ]
    };
  }

  return {
    headline: `Best overall title route at rank #${item.rank}.`,
    body: `${player.name} is the featured coach pick because the ${tier} OVR profile gives you the cleanest starting point before tactics complicate the draw. The recommendation is not about nationality; it is about a complete badminton base that can win in multiple match shapes.`,
    tacticalRead: "Start from a balanced plan, scout the first opponent, then adjust tempo once the bracket reveals the real threat.",
    metrics: [
      { label: "OVR", value: item.overall },
      { label: "Power", value: item.dossier.power },
      { label: "Speed", value: item.dossier.speed },
      { label: "Control", value: item.dossier.control }
    ]
  };
}

type AthleteSelectionPurpose = "career" | "quickTournament";

export function SetupView(props: SetupViewProps) {
  const [selectionPurpose, setSelectionPurpose] = useState<AthleteSelectionPurpose | null>(null);
  const [modalSelectedPlayerId, setModalSelectedPlayerId] = useState<string | null>(null);
  const [modalSelectionMade, setModalSelectionMade] = useState(false);
  const [rosterBrowseOpen, setRosterBrowseOpen] = useState(false);
  const [activeModeKey, setActiveModeKey] = useState<RecommendationModeKey>("best");
  const [browseQuery, setBrowseQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [archetypeFilter, setArchetypeFilter] = useState<ArchetypeFilter>("all");
  const [browseSortKey, setBrowseSortKey] = useState<BrowseSortKey>("overall");
  const rankedRoster = useMemo(() => rankRosterByOverall(), []);
  const recommendationModes = useMemo(() => buildRecommendationModes(rankedRoster), [rankedRoster]);
  const countryOptions = useMemo(
    () => [...new Set(rankedRoster.map((item) => item.entry.player.nationality))].sort(),
    [rankedRoster]
  );
  const filteredRoster = useMemo(
    () =>
      filterAndSortRoster(
        rankedRoster,
        browseQuery,
        countryFilter,
        tierFilter,
        archetypeFilter,
        browseSortKey
      ),
    [archetypeFilter, browseQuery, browseSortKey, countryFilter, rankedRoster, tierFilter]
  );
  const activeMode =
    recommendationModes.find((mode) => mode.key === activeModeKey) ?? recommendationModes[0];
  const featuredPick = activeMode.picks[0];
  const alternatePicks = activeMode.picks.slice(1, 5);
  const featuredCopy = featuredPick
    ? buildFeaturedRecommendationCopy(activeMode.key, featuredPick)
    : undefined;
  const previewedAthlete =
    rankedRoster.find((item) => item.entry.player.id === modalSelectedPlayerId) ??
    rankedRoster.find((item) => item.entry.player.id === props.selectedPlayerId) ??
    featuredPick ??
    rankedRoster[0];
  const hasBrowseFilters =
    browseQuery.trim() !== "" ||
    countryFilter !== "all" ||
    tierFilter !== "all" ||
    archetypeFilter !== "all" ||
    browseSortKey !== "overall";
  const activeFilterLabels = [
    browseQuery.trim() ? `Search: "${browseQuery.trim()}"` : "",
    countryFilter !== "all" ? `Country: ${countryFilter}` : "",
    tierFilter !== "all" ? `Tier: ${tierLabels[tierFilter]}` : "",
    archetypeFilter !== "all" ? `Style: ${archetypeLabels[archetypeFilter]}` : "",
    browseSortKey !== "overall" ? `Sort: ${sortLabels[browseSortKey]}` : ""
  ].filter(Boolean);
  const localSlotLabel = props.activeSavePresent
    ? props.careerPresent
      ? "Career save loaded"
      : "Tournament/setup save loaded"
    : "No active local save";
  const { modalRef, handleModalKeyDown } = useModalFocus(selectionPurpose !== null, closeSelectionModal);

  function resetBrowseFilters() {
    setBrowseQuery("");
    setCountryFilter("all");
    setTierFilter("all");
    setArchetypeFilter("all");
    setBrowseSortKey("overall");
  }

  function openSelectionModal(purpose: AthleteSelectionPurpose) {
    setSelectionPurpose(purpose);
    setModalSelectedPlayerId(null);
    setModalSelectionMade(false);
    setRosterBrowseOpen(false);
    setActiveModeKey("best");
    resetBrowseFilters();
  }

  function closeSelectionModal() {
    setSelectionPurpose(null);
    setModalSelectedPlayerId(null);
    setModalSelectionMade(false);
    setRosterBrowseOpen(false);
  }

  function selectModalPlayer(playerId: string) {
    setModalSelectedPlayerId(playerId);
    setModalSelectionMade(true);

    if (selectionPurpose === "quickTournament") {
      props.onSelectPlayer(playerId);
    }
  }

  function confirmSelectionModal() {
    if (!selectionPurpose || !modalSelectionMade || !modalSelectedPlayerId) {
      return;
    }

    const selectedPlayerId = modalSelectedPlayerId;
    const confirmedPurpose = selectionPurpose;

    closeSelectionModal();

    if (confirmedPurpose === "career") {
      props.onStartCareer(selectedPlayerId);
      return;
    }

    props.onStartTournament(selectedPlayerId);
  }

  function renderAthleteCard(item: RankedAthlete, compact = false) {
    const selectedInModal = item.entry.player.id === modalSelectedPlayerId;

    return (
      <article
        key={item.entry.player.id}
        className={`athlete-card ${compact ? "athlete-card-compact" : ""} ${
          selectedInModal ? "athlete-card-active" : ""
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
        <div className="recommendation-pick-tags athlete-card-tags">
          <span>{archetypeLabels[getArchetype(item)]}</span>
          <span>{tierLabels[getTier(item)]}</span>
        </div>
        <div className="athlete-card-footer">
          <span>{item.entry.player.styleLabel}</span>
          <span>OVR {item.overall}</span>
        </div>
        {selectedInModal ? (
          <span className="selection-chip">Selected</span>
        ) : (
          <button
            className="sidebar-mini-button athlete-select-button"
            type="button"
            aria-label={`Select ${item.entry.player.name}`}
            onClick={() => selectModalPlayer(item.entry.player.id)}
          >
            Select Athlete
          </button>
        )}
      </article>
    );
  }

  function renderSelectionModal() {
    if (!selectionPurpose) {
      return null;
    }

    const isCareer = selectionPurpose === "career";
    const confirmDisabled = !modalSelectionMade || !modalSelectedPlayerId;
    const confirmLabel = isCareer ? "Confirm Career Athlete" : "Start Tournament";
    const purposeLabel = isCareer ? "New Career" : "Disposable Run";
    const purposeCopy = isCareer
      ? "Choose the locked managed athlete for this local career. The save is created only after you confirm this modal selection."
      : "Choose a disposable tournament athlete, then optionally set the opening tactic before launch.";

    return (
      <div className="modal-backdrop" role="presentation">
        <section
          className="athlete-selection-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="athlete-selection-title"
          ref={modalRef}
          onKeyDown={handleModalKeyDown}
          tabIndex={-1}
        >
          <div className="modal-header athlete-selection-header">
            <div>
              <p className="screen-kicker">{purposeLabel}</p>
              <h2 id="athlete-selection-title">Pick Your Playstyle</h2>
              <p className="modal-subcopy">{purposeCopy}</p>
            </div>
            <button
              className="modal-close-button"
              type="button"
              aria-label="Close athlete selection"
              onClick={closeSelectionModal}
            >
              Close
            </button>
          </div>

          <div className="athlete-selection-body">
            <section className="command-panel command-panel-wide recommendation-panel athlete-selection-recommendations">
              <div className="panel-header">
                <div>
                  <h2>Recommendation Board</h2>
                  <p className="panel-summary panel-summary-tight">
                    A default preview is visible, but the final action unlocks only after you deliberately select an athlete in this modal.
                  </p>
                </div>
                <button
                  className="command-button command-button-secondary browse-roster-button"
                  type="button"
                  aria-expanded={rosterBrowseOpen}
                  onClick={() => setRosterBrowseOpen((current) => !current)}
                >
                  Browse All Athletes
                </button>
              </div>

              <div className="recommendation-mode-strip" aria-label="Recommendation modes">
                {recommendationModes.map((mode) => (
                  <button
                    key={mode.key}
                    className={`recommendation-mode-button ${
                      mode.key === activeMode.key ? "recommendation-mode-button-active" : ""
                    }`}
                    type="button"
                    aria-pressed={mode.key === activeMode.key}
                    onClick={() => setActiveModeKey(mode.key)}
                  >
                    <span>{mode.cue}</span>
                    <strong>{mode.label}</strong>
                  </button>
                ))}
              </div>

              <section className="recommendation-mode-stage" aria-labelledby="active-recommendation-title">
                <div className="recommendation-group-header">
                  <div>
                    <span>{activeMode.cue}</span>
                    <h3 id="active-recommendation-title">{activeMode.label}</h3>
                  </div>
                  <p>{activeMode.summary}</p>
                </div>
                {featuredPick && featuredCopy && (
                  <div className="recommendation-layout">
                    <article
                      className={
                        featuredPick.entry.player.id === modalSelectedPlayerId
                          ? "recommendation-featured-card recommendation-pick-active"
                          : "recommendation-featured-card"
                      }
                      aria-label={`Featured recommendation: ${featuredPick.entry.player.name}`}
                    >
                      <div className="recommendation-featured-top">
                        <span className="athlete-avatar">{featuredPick.entry.player.nationality}</span>
                        <div>
                          <span className="recommendation-featured-kicker">Featured Coach Pick</span>
                          <span>Rank #{featuredPick.rank}</span>
                        </div>
                      </div>
                      <button
                        className="athlete-profile-button recommendation-featured-name"
                        type="button"
                        onClick={() => props.onOpenPlayerProfile(featuredPick.entry.player.id)}
                      >
                        {featuredPick.entry.player.name}
                      </button>
                      <div className="recommendation-pick-tags">
                        <span>{archetypeLabels[getArchetype(featuredPick)]}</span>
                        <span>{tierLabels[getTier(featuredPick)]}</span>
                        <span>OVR {featuredPick.overall}</span>
                      </div>
                      <p className="recommendation-featured-headline">{featuredCopy.headline}</p>
                      <p className="recommendation-featured-copy">{featuredCopy.body}</p>
                      <div className="featured-stat-grid" aria-label="Featured recommendation stat cluster">
                        {featuredCopy.metrics.map((metric) => (
                          <div className="featured-stat" key={metric.label}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                          </div>
                        ))}
                      </div>
                      <p className="recommendation-featured-tactical">{featuredCopy.tacticalRead}</p>
                      <div className="recommendation-featured-actions">
                        {featuredPick.entry.player.id === modalSelectedPlayerId ? (
                          <span className="selection-chip">Selected</span>
                        ) : (
                          <button
                            className="sidebar-mini-button"
                            type="button"
                            aria-label={`Select featured ${featuredPick.entry.player.name}`}
                            onClick={() => selectModalPlayer(featuredPick.entry.player.id)}
                          >
                            Select
                          </button>
                        )}
                        <button
                          className="sidebar-mini-button profile-open-button"
                          type="button"
                          onClick={() => props.onOpenPlayerProfile(featuredPick.entry.player.id)}
                        >
                          Open Profile
                        </button>
                      </div>
                    </article>

                    <div className="recommendation-alt-grid" aria-label="Supporting recommendations">
                      {alternatePicks.map((item) => (
                        <article
                          className={
                            item.entry.player.id === modalSelectedPlayerId
                              ? "recommendation-pick recommendation-pick-active"
                              : "recommendation-pick"
                          }
                          key={`${activeMode.key}-${item.entry.player.id}`}
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
                          <p>{activeMode.reasonFor(item)}</p>
                          <div className="recommendation-pick-tags">
                            <span>{archetypeLabels[getArchetype(item)]}</span>
                            <span>{tierLabels[getTier(item)]}</span>
                          </div>
                          <div className="recommendation-pick-actions">
                            {item.entry.player.id === modalSelectedPlayerId ? (
                              <span className="selection-chip">Selected</span>
                            ) : (
                              <button
                                className="sidebar-mini-button"
                                type="button"
                                aria-label={`Select ${item.entry.player.name}`}
                                onClick={() => selectModalPlayer(item.entry.player.id)}
                              >
                                Select
                              </button>
                            )}
                            <span>OVR {item.overall}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </section>

            <aside className="command-panel dossier-panel athlete-selection-dossier">
              <div className="panel-header">
                <h2>{modalSelectionMade ? "Selected Operative" : "Preview Operative"}</h2>
                <span>OVR Rank #{previewedAthlete.rank}</span>
              </div>

              <div className="dossier-identity">
                <div>
                  <p className="dossier-overline">{previewedAthlete.entry.player.nationality}</p>
                  <h3>{previewedAthlete.entry.player.name}</h3>
                  <p>{previewedAthlete.entry.player.styleLabel}</p>
                </div>
                <div className="dossier-avatar">{previewedAthlete.entry.player.nationality}</div>
              </div>

              <div className="dossier-metrics">
                <div>
                  <div className="metric-row">
                    <span>Power</span>
                    <strong>{previewedAthlete.dossier.power}</strong>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill metric-track-fill-neutral" style={{ width: `${previewedAthlete.dossier.power}%` }} />
                  </div>
                </div>
                <div>
                  <div className="metric-row">
                    <span>Speed</span>
                    <strong>{previewedAthlete.dossier.speed}</strong>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill metric-track-fill-cyan" style={{ width: `${previewedAthlete.dossier.speed}%` }} />
                  </div>
                </div>
                <div>
                  <div className="metric-row">
                    <span>Stamina</span>
                    <strong>{previewedAthlete.dossier.stamina}</strong>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill" style={{ width: `${previewedAthlete.dossier.stamina}%` }} />
                  </div>
                </div>
                <div>
                  <div className="metric-row">
                    <span>Control</span>
                    <strong>{previewedAthlete.dossier.control}</strong>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill metric-track-fill-soft" style={{ width: `${previewedAthlete.dossier.control}%` }} />
                  </div>
                </div>
              </div>

              <div className="dossier-note">
                <span className="chip chip-primary">OVR {previewedAthlete.overall}</span>
                <p className="dossier-note-title">{previewedAthlete.dossier.formHeadline}</p>
                <p>{previewedAthlete.dossier.formSummary}</p>
                {!modalSelectionMade && (
                  <p className="modal-selection-gate">Select an athlete card to unlock {confirmLabel.toLowerCase()}.</p>
                )}
                <button
                  className="sidebar-mini-button profile-open-button"
                  type="button"
                  onClick={() => props.onOpenPlayerProfile(previewedAthlete.entry.player.id)}
                >
                  Open Profile
                </button>
              </div>
            </aside>
          </div>

          {isCareer ? null : (
            <section className="command-panel command-panel-wide athlete-selection-tactics">
              <div className="panel-header">
                <h2>Strategic Override</h2>
                <span>Compact opening tactic for this disposable run</span>
              </div>
              <div className="tactic-option-grid tactic-option-grid-compact">
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
          )}

          {rosterBrowseOpen && (
            <section className="command-panel command-panel-wide athlete-selection-browse" aria-labelledby="full-roster-title">
              <div className="panel-header">
                <div>
                  <p className="screen-kicker">Fallback Selection</p>
                  <h2 id="full-roster-title">Browse All Athletes</h2>
                  <p className="modal-subcopy">
                    Use the full board when you need a specific athlete, nation, tier, or stat shape.
                  </p>
                </div>
                <button
                  className="command-button command-button-secondary browse-roster-button"
                  type="button"
                  onClick={() => setRosterBrowseOpen(false)}
                >
                  Hide Roster
                </button>
              </div>

              <div className="browse-controls" aria-label="Browse athlete filters">
                <label className="browse-field">
                  <span>Search</span>
                  <input
                    type="search"
                    value={browseQuery}
                    onChange={(event) => setBrowseQuery(event.target.value)}
                    placeholder="Name, style, country"
                  />
                </label>

                <label className="browse-field">
                  <span>Country</span>
                  <select
                    value={countryFilter}
                    onChange={(event) => setCountryFilter(event.target.value)}
                  >
                    <option value="all">All countries</option>
                    {countryOptions.map((country) => (
                      <option value={country} key={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="browse-field">
                  <span>Tier</span>
                  <select
                    value={tierFilter}
                    onChange={(event) => setTierFilter(event.target.value as TierFilter)}
                  >
                    <option value="all">All tiers</option>
                    <option value="elite">Elite</option>
                    <option value="contender">Contender</option>
                    <option value="underdog">Underdog</option>
                  </select>
                </label>

                <label className="browse-field">
                  <span>Style</span>
                  <select
                    value={archetypeFilter}
                    onChange={(event) => setArchetypeFilter(event.target.value as ArchetypeFilter)}
                  >
                    <option value="all">All styles</option>
                    <option value="attack">Attack First</option>
                    <option value="control">Control Artist</option>
                    <option value="rally">Rally Engine</option>
                    <option value="balanced">All-Rounder</option>
                  </select>
                </label>

                <label className="browse-field">
                  <span>Sort</span>
                  <select
                    value={browseSortKey}
                    onChange={(event) => setBrowseSortKey(event.target.value as BrowseSortKey)}
                  >
                    <option value="overall">OVR</option>
                    <option value="rank">Rank</option>
                    <option value="power">Power</option>
                    <option value="speed">Speed</option>
                    <option value="stamina">Stamina</option>
                    <option value="control">Control</option>
                  </select>
                </label>
              </div>

              <div className="browse-results-bar">
                <div>
                  <strong>{filteredRoster.length}</strong>
                  <span> of {rankedRoster.length} athletes</span>
                </div>
                <div className="active-filter-list" aria-label="Active filters">
                  {activeFilterLabels.length > 0 ? (
                    activeFilterLabels.map((label) => <span key={label}>{label}</span>)
                  ) : (
                    <span>All athletes</span>
                  )}
                </div>
                <button
                  className="sidebar-mini-button browse-reset-button"
                  type="button"
                  onClick={resetBrowseFilters}
                  disabled={!hasBrowseFilters}
                >
                  Clear Filters
                </button>
              </div>

              <div className="panel-header panel-header-compact">
                <h3>Active Roster</h3>
                <span>Sorted by {sortLabels[browseSortKey]}</span>
              </div>
              {filteredRoster.length > 0 ? (
                <div className="roster-grid roster-grid-modal">
                  {filteredRoster.map((item) => renderAthleteCard(item, true))}
                </div>
              ) : (
                <div className="roster-empty-state">
                  <h3>No athletes match those filters.</h3>
                  <p>Clear the board and widen the search before committing your tournament pick.</p>
                  <button className="command-button command-button-secondary" type="button" onClick={resetBrowseFilters}>
                    Clear Filters
                  </button>
                </div>
              )}
            </section>
          )}

          <div className="confirm-actions athlete-selection-actions">
            <button className="command-button command-button-secondary" type="button" onClick={closeSelectionModal}>
              Cancel
            </button>
            <button
              className="command-button command-button-primary"
              type="button"
              onClick={confirmSelectionModal}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className="screen-shell start-screen">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Launch Control</p>
          <h1 className="screen-title">Start Screen</h1>
          <p className="screen-copy">
            Continue the local slot, create one locked career athlete, or open a disposable tournament selection modal.
          </p>
        </div>
        <div className="screen-meta">
          <span>{localSlotLabel}</span>
          {props.corruptSavePresent && <span>Quarantine present</span>}
        </div>
      </div>

      <section className="start-action-grid" aria-label="Start screen actions">
        {props.activeSavePresent && (
          <article className="command-panel start-action-panel start-action-panel-primary">
            <div>
              <p className="screen-kicker">Active Slot</p>
              <h2>Continue</h2>
              <p>Resume the compatible local save exactly where it was left.</p>
            </div>
            <button className="command-button command-button-primary" type="button" onClick={props.onContinueLocalSave}>
              Continue
            </button>
          </article>
        )}

        <article className="command-panel start-action-panel">
          <div>
            <p className="screen-kicker">Career Save</p>
            <h2>Start New Career</h2>
            <p>Open the playstyle-first athlete lock modal before creating a career program.</p>
          </div>
          <button className="command-button command-button-primary" type="button" onClick={() => openSelectionModal("career")}>
            Start New Career
          </button>
        </article>

        <article className="command-panel start-action-panel">
          <div>
            <p className="screen-kicker">Disposable Run</p>
            <h2>Quick Tournament</h2>
            <p>Choose the one-off athlete and tactic inside a blocking launch modal.</p>
          </div>
          <button className="command-button command-button-secondary" type="button" onClick={() => openSelectionModal("quickTournament")}>
            Quick Tournament
          </button>
        </article>

        <article className="command-panel start-action-panel">
          <div>
            <p className="screen-kicker">Local Slot</p>
            <h2>Load Save</h2>
            <p>Preview imports, export the current slot, or recover a quarantined local file.</p>
          </div>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenSaveManager}>
            Load Save
          </button>
        </article>

        <article className="command-panel start-action-panel">
          <div>
            <p className="screen-kicker">System</p>
            <h2>Preferences</h2>
            <p>Adjust display accent and session-level controls before starting.</p>
          </div>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenPreferences}>
            Preferences
          </button>
        </article>
      </section>

      {renderSelectionModal()}
    </section>
  );
}
