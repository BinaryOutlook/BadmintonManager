import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { seededPlayers, type SeededPlayer } from "../../game/content/players";
import type { LiveMatchSession } from "../../game/core/models";
import type { Player } from "../../game/core/models";
import type { CareerState, ProgramRosterSlot } from "../../game/career/models";
import { programRoleLabel } from "../../game/career/program";
import { scheduledPreparationForAthlete } from "../../game/career/preparation";
import { activeWorldSeededPlayers, careerWorldPlayerMap } from "../../game/career/world";
import { createPlayerProfileViewModel } from "../../game/selectors/player";
import type { AppPhase } from "../../game/store/store";
import type { TournamentState } from "../../game/tournament/tournament";

interface SquadPageProps {
  selectedPlayerId: string;
  phase: AppPhase;
  career: CareerState | null;
  tournament: TournamentState | null;
  liveMatchSession?: LiveMatchSession | null;
  players?: readonly SeededPlayer[];
  playersById?: Readonly<Record<string, Player>>;
  onOpenPlayerProfile: (playerId: string) => void;
  onSelectPlayer: (playerId: string) => void;
}

type CareerSquadView = "program" | "world";

const roleOrder: Record<ProgramRosterSlot["role"], number> = {
  lead: 0,
  senior: 1,
  academy: 2
};

function sentenceCase(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatContract(value: number) {
  return `$${value.toLocaleString("en-US")}/week`;
}

export function SquadPage(props: SquadPageProps) {
  const [careerView, setCareerView] = useState<CareerSquadView>("program");
  const activeView = props.career ? careerView : "world";
  const careerTabs: CareerSquadView[] = ["program", "world"];
  const players = props.players ?? (props.career ? activeWorldSeededPlayers(props.career) : seededPlayers);
  const playersById = props.playersById ?? (props.career
    ? careerWorldPlayerMap(props.career)
    : Object.fromEntries(players.map((entry) => [entry.player.id, entry.player])));
  const roster = players
    .map((entry) => {
      const profile = createPlayerProfileViewModel({
        playerId: entry.player.id,
        selectedPlayerId: props.selectedPlayerId,
        tournament: props.tournament,
        liveMatch: props.liveMatchSession,
        career: props.career,
        playersById
      });

      return profile ? { entry, profile } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.profile.overall - left.profile.overall || left.entry.seed - right.entry.seed);
  const programRoster = props.career
    ? [...props.career.ecosystem.recruitment.roster].sort(
        (left, right) => roleOrder[left.role] - roleOrder[right.role] || left.name.localeCompare(right.name)
      )
    : [];

  function handleCareerTabKey(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const keyMap: Record<string, number> = {
      ArrowRight: currentIndex + 1,
      ArrowLeft: currentIndex - 1,
      Home: 0,
      End: careerTabs.length - 1
    };
    const requestedIndex = keyMap[event.key];

    if (typeof requestedIndex !== "number") {
      return;
    }

    event.preventDefault();
    const nextIndex = (requestedIndex + careerTabs.length) % careerTabs.length;
    const nextView = careerTabs[nextIndex];
    setCareerView(nextView);
    window.requestAnimationFrame(() => document.getElementById(`squad-tab-${nextView}`)?.focus());
  }

  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Squad</p>
          <h1 className="screen-title">
            {props.career ? (activeView === "program" ? "My Program" : "World Directory") : "Athlete Directory"}
          </h1>
          <p className="screen-copy">
            {props.career
              ? "Manage the athletes under your care, or inspect the wider fictional player pool without changing your program lead."
              : "Browse the local fictional player pool and open a generated profile for any athlete."}
          </p>
        </div>
        <div className="screen-meta">
          <span>
            {props.career
              ? `${programRoster.length} program athlete${programRoster.length === 1 ? "" : "s"}`
              : `${roster.length} athletes`}
          </span>
          <span>{props.career ? "Career athlete locked" : props.phase === "setup" ? "Quick tournament editable" : "Run athlete locked"}</span>
        </div>
      </div>

      {props.career && (
        <div className="squad-view-tabs" role="tablist" aria-label="Squad directory views">
          <button
            id="squad-tab-program"
            className={activeView === "program" ? "profile-tab profile-tab-active" : "profile-tab"}
            type="button"
            role="tab"
            aria-selected={activeView === "program"}
            aria-controls="squad-panel-program"
            tabIndex={activeView === "program" ? 0 : -1}
            onClick={() => setCareerView("program")}
            onKeyDown={(event) => handleCareerTabKey(event, 0)}
          >
            My Program
          </button>
          <button
            id="squad-tab-world"
            className={activeView === "world" ? "profile-tab profile-tab-active" : "profile-tab"}
            type="button"
            role="tab"
            aria-selected={activeView === "world"}
            aria-controls="squad-panel-world"
            tabIndex={activeView === "world" ? 0 : -1}
            onClick={() => setCareerView("world")}
            onKeyDown={(event) => handleCareerTabKey(event, 1)}
          >
            World Directory
          </button>
        </div>
      )}

      {props.career && activeView === "program" ? (
        <section
          id="squad-panel-program"
          className="command-panel"
          role="tabpanel"
          aria-labelledby="squad-tab-program"
        >
          <div className="panel-header">
            <div>
              <p className="screen-kicker">{props.career.program.name}</p>
              <h2>My Program</h2>
            </div>
            <span>Lead, rotation and development pathways</span>
          </div>

          {programRoster.length > 0 ? (
            <div className="program-squad-list">
              {programRoster.map((slot) => {
                const athlete = props.career?.athletes.find((entry) => entry.playerId === slot.athleteId);
                const preparation = props.career
                  ? scheduledPreparationForAthlete(props.career, slot.athleteId, props.career.date)
                  : null;
                const isManagedLead = slot.athleteId === props.career?.program.managedPlayerId;
                const sourcePlayer = playersById[slot.athleteId];
                const candidate = props.career?.ecosystem.recruitment.candidates.find(
                  (entry) => entry.id === slot.athleteId
                );

                return (
                  <article
                    key={slot.athleteId}
                    className={isManagedLead ? "program-squad-row program-squad-row-lead" : "program-squad-row"}
                  >
                    <div className="program-squad-identity">
                      <span className="athlete-avatar">{sourcePlayer?.nationality ?? candidate?.country ?? "BM"}</span>
                      <div>
                        <button
                          className="athlete-profile-button"
                          type="button"
                          onClick={() => props.onOpenPlayerProfile(slot.athleteId)}
                        >
                          {slot.name}
                        </button>
                        <div className="program-squad-badges">
                          <span className={isManagedLead ? "chip chip-primary" : "chip"}>{programRoleLabel(slot)}</span>
                          {isManagedLead && <span className="managed-lead-label">Managed lead</span>}
                        </div>
                      </div>
                    </div>

                    <dl className="program-squad-facts">
                      <div>
                        <dt>Readiness</dt>
                        <dd>{athlete ? Math.round(athlete.readiness) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{athlete ? sentenceCase(athlete.recoveryStatus) : sentenceCase(slot.status)}</dd>
                      </div>
                      <div>
                        <dt>Contract</dt>
                        <dd>{formatContract(slot.contractCost)}</dd>
                      </div>
                    </dl>

                    <div className={preparation ? "program-squad-preparation is-scheduled" : "program-squad-preparation"}>
                      <span>Today&apos;s preparation</span>
                      <strong>{preparation?.planSnapshot.label ?? "No block scheduled"}</strong>
                      <small>
                        {preparation
                          ? `${sentenceCase(preparation.planSnapshot.focus)} · ${sentenceCase(preparation.planSnapshot.intensity)}`
                          : isManagedLead
                            ? "Schedule work from Training before advancing the day."
                            : "Schedule this athlete from the Recruitment Desk before advancing."}
                      </small>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="roster-empty-state" role="status">
              <strong>No active roster slots</strong>
              <span>Recruit an athlete to begin building the program pathway.</span>
            </div>
          )}
        </section>
      ) : (
        <section
          id={props.career ? "squad-panel-world" : undefined}
          className="command-panel"
          role={props.career ? "tabpanel" : undefined}
          aria-labelledby={props.career ? "squad-tab-world" : undefined}
        >
          <div className="panel-header">
            <div>
              <h2>{props.career ? "World Directory" : "Player Pool"}</h2>
              {props.career && <p className="squad-panel-note">Profile viewing does not change your managed lead.</p>}
            </div>
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
                {!props.career && props.phase === "setup" && entry.player.id !== props.selectedPlayerId && (
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
      )}
    </section>
  );
}
