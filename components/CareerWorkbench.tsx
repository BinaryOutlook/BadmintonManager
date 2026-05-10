import { playerMap } from "../game/content/players";
import { buildWeek, daysBetween } from "../game/career/calendar";
import { canAffordEventEntry, eventEntryCost } from "../game/career/economy";
import { canCommissionScoutReport, roleLabel, staffModifiers } from "../game/career/ecosystem";
import { getCareerEvent, getNextEvent } from "../game/career/events";
import type {
  AdvancedTacticPlan,
  CareerState,
  FacilityModifier,
  FacilityType,
  PlayerPromise,
  RallyLengthIntent,
  TacticModule
} from "../game/career/models";
import { effectiveEventEntryCosts, facilityModifiers } from "../game/career/facilitiesMedia";
import { managedAthlete } from "../game/career/state";
import { activeAdvancedTacticPlan, buildPreMatchPlanningBridge, calculateTacticEffectProfile, tacticPlanToMatchTactic } from "../game/career/tactics";
import { trainingPlans } from "../game/career/training";
import type { SaveRecoveryNotice } from "../game/store/store";

interface CareerPageProps {
  career: CareerState | null;
  saveRecovery: SaveRecoveryNotice | null;
  onStartCareer: () => void;
  onOpenTraining: () => void;
  onOpenCalendar: () => void;
  onOpenHome: () => void;
  onOpenProgram: () => void;
  onOpenRivals: () => void;
  onOpenMatchPlanning: () => void;
  onOpenFacilities: () => void;
  onOpenMedia: () => void;
  onOpenScouting: () => void;
  onOpenRecruitment: () => void;
  onOpenYouth: () => void;
  onOpenStaff: () => void;
  onOpenPromises: () => void;
  onApplyTraining: (planId: string) => void;
  onEnterEvent: (eventId: string) => void;
  onAdvanceDay: () => void;
  onStartManagedMatch: () => void;
  onContinueAfterPostMatch: () => void;
  onCommissionScoutReport: (subjectId: string, subjectType: "candidate" | "prospect" | "opponent") => void;
  onMakeRecruitmentOffer: (candidateId: string) => void;
  onTrainRosterAthlete: (athleteId: string) => void;
  onEnterRosterAthleteLowerEvent: (athleteId: string) => void;
  onDevelopYouthProspect: (prospectId: string) => void;
  onEnterYouthLowerEvent: (prospectId: string) => void;
  onHireStaffMember: (staffId: string) => void;
  onSetManagedAthletePromise: (targetType: PlayerPromise["targetType"]) => void;
  onWithdrawPromise: (promiseId: string) => void;
  onAdvanceRivalCircuit: () => void;
  onUpgradeFacility: (facilityType: FacilityType) => void;
  onResolveMediaObjectives: () => void;
  onUpdateAdvancedTacticPlan: (
    patch: Partial<
      Pick<
        AdvancedTacticPlan,
        "name" | "tempo" | "rearCourtPressure" | "netPriority" | "riskTolerance" | "rallyLengthIntent" | "modules"
      >
    >
  ) => void;
  onRefreshAssistantAdvice: () => void;
  onApplyAssistantAdvice: (adviceId: string) => void;
  onOverrideAssistantAdvice: (adviceId: string, reason: string) => void;
}

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`;
}

function activeEvent(career: CareerState) {
  return career.activeEventId
    ? getCareerEvent(career.events, career.activeEventId)
    : getNextEvent(career.events, career.date);
}

function pressureForEvent(career: CareerState, eventId: string) {
  return career.rivals.fieldPressure.find((entry) => entry.eventId === eventId);
}

function modifierRows(modifiers: FacilityModifier) {
  return [
    ["Training", `+${Math.round(modifiers.trainingDevelopment * 100)}%`],
    ["Recovery", `-${Math.round(modifiers.recoveryFatigue)} fatigue`],
    ["Injury", `-${Math.round(modifiers.injuryMitigation * 100)} pts`],
    ["Scouting", `+${Math.round(modifiers.scoutingAccuracy)} accuracy`],
    ["Advice", `+${Math.round(modifiers.adviceQuality)} quality`],
    ["Youth", `+${Math.round(modifiers.youthReadiness)} ready`],
    ["Travel", `-${Math.round(modifiers.travelCostReduction * 100)}% cost`],
    ["Pressure", `+${Math.round(modifiers.pressureResistance)} buffer`]
  ];
}

function CareerEmpty(props: Pick<CareerPageProps, "onStartCareer" | "saveRecovery">) {
  return (
    <section className="screen-shell">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Career</p>
          <h1 className="screen-title">Career Command Center</h1>
          <p className="screen-copy">
            Create a persisted career save before training, event entry, ranking points, and cashflow come online.
          </p>
        </div>
        <button className="command-button command-button-primary" type="button" onClick={props.onStartCareer}>
          Create Career Save
        </button>
      </div>

      {props.saveRecovery && (
        <section className="command-panel career-recovery-panel" role="status" aria-live="polite">
          <div className="panel-header">
            <h2>Career Save Recovery</h2>
            <span>Corrupt save quarantined</span>
          </div>
          <p className="panel-summary">
            {props.saveRecovery.message} The unreadable payload remains in local storage as{" "}
            <strong>{props.saveRecovery.backupKey}</strong> for manual recovery.
          </p>
        </section>
      )}

      <section className="command-panel">
        <div className="panel-header">
          <h2>No Career Loaded</h2>
          <span>{props.saveRecovery ? "Fresh safe slot ready" : "Local save slot ready"}</span>
        </div>
        <p className="panel-summary">
          The career save will preserve the season date, athlete readiness, budget ledger, event entry, ranking points,
          and post-match report through browser reloads.
        </p>
      </section>
    </section>
  );
}

export function CareerHomePage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const athlete = managedAthlete(props.career);
  const player = playerMap[props.career.program.managedPlayerId];
  const event = activeEvent(props.career);
  const recentLedger = props.career.economy.ledger.slice(-4).reverse();

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Career Home</p>
          <h1 className="screen-title">Career Command Center</h1>
          <p className="screen-copy">
            {props.career.date} - {player.name} sits rank {athlete.currentRank} with {athlete.rankingPoints} season points.
          </p>
        </div>
        <div className="screen-meta">
          <span>Cash {money(props.career.economy.cash)}</span>
          <span>Readiness {athlete.readiness}</span>
          <span>{props.career.stage.replace("_", " ")}</span>
        </div>
      </div>

      <div className="career-dashboard-grid">
        <section className="command-panel career-priority-panel">
          <div className="panel-header">
            <h2>Next Decision</h2>
            <span>{event?.tier ?? "No event"}</span>
          </div>
          <div className="career-decision-block">
            <strong>{event?.name ?? "Season planning"}</strong>
            <p>
              {event
                ? `${daysBetween(props.career.date, event.startDate)} day(s) until match day. Entry changes travel cost, prize upside, and ranking points.`
                : "No remaining event in the Phase 1 catalog."}
            </p>
            <div className="career-action-row">
              <button className="command-button command-button-primary" type="button" onClick={props.onOpenCalendar}>
                Event Desk
              </button>
              <button className="command-button command-button-secondary" type="button" onClick={props.onOpenTraining}>
                Training Desk
              </button>
              <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
                Program Hub
              </button>
              <button className="command-button command-button-secondary" type="button" onClick={props.onOpenRivals}>
                Circuit Room
              </button>
              <button className="command-button command-button-secondary" type="button" onClick={props.onOpenMatchPlanning}>
                Match Planning
              </button>
            </div>
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Readiness</h2>
            <span>{athlete.recoveryStatus}</span>
          </div>
          <div className="career-meter-list">
            <CareerMeter label="Readiness" value={athlete.readiness} />
            <CareerMeter label="Fatigue" value={Math.round(athlete.fatigue)} danger />
            <CareerMeter label="Injury Risk" value={Math.round(athlete.injuryRisk * 100)} danger />
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Ranking Pressure</h2>
            <span>{athlete.rankingPoints} pts</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Rank</span>
              <strong>{athlete.currentRank}</strong>
            </div>
            <div>
              <span>Points</span>
              <strong>{athlete.rankingPoints}</strong>
            </div>
            <div>
              <span>Event History</span>
              <strong>{props.career.completedEventIds.length}</strong>
            </div>
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Ledger</h2>
            <span>Reconciled cashflow</span>
          </div>
          <div className="career-ledger">
            {recentLedger.map((entry) => (
              <div key={entry.id} className="career-ledger-row">
                <span>{entry.label}</span>
                <strong>{signedMoney(entry.amount)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Program Ecosystem</h2>
            <span>Scouting / recruitment / youth / staff / promises</span>
          </div>
          <div className="career-ecosystem-strip">
            <button className="career-system-tile" type="button" onClick={props.onOpenScouting}>
              <span>Reports</span>
              <strong>{props.career.ecosystem.scouting.reports.length}</strong>
              <small>{props.career.ecosystem.scouting.assignments.length} assignments</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenRecruitment}>
              <span>Roster</span>
              <strong>
                {props.career.ecosystem.recruitment.roster.length}/{props.career.ecosystem.recruitment.rosterLimit}
              </strong>
              <small>{props.career.ecosystem.recruitment.candidates.length} candidates</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenYouth}>
              <span>Youth</span>
              <strong>{props.career.ecosystem.academy.prospects.length}</strong>
              <small>{props.career.ecosystem.lowerEventEntries.filter((entry) => entry.subjectType === "youth_prospect").length} lower entries</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenStaff}>
              <span>Staff</span>
              <strong>{props.career.ecosystem.staff.hired.length}/5</strong>
              <small>{money(staffModifiers(props.career.ecosystem).salary)} committed</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenPromises}>
              <span>Promises</span>
              <strong>{props.career.ecosystem.promises.filter((promise) => promise.status === "active").length}</strong>
              <small>{props.career.ecosystem.promises.filter((promise) => promise.status !== "active").length} resolved</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenRivals}>
              <span>Rivals</span>
              <strong>{Math.round(Math.max(...props.career.rivals.programs.map((program) => program.pressureScore)))}</strong>
              <small>{props.career.rivals.fieldPressure.length} pressured event fields</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenMatchPlanning}>
              <span>Tactics</span>
              <strong>{activeAdvancedTacticPlan(props.career).name}</strong>
              <small>{props.career.matchPlanning.advice.filter((entry) => entry.overrideState === "pending").length} staff notes</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenFacilities}>
              <span>Facilities</span>
              <strong>{props.career.facilities.reduce((total, facility) => total + facility.level, 0)}</strong>
              <small>{money(props.career.facilities.reduce((total, facility) => total + facility.maintenanceCost, 0))} upkeep</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenMedia}>
              <span>Media</span>
              <strong>{props.career.media.reputation}</strong>
              <small>
                {props.career.media.sponsors.filter((objective) => objective.status === "active").length +
                  props.career.media.federationObjectives.filter((objective) => objective.status === "active").length}{" "}
                active objectives
              </small>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerRivalCircuitPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const topPressure = [...props.career.rivals.fieldPressure].sort(
    (left, right) => right.pressureScore - left.pressureScore
  )[0];

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Circuit Room</p>
          <h1 className="screen-title">Rival Programs</h1>
          <p className="screen-copy">
            Rival academies train, select event fields, age through form curves, and push ranking pressure while your program plans.
          </p>
        </div>
        <div className="screen-meta">
          <span>Last sim {props.career.rivals.lastSimulatedDate}</span>
          <span>{props.career.rivals.fieldPressure.length} fields watched</span>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
          <button className="command-button command-button-primary" type="button" onClick={props.onAdvanceRivalCircuit}>
            Sim Rival Day
          </button>
        </div>
      </div>

      <div className="program-grid rival-circuit-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Season Pressure</h2>
            <span>{topPressure ? topPressure.topThreatName : "No field locked"}</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Peak Pressure</span>
              <strong>{topPressure ? Math.round(topPressure.pressureScore) : 0}</strong>
            </div>
            <div>
              <span>Rival Entries</span>
              <strong>{props.career.rivals.programs.reduce((total, program) => total + program.eventEntries.length, 0)}</strong>
            </div>
            <div>
              <span>Completed Results</span>
              <strong>
                {props.career.rivals.programs.reduce(
                  (total, program) => total + program.eventEntries.filter((entry) => entry.status === "completed").length,
                  0
                )}
              </strong>
            </div>
            <div>
              <span>Ranking Leader</span>
              <strong>{props.career.rivals.programs[0]?.roster[0]?.currentRank ?? "-"}</strong>
            </div>
          </div>
          <div className="rival-pressure-list">
            {props.career.rivals.fieldPressure.map((pressure) => {
              const event = getCareerEvent(props.career!.events, pressure.eventId);

              return (
                <div key={pressure.eventId} className="program-log-row">
                  <span>{event?.tier ?? "event"} / {pressure.rivalCount} rivals</span>
                  <strong>{event?.name ?? pressure.eventId}</strong>
                  <p>
                    {pressure.topThreatName} leads the field; average threat {Math.round(pressure.averageThreat)}, pressure{" "}
                    {Math.round(pressure.pressureScore)}.
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Rival Progression Log</h2>
            <span>Persistent circuit events</span>
          </div>
          <div className="program-log-list">
            {props.career.rivals.circuitLog.slice(0, 8).map((entry) => (
              <div key={entry.id} className="program-log-row">
                <span>{entry.date} / {entry.type}</span>
                <strong>{entry.stateDelta}</strong>
                <p>{entry.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Program Watchlist</h2>
            <span>Training bias / entries / age curve</span>
          </div>
          <div className="program-card-grid">
            {props.career.rivals.programs.map((program) => {
              const lead = program.roster[0];
              const latestEntry = program.eventEntries[0];

              return (
                <article key={program.id} className="program-decision-card rival-program-card">
                  <span>{program.strategy.replace("_", " ")} / {program.budgetTier}</span>
                  <strong>{program.name}</strong>
                  <p>
                    Bias {program.trainingBias}; form {Math.round(program.form)}; pressure {Math.round(program.pressureScore)}.
                  </p>
                  <div className="career-stat-grid">
                    <div>
                      <span>Lead</span>
                      <strong>{lead?.name ?? "No athlete"}</strong>
                    </div>
                    <div>
                      <span>Rating</span>
                      <strong>{lead ? Math.round(lead.rating) : 0}</strong>
                    </div>
                    <div>
                      <span>Rank</span>
                      <strong>{lead?.currentRank ?? "-"}</strong>
                    </div>
                    <div>
                      <span>Trend</span>
                      <strong>{lead?.trend ?? "steady"}</strong>
                    </div>
                  </div>
                  <p>
                    Latest selection:{" "}
                    {latestEntry
                      ? `${latestEntry.eventName}, projected ${latestEntry.projectedRound}, ${latestEntry.status}${
                          latestEntry.resultRound ? ` as ${latestEntry.resultRound}` : ""
                        }`
                      : "watching the calendar"}.
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerProgramHubPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const modifiers = staffModifiers(props.career.ecosystem);
  const psychology = props.career.ecosystem.psychology.find(
    (entry) => entry.athleteId === props.career?.program.managedPlayerId
  );
  const activePromises = props.career.ecosystem.promises.filter((promise) => promise.status === "active");
  const pendingAssignments = props.career.ecosystem.scouting.assignments.filter(
    (assignment) => assignment.status === "pending"
  );

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Program Hub</p>
          <h1 className="screen-title">Program Ecosystem</h1>
          <p className="screen-copy">
            Decide what the program knows, who it signs, who it develops, and what it has promised before the next event.
          </p>
        </div>
        <div className="screen-meta">
          <span>Cash {money(props.career.economy.cash)}</span>
          <span>Roster {props.career.ecosystem.recruitment.roster.length}/{props.career.ecosystem.recruitment.rosterLimit}</span>
          <span>Scout capacity {pendingAssignments.length}/{modifiers.scoutCapacity}</span>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
        </div>
      </div>

      <div className="program-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Next Program Decisions</h2>
            <span>Live pressure</span>
          </div>
          <div className="career-ecosystem-strip career-ecosystem-strip-large">
            <button className="career-system-tile" type="button" onClick={props.onOpenScouting}>
              <span>Scouting Network</span>
              <strong>{pendingAssignments.length} pending</strong>
              <small>
                {props.career.ecosystem.scouting.reports.filter((report) => report.state !== "expired").length} live reports,{" "}
                {props.career.ecosystem.scouting.reports.filter((report) => report.state === "expired").length} expired
              </small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenRecruitment}>
              <span>Recruitment Desk</span>
              <strong>{props.career.ecosystem.recruitment.candidates.filter((candidate) => candidate.offerState === "none").length} undecided</strong>
              <small>Budget, roster, fit, and promises</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenYouth}>
              <span>Youth Academy</span>
              <strong>{props.career.ecosystem.academy.prospects[0]?.readiness ?? 0}% ready</strong>
              <small>16-year-old prospect pipeline</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenStaff}>
              <span>Staff Room</span>
              <strong>{props.career.ecosystem.staff.hired.length} hired</strong>
              <small>Training +{Math.round(modifiers.training * 100)}%, recovery +{Math.round(modifiers.recovery * 100)}%</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenFacilities}>
              <span>Facilities Upgrades</span>
              <strong>{props.career.facilities.reduce((total, facility) => total + facility.level, 0)} levels</strong>
              <small>Training, recovery, analytics, youth, travel</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenMedia}>
              <span>Media Desk</span>
              <strong>Rep {props.career.media.reputation}</strong>
              <small>Sponsor goals and federation expectations</small>
            </button>
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Morale / Promise Alerts</h2>
            <span>{activePromises.length} active</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Form</span>
              <strong>{psychology?.form ?? 0}</strong>
            </div>
            <div>
              <span>Morale</span>
              <strong>{psychology?.morale ?? 0}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{psychology?.confidence ?? 0}</strong>
            </div>
            <div>
              <span>Traits</span>
              <strong>{psychology?.personalityTraits.join(", ") ?? "unknown"}</strong>
            </div>
          </div>
          <button className="command-button command-button-secondary career-button-spaced" type="button" onClick={props.onOpenPromises}>
            Athlete State + Promises
          </button>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Program Log</h2>
            <span>Persistent consequences</span>
          </div>
          <div className="program-log-list">
            {props.career.ecosystem.programLog.slice(0, 6).map((entry) => (
              <div key={entry.id} className="program-log-row">
                <span>{entry.date} / {entry.source}</span>
                <strong>{entry.message}</strong>
                <p>{entry.stateDelta}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerFacilitiesPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const modifiers = facilityModifiers(props.career.facilities);
  const nextEvent = activeEvent(props.career);
  const travelCosts = nextEvent ? effectiveEventEntryCosts(nextEvent, props.career.facilities) : null;
  const totalMaintenance = props.career.facilities.reduce((total, facility) => total + facility.maintenanceCost, 0);

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Program Infrastructure</p>
          <h1 className="screen-title">Facilities Upgrades</h1>
          <p className="screen-copy">
            Infrastructure spend changes training output, recovery load, analytics clarity, youth readiness, and travel strain.
          </p>
        </div>
        <div className="screen-meta">
          <span>Cash {money(props.career.economy.cash)}</span>
          <span>Upkeep {money(totalMaintenance)}</span>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
            Program Hub
          </button>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenMedia}>
            Media Desk
          </button>
        </div>
      </div>

      <div className="program-grid infrastructure-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Upgrade Board</h2>
            <span>{props.career.facilities.reduce((total, facility) => total + facility.level, 0)} total levels</span>
          </div>
          <div className="program-card-grid facility-card-grid">
            {props.career.facilities.map((facility) => {
              const canUpgrade = facility.status !== "maxed" && props.career!.economy.cash >= facility.nextUpgradeCost;

              return (
                <article key={facility.id} className="program-decision-card facility-card">
                  <span>{facility.status} / level {facility.level} of {facility.maxLevel}</span>
                  <strong>{facility.label}</strong>
                  <p>
                    Next cost {money(facility.nextUpgradeCost)}; build window {facility.buildTimeDays} day(s); upkeep{" "}
                    {money(facility.maintenanceCost)}.
                  </p>
                  <div className="career-stat-grid">
                    {Object.entries(facility.modifiers)
                      .filter(([, value]) => value !== 0)
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key}>
                          <span>{key.replace(/([A-Z])/g, " $1")}</span>
                          <strong>{typeof value === "number" && value < 1 ? `${Math.round(value * 100)}%` : Math.round(value)}</strong>
                        </div>
                      ))}
                    {facility.level === 0 && (
                      <div>
                        <span>Modifier</span>
                        <strong>Baseline</strong>
                      </div>
                    )}
                  </div>
                  <button
                    className="command-button command-button-primary"
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => props.onUpgradeFacility(facility.type)}
                  >
                    {facility.status === "maxed"
                      ? "Max Level"
                      : props.career!.economy.cash < facility.nextUpgradeCost
                        ? "Unaffordable"
                        : `Upgrade ${facility.label}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Active Modifiers</h2>
            <span>Gameplay effects</span>
          </div>
          <div className="career-stat-grid facility-modifier-grid">
            {modifierRows(modifiers).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {travelCosts && nextEvent && (
            <div className="program-log-row career-button-spaced">
              <span>{nextEvent.tier} travel quality</span>
              <strong>{nextEvent.name}</strong>
              <p>
                Travel cost {money(travelCosts.travelCost)} with {money(travelCosts.savedTravelCost)} saved; travel load{" "}
                {travelCosts.travelFatigue} fatigue.
              </p>
            </div>
          )}
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Upgrade Log</h2>
            <span>Budget consequences</span>
          </div>
          <div className="program-card-grid">
            {props.career.facilities.flatMap((facility) =>
              facility.history.slice(0, 2).map((entry) => (
                <div key={entry.id} className="program-log-row">
                  <span>{entry.date} / {facility.label}</span>
                  <strong>{entry.note}</strong>
                  <p>Cost {money(entry.cost)}; level {entry.level}; current upkeep {money(facility.maintenanceCost)}.</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerMediaObjectivesPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const activeObjectives = [
    ...props.career.media.sponsors.map((objective) => ({ ...objective, source: "Sponsor" })),
    ...props.career.media.federationObjectives.map((objective) => ({ ...objective, source: "Federation" }))
  ];
  const psychology = props.career.ecosystem.psychology.find(
    (entry) => entry.athleteId === props.career?.program.managedPlayerId
  );

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">External Pressure</p>
          <h1 className="screen-title">Media / Sponsors / Objectives</h1>
          <p className="screen-copy">
            Sponsors, federation targets, press pressure, and reputation now move budget, morale, and program leverage.
          </p>
        </div>
        <div className="screen-meta">
          <span>Reputation {props.career.media.reputation}</span>
          <span>Morale {psychology?.morale ?? 0}</span>
          <button className="command-button command-button-primary" type="button" onClick={props.onResolveMediaObjectives}>
            Resolve Pressure
          </button>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenFacilities}>
            Facilities
          </button>
        </div>
      </div>

      <div className="program-grid media-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Objective Board</h2>
            <span>{activeObjectives.filter((objective) => objective.status === "active").length} active</span>
          </div>
          <div className="program-card-grid objective-card-grid">
            {activeObjectives.map((objective) => (
              <article key={objective.id} className="program-decision-card objective-card">
                <span>{objective.source} / {objective.status} / due {objective.deadline}</span>
                <strong>{objective.sponsorName}</strong>
                <p>{objective.description}</p>
                <div className="career-meter">
                  <div className="metric-row">
                    <span>Progress</span>
                    <strong>{Math.round(objective.progress)}%</strong>
                  </div>
                  <div className="metric-track">
                    <div className="metric-track-fill" style={{ width: `${Math.max(3, Math.min(100, objective.progress))}%` }} />
                  </div>
                </div>
                <div className="career-stat-grid">
                  <div>
                    <span>Reward</span>
                    <strong>{signedMoney(objective.reward.cash)}</strong>
                  </div>
                  <div>
                    <span>Penalty</span>
                    <strong>{signedMoney(objective.penalty.cash)}</strong>
                  </div>
                  <div>
                    <span>Rep</span>
                    <strong>{objective.reward.reputation}/{objective.penalty.reputation}</strong>
                  </div>
                  <div>
                    <span>Morale</span>
                    <strong>{objective.reward.morale}/{objective.penalty.morale}</strong>
                  </div>
                </div>
                {objective.resolutionLog[0] && <p>{objective.resolutionLog[0]}</p>}
              </article>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Press Pressure</h2>
            <span>{props.career.media.pressEvents.filter((event) => event.status === "active").length} active</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Reputation</span>
              <strong>{props.career.media.reputation}</strong>
            </div>
            <div>
              <span>Morale</span>
              <strong>{psychology?.morale ?? 0}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{psychology?.confidence ?? 0}</strong>
            </div>
            <div>
              <span>Cash</span>
              <strong>{money(props.career.economy.cash)}</strong>
            </div>
          </div>
          <div className="program-log-list career-button-spaced">
            {props.career.media.pressEvents.map((event) => (
              <div key={event.id} className="program-log-row">
                <span>{event.status} / pressure {event.pressure}</span>
                <strong>{event.headline}</strong>
                <p>Potential swing: reputation {event.reputationDelta}, morale {event.moraleDelta}.</p>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Reaction Log</h2>
            <span>Visible consequences</span>
          </div>
          <div className="program-card-grid">
            {props.career.media.reactionLog.map((entry) => (
              <div key={entry.id} className="program-log-row">
                <span>{entry.date} / {entry.source}</span>
                <strong>{entry.message}</strong>
                <p>{entry.stateDelta}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function CareerMeter(props: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="career-meter">
      <div className="metric-row">
        <span>{props.label}</span>
        <strong>{props.value}%</strong>
      </div>
      <div className="metric-track">
        <div
          className={props.danger ? "metric-track-fill metric-track-fill-danger" : "metric-track-fill"}
          style={{ width: `${Math.max(3, Math.min(100, props.value))}%` }}
        />
      </div>
    </div>
  );
}

export function CareerScoutingNetworkPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const modifiers = staffModifiers(props.career.ecosystem);
  const scoutSubjects = [
    ...props.career.ecosystem.recruitment.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      type: "candidate" as const,
      detail: `${candidate.country} / ${candidate.source}`,
      knowledge: Object.entries(candidate.knowledge)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    })),
    ...props.career.ecosystem.academy.prospects.map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      type: "prospect" as const,
      detail: `Age ${prospect.age} / readiness ${prospect.readiness}`,
      knowledge: `potential: estimated ${prospect.potentialRange[0]}-${prospect.potentialRange[1]}, eligibility: ${
        prospect.lowerEventEligibility ? "verified" : "unknown"
      }`
    }))
  ];

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Scouting Network</p>
          <h1 className="screen-title">Reduce Uncertainty</h1>
          <p className="screen-copy">
            Assign scout capacity, pay report costs, and move candidate knowledge from unknown to estimated to verified.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
            Program Hub
          </button>
          <button className="command-button command-button-primary" type="button" onClick={props.onAdvanceDay}>
            Advance Day
          </button>
        </div>
      </div>

      <div className="program-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Assignment Board</h2>
            <span>Capacity {props.career.ecosystem.scouting.capacityUsed}/{modifiers.scoutCapacity}</span>
          </div>
          <div className="program-card-grid">
            {scoutSubjects.map((subject) => {
              const gate = canCommissionScoutReport(props.career!, subject.id);
              const report = props.career?.ecosystem.scouting.reports.find((entry) => entry.subjectId === subject.id);
              const assignment = props.career?.ecosystem.scouting.assignments.find(
                (entry) => entry.subjectId === subject.id && entry.status === "pending"
              );

              return (
                <article key={subject.id} className="program-decision-card">
                  <span>{subject.type}</span>
                  <strong>{subject.name}</strong>
                  <p>{subject.detail}</p>
                  <p>{subject.knowledge}</p>
                  <div className="knowledge-chip-row">
                    <span className="knowledge-chip knowledge-chip-unknown">unknown</span>
                    <span className="knowledge-chip knowledge-chip-estimated">estimated</span>
                    <span className="knowledge-chip knowledge-chip-verified">verified</span>
                  </div>
                  <p>
                    {report
                      ? `Report ${report.state}: ${report.confidence}% confidence, ${report.accuracy}% accuracy, expires ${report.expiresAt}.`
                      : assignment
                        ? `Assignment pending until ${assignment.dueAt}.`
                        : `Cost ${money(3200)} / ${modifiers.scouting >= 0.18 ? "1" : "2"} day(s).`}
                  </p>
                  <button
                    className="command-button command-button-primary"
                    type="button"
                    disabled={!gate.allowed}
                    onClick={() => props.onCommissionScoutReport(subject.id, subject.type)}
                  >
                    {gate.allowed ? "Commission Report" : gate.reason}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Report Queue</h2>
            <span>
              {props.career.ecosystem.scouting.reports.filter((report) => report.state !== "expired").length} live /{" "}
              {props.career.ecosystem.scouting.reports.filter((report) => report.state === "expired").length} expired
            </span>
          </div>
          <div className="program-log-list">
            {props.career.ecosystem.scouting.assignments.map((assignment) => (
              <div key={assignment.id} className="program-log-row">
                <span>{assignment.status} / due {assignment.dueAt}</span>
                <strong>{assignment.subjectId}</strong>
                <p>{assignment.scope} scope, cost {money(assignment.cost)}</p>
              </div>
            ))}
            {props.career.ecosystem.scouting.reports.map((report) => (
              <div key={report.id} className="program-log-row">
                <span>{report.state} / {report.confidence}% confidence</span>
                <strong>{report.subjectId}</strong>
                <p>{report.recommendation}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerRecruitmentDeskPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Recruitment Desk</p>
          <h1 className="screen-title">Offer Flow</h1>
          <p className="screen-copy">
            Evaluate fit, interest, report confidence, budget pressure, and roster slots before signing athletes.
          </p>
        </div>
        <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
          Program Hub
        </button>
      </div>

      <div className="program-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Candidate Evaluation</h2>
            <span>Cash {money(props.career.economy.cash)}</span>
          </div>
          <div className="program-card-grid">
            {props.career.ecosystem.recruitment.candidates.map((candidate) => {
              const report = props.career?.ecosystem.scouting.reports.find((entry) => entry.subjectId === candidate.id);
              const offerCost = candidate.knowledge.cost === "verified" ? candidate.verifiedCost : candidate.estimatedCost;
              const rosterFull =
                props.career!.ecosystem.recruitment.roster.length >= props.career!.ecosystem.recruitment.rosterLimit;

              return (
                <article key={candidate.id} className="program-decision-card">
                  <span>{candidate.country} / {candidate.rosterImpact}</span>
                  <strong>{candidate.name}</strong>
                  <p>{candidate.source}</p>
                  <div className="career-stat-grid">
                    <div>
                      <span>Interest</span>
                      <strong>{candidate.interest}</strong>
                    </div>
                    <div>
                      <span>Fit</span>
                      <strong>{candidate.fit}</strong>
                    </div>
                    <div>
                      <span>Risk</span>
                      <strong>{candidate.risk}</strong>
                    </div>
                    <div>
                      <span>Cost</span>
                      <strong>{money(offerCost)}</strong>
                    </div>
                  </div>
                  <p>
                    Report: {report ? `${report.confidence}% confidence, ${report.state}` : "not commissioned; cost remains estimated"}.
                    Promise request: {candidate.promiseRequested ?? "none"}.
                  </p>
                  <button
                    className="command-button command-button-primary"
                    type="button"
                    disabled={candidate.offerState !== "none" || rosterFull || props.career!.economy.cash < offerCost}
                    onClick={() => props.onMakeRecruitmentOffer(candidate.id)}
                  >
                    {candidate.offerState === "none"
                      ? rosterFull
                        ? "Roster Full"
                        : props.career!.economy.cash < offerCost
                          ? "Unaffordable"
                          : "Make Offer"
                      : `Offer ${candidate.offerState}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Program Roster</h2>
            <span>{props.career.ecosystem.recruitment.roster.length}/{props.career.ecosystem.recruitment.rosterLimit}</span>
          </div>
          <div className="program-log-list">
            {career.ecosystem.recruitment.roster.map((slot) => {
              const athleteState = career.athletes.find((athlete) => athlete.playerId === slot.athleteId);

              return (
                <div key={slot.athleteId} className="program-log-row">
                  <span>{slot.role} / {slot.status}</span>
                  <strong>{slot.name}</strong>
                  <p>
                    {money(slot.contractCost)} weekly contract, joined {slot.joinedAt}.{" "}
                    {athleteState
                      ? `Career athlete ready at ${Math.round(athleteState.readiness)} readiness.`
                      : "Roster display only."}
                  </p>
                  {slot.athleteId !== career.program.managedPlayerId && (
                    <div className="career-action-row career-action-row-left">
                      <button
                        className="command-button command-button-secondary"
                        type="button"
                        onClick={() => props.onTrainRosterAthlete(slot.athleteId)}
                      >
                        Train Athlete
                      </button>
                      <button
                        className="command-button command-button-primary"
                        type="button"
                        onClick={() => props.onEnterRosterAthleteLowerEvent(slot.athleteId)}
                      >
                        Enter Lower Event
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {props.career.ecosystem.lowerEventEntries
              .filter((entry) => entry.subjectType === "roster_athlete")
              .map((entry) => (
                <div key={entry.id} className="program-log-row">
                  <span>{entry.tier} / {entry.resultRound}</span>
                  <strong>{entry.subjectName}</strong>
                  <p>{entry.eventName} entered {entry.enteredAt}; readiness {entry.readinessAtEntry}.</p>
                </div>
              ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerYouthAcademyPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Youth Academy</p>
          <h1 className="screen-title">Prospect Pipeline</h1>
          <p className="screen-copy">
            Develop 16-year-old prospects toward readiness and lower-event eligibility without treating them as senior players.
          </p>
        </div>
        <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
          Program Hub
        </button>
      </div>

      <div className="program-card-grid">
        {props.career.ecosystem.academy.prospects.map((prospect) => (
          <article key={prospect.id} className="command-panel program-decision-card">
            <span>Age {prospect.age} / {prospect.developmentPlan}</span>
            <strong>{prospect.name}</strong>
            <p>
              Potential {prospect.potentialRange[0]}-{prospect.potentialRange[1]} / traits{" "}
              {prospect.developmentTraits.join(", ")}
            </p>
            <div className="career-stat-grid">
              <div>
                <span>Readiness</span>
                <strong>{Math.round(prospect.readiness)}</strong>
              </div>
              <div>
                <span>Morale</span>
                <strong>{Math.round(prospect.morale)}</strong>
              </div>
              <div>
                <span>Staff Modifier</span>
                <strong>{prospect.mentorOrStaffModifier}</strong>
              </div>
              <div>
                <span>Lower Event</span>
                <strong>{prospect.lowerEventEligibility ? "Eligible" : "Not ready"}</strong>
              </div>
            </div>
            <button className="command-button command-button-primary" type="button" onClick={() => props.onDevelopYouthProspect(prospect.id)}>
              Run Development Block
            </button>
            <button
              className="command-button command-button-secondary"
              type="button"
              disabled={!prospect.lowerEventEligibility}
              onClick={() => props.onEnterYouthLowerEvent(prospect.id)}
            >
              {prospect.lowerEventEligibility ? "Enter Lower Event" : "Lower Event Locked"}
            </button>
          </article>
        ))}
        {props.career.ecosystem.lowerEventEntries
          .filter((entry) => entry.subjectType === "youth_prospect")
          .map((entry) => (
            <article key={entry.id} className="command-panel program-decision-card">
              <span>{entry.tier} / {entry.status}</span>
              <strong>{entry.subjectName} lower-event entry</strong>
              <p>
                {entry.eventName} recorded on {entry.enteredAt}; readiness {entry.readinessAtEntry}; result {entry.resultRound}.
              </p>
            </article>
          ))}
      </div>
    </section>
  );
}

export function CareerStaffRoomPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const modifiers = staffModifiers(props.career.ecosystem);

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Staff Room</p>
          <h1 className="screen-title">Hire Modifiers</h1>
          <p className="screen-copy">
            Assistant coach, physio, analyst, scout, and mental coach salaries create visible downstream modifiers.
          </p>
        </div>
        <div className="screen-meta">
          <span>Salary {money(modifiers.salary)}</span>
          <span>Scout cap {modifiers.scoutCapacity}</span>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
            Program Hub
          </button>
        </div>
      </div>

      <div className="program-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Available Roles</h2>
            <span>Cash {money(props.career.economy.cash)}</span>
          </div>
          <div className="program-card-grid">
            {props.career.ecosystem.staff.candidates.map((staff) => (
              <article key={staff.id} className="program-decision-card">
                <span>{roleLabel(staff.role)} / level {staff.level}</span>
                <strong>{staff.name}</strong>
                <p>{staff.adviceBias}</p>
                <p>
                  Salary {money(staff.salary)} / training +{Math.round(staff.modifiers.training * 100)}%, recovery +
                  {Math.round(staff.modifiers.recovery * 100)}%, scouting +{Math.round(staff.modifiers.scouting * 100)}%,
                  morale +{Math.round(staff.modifiers.morale * 100)}%.
                </p>
                <button
                  className="command-button command-button-primary"
                  type="button"
                  disabled={props.career!.economy.cash < staff.salary}
                  onClick={() => props.onHireStaffMember(staff.id)}
                >
                  {props.career!.economy.cash < staff.salary ? "Unaffordable" : "Hire Staff"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Active Modifiers</h2>
            <span>{props.career.ecosystem.staff.hired.length} hired</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Training</span>
              <strong>+{Math.round(modifiers.training * 100)}%</strong>
            </div>
            <div>
              <span>Recovery</span>
              <strong>+{Math.round(modifiers.recovery * 100)}%</strong>
            </div>
            <div>
              <span>Scouting</span>
              <strong>+{Math.round(modifiers.scouting * 100)}%</strong>
            </div>
            <div>
              <span>Morale</span>
              <strong>+{Math.round(modifiers.morale * 100)}%</strong>
            </div>
          </div>
          <div className="program-log-list career-button-spaced">
            {props.career.ecosystem.staff.hired.map((staff) => (
              <div key={staff.id} className="program-log-row">
                <span>{roleLabel(staff.role)}</span>
                <strong>{staff.name}</strong>
                <p>{staff.adviceBias}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerAthletePromisesPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const psychology = props.career.ecosystem.psychology.find(
    (entry) => entry.athleteId === props.career?.program.managedPlayerId
  );

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Athlete State + Promises</p>
          <h1 className="screen-title">Psychology Desk</h1>
          <p className="screen-copy">
            Form, morale, confidence, personality, and targets now carry deadlines and consequence logs.
          </p>
        </div>
        <button className="command-button command-button-secondary" type="button" onClick={props.onOpenProgram}>
          Program Hub
        </button>
      </div>

      <div className="program-grid">
        <section className="command-panel">
          <div className="panel-header">
            <h2>Managed Athlete State</h2>
            <span>{psychology?.personalityTraits.join(", ") ?? "none"}</span>
          </div>
          <div className="career-meter-list">
            <CareerMeter label="Form" value={psychology?.form ?? 0} />
            <CareerMeter label="Morale" value={psychology?.morale ?? 0} />
            <CareerMeter label="Confidence" value={psychology?.confidence ?? 0} />
          </div>
          <div className="program-log-list career-button-spaced">
            {props.career.ecosystem.psychology.map((entry) => (
              <div key={entry.athleteId} className="program-log-row">
                <span>{entry.athleteId === props.career?.program.managedPlayerId ? "managed athlete" : "program athlete"}</span>
                <strong>{props.career?.ecosystem.recruitment.roster.find((slot) => slot.athleteId === entry.athleteId)?.name ?? playerMap[entry.athleteId]?.name ?? entry.athleteId}</strong>
                <p>Form {entry.form}, morale {entry.morale}, confidence {entry.confidence}. Latest: {entry.recentDrivers[0]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Targets And Promises</h2>
            <span>Kept / missed / withdrawn</span>
          </div>
          <div className="career-action-row career-action-row-left">
            <button className="command-button command-button-primary" type="button" onClick={() => props.onSetManagedAthletePromise("improve_stamina")}>
              Promise Stamina
            </button>
            <button className="command-button command-button-secondary" type="button" onClick={() => props.onSetManagedAthletePromise("lower_event_entry")}>
              Promise Lower Event
            </button>
          </div>
          <div className="program-card-grid career-button-spaced">
            {props.career.ecosystem.promises.map((promise) => (
              <article key={promise.id} className="program-decision-card">
                <span>{promise.status} / deadline {promise.deadline}</span>
                <strong>{promise.targetValue}</strong>
                <p>
                  Owner: {props.career?.ecosystem.recruitment.roster.find((slot) => slot.athleteId === promise.athleteId)?.name ?? playerMap[promise.athleteId]?.name ?? promise.athleteId}
                </p>
                <p>
                  Reward morale {promise.reward.morale >= 0 ? "+" : ""}{promise.reward.morale}, confidence +
                  {promise.reward.confidence}; penalty morale {promise.penalty.morale}, confidence {promise.penalty.confidence}.
                </p>
                <p>{promise.resolutionLog[0]}</p>
                {promise.status === "active" && (
                  <div className="danger-zone">
                    <span>Danger zone</span>
                    <button className="command-button command-button-secondary" type="button" onClick={() => props.onWithdrawPromise(promise.id)}>
                      Withdraw Promise
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

const tacticModules: Array<{ id: TacticModule; label: string; detail: string }> = [
  { id: "target_backhand", label: "Backhand Target", detail: "Biases pressure lanes toward the opponent's weaker shoulder." },
  { id: "net_trap", label: "Net Trap", detail: "Raises net-control projection and lowers loose tape errors." },
  { id: "rear_court_lock", label: "Rear Lock", detail: "Commits to lifts, clears, and back-court pressure." },
  { id: "body_smash", label: "Body Smash", detail: "Adds winner pressure while increasing strain." },
  { id: "safe_lift_release", label: "Safe Lift", detail: "Gives the plan a pressure-release valve when fatigue rises." }
];

const rallyIntentOptions: Array<{ id: RallyLengthIntent; label: string }> = [
  { id: "shorten", label: "Shorten" },
  { id: "balanced", label: "Balanced" },
  { id: "extend", label: "Extend" }
];

function tacticModuleToggle(plan: AdvancedTacticPlan, moduleId: TacticModule) {
  return plan.modules.includes(moduleId)
    ? plan.modules.filter((entry) => entry !== moduleId)
    : [...plan.modules, moduleId];
}

export function CareerMatchPlanningPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const plan = activeAdvancedTacticPlan(props.career);
  const matchTactic = tacticPlanToMatchTactic(plan);
  const effect = calculateTacticEffectProfile({
    plan,
    state: props.career,
    opponentId: props.career.lastPreMatchBrief?.opponentId
  });
  const pendingAdvice = props.career.matchPlanning.advice.filter((entry) => entry.overrideState === "pending");

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Match Planning</p>
          <h1 className="screen-title">Advanced Tactics Creator</h1>
          <p className="screen-copy">
            Tune the match plan before the next managed match. The sliders translate into simulation tactics, projected strain,
            and explainable staff advice.
          </p>
        </div>
        <div className="screen-meta">
          <span>{matchTactic.tempo}</span>
          <span>{matchTactic.pressurePattern.replaceAll("_", " ")}</span>
          <button className="command-button command-button-secondary" type="button" onClick={props.onRefreshAssistantAdvice}>
            Refresh Advice
          </button>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
        </div>
      </div>

      <div className="match-planning-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>{plan.name}</h2>
            <span>Simulation bridge: {matchTactic.riskProfile.replace("_", " ")}</span>
          </div>

          <div className="tactic-control-stack">
            <label className="tactic-slider-row">
              <span>Tempo</span>
              <input
                type="range"
                min="0"
                max="100"
                value={plan.tempo}
                onChange={(event) => props.onUpdateAdvancedTacticPlan({ tempo: Number(event.currentTarget.value) })}
              />
              <strong>{plan.tempo}</strong>
            </label>
            <label className="tactic-slider-row">
              <span>Rear-Court Pressure</span>
              <input
                type="range"
                min="0"
                max="100"
                value={plan.rearCourtPressure}
                onChange={(event) => props.onUpdateAdvancedTacticPlan({ rearCourtPressure: Number(event.currentTarget.value) })}
              />
              <strong>{plan.rearCourtPressure}</strong>
            </label>
            <label className="tactic-slider-row">
              <span>Net Priority</span>
              <input
                type="range"
                min="0"
                max="100"
                value={plan.netPriority}
                onChange={(event) => props.onUpdateAdvancedTacticPlan({ netPriority: Number(event.currentTarget.value) })}
              />
              <strong>{plan.netPriority}</strong>
            </label>
            <label className="tactic-slider-row">
              <span>Risk</span>
              <input
                type="range"
                min="0"
                max="100"
                value={plan.riskTolerance}
                onChange={(event) => props.onUpdateAdvancedTacticPlan({ riskTolerance: Number(event.currentTarget.value) })}
              />
              <strong>{plan.riskTolerance}</strong>
            </label>
          </div>

          <div className="rally-intent-control" role="group" aria-label="Rally length intent">
            {rallyIntentOptions.map((option) => (
              <button
                key={option.id}
                className={plan.rallyLengthIntent === option.id ? "sidebar-mini-button sidebar-mini-button-active" : "sidebar-mini-button"}
                type="button"
                aria-pressed={plan.rallyLengthIntent === option.id}
                onClick={() => props.onUpdateAdvancedTacticPlan({ rallyLengthIntent: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="tactic-module-grid">
            {tacticModules.map((module) => (
              <button
                key={module.id}
                className={plan.modules.includes(module.id) ? "tactic-module-button tactic-module-button-active" : "tactic-module-button"}
                type="button"
                aria-pressed={plan.modules.includes(module.id)}
                onClick={() => props.onUpdateAdvancedTacticPlan({ modules: tacticModuleToggle(plan, module.id) })}
              >
                <strong>{module.label}</strong>
                <span>{module.detail}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Effect Projection</h2>
            <span>State-derived</span>
          </div>
          <div className="career-meter-list">
            <CareerMeter label="Winner Pressure" value={effect.winnerPressure} />
            <CareerMeter label="Net Control" value={effect.netControl} />
            <CareerMeter label="Rear-Court Control" value={effect.rearCourtControl} />
            <CareerMeter label="Error Risk" value={effect.errorRisk} danger />
            <CareerMeter label="Stamina Load" value={effect.staminaLoad} danger />
            <CareerMeter label="Strain Bias" value={effect.strainBias} danger />
          </div>
          <div className="program-log-list career-button-spaced">
            {effect.matchupNotes.map((note) => (
              <div key={note} className="program-log-row">
                <span>Projection note</span>
                <strong>{note}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Assistant Advice / Override</h2>
            <span>{pendingAdvice.length} pending</span>
          </div>
          <div className="advice-card-grid">
            {props.career.matchPlanning.advice.map((advice) => (
              <article key={advice.id} className={advice.overrideState === "pending" ? "program-decision-card advice-card" : "program-decision-card advice-card advice-card-muted"}>
                <span>{advice.topic} / {roleLabel(advice.sourceRole)} / {advice.confidence}% confidence</span>
                <strong>{advice.recommendation}</strong>
                <p>{advice.rationale}</p>
                <p>{advice.tradeoff}</p>
                <div className="knowledge-chip-row">
                  {advice.inputs.map((input) => (
                    <span key={input} className="knowledge-chip knowledge-chip-estimated">{input}</span>
                  ))}
                </div>
                <div className="career-action-row career-action-row-left">
                  <button
                    className="command-button command-button-primary"
                    type="button"
                    disabled={advice.overrideState !== "pending"}
                    onClick={() => props.onApplyAssistantAdvice(advice.id)}
                  >
                    {advice.overrideState === "applied" ? "Applied" : "Apply"}
                  </button>
                  <button
                    className="command-button command-button-secondary"
                    type="button"
                    disabled={advice.overrideState !== "pending"}
                    onClick={() => props.onOverrideAssistantAdvice(advice.id, `Manager override kept ${plan.name}.`)}
                  >
                    {advice.overrideState === "overridden" ? "Overridden" : "Override"}
                  </button>
                </div>
                {advice.overrideReason && <p>Override reason: {advice.overrideReason}</p>}
              </article>
            ))}
          </div>
          {props.career.matchPlanning.overrideLog.length > 0 && (
            <div className="program-log-list career-button-spaced">
              {props.career.matchPlanning.overrideLog.map((entry) => (
                <div key={entry.id} className="program-log-row">
                  <span>{entry.date} / {entry.topic}</span>
                  <strong>Manager override preserved</strong>
                  <p>{entry.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export function CareerTrainingPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const athlete = managedAthlete(props.career);

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Training / Recovery</p>
          <h1 className="screen-title">Load Management</h1>
          <p className="screen-copy">
            Choose one training block. Every option changes development, fatigue, injury risk, and budget.
          </p>
        </div>
        <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
          Career Home
        </button>
      </div>

      <div className="career-training-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Training Plans</h2>
            <span>Cash {money(props.career.economy.cash)}</span>
          </div>
          <div className="career-plan-grid">
            {trainingPlans.map((plan) => (
              <button
                key={plan.id}
                className={
                  props.career?.selectedTrainingPlanId === plan.id
                    ? "career-plan-card career-plan-card-active"
                    : "career-plan-card"
                }
                type="button"
                aria-pressed={props.career?.selectedTrainingPlanId === plan.id}
                onClick={() => props.onApplyTraining(plan.id)}
              >
                <span>{plan.intensity}</span>
                <strong>{plan.label}</strong>
                <p>
                  {plan.focus} + cost {money(plan.cost)} - fatigue {plan.fatigueDelta >= 0 ? "+" : ""}
                  {plan.fatigueDelta}, risk {plan.injuryRiskDelta >= 0 ? "+" : ""}
                  {Math.round(plan.injuryRiskDelta * 100)} pts
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Projected Athlete</h2>
            <span>{athlete.recoveryStatus}</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Smash</span>
              <strong>{Math.round(athlete.development.smash)}</strong>
            </div>
            <div>
              <span>Stamina</span>
              <strong>{Math.round(athlete.development.stamina)}</strong>
            </div>
            <div>
              <span>Composure</span>
              <strong>{Math.round(athlete.development.composure)}</strong>
            </div>
            <div>
              <span>Recovery</span>
              <strong>{Math.round(athlete.development.recovery)}</strong>
            </div>
          </div>
          <div className="career-meter-list career-meter-list-spaced">
            <CareerMeter label="Readiness" value={athlete.readiness} />
            <CareerMeter label="Fatigue" value={Math.round(athlete.fatigue)} danger />
            <CareerMeter label="Injury Risk" value={Math.round(athlete.injuryRisk * 100)} danger />
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerCalendarPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const week = buildWeek(props.career.date);

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Calendar / Event Entry</p>
          <h1 className="screen-title">Season Week</h1>
          <p className="screen-copy">
            Advance the career date, enter a tiered event, and let the event stakes drive cost and ranking pressure.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
          <button className="command-button command-button-primary" type="button" onClick={props.onAdvanceDay}>
            Advance Day
          </button>
        </div>
      </div>

      <div className="career-calendar-grid">
        <section className="command-panel">
          <div className="panel-header">
            <h2>Week Strip</h2>
            <span>{props.career.date}</span>
          </div>
          <div className="career-week-strip">
            {week.map((day) => (
              <div key={day} className={day === props.career?.date ? "career-day career-day-active" : "career-day"}>
                <span>{day.slice(5)}</span>
                <strong>
                  {props.career?.events.find((event) => event.startDate === day)?.tier ?? "Train"}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Event Tiers</h2>
            <span>Entry state persists</span>
          </div>
          <div className="career-event-list">
            {props.career.events.map((event) => {
              const entered = props.career?.enteredEventIds.includes(event.id);
              const completed = props.career?.completedEventIds.includes(event.id);
              const fieldPressure = props.career ? pressureForEvent(props.career, event.id) : undefined;
              const totalCost = eventEntryCost({
                travelCost: event.travelCost,
                entryFee: event.entryFee
              });
              const affordable = props.career
                ? canAffordEventEntry({
                    economy: props.career.economy,
                    travelCost: event.travelCost,
                    entryFee: event.entryFee
                  })
                : false;
              return (
                <article
                  key={event.id}
                  className={affordable || entered || completed ? "career-event-card" : "career-event-card career-event-card-blocked"}
                >
                  <div>
                    <span>{event.tier}</span>
                    <strong>{event.name}</strong>
                    <p>
                      {event.startDate} - travel {money(event.travelCost)}, entry {money(event.entryFee)}, total{" "}
                      {money(totalCost)}, prize {money(event.prizeMoney.champion)}, champion points {event.rankingPoints.champion}
                    </p>
                    <p>
                      Rival field:{" "}
                      {fieldPressure
                        ? `${fieldPressure.rivalCount} programs, ${Math.round(fieldPressure.pressureScore)} pressure, top threat ${fieldPressure.topThreatName}`
                        : "open scouting field"}
                    </p>
                    {!affordable && !entered && !completed && (
                      <p className="career-event-warning">
                        Insufficient funds: program cash {money(props.career?.economy.cash ?? 0)} cannot cover entry.
                      </p>
                    )}
                  </div>
                  <button
                    className={entered ? "command-button command-button-secondary" : "command-button command-button-primary"}
                    type="button"
                    disabled={entered || completed || !affordable}
                    onClick={() => props.onEnterEvent(event.id)}
                  >
                    {completed ? "Complete" : entered ? "Entered" : affordable ? "Enter Event" : "Insufficient Funds"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerPreMatchHubPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const brief = props.career.lastPreMatchBrief;
  const event = activeEvent(props.career);
  const opponent = brief ? playerMap[brief.opponentId] : null;
  const planningBridge = buildPreMatchPlanningBridge(props.career);

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Pre-Match Hub</p>
          <h1 className="screen-title">Opponent Briefing</h1>
          <p className="screen-copy">
            Career context is now attached to the managed match: readiness, risk, tier stakes, and event consequence.
          </p>
        </div>
        <button className="command-button command-button-primary" type="button" onClick={props.onStartManagedMatch}>
          Enter Match
        </button>
      </div>

      <div className="career-hub-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>{opponent?.name ?? "Opponent pending"}</h2>
            <span>{event?.tier ?? "Event"}</span>
          </div>
          <p className="panel-summary">{brief?.opponentBrief ?? "The draw will resolve when the event opens."}</p>
          <div className="career-brief-grid">
            <div>
              <span>Readiness</span>
              <strong>{brief?.readiness ?? 0}</strong>
            </div>
            <div>
              <span>Risk Note</span>
              <strong>{brief?.riskNote ?? "No briefing yet"}</strong>
            </div>
            <div>
              <span>Tier Stakes</span>
              <strong>{brief?.tierStakes ?? "No event entered"}</strong>
            </div>
            <div>
              <span>Recommendation</span>
              <strong>{brief?.recommendation ?? "Advance the calendar into match day."}</strong>
            </div>
          </div>
        </section>
        <section className="command-panel">
          <div className="panel-header">
            <h2>Pre-Match Planning Bridge</h2>
            <span>{planningBridge.adviceState.replace("_", " ")}</span>
          </div>
          <div className="career-brief-grid pre-match-planning-grid">
            <div>
              <span>Selected Tactic</span>
              <strong>{planningBridge.planName}</strong>
              <p>{planningBridge.tacticSummary}</p>
            </div>
            <div>
              <span>Assistant Signal</span>
              <strong>{planningBridge.adviceLabel}</strong>
              <p>{planningBridge.adviceDetail}</p>
            </div>
            <div>
              <span>Rival Intel</span>
              <strong>{planningBridge.rivalIntel}</strong>
            </div>
            <div>
              <span>Objective Stakes</span>
              <strong>{planningBridge.objectiveStakes}</strong>
            </div>
            <div>
              <span>Effect Projection</span>
              <strong>{planningBridge.effectSummary}</strong>
            </div>
            <div>
              <span>Fatigue / Strain Warning</span>
              <strong>{planningBridge.strainWarning}</strong>
            </div>
          </div>
          <button className="command-button command-button-secondary career-button-spaced" type="button" onClick={props.onOpenMatchPlanning}>
            Adjust Match Plan
          </button>
        </section>
      </div>
    </section>
  );
}

export function CareerPostMatchHubPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const report = props.career.lastMatchReport;
  const opponent = report ? playerMap[report.opponentId] : null;

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Post-Match Hub</p>
          <h1 className="screen-title">Match Evidence Review</h1>
          <p className="screen-copy">
            Ranking points, prize money, fatigue, and next training recommendations are settled from the managed match.
          </p>
        </div>
        <button className="command-button command-button-primary" type="button" onClick={props.onContinueAfterPostMatch}>
          Continue Career
        </button>
      </div>

      <div className="career-hub-grid">
        <section className="command-panel">
          <div className="panel-header">
            <h2>{report ? `${report.result.toUpperCase()} vs ${opponent?.name}` : "No report"}</h2>
            <span>{report?.scoreline ?? "Pending"}</span>
          </div>
          <div className="career-stat-grid">
            <div>
              <span>Points</span>
              <strong>+{report?.pointsDelta ?? 0}</strong>
            </div>
            <div>
              <span>Cash</span>
              <strong>{signedMoney(report?.cashDelta ?? 0)}</strong>
            </div>
            <div>
              <span>Fatigue</span>
              <strong>+{Math.round(report?.fatigueDelta ?? 0)}</strong>
            </div>
          </div>
        </section>

        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Evidence And Recommendations</h2>
            <span>Career-aware recap</span>
          </div>
          <div className="career-evidence-grid">
            <div>
              <h3>Match Evidence</h3>
              {(report?.evidence ?? ["Complete a managed match to generate evidence."]).map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
            <div>
              <h3>Training Recommendations</h3>
              {(report?.recommendations ?? ["Post-match recommendations will appear here."]).map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
