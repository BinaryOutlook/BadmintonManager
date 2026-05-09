import { playerMap } from "../game/content/players";
import { buildWeek, daysBetween } from "../game/career/calendar";
import { getCareerEvent, getNextEvent } from "../game/career/events";
import type { CareerState } from "../game/career/models";
import { managedAthlete } from "../game/career/state";
import { trainingPlans } from "../game/career/training";

interface CareerPageProps {
  career: CareerState | null;
  onStartCareer: () => void;
  onOpenTraining: () => void;
  onOpenCalendar: () => void;
  onOpenHome: () => void;
  onApplyTraining: (planId: string) => void;
  onEnterEvent: (eventId: string) => void;
  onAdvanceDay: () => void;
  onStartManagedMatch: () => void;
  onContinueAfterPostMatch: () => void;
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

function CareerEmpty(props: Pick<CareerPageProps, "onStartCareer">) {
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

      <section className="command-panel">
        <div className="panel-header">
          <h2>No Career Loaded</h2>
          <span>Local save slot ready</span>
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
    return <CareerEmpty onStartCareer={props.onStartCareer} />;
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

export function CareerTrainingPage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} />;
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
    return <CareerEmpty onStartCareer={props.onStartCareer} />;
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
              return (
                <article key={event.id} className="career-event-card">
                  <div>
                    <span>{event.tier}</span>
                    <strong>{event.name}</strong>
                    <p>
                      {event.startDate} - travel {money(event.travelCost)}, entry {money(event.entryFee)}, champion points{" "}
                      {event.rankingPoints.champion}
                    </p>
                  </div>
                  <button
                    className={entered ? "command-button command-button-secondary" : "command-button command-button-primary"}
                    type="button"
                    disabled={entered || completed}
                    onClick={() => props.onEnterEvent(event.id)}
                  >
                    {completed ? "Complete" : entered ? "Entered" : "Enter Event"}
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
    return <CareerEmpty onStartCareer={props.onStartCareer} />;
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
    return <CareerEmpty onStartCareer={props.onStartCareer} />;
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
