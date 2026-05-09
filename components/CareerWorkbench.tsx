import { playerMap } from "../game/content/players";
import { buildWeek, daysBetween } from "../game/career/calendar";
import { canAffordEventEntry, eventEntryCost } from "../game/career/economy";
import { canCommissionScoutReport, roleLabel, staffModifiers } from "../game/career/ecosystem";
import { getCareerEvent, getNextEvent } from "../game/career/events";
import type { CareerState, PlayerPromise } from "../game/career/models";
import { managedAthlete } from "../game/career/state";
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
  onDevelopYouthProspect: (prospectId: string) => void;
  onHireStaffMember: (staffId: string) => void;
  onSetManagedAthletePromise: (targetType: PlayerPromise["targetType"]) => void;
  onWithdrawPromise: (promiseId: string) => void;
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
              <small>{props.career.ecosystem.academy.prospects.filter((prospect) => prospect.lowerEventEligibility).length} eligible</small>
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
              <small>{props.career.ecosystem.scouting.reports.length} verified reports</small>
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
            <span>{props.career.ecosystem.scouting.reports.length} reports</span>
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
            {props.career.ecosystem.recruitment.roster.map((slot) => (
              <div key={slot.athleteId} className="program-log-row">
                <span>{slot.role} / {slot.status}</span>
                <strong>{slot.name}</strong>
                <p>{money(slot.contractCost)} weekly contract, joined {slot.joinedAt}</p>
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
            {(psychology?.recentDrivers ?? []).map((driver) => (
              <div key={driver} className="program-log-row">
                <span>driver</span>
                <strong>{driver}</strong>
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
