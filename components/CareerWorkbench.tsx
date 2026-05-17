import { useState } from "react";
import { playerMap } from "../game/content/players";
import { addDays, buildWeek, daysBetween } from "../game/career/calendar";
import { canAffordEventEntry, eventEntryCost } from "../game/career/economy";
import { canCommissionScoutReport, roleLabel, staffModifiers } from "../game/career/ecosystem";
import {
  buildEventSeedingSnapshot,
  CALENDAR_PAGE_SIZE,
  eventDeadlineMilestones,
  eventEndDate,
  eventEligibilityFor,
  eventStatusFor,
  getCareerEvent,
  getNextEvent,
  paginateCalendarItems,
  pastCalendarRecords,
  upcomingCalendarEvents
} from "../game/career/events";
import { canCompeteWithInjury, canTrainWithInjury } from "../game/career/health";
import type {
  AdvancedTacticPlan,
  CareerEventDefinition,
  CareerState,
  FacilityModifier,
  FacilityType,
  PlayerPromise,
  RallyLengthIntent,
  TacticModule
} from "../game/career/models";
import { managedMatchScheduleForEvent } from "../game/career/matchSchedule";
import { effectiveEventEntryCosts, facilityModifiers } from "../game/career/facilitiesMedia";
import { managedAthlete } from "../game/career/state";
import { activeAdvancedTacticPlan, buildPreMatchPlanningBridge, calculateTacticEffectProfile, tacticPlanToMatchTactic } from "../game/career/tactics";
import { trainingPlans } from "../game/career/training";
import { STORAGE_KEY, type SaveRecoveryNotice } from "../game/store/store";
import { isManagedPlayerStillInEvent, type TournamentState } from "../game/tournament/tournament";
import { KnockoutTree } from "./KnockoutTree";
import { TacticalMatchViewer } from "./TacticalMatchViewer";

interface CareerPageProps {
  career: CareerState | null;
  tournament: TournamentState | null;
  saveRecovery: SaveRecoveryNotice | null;
  activeSavePresent: boolean;
  corruptSavePresent: boolean;
  onStartCareer: () => void;
  onOpenTraining: () => void;
  onOpenCalendar: () => void;
  onOpenEventDetails: (eventId: string) => void;
  onOpenHome: () => void;
  onOpenLiveMatch: () => void;
  onOpenPostMatch: () => void;
  onOpenProgram: () => void;
  onOpenRivals: () => void;
  onOpenMatchPlanning: () => void;
  onOpenSaveManager: () => void;
  onRequestNewSession: () => void;
  onOpenFacilities: () => void;
  onOpenMedia: () => void;
  onOpenScouting: () => void;
  onOpenRecruitment: () => void;
  onOpenYouth: () => void;
  onOpenStaff: () => void;
  onOpenPromises: () => void;
  onOpenPlayerProfile: (playerId: string) => void;
  onApplyTraining: (planId: string) => void;
  onEnterEvent: (eventId: string) => void;
  onOpenScheduledCareerMatch: (eventId?: string) => void;
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

function points(value: number) {
  return `${value.toLocaleString()} pts`;
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`;
}

function statusLabel(status: ReturnType<typeof eventStatusFor>) {
  return status.replace(/_/g, " ");
}

function daysUntilLabel(date: string, targetDate: string) {
  const days = daysBetween(date, targetDate);

  if (days < 0) {
    return `${Math.abs(days)} day(s) ago`;
  }

  if (days === 0) {
    return "today";
  }

  return `${days} day(s)`;
}

function activeEvent(career: CareerState) {
  return career.activeEventId
    ? getCareerEvent(career.events, career.activeEventId)
    : getNextEvent(career.events, career.date);
}

type CalendarSection = "upcoming" | "past";

function nextCalendarMilestone(career: CareerState, event: CareerState["events"][number] | undefined) {
  if (career.stage === "pre_match") {
    return "Match briefing ready today";
  }

  if (career.stage === "post_match") {
    return "Match review pending";
  }

  if (!event) {
    return "No scheduled event";
  }

  const endDate = addDays(event.startDate, event.durationDays - 1);
  const status = eventStatusFor(career, event);

  if (status === "completed") {
    return `Completed ${endDate}`;
  }

  if (status === "in_progress") {
    return `Event window active until ${endDate}`;
  }

  if (career.date <= event.entryDeadline) {
    return `Entry deadline ${event.entryDeadline}`;
  }

  if (career.date <= event.drawDate) {
    return `Draw published ${event.drawDate}`;
  }

  if (career.date <= event.startDate) {
    return `Main draw ${event.startDate}`;
  }

  return `Window closed ${endDate}`;
}

type CalendarEventAction =
  | {
      kind: "enter_event";
      label: "Enter Event";
      disabled: false;
      tone: "primary";
      eventId: string;
    }
  | {
      kind: "play_match";
      label: string;
      disabled: false;
      tone: "required";
      eventId: string;
    }
  | {
      kind: "open_draw";
      label: "View Entry" | "View Draw";
      disabled: false;
      tone: "secondary";
      eventId: string;
    }
  | {
      kind: "review_match";
      label: "Review Match";
      disabled: false;
      tone: "required";
    }
  | {
      kind: "completed";
      label: "Complete";
      disabled: true;
      tone: "muted";
    }
  | {
      kind: "blocked";
      label: string;
      disabled: true;
      tone: "muted";
      reason: string;
    };

function calendarEventActionFor(args: {
  career: CareerState;
  event: CareerEventDefinition;
  tournament: TournamentState | null;
  completed: boolean;
  entered: boolean;
  blocked: boolean;
  medicalAllowed: boolean;
  tierAllowed: boolean;
  affordable: boolean;
}): CalendarEventAction {
  if (args.completed) {
    return {
      kind: "completed",
      label: "Complete",
      disabled: true,
      tone: "muted"
    };
  }

  if (args.entered) {
    if (args.career.stage === "post_match" && args.career.activeEventId === args.event.id) {
      return {
        kind: "review_match",
        label: "Review Match",
        disabled: false,
        tone: "required"
      };
    }

    const schedule = managedMatchScheduleForEvent({
      career: args.career,
      tournament: args.tournament,
      eventId: args.event.id
    });

    if (schedule?.event.id === args.event.id && schedule.playable) {
      return {
        kind: "play_match",
        label: `Play ${args.event.name} ${schedule.round}`,
        disabled: false,
        tone: "required",
        eventId: args.event.id
      };
    }

    return {
      kind: "open_draw",
      label: args.tournament?.id === args.event.id ? "View Draw" : "View Entry",
      disabled: false,
      tone: "secondary",
      eventId: args.event.id
    };
  }

  if (args.blocked) {
    const label = !args.medicalAllowed
      ? "Medical Hold"
      : !args.tierAllowed
        ? "Tier Locked"
        : args.affordable
          ? "Unavailable"
          : "Insufficient Funds";

    return {
      kind: "blocked",
      label,
      disabled: true,
      tone: "muted",
      reason: label
    };
  }

  return {
    kind: "enter_event",
    label: "Enter Event",
    disabled: false,
    tone: "primary",
    eventId: args.event.id
  };
}

function calendarEventActionClass(action: CalendarEventAction) {
  if (action.tone === "primary") {
    return "command-button command-button-primary";
  }

  if (action.tone === "required") {
    return "command-button command-button-required";
  }

  return "command-button command-button-secondary";
}

function CalendarPager(props: {
  label: string;
  pageIndex: number;
  pageCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPageChange: (pageIndex: number) => void;
}) {
  return (
    <div className="calendar-pagination" aria-label={`${props.label} pagination`}>
      <button
        className="command-button command-button-secondary"
        type="button"
        disabled={!props.hasPrevious}
        onClick={() => props.onPageChange(props.pageIndex - 1)}
      >
        Previous
      </button>
      <span>
        Page {props.pageIndex + 1} of {props.pageCount}
      </span>
      <button
        className="command-button command-button-secondary"
        type="button"
        disabled={!props.hasNext}
        onClick={() => props.onPageChange(props.pageIndex + 1)}
      >
        Next
      </button>
    </div>
  );
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
  const ranking = props.career.rankings.find((entry) => entry.playerId === props.career?.program.managedPlayerId);
  const eventGate = event ? eventEligibilityFor(props.career, event) : null;
  const eventStatus = event ? eventStatusFor(props.career, event) : null;
  const seedingSnapshot = event ? buildEventSeedingSnapshot({ state: props.career, event }) : null;
  const recentLedger = props.career.economy.ledger.slice(-4).reverse();
  const week = buildWeek(props.career.date);
  const evidenceRows = (props.career.lastMatchReport?.evidence ?? ["No managed match evidence yet."]).slice(0, 3);
  const taskRows = [
    {
      label: props.career.stage === "post_match" ? "Review desk" : props.career.stage === "pre_match" ? "Match day" : "Program desk",
      value:
        props.career.stage === "post_match"
          ? "Post-match report waiting"
          : props.career.stage === "pre_match"
            ? "Opponent briefing ready"
            : event
              ? `${event.name} planning`
              : "Season planning",
      action:
        props.career.stage === "post_match"
          ? "Review"
          : props.career.stage === "pre_match"
            ? "Open briefing"
            : "Open calendar"
    },
    {
      label: "Training",
      value: `${(props.career.selectedTrainingPlanId ?? "No training").replace(/-/g, " ")} block selected`,
      action: athlete.fatigue >= 65 ? "Reduce load" : "Monitor load"
    },
    {
      label: "Save state",
      value: props.activeSavePresent ? "Active browser slot online" : "No active slot detected",
      action: props.corruptSavePresent ? "Review quarantine" : "Export when ready"
    }
  ];
  const liveRouteLabel =
    props.career.stage === "pre_match"
      ? "Open Pre-Match"
      : props.career.stage === "post_match"
        ? "Review Match"
        : "Match Plan";
  const stageLabel = props.career.stage.replace(/_/g, " ");
  const nextEventName = event?.name ?? "Season planning";
  const eventIntro = event
    ? `${event.location.city}, ${event.location.country} | Starts ${event.startDate} (${daysUntilLabel(props.career.date, event.startDate)}) | ${event.stakesLabel}.`
    : "No remaining event in the Phase 1 catalog.";
  const medicalSummary =
    athlete.injury.status === "healthy"
      ? "Available for training and event entry."
      : `${athlete.injury.daysRemaining} day(s) remaining; return ${athlete.injury.returnDate ?? "pending"}. ${athlete.injury.notes[0]}`;
  return (
    <section className="screen-shell career-page" aria-label="Portal Home" data-page-contract="portal-home">
      <div className="screen-header career-portal-header">
        <div>
          <p className="screen-kicker">Portal Home</p>
          <h1 className="screen-title">Career Command Center</h1>
          <p className="screen-copy career-portal-summary">
            {props.career.date} | {player.name} | Rank {athlete.currentRank} | {points(athlete.rankingPoints)} | Race{" "}
            {points(ranking?.seasonPoints ?? 0)} | Next: {nextEventName}
          </p>
        </div>
        <div className="screen-meta screen-meta-actions career-portal-meta">
          <span>Cash {money(props.career.economy.cash)}</span>
          <span>Readiness {athlete.readiness}%</span>
          <span>{stageLabel}</span>
        </div>
      </div>

      <section className="career-status-strip career-status-strip-compact" aria-label="Career route status">
        <div>
          <span>Route</span>
          <strong>Career Home</strong>
        </div>
        <div>
          <span>Next</span>
          <strong>{nextEventName}</strong>
        </div>
        <div>
          <span>Deadline</span>
          <strong>{event ? `${event.entryDeadline} (${daysUntilLabel(props.career.date, event.entryDeadline)})` : "No open event"}</strong>
        </div>
        <div>
          <span>Action</span>
          <strong>{eventStatus ? statusLabel(eventStatus) : liveRouteLabel}</strong>
        </div>
        <div>
          <span>Save</span>
          <strong>{props.activeSavePresent ? `Active ${STORAGE_KEY}` : "No active slot"}</strong>
        </div>
      </section>

      <div className="career-dashboard-grid career-dashboard-grid-compact">
        <section className="command-panel career-dashboard-card career-dashboard-card-decision career-priority-panel">
          <div className="panel-header">
            <h2>Next Decision</h2>
            <span>{event ? `${event.tier} / week ${event.weekNumber}` : "No event"}</span>
          </div>
          <div className="career-decision-block career-decision-block-compact">
            <strong>{event?.name ?? "Season planning"}</strong>
            <p>{eventIntro}</p>
            {event && eventGate && (
              <div className="career-quick-stakes career-quick-stakes-compact" aria-label="Next event stakes summary">
                <div>
                  <span>Eligibility</span>
                  <strong>{eventGate.allowed ? "Entry clear" : "Gate blocked"}</strong>
                  <small>
                    Rank {eventGate.rank}, readiness {eventGate.readiness}, season race {points(eventGate.seasonPoints)}.
                  </small>
                </div>
                <div>
                  <span>Cutoff</span>
                  <strong>{event.rankingCutoffDate}</strong>
                  <small>Seed snapshot {seedingSnapshot?.status ?? "projected"} on {event.seedingDate}.</small>
                </div>
                <div>
                  <span>Prize / Cost</span>
                  <strong>{money(event.prizeMoney.champion)} / {money(eventEntryCost(event))}</strong>
                  <small>Champion points {points(event.rankingPoints.champion)}.</small>
                </div>
              </div>
            )}
            <div className="career-action-row">
              <button className="command-button command-button-primary" type="button" onClick={props.onOpenCalendar}>
                Calendar
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

        <section className="command-panel career-dashboard-card career-dashboard-card-tasks">
          <div className="panel-header">
            <h2>Tasks / Inbox</h2>
            <span>{taskRows.length} live items</span>
          </div>
          <div className="management-table management-table-compact career-task-table" aria-label="Portal tasks inbox">
            <div className="management-table-row management-table-row-head" aria-hidden="true">
              <span>Type</span>
              <strong>Item</strong>
              <small>Action</small>
            </div>
            {taskRows.map((task) => (
              <div key={task.label} className="management-table-row">
                <span>{task.label}</span>
                <strong>{task.value}</strong>
                <small>{task.action}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel career-dashboard-card career-dashboard-card-readiness">
          <div className="panel-header">
            <h2>Readiness</h2>
            <span>{athlete.recoveryStatus}</span>
          </div>
          <div className="career-meter-list career-meter-list-compact">
            <CareerMeter label="Readiness" value={athlete.readiness} />
            <CareerMeter label="Fatigue" value={Math.round(athlete.fatigue)} danger />
            <CareerMeter label="Injury Risk" value={Math.round(athlete.injuryRisk * 100)} danger />
          </div>
          <div className="program-log-row career-readiness-medical-row career-button-spaced">
            <span>Medical</span>
            <strong>{athlete.injury.label}</strong>
            <small>{medicalSummary}</small>
          </div>
        </section>

        <section className="command-panel career-dashboard-card career-dashboard-card-calendar">
          <div className="panel-header">
            <h2>Calendar Snapshot</h2>
            <span>{props.career.date}</span>
          </div>
          <div className="career-week-strip career-week-strip-compact" aria-label="Portal calendar snapshot">
            {week.map((day) => {
              const calendarEvent = props.career?.events.find((entry) => entry.startDate === day);
              const dayLabel = calendarEvent?.tier ?? (day === props.career?.date ? "Today" : "Train");

              return (
                <div key={day} className={day === props.career?.date ? "career-day career-day-active" : "career-day"}>
                  <span>{day.slice(5)}</span>
                  <strong>{dayLabel}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="command-panel career-dashboard-card career-dashboard-card-evidence">
          <div className="panel-header">
            <h2>Recent Match Evidence</h2>
            <span>{props.career.lastMatchReport ? `${props.career.lastMatchReport.round} evidence` : "No report"}</span>
          </div>
          <div className="management-table management-table-compact career-evidence-table" aria-label="Recent match evidence">
            <div className="management-table-row management-table-row-head" aria-hidden="true">
              <span>#</span>
              <strong>Evidence</strong>
              <small>Score</small>
            </div>
            {evidenceRows.map((entry, index) => (
              <div key={`${entry}-${index}`} className="management-table-row">
                <span>{index + 1}</span>
                <strong>{entry}</strong>
                <small>{props.career?.lastMatchReport?.scoreline ?? "Pending"}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel career-dashboard-card career-dashboard-card-ledger">
          <div className="panel-header">
            <h2>Ledger</h2>
            <span>Reconciled cashflow</span>
          </div>
          <div className="career-ledger career-ledger-compact">
            {recentLedger.length > 0 ? (
              recentLedger.map((entry) => (
                <div key={entry.id} className="career-ledger-row">
                  <span>{entry.label}</span>
                  <strong className={entry.amount >= 0 ? "career-ledger-amount-positive" : "career-ledger-amount-negative"}>
                    {signedMoney(entry.amount)}
                  </strong>
                </div>
              ))
            ) : (
              <div className="career-ledger-row career-ledger-row-empty">
                <span>No ledger entries yet</span>
                <strong>$0</strong>
              </div>
            )}
          </div>
        </section>

        <section className="command-panel career-dashboard-card career-dashboard-card-ranking">
          <div className="panel-header">
            <h2>Ranking Pressure</h2>
            <span>simplified circuit list</span>
          </div>
          <div className="career-stat-grid career-stat-grid-compact">
            <div>
              <span>Rank</span>
              <strong>{athlete.currentRank}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{points(athlete.rankingPoints)}</strong>
            </div>
            <div>
              <span>Race</span>
              <strong>{points(ranking?.seasonPoints ?? 0)}</strong>
            </div>
            <div>
              <span>Events</span>
              <strong>{props.career.completedEventIds.length}</strong>
            </div>
          </div>
          {event && (
            <p className="panel-summary career-ranking-note">
              Finals gate: top 8 or four completed events; fictional simplified circuit list.
            </p>
          )}
        </section>

        <section className="command-panel career-dashboard-card career-dashboard-card-ecosystem">
          <div className="panel-header">
            <h2>Program Ecosystem</h2>
            <span>Subsystems</span>
          </div>
          <div className="career-ecosystem-strip career-ecosystem-strip-compact">
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
              <small>{props.career.rivals.fieldPressure.length} fields</small>
            </button>
            <button className="career-system-tile" type="button" onClick={props.onOpenMatchPlanning}>
              <span>Tactics</span>
              <strong>{activeAdvancedTacticPlan(props.career).name}</strong>
              <small>{props.career.matchPlanning.advice.filter((entry) => entry.overrideState === "pending").length} notes</small>
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
                active
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
          <span>Daily upkeep {money(totalMaintenance)}</span>
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
              const canUpgrade = facility.status === "ready" && props.career!.economy.cash >= facility.nextUpgradeCost;
              const buildDetail =
                facility.status === "building" && facility.buildCompleteDate
                  ? `completes ${facility.buildCompleteDate}`
                  : `build window ${facility.buildTimeDays} day(s)`;

              return (
                <article key={facility.id} className="program-decision-card facility-card">
                  <span>{facility.status} / level {facility.level} of {facility.maxLevel}</span>
                  <strong>{facility.label}</strong>
                  <p>
                    Next cost {money(facility.nextUpgradeCost)}; {buildDetail}; daily upkeep {money(facility.maintenanceCost)}.
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
                      : facility.status === "building"
                        ? "Build In Progress"
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
                  <p>Cost {money(entry.cost)}; level {entry.level}; daily upkeep {money(facility.maintenanceCost)}.</p>
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
  const facilities = facilityModifiers(props.career.facilities);
  const scoutDurationDays = modifiers.scouting >= 0.18 || facilities.scoutingAccuracy >= 5 ? 1 : 2;
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
                        : `Cost ${money(3200)} / ${scoutDurationDays} day(s).`}
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

      <section className="management-status-strip" aria-label="Match planning status">
        <div>
          <span>Plan</span>
          <strong>{plan.name}</strong>
        </div>
        <div>
          <span>Tempo</span>
          <strong>{plan.tempo}</strong>
        </div>
        <div>
          <span>Risk</span>
          <strong>{plan.riskTolerance}</strong>
        </div>
        <div>
          <span>Advice</span>
          <strong>{pendingAdvice.length} pending</strong>
        </div>
        <div>
          <span>Next action</span>
          <strong>{props.career.stage === "pre_match" ? "Enter briefing" : "Lock plan"}</strong>
        </div>
      </section>

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

      <section className="management-status-strip" aria-label="Training status">
        <div>
          <span>Selected block</span>
          <strong>{(props.career.selectedTrainingPlanId ?? "No training").replace(/-/g, " ")}</strong>
        </div>
        <div>
          <span>Readiness</span>
          <strong>{athlete.readiness}</strong>
        </div>
        <div>
          <span>Fatigue</span>
          <strong>{Math.round(athlete.fatigue)}</strong>
        </div>
        <div>
          <span>Injury risk</span>
          <strong>{Math.round(athlete.injuryRisk * 100)}%</strong>
        </div>
        <div>
          <span>Next action</span>
          <strong>{athlete.fatigue >= 65 ? "Reduce load" : "Commit block"}</strong>
        </div>
      </section>

      <div className="career-training-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Training Plans</h2>
            <span>Cash {money(props.career.economy.cash)}</span>
          </div>
          <div className="career-plan-grid">
            {trainingPlans.map((plan) => {
              const medicalGate = canTrainWithInjury(athlete, plan.intensity);
              const affordable = props.career!.economy.cash >= plan.cost;
              const disabled = !medicalGate.allowed || !affordable;

              return (
                <button
                  key={plan.id}
                  className={
                    props.career?.selectedTrainingPlanId === plan.id
                      ? "career-plan-card career-plan-card-active"
                      : disabled
                        ? "career-plan-card career-plan-card-blocked"
                        : "career-plan-card"
                  }
                  type="button"
                  disabled={disabled}
                  aria-pressed={props.career?.selectedTrainingPlanId === plan.id}
                  onClick={() => props.onApplyTraining(plan.id)}
                >
                  <span>{plan.intensity}</span>
                  <strong>{plan.label}</strong>
                  <p>
                    {disabled
                      ? !affordable
                        ? `Insufficient budget for ${money(plan.cost)} block.`
                        : medicalGate.reason
                      : `${plan.focus} + cost ${money(plan.cost)} - fatigue ${plan.fatigueDelta >= 0 ? "+" : ""}${plan.fatigueDelta}, risk ${plan.injuryRiskDelta >= 0 ? "+" : ""}${Math.round(plan.injuryRiskDelta * 100)} pts`}
                  </p>
                </button>
              );
            })}
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
          <div className="program-log-row career-button-spaced">
            <span>{athlete.injury.status} / return {athlete.injury.returnDate ?? "available"}</span>
            <strong>{athlete.injury.label}</strong>
            <p>{athlete.injury.notes[0]}</p>
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerCalendarPage(props: CareerPageProps) {
  const [activeSection, setActiveSection] = useState<CalendarSection>("upcoming");
  const [upcomingPageIndex, setUpcomingPageIndex] = useState(0);
  const [pastPageIndex, setPastPageIndex] = useState(0);

  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const careerDate = career.date;
  const week = buildWeek(career.date);
  const athlete = managedAthlete(career);
  const medicalGate = canCompeteWithInjury(athlete);
  const ranking = career.rankings.find((entry) => entry.playerId === career.program.managedPlayerId);
  const upcomingEvents = upcomingCalendarEvents(career);
  const pastRecords = pastCalendarRecords(career);
  const upcomingPage = paginateCalendarItems(upcomingEvents, upcomingPageIndex);
  const pastPage = paginateCalendarItems(pastRecords, pastPageIndex);
  const nextEvent = career.activeEventId
    ? getCareerEvent(career.events, career.activeEventId) ?? upcomingEvents[0]
    : upcomingEvents[0];
  const nextGate = nextEvent ? eventEligibilityFor(career, nextEvent) : null;
  const nextStatus = nextEvent ? eventStatusFor(career, nextEvent) : null;
  const nextSnapshot = nextEvent ? buildEventSeedingSnapshot({ state: career, event: nextEvent }) : null;
  const nextEntryCosts = nextEvent ? effectiveEventEntryCosts(nextEvent, career.facilities) : null;
  const nextTotalCost = nextEntryCosts ? eventEntryCost(nextEntryCosts) : 0;
  const activeEventLabel = career.activeEventId ? nextEvent?.name ?? "Active entry" : "No active entry";
  const completedEventCount = career.completedEventIds.length;
  const handleSectionChange = (section: CalendarSection) => {
    setActiveSection(section);

    if (section === "upcoming") {
      setUpcomingPageIndex(0);
      return;
    }

    setPastPageIndex(0);
  };

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Career Calendar</p>
          <h1 className="screen-title">Calendar</h1>
          <p className="screen-copy">
            Track fictional circuit events, entry deadlines, draw timing, eligibility gates, costs, readiness, and the
            next schedule milestone without leaving the career workspace.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
        </div>
      </div>

      <div className="calendar-subnav" role="tablist" aria-label="Calendar sections">
        <button
          id="calendar-tab-upcoming"
          className={activeSection === "upcoming" ? "calendar-subnav-tab calendar-subnav-tab-active" : "calendar-subnav-tab"}
          type="button"
          role="tab"
          aria-selected={activeSection === "upcoming"}
          aria-controls="calendar-panel-upcoming"
          onClick={() => handleSectionChange("upcoming")}
        >
          Upcoming
        </button>
        <button
          id="calendar-tab-past"
          className={activeSection === "past" ? "calendar-subnav-tab calendar-subnav-tab-active" : "calendar-subnav-tab"}
          type="button"
          role="tab"
          aria-selected={activeSection === "past"}
          aria-controls="calendar-panel-past"
          onClick={() => handleSectionChange("past")}
        >
          Past Events
        </button>
      </div>

      <section className="management-status-strip calendar-status-strip" aria-label="Calendar status">
        <div>
          <span>Today</span>
          <strong>{careerDate}</strong>
        </div>
        <div>
          <span>Active event</span>
          <strong>{activeEventLabel}</strong>
        </div>
        <div>
          <span>Next match/draw/deadline</span>
          <strong>{nextCalendarMilestone(career, nextEvent)}</strong>
        </div>
        <div>
          <span>Readiness</span>
          <strong>{athlete.readiness}</strong>
        </div>
        <div>
          <span>Deadline</span>
          <strong>{nextEvent ? `${nextEvent.entryDeadline} (${daysUntilLabel(careerDate, nextEvent.entryDeadline)})` : "No deadline"}</strong>
        </div>
      </section>

      {activeSection === "upcoming" ? (
        <div
          id="calendar-panel-upcoming"
          className="career-calendar-layout"
          role="tabpanel"
          aria-labelledby="calendar-tab-upcoming"
        >
          <section className="command-panel command-panel-full">
            <div className="panel-header">
              <h2>Schedule Brief</h2>
              <span>{career.seasonId} circuit season</span>
            </div>
            {nextEvent && nextGate && nextSnapshot ? (
              <div className="career-event-brief calendar-brief-grid">
                <div>
                  <span>Current Event</span>
                  <strong>{nextEvent.name}</strong>
                  <small>
                    {nextEvent.tier} / week {nextEvent.weekNumber} / {nextEvent.location.venue}
                  </small>
                </div>
                <div>
                  <span>Schedule Status</span>
                  <strong>{statusLabel(nextStatus ?? "scheduled")}</strong>
                  <small>Entry deadline {nextEvent.entryDeadline}, draw milestone {nextEvent.drawDate}.</small>
                </div>
                <div>
                  <span>Eligibility</span>
                  <strong>{nextGate.allowed ? "Entry gate clear" : "Blocked"}</strong>
                  <small>
                    Rank {nextGate.rank}, total {points(nextGate.points)}, readiness {nextGate.readiness}.
                  </small>
                </div>
                <div>
                  <span>Ranking Stakes</span>
                  <strong>{points(nextEvent.rankingPoints.champion)}</strong>
                  <small>Champion prize {money(nextEvent.prizeMoney.champion)}; season race {points(ranking?.seasonPoints ?? 0)}.</small>
                </div>
                <div>
                  <span>Seed Snapshot</span>
                  <strong>{nextSnapshot.managedSeed ? `Seed ${nextSnapshot.managedSeed.seed}` : "Outside top seeds"}</strong>
                  <small>
                    {nextSnapshot.status} from fictional circuit ranking; this is presentation, not full draw-engine
                    replacement.
                  </small>
                </div>
              </div>
            ) : (
              <p className="panel-summary">No remaining event is available in the current fictional circuit catalog.</p>
            )}
          </section>

          <section className="command-panel command-panel-full calendar-schedule-panel">
            <div className="panel-header">
              <h2>Upcoming Event Schedule</h2>
              <span>{upcomingEvents.length} current/future events, {CALENDAR_PAGE_SIZE} per page</span>
            </div>
            <div className="calendar-event-table" aria-label="Upcoming event schedule">
              <div className="calendar-event-row calendar-event-row-head" aria-hidden="true">
                <span>Event</span>
                <span>Window</span>
                <span>Deadline</span>
                <span>Eligibility</span>
                <span>Stakes</span>
                <span>Action</span>
              </div>
              {upcomingPage.items.map((event) => {
                const entered = career.enteredEventIds.includes(event.id);
                const completed = career.completedEventIds.includes(event.id);
                const fieldPressure = pressureForEvent(career, event.id);
                const tierGate = eventEligibilityFor(career, event);
                const status = eventStatusFor(career, event);
                const seedingSnapshot = buildEventSeedingSnapshot({ state: career, event });
                const entryCosts = effectiveEventEntryCosts(event, career.facilities);
                const totalCost = eventEntryCost(entryCosts);
                const affordable = canAffordEventEntry({
                  economy: career.economy,
                  travelCost: entryCosts.travelCost,
                  entryFee: entryCosts.entryFee
                });
                const tierAllowed = tierGate.allowed;
                const eventBlocked = !affordable || !medicalGate.allowed || !tierAllowed;
                const action = calendarEventActionFor({
                  career,
                  event,
                  tournament: props.tournament,
                  completed,
                  entered,
                  blocked: eventBlocked,
                  medicalAllowed: medicalGate.allowed,
                  tierAllowed,
                  affordable
                });
                const milestones = eventDeadlineMilestones(event);
                const endDate = eventEndDate(event);
                const rowClassName =
                  eventBlocked && !entered && !completed
                    ? "calendar-event-row calendar-event-row-blocked"
                    : "calendar-event-row";
                const handleEventAction = () => {
                  switch (action.kind) {
                    case "enter_event":
                      props.onEnterEvent(action.eventId);
                      return;
                    case "play_match":
                      props.onOpenScheduledCareerMatch(action.eventId);
                      return;
                    case "open_draw":
                      props.onOpenEventDetails(action.eventId);
                      return;
                    case "review_match":
                      props.onOpenPostMatch();
                      return;
                    case "blocked":
                    case "completed":
                      return;
                  }
                };

                return (
                  <article key={event.id} className={rowClassName}>
                    <div className="calendar-event-main">
                      <span>{event.tier} / week {event.weekNumber} / {statusLabel(status)}</span>
                      <strong>{event.name}</strong>
                      <p>{event.location.city}, {event.location.country} - {event.location.venue}. {event.stakesLabel}.</p>
                    </div>
                    <div>
                      <span>Window</span>
                      <strong>{event.startDate} - {endDate}</strong>
                      <small>{event.durationDays} day event</small>
                    </div>
                    <div>
                      <span>Entry Deadline</span>
                      <strong>{event.entryDeadline}</strong>
                      <small>{daysUntilLabel(careerDate, event.entryDeadline)}</small>
                    </div>
                    <div>
                      <span>Eligibility</span>
                      <strong>{tierGate.allowed ? "Gate clear" : "Gate blocked"}</strong>
                      <small>Rank {tierGate.rank}, readiness {tierGate.readiness}</small>
                    </div>
                    <div>
                      <span>Prize / Cost</span>
                      <strong>{money(event.prizeMoney.champion)} / {money(totalCost)}</strong>
                      <small>{points(event.rankingPoints.champion)} champion result</small>
                    </div>
                    <div className="calendar-event-actions">
                      <button
                        className={calendarEventActionClass(action)}
                        type="button"
                        disabled={action.disabled}
                        onClick={handleEventAction}
                      >
                        {action.label}
                      </button>
                    </div>
                    <div className="calendar-event-row-details">
                      <div className="career-deadline-row" aria-label={`${event.name} deadline milestones`}>
                        {milestones.map((milestone) => (
                          <span
                            key={milestone.key}
                            className={careerDate >= milestone.date ? "deadline-chip deadline-chip-past" : "deadline-chip"}
                          >
                            {milestone.label}: {milestone.date}
                          </span>
                        ))}
                      </div>
                      <p>
                        Rival field: {fieldPressure
                          ? `${fieldPressure.rivalCount} programs, ${Math.round(fieldPressure.pressureScore)} pressure, top threat ${fieldPressure.topThreatName}`
                          : "open scouting field"}
                      </p>
                      <p>
                        Eligibility: rank {tierGate.rank}, total {points(tierGate.points)}, season race {points(tierGate.seasonPoints)},
                        readiness {tierGate.readiness}, {tierGate.completedEvents} completed event(s). {tierGate.reason}.
                      </p>
                      <p>
                        Seed snapshot: {seedingSnapshot.managedSeed
                          ? `projected seed ${seedingSnapshot.managedSeed.seed} from rank ${seedingSnapshot.managedSeed.rank}`
                          : `outside the top ${event.seedCount} seeds`}
                        . This calendar preview does not replace the current playable knockout draw engine.
                      </p>
                      {!affordable && !entered && !completed && (
                        <p className="career-event-warning">
                          Insufficient funds: program cash {money(career.economy.cash)} cannot cover entry.
                        </p>
                      )}
                      {!tierAllowed && !entered && !completed && (
                        <p className="career-event-warning">Tier gate: {tierGate.requirements.join(", ")}.</p>
                      )}
                      {!medicalGate.allowed && !entered && !completed && (
                        <p className="career-event-warning">Medical hold: {medicalGate.reason}.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <CalendarPager
              label="Upcoming events"
              pageIndex={upcomingPage.pageIndex}
              pageCount={upcomingPage.pageCount}
              hasPrevious={upcomingPage.hasPrevious}
              hasNext={upcomingPage.hasNext}
              onPageChange={setUpcomingPageIndex}
            />
          </section>

          <div className="calendar-secondary-grid">
            <section className="command-panel calendar-week-panel">
              <div className="panel-header">
                <h2>Week Strip</h2>
                <span>{career.date}</span>
              </div>
              <div className="career-week-strip">
                {week.map((day) => (
                  <div key={day} className={day === career.date ? "career-day career-day-active" : "career-day"}>
                    <span>{day.slice(5)}</span>
                    <strong>{career.events.find((event) => event.startDate === day)?.tier ?? "Train"}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Milestones &amp; Seeding</h2>
                <span>{nextEvent ? nextEvent.name : "No event"}</span>
              </div>
              {nextEvent && nextSnapshot ? (
                <div className="career-decision-block calendar-secondary-panel-body">
                  <div className="career-deadline-row" aria-label={`${nextEvent.name} active milestones`}>
                    {eventDeadlineMilestones(nextEvent).map((milestone) => (
                      <span
                        key={milestone.key}
                        className={careerDate >= milestone.date ? "deadline-chip deadline-chip-past" : "deadline-chip"}
                      >
                        {milestone.label}: {milestone.date}
                      </span>
                    ))}
                  </div>
                  <p>
                    Seed snapshot is {nextSnapshot.status} on {nextEvent.seedingDate}; draw publication is {nextEvent.drawDate} for a
                    {" "}{nextEvent.drawSize}-player bridge with {nextEvent.seedCount} seeds.
                  </p>
                </div>
              ) : (
                <p className="panel-summary">No active milestone set is available.</p>
              )}
            </section>

            <section className="command-panel">
              <div className="panel-header">
                <h2>Eligibility &amp; Costs</h2>
                <span>{nextGate?.allowed ? "Entry gate clear" : "Check requirements"}</span>
              </div>
              {nextEvent && nextGate && nextEntryCosts ? (
                <div className="career-quick-stakes calendar-cost-grid" aria-label="Calendar eligibility and cost summary">
                  <div>
                    <span>Gate</span>
                    <strong>{nextGate.allowed ? "Clear" : "Blocked"}</strong>
                    <small>{nextGate.reason}.</small>
                  </div>
                  <div>
                    <span>Readiness</span>
                    <strong>{athlete.readiness}</strong>
                    <small>{medicalGate.allowed ? "Medical gate clear" : medicalGate.reason}</small>
                  </div>
                  <div>
                    <span>Total Cost</span>
                    <strong>{money(nextTotalCost)}</strong>
                    <small>Travel {money(nextEntryCosts.travelCost)}, entry {money(nextEntryCosts.entryFee)}</small>
                  </div>
                </div>
              ) : (
                <p className="panel-summary">No eligibility or cost preview is available.</p>
              )}
            </section>
          </div>

          <section className="command-panel command-panel-full">
            <div className="panel-header">
              <h2>Simplification Boundary</h2>
              <span>honest calendar copy</span>
            </div>
            <p className="panel-summary">
              Badminton Manager uses a fictional single circuit ranking with total points and a season race. Deadlines,
              ranking cutoffs, seed snapshots, and draw publication dates are modeled for event planning, while the
              playable match bridge remains the existing deterministic 16-player knockout.
            </p>
          </section>
        </div>
      ) : (
        <div id="calendar-panel-past" className="career-calendar-layout" role="tabpanel" aria-labelledby="calendar-tab-past">
          <section className="command-panel command-panel-full calendar-past-state">
            <div className="panel-header">
              <h2>Past Events</h2>
              <span>{pastRecords.length} recorded events, {CALENDAR_PAGE_SIZE} per page</span>
            </div>
            <div className="career-event-brief calendar-past-summary">
              <div>
                <span>Completed IDs</span>
                <strong>{completedEventCount}</strong>
                <small>Completed-event markers currently in the save.</small>
              </div>
              <div>
                <span>History Records</span>
                <strong>{pastRecords.length}</strong>
                <small>Completed, skipped, and missed events from the saved archive.</small>
              </div>
              <div>
                <span>Latest Match</span>
                <strong>{career.lastMatchReport?.scoreline ?? "No result yet"}</strong>
                <small>{career.lastMatchReport ? `${career.lastMatchReport.round} / ${career.lastMatchReport.result}` : "Play an event to create review evidence."}</small>
              </div>
            </div>
            {pastPage.items.length > 0 ? (
              <>
                <div className="calendar-event-table" aria-label="Past event records">
                  <div className="calendar-event-row calendar-event-row-head" aria-hidden="true">
                    <span>Event</span>
                    <span>Dates</span>
                    <span>Result</span>
                    <span>Points / Prize</span>
                    <span>Costs</span>
                    <span>Evidence</span>
                  </div>
                  {pastPage.items.map((record) => (
                    <article key={record.eventId} className="calendar-event-row">
                      <div className="calendar-event-main">
                        <span>{record.tier} / {record.status.replace(/_/g, " ")}</span>
                        <strong>{record.eventName}</strong>
                        <p>{record.entered ? "Entered event" : "Not entered"} / completed {record.completedAt}</p>
                      </div>
                      <div>
                        <span>Window</span>
                        <strong>{record.startDate} - {record.endDate}</strong>
                        <small>Archived newest first</small>
                      </div>
                      <div>
                        <span>Result</span>
                        <strong>{record.resultRound ?? record.status.replace(/_/g, " ")}</strong>
                        <small>{record.achievements.length > 0 ? record.achievements.join(", ") : "No achievement tag"}</small>
                      </div>
                      <div>
                        <span>Points / Prize</span>
                        <strong>{points(record.pointsAwarded)} / {money(record.prizeMoney)}</strong>
                        <small>Net cash {signedMoney(record.netCash)}</small>
                      </div>
                      <div>
                        <span>Entry / Travel</span>
                        <strong>{money(record.entryCost)} / {money(record.travelCost)}</strong>
                        <small>Total cost {money(record.entryCost + record.travelCost)}</small>
                      </div>
                      <div>
                        <span>Scoreline</span>
                        <strong>{record.scorelines[0] ?? "No match played"}</strong>
                        <small>{record.matchIds.length} match record(s)</small>
                      </div>
                    </article>
                  ))}
                </div>
                <CalendarPager
                  label="Past events"
                  pageIndex={pastPage.pageIndex}
                  pageCount={pastPage.pageCount}
                  hasPrevious={pastPage.hasPrevious}
                  hasNext={pastPage.hasNext}
                  onPageChange={setPastPageIndex}
                />
              </>
            ) : (
              <p className="panel-summary">
                No past-event records have been written yet. Finished, skipped, and missed events will appear here after
                the career calendar advances beyond their event window.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export function CareerEventDetailsPage(props: CareerPageProps & { eventId: string }) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const event = getCareerEvent(career.events, props.eventId);

  if (!event) {
    return (
      <section className="screen-shell career-page">
        <div className="screen-header">
          <div>
            <p className="screen-kicker">Event Details</p>
            <h1 className="screen-title">Event Not Found</h1>
            <p className="screen-copy">The selected calendar entry is no longer available in the active career catalog.</p>
          </div>
          <div className="career-action-row">
            <button className="command-button command-button-secondary" type="button" onClick={props.onOpenCalendar}>
              Calendar
            </button>
          </div>
        </div>
      </section>
    );
  }

  const athlete = managedAthlete(career);
  const medicalGate = canCompeteWithInjury(athlete);
  const entered = career.enteredEventIds.includes(event.id);
  const completed = career.completedEventIds.includes(event.id);
  const tierGate = eventEligibilityFor(career, event);
  const seedingSnapshot = buildEventSeedingSnapshot({ state: career, event });
  const entryCosts = effectiveEventEntryCosts(event, career.facilities);
  const affordable = canAffordEventEntry({
    economy: career.economy,
    travelCost: entryCosts.travelCost,
    entryFee: entryCosts.entryFee
  });
  const action = calendarEventActionFor({
    career,
    event,
    tournament: props.tournament,
    completed,
    entered,
    blocked: !affordable || !medicalGate.allowed || !tierGate.allowed,
    medicalAllowed: medicalGate.allowed,
    tierAllowed: tierGate.allowed,
    affordable
  });
  const handleAction = () => {
    switch (action.kind) {
      case "enter_event":
        props.onEnterEvent(action.eventId);
        return;
      case "play_match":
        props.onOpenScheduledCareerMatch(action.eventId);
        return;
      case "review_match":
        props.onOpenPostMatch();
        return;
      case "open_draw":
      case "blocked":
      case "completed":
        return;
    }
  };

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Event Details</p>
          <h1 className="screen-title">{event.name}</h1>
          <p className="screen-copy">
            {event.tier} event in week {event.weekNumber}, hosted at {event.location.venue} in {event.location.city},{" "}
            {event.location.country}. {event.stakesLabel}.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenCalendar}>
            Calendar
          </button>
          <button
            className={calendarEventActionClass(action)}
            type="button"
            disabled={action.disabled || action.kind === "open_draw"}
            onClick={handleAction}
          >
            {action.label}
          </button>
        </div>
      </div>

      <section className="management-status-strip calendar-status-strip" aria-label="Event detail status">
        <div>
          <span>Status</span>
          <strong>{statusLabel(eventStatusFor(career, event))}</strong>
        </div>
        <div>
          <span>Window</span>
          <strong>{event.startDate} - {eventEndDate(event)}</strong>
        </div>
        <div>
          <span>Entry deadline</span>
          <strong>{event.entryDeadline}</strong>
        </div>
        <div>
          <span>Readiness</span>
          <strong>{athlete.readiness}</strong>
        </div>
        <div>
          <span>Action</span>
          <strong>{action.label}</strong>
        </div>
      </section>

      <div className="career-dashboard-grid">
        <section className="command-panel">
          <div className="panel-header">
            <h2>Entry Gate</h2>
            <span>{tierGate.allowed && medicalGate.allowed && affordable ? "clear" : "attention needed"}</span>
          </div>
          <div className="management-table" aria-label={`${event.name} entry gates`}>
            <div className="management-table-row">
              <span>Eligibility</span>
              <strong>{tierGate.allowed ? "Gate clear" : "Blocked"}</strong>
              <small>{tierGate.reason}</small>
            </div>
            <div className="management-table-row">
              <span>Medical</span>
              <strong>{medicalGate.allowed ? "Available" : "Hold"}</strong>
              <small>{medicalGate.reason}</small>
            </div>
            <div className="management-table-row">
              <span>Cost</span>
              <strong>{money(entryCosts.travelCost + entryCosts.entryFee)}</strong>
              <small>{affordable ? "Program can afford entry" : `Cash ${money(career.economy.cash)}`}</small>
            </div>
          </div>
        </section>

        <section className="command-panel">
          <div className="panel-header">
            <h2>Deadlines</h2>
            <span>{event.drawDate} draw</span>
          </div>
          <div className="career-deadline-row" aria-label={`${event.name} details milestones`}>
            {eventDeadlineMilestones(event).map((milestone) => (
              <span
                key={milestone.key}
                className={career.date >= milestone.date ? "deadline-chip deadline-chip-past" : "deadline-chip"}
              >
                {milestone.label}: {milestone.date}
              </span>
            ))}
          </div>
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <h2>Draw Snapshot</h2>
            <span>{seedingSnapshot.status}</span>
          </div>
          <div className="career-event-brief calendar-brief-grid">
            <div>
              <span>Draw Size</span>
              <strong>{event.drawSize}</strong>
              <small>{event.seedCount} seeded entries</small>
            </div>
            <div>
              <span>Managed Seed</span>
              <strong>{seedingSnapshot.managedSeed ? `Seed ${seedingSnapshot.managedSeed.seed}` : "Outside seeds"}</strong>
              <small>{seedingSnapshot.source}</small>
            </div>
            <div>
              <span>Champion Stakes</span>
              <strong>{points(event.rankingPoints.champion)} / {money(event.prizeMoney.champion)}</strong>
              <small>Entry {money(event.entryFee)}, travel {money(event.travelCost)}</small>
            </div>
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
  const athlete = managedAthlete(props.career);

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

      <section className="management-status-strip" aria-label="Pre-match briefing status">
        <div>
          <span>Event</span>
          <strong>{event?.name ?? "No event"}</strong>
        </div>
        <div>
          <span>Opponent</span>
          <strong>{opponent?.name ?? "Pending"}</strong>
        </div>
        <div>
          <span>Readiness</span>
          <strong>{athlete.readiness}</strong>
        </div>
        <div>
          <span>Plan</span>
          <strong>{planningBridge.planName}</strong>
        </div>
        <div>
          <span>Next action</span>
          <strong>Enter match</strong>
        </div>
      </section>

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
              <strong>
                {athlete.injury.status === "healthy"
                  ? brief?.riskNote ?? "No briefing yet"
                  : `${athlete.injury.label}: ${athlete.injury.daysRemaining} day(s) remaining`}
              </strong>
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

        {props.tournament ? (
          <KnockoutTree
            tournament={props.tournament}
            selectedPlayerId={props.career.program.managedPlayerId}
            title="Current Event Bracket"
            subtitle="Managed path, pending match, and background results"
            onOpenPlayerProfile={props.onOpenPlayerProfile}
          />
        ) : null}
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
  const eventStillActive =
    props.career.activeEventId !== null &&
    !props.career.completedEventIds.includes(props.career.activeEventId) &&
    Boolean(props.tournament && isManagedPlayerStillInEvent(props.tournament));
  const continueLabel = eventStillActive
    ? "Continue To Next Round"
    : report?.result === "win"
      ? "Collect Title And Continue"
      : "Close Event";
  const event = activeEvent(props.career);

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
          {continueLabel}
        </button>
      </div>

      <section className="management-status-strip" aria-label="Post-match review status">
        <div>
          <span>Event</span>
          <strong>{event?.name ?? report?.eventId ?? "No event"}</strong>
        </div>
        <div>
          <span>Round</span>
          <strong>{report?.round ?? "Pending"}</strong>
        </div>
        <div>
          <span>Result</span>
          <strong>{report?.result ?? "Pending"}</strong>
        </div>
        <div>
          <span>Event state</span>
          <strong>{eventStillActive ? "Still alive" : "Closeout"}</strong>
        </div>
        <div>
          <span>Next action</span>
          <strong>{continueLabel}</strong>
        </div>
      </section>

      <div className="career-hub-grid">
        {props.tournament ? (
          <KnockoutTree
            tournament={props.tournament}
            selectedPlayerId={props.career.program.managedPlayerId}
            title="Current Event Bracket"
            subtitle="Latest result, live path, and background match summaries"
            onOpenPlayerProfile={props.onOpenPlayerProfile}
          />
        ) : null}

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

        <section className="command-panel command-panel-full">
          <TacticalMatchViewer
            frame={report?.tacticalViewer ?? null}
            title="Rally Pattern Map"
            statusLabel={report?.tacticalViewer ? `${report.tacticalViewer.sequence} rallies` : "No frame"}
          />
        </section>
      </div>
    </section>
  );
}
