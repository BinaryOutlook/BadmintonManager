import { type KeyboardEvent, type ReactNode, useState } from "react";
import { playerMap } from "../game/content/players";
import { addCalendarMonths, addDays, buildWeek, calendarMonthCursorForDate, daysBetween } from "../game/career/calendar";
import type { AdvanceDayForecast } from "../game/career/dayResolution";
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
  scheduleCalendarMonthForCareer,
  upcomingCalendarEvents
} from "../game/career/events";
import type { CalendarMonthCursor, CalendarMonthViewModel } from "../game/career/events";
import { canCompeteWithInjury, canTrainWithInjury } from "../game/career/health";
import { rankingsByCurrentRank } from "../game/career/rankings";
import type {
  AdvancedTacticPlan,
  CareerEventBracketSnapshot,
  CareerEventDefinition,
  CareerEventHistoryRecord,
  CareerState,
  FacilityModifier,
  FacilityType,
  PlayerPromise,
  RallyLengthIntent,
  TacticModule,
  TournamentAddress
} from "../game/career/models";
import { managedMatchScheduleForEvent } from "../game/career/matchSchedule";
import { effectiveEventEntryCosts, facilityModifiers } from "../game/career/facilitiesMedia";
import { previewPreparationPlan, scheduledPreparationForAthlete } from "../game/career/preparation";
import {
  groupManagerScheduleEntriesByDate,
  managerScheduleEntriesBetween,
  managerScheduleMonthForCareer,
  type ManagerScheduleDateGroup,
  type ManagerScheduleDestination,
  type ManagerScheduleEntry
} from "../game/career/schedule";
import { managedAthlete } from "../game/career/state";
import { activeAdvancedTacticPlan, buildPreMatchPlanningBridge, calculateTacticEffectProfile, tacticPlanToMatchTactic } from "../game/career/tactics";
import { trainingPlans } from "../game/career/training";
import type { SaveRecoveryNotice } from "../game/store/store";
import {
  isManagedPlayerStillInEvent,
  type RoundName,
  type TournamentMatch,
  type TournamentState
} from "../game/tournament/tournament";
import { KnockoutTree } from "./KnockoutTree";
import { SmartPlayerText } from "./PlayerLink";
import { TacticalMatchViewer } from "./TacticalMatchViewer";
import { TournamentLink } from "./TournamentLink";

interface CareerPageProps {
  career: CareerState | null;
  tournament: TournamentState | null;
  advanceDayForecast?: AdvanceDayForecast | null;
  saveRecovery: SaveRecoveryNotice | null;
  activeSavePresent: boolean;
  corruptSavePresent: boolean;
  onStartCareer: () => void;
  onOpenTraining: () => void;
  onOpenCalendar: () => void;
  onOpenTimeline: () => void;
  onOpenTournamentHome: (address: TournamentAddress) => void;
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
  onApplyTraining: (planId: string | null) => void;
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

function compactNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value);
}

function signedNumber(value: number, suffix = "") {
  const normalized = Math.abs(value) < 0.000_1 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${compactNumber(normalized)}${suffix}`;
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

function calendarRoundLabel(round: "R16" | "QF" | "SF" | "F") {
  switch (round) {
    case "R16":
      return "Round of 16";
    case "QF":
      return "Quarter-Final";
    case "SF":
      return "Semi-Final";
    case "F":
      return "Final";
  }
}

function ProfileNameButton(props: {
  playerId: string | null | undefined;
  fallback: ReactNode;
  onOpenPlayerProfile: (playerId: string) => void;
  className?: string;
  children?: ReactNode;
}) {
  const player = props.playerId ? playerMap[props.playerId] : null;

  if (!player) {
    return <>{props.fallback}</>;
  }

  return (
    <button
      className={props.className ?? "profile-name-button"}
      type="button"
      onClick={() => props.onOpenPlayerProfile(player.id)}
    >
      {props.children ?? player.name}
    </button>
  );
}

function CareerTournamentLink(props: {
  career: CareerState;
  eventId?: string | null;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <TournamentLink
      seasonId={props.career.seasonId}
      eventId={props.eventId}
      className={props.className}
      ariaLabel={props.ariaLabel}
    >
      {props.children}
    </TournamentLink>
  );
}

function SmartCareerText(props: {
  text: string;
  className?: string;
  onOpenPlayerProfile: (playerId: string) => void;
}) {
  return (
    <SmartPlayerText
      text={props.text}
      className={props.className}
      onOpenPlayerProfile={props.onOpenPlayerProfile}
    />
  );
}

function activeEvent(career: CareerState) {
  return career.activeEventId
    ? getCareerEvent(career.events, career.activeEventId)
    : getNextEvent(career.events, career.date);
}

type CareerCalendarPageProps = CareerPageProps & {
  initialMonthCursor?: CalendarMonthCursor;
};

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
      label: "Open Event";
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
      label: "Open Event",
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

const scheduleCalendarWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type ManagerScheduleNavigationProps = Pick<
  CareerPageProps,
  | "onOpenTournamentHome"
  | "onOpenScheduledCareerMatch"
  | "onOpenTraining"
  | "onOpenScouting"
  | "onOpenFacilities"
>;

function readableScheduleToken(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function managerScheduleCategoryClass(entry: ManagerScheduleEntry) {
  return `manager-schedule-category-${entry.category}`;
}

function managerScheduleStatusClass(entry: ManagerScheduleEntry) {
  return `manager-schedule-status-${entry.status}`;
}

function managerScheduleActionLabel(destination: ManagerScheduleDestination) {
  switch (destination?.kind) {
    case "tournament":
      return "Open event";
    case "scheduled_match":
      return "Open match";
    case "training":
      return "Open training";
    case "scouting":
      return "Open scouting";
    case "facilities":
      return "Open facilities";
    case undefined:
      return null;
  }
}

function openManagerScheduleDestination(
  props: ManagerScheduleNavigationProps,
  destination: ManagerScheduleDestination
) {
  switch (destination?.kind) {
    case "tournament":
      props.onOpenTournamentHome({ seasonId: destination.seasonId, eventId: destination.eventId });
      return;
    case "scheduled_match":
      props.onOpenScheduledCareerMatch(destination.eventId);
      return;
    case "training":
      props.onOpenTraining();
      return;
    case "scouting":
      props.onOpenScouting();
      return;
    case "facilities":
      props.onOpenFacilities();
      return;
    case undefined:
      return;
  }
}

function managerScheduleAccessibleAction(entry: ManagerScheduleEntry) {
  const action = managerScheduleActionLabel(entry.destination);
  return action
    ? `${action}: ${entry.title}, ${readableScheduleToken(entry.category)}, ${readableScheduleToken(entry.status)}, ${entry.date}`
    : null;
}

function ScheduleCalendarGrid(props: {
  career: CareerState;
  month: CalendarMonthViewModel;
  managerGroups: ManagerScheduleDateGroup[];
  monthControls?: ReactNode;
} & ManagerScheduleNavigationProps) {
  const entriesByDate = new Map(props.managerGroups.map((group) => [group.date, group.entries]));

  return (
    <div className="schedule-calendar-months" aria-label="Manager schedule calendar month">
      <section className="schedule-calendar-month" aria-label={`Calendar for ${props.month.label}`}>
        <header className="schedule-calendar-month-header">
          <h2>{props.month.label}</h2>
          {props.monthControls}
        </header>
        <div className="schedule-calendar-weekdays" aria-hidden="true">
          {scheduleCalendarWeekdays.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="schedule-calendar-grid" role="grid" aria-label={`Calendar for ${props.month.label}`}>
          {props.month.weeks.map((week, weekIndex) => (
            <div className="schedule-calendar-week" role="row" key={`${props.month.cursor}-week-${weekIndex}`}>
              {week.days.map((cell) => {
                const entries = cell.inVisibleMonth ? entriesByDate.get(cell.date) ?? [] : [];
                const className = [
                  "schedule-calendar-cell",
                  cell.inVisibleMonth ? "" : "schedule-calendar-cell-muted",
                  cell.isCareerToday ? "schedule-calendar-cell-today" : ""
                ].filter(Boolean).join(" ");

                return (
                  <div
                    key={cell.date}
                    className={className}
                    role="gridcell"
                    aria-current={cell.isCareerToday ? "date" : undefined}
                    aria-label={`${cell.date}, ${entries.length} manager schedule item(s)${cell.isCareerToday ? ", career today" : ""}`}
                  >
                    <span className="schedule-calendar-day-number">{cell.dayNumber}</span>
                    {entries.length > 0 ? (
                      <div className="schedule-calendar-entry-stack">
                        {entries.map((entry) => {
                          const badgeClassName = [
                            "schedule-calendar-badge",
                            managerScheduleCategoryClass(entry),
                            managerScheduleStatusClass(entry)
                          ].join(" ");
                          const content = (
                            <>
                              <span className="schedule-calendar-badge-meta">
                                {readableScheduleToken(entry.category)} · {readableScheduleToken(entry.status)}
                              </span>
                              <strong>{entry.title}</strong>
                              <small>{entry.detail}</small>
                            </>
                          );
                          const actionLabel = managerScheduleAccessibleAction(entry);

                          return actionLabel ? (
                            <button
                              key={entry.id}
                              className={badgeClassName}
                              type="button"
                              aria-label={actionLabel}
                              onClick={() => openManagerScheduleDestination(props, entry.destination)}
                            >
                              {content}
                            </button>
                          ) : (
                            <div key={entry.id} className={badgeClassName} aria-label={`${entry.title}, ${entry.status}`}>
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function pressureForEvent(career: CareerState, eventId: string) {
  return career.rivals.fieldPressure.find((entry) => entry.eventId === eventId);
}

function rankingStatus(entry: CareerState["rankings"][number]) {
  const latest = [...entry.eventHistory].sort((left, right) =>
    (right.date ?? "").localeCompare(left.date ?? "") ||
    left.eventId.localeCompare(right.eventId) ||
    left.round.localeCompare(right.round)
  )[0];

  if (!latest) {
    return entry.countedResults > 0
      ? `${entry.countedResults}/${entry.eligibleResults} counted`
      : "No counted results";
  }

  return `Latest ${latest.round} +${points(latest.points)} / ${entry.countedResults} counted`;
}

const RANKINGS_PAGE_SIZE = 8;

function openTournamentHome(props: CareerPageProps, career: CareerState, eventId: string) {
  props.onOpenTournamentHome({ seasonId: career.seasonId, eventId });
}

function tournamentFromSnapshot(args: {
  event: CareerEventDefinition | undefined;
  record: CareerEventHistoryRecord;
  snapshot: CareerEventBracketSnapshot;
}): TournamentState {
  return {
    id: args.record.eventId,
    name: args.event?.name ?? args.record.eventName,
    tier: args.event?.tier ?? args.record.tier,
    prizePoolUsd: (args.event?.prizeMoney.champion ?? args.record.prizeMoney) * 2,
    managedPlayerId: args.snapshot.managedPlayerId,
    rounds: args.snapshot.rounds.map((round) => ({
      name: round.name,
      matches: round.matches.map((match) => ({
        id: match.id,
        round: round.name,
        sideAId: match.sideAId,
        sideBId: match.sideBId,
        winnerId: match.winnerId ?? undefined,
        scoreline: match.scoreline ?? undefined,
        managed: match.managed,
        completed: Boolean(match.winnerId)
      }))
    })),
    currentRoundIndex: Math.max(0, args.snapshot.rounds.length - 1),
    rngState: 0,
    eliminated: args.snapshot.championId !== args.snapshot.managedPlayerId,
    managedResults: [],
    championId: args.snapshot.championId ?? undefined
  };
}

type CareerMatchHistoryRecord = CareerState["matchHistory"][number];
type EventOutcomeConfidence = "complete" | "partial" | "legacy";

type EventOutcome = {
  championId: string | null;
  runnerUpId: string | null;
  finalScoreline: string | null;
  sourceLabel: string;
  confidence: EventOutcomeConfidence;
};

type EventMatchEvidence = {
  id: string;
  round: RoundName;
  playerAId: string;
  playerBId: string;
  winnerId: string;
  loserId: string;
  scoreline: string;
  sourceLabel: string;
};

const archiveRoundOrder: RoundName[] = ["R16", "QF", "SF", "F"];
const archiveRoundIndex: Record<RoundName, number> = {
  R16: 0,
  QF: 1,
  SF: 2,
  F: 3
};
const completeBracketMatchCount: Record<RoundName, number> = {
  R16: 8,
  QF: 4,
  SF: 2,
  F: 1
};

function eventMatchHistory(career: CareerState, eventId: string) {
  return [...career.matchHistory]
    .filter((record) => record.eventId === eventId)
    .sort(
      (left, right) =>
        archiveRoundIndex[left.round] - archiveRoundIndex[right.round] ||
        matchNumberFromId(left.id) - matchNumberFromId(right.id) ||
        left.id.localeCompare(right.id)
    );
}

function matchNumberFromId(id: string) {
  const match = /-(\d+)$/.exec(id);

  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function removeEventPrefix(eventId: string, recordId: string) {
  const prefix = `${eventId}:`;

  return recordId.startsWith(prefix) ? recordId.slice(prefix.length) : recordId;
}

function sourceLabelForRecord(source: CareerMatchHistoryRecord["source"]) {
  switch (source) {
    case "played":
      return "Played managed match";
    case "quick_sim":
      return "Quick simulation";
    case "universe_sim":
      return "Universe simulation";
    case "backfill_sim":
      return "Backfill simulation";
    case "archive_import":
      return "Archive import";
  }
}

function sourceLabelForTournamentMatch(match: TournamentMatch) {
  if (match.managed) {
    return "Played managed match";
  }

  return match.simulationFidelity === "quick" ? "Quick simulation" : "Archived result";
}

function completedFinalMatch(tournament: TournamentState) {
  const finalMatch = tournament.rounds
    .find((round) => round.name === "F")
    ?.matches.find((match) => match.completed && Boolean(match.winnerId));

  return finalMatch ?? null;
}

function runnerUpIdForMatch(match: Pick<TournamentMatch, "sideAId" | "sideBId" | "winnerId">) {
  if (!match.winnerId) {
    return null;
  }

  return match.sideAId === match.winnerId ? match.sideBId : match.sideAId;
}

function tournamentOutcome(tournament: TournamentState, sourceLabel: string): EventOutcome | null {
  const finalMatch = completedFinalMatch(tournament);

  if (finalMatch?.winnerId) {
    return {
      championId: finalMatch.winnerId,
      runnerUpId: runnerUpIdForMatch(finalMatch),
      finalScoreline: finalMatch.scoreline ?? null,
      sourceLabel,
      confidence: "complete"
    };
  }

  if (tournament.championId) {
    return {
      championId: tournament.championId,
      runnerUpId: null,
      finalScoreline: null,
      sourceLabel,
      confidence: "partial"
    };
  }

  return null;
}

function achievementOutcome(career: CareerState, eventId: string): EventOutcome | null {
  const champion = career.playerAchievements.find(
    (achievement) => achievement.eventId === eventId && achievement.result === "champion"
  );
  const runnerUp = career.playerAchievements.find(
    (achievement) => achievement.eventId === eventId && achievement.result === "runner_up"
  );

  if (!champion && !runnerUp) {
    return null;
  }

  return {
    championId: champion?.playerId ?? null,
    runnerUpId: runnerUp?.playerId ?? null,
    finalScoreline: null,
    sourceLabel: "Career achievement archive",
    confidence: champion && runnerUp ? "partial" : "legacy"
  };
}

function managedHistoryOnlyOutcome(args: {
  record: CareerEventHistoryRecord | undefined;
  managedPlayerId: string;
}): EventOutcome | null {
  if (!args.record) {
    return null;
  }

  if (args.record.status === "champion") {
    return {
      championId: args.managedPlayerId,
      runnerUpId: null,
      finalScoreline: args.record.scorelines.at(-1) ?? null,
      sourceLabel: "Managed-result archive",
      confidence: "legacy"
    };
  }

  if (args.record.status === "runner_up") {
    return {
      championId: null,
      runnerUpId: args.managedPlayerId,
      finalScoreline: args.record.scorelines.at(-1) ?? null,
      sourceLabel: "Managed-result archive",
      confidence: "legacy"
    };
  }

  return null;
}

function completeTournamentFromMatchHistory(args: {
  event: CareerEventDefinition;
  records: CareerMatchHistoryRecord[];
  managedPlayerId: string;
}): TournamentState | null {
  const recordsByRound = Object.fromEntries(
    archiveRoundOrder.map((round) => [
      round,
      args.records.filter((record) => record.round === round)
    ])
  ) as Record<RoundName, CareerMatchHistoryRecord[]>;
  const hasCompleteShape = archiveRoundOrder.every(
    (round) => recordsByRound[round].length === completeBracketMatchCount[round]
  );

  if (!hasCompleteShape) {
    return null;
  }

  const finalRecord = recordsByRound.F[0];

  if (!finalRecord) {
    return null;
  }

  return {
    id: args.event.id,
    name: args.event.name,
    tier: args.event.tier,
    prizePoolUsd: args.event.prizeMoney.champion * 2,
    managedPlayerId: args.managedPlayerId,
    rounds: archiveRoundOrder.map((round) => ({
      name: round,
      matches: recordsByRound[round].map((record) => ({
        id: removeEventPrefix(args.event.id, record.id),
        round,
        sideAId: record.playerAId,
        sideBId: record.playerBId,
        winnerId: record.winnerId,
        scoreline: record.scoreline,
        simulationFidelity:
          record.source === "quick_sim" || record.source === "universe_sim" || record.source === "backfill_sim"
            ? "quick"
            : "detailed",
        managed: record.playerAId === args.managedPlayerId || record.playerBId === args.managedPlayerId,
        completed: true
      }))
    })),
    currentRoundIndex: archiveRoundOrder.length - 1,
    rngState: 0,
    eliminated: finalRecord.winnerId !== args.managedPlayerId,
    managedResults: [],
    championId: finalRecord.winnerId
  };
}

function evidenceFromMatchRecords(records: CareerMatchHistoryRecord[]): EventMatchEvidence[] {
  return records.map((record) => ({
    id: record.id,
    round: record.round,
    playerAId: record.playerAId,
    playerBId: record.playerBId,
    winnerId: record.winnerId,
    loserId: record.playerAId === record.winnerId ? record.playerBId : record.playerAId,
    scoreline: record.scoreline,
    sourceLabel: sourceLabelForRecord(record.source)
  }));
}

function evidenceFromTournament(tournament: TournamentState): EventMatchEvidence[] {
  return tournament.rounds.flatMap((round) =>
    round.matches.flatMap((match): EventMatchEvidence[] => {
      if (!match.completed || !match.winnerId || !match.scoreline) {
        return [];
      }

      return [
        {
          id: match.id,
          round: round.name,
          playerAId: match.sideAId,
          playerBId: match.sideBId,
          winnerId: match.winnerId,
          loserId: match.sideAId === match.winnerId ? match.sideBId : match.sideAId,
          scoreline: match.scoreline,
          sourceLabel: sourceLabelForTournamentMatch(match)
        }
      ];
    })
  );
}

function rankingLedgerLine(args: {
  career: CareerState;
  eventId: string;
  playerId: string | null;
  fallbackPoints: number | null;
  fallbackLabel: string;
}) {
  if (!args.playerId) {
    return "Unknown athlete; no ranking ledger lookup possible.";
  }

  const entry = args.career.rankings.find((ranking) => ranking.playerId === args.playerId);
  const history = entry?.eventHistory.find((record) => record.eventId === args.eventId);

  if (history) {
    return `Ranking ledger +${points(history.points)} (${history.round}).`;
  }

  if (args.fallbackPoints !== null) {
    return `${args.fallbackLabel} value ${points(args.fallbackPoints)}; no ranking ledger entry in this save.`;
  }

  return "No ranking ledger entry in this save.";
}

function playerDisplayName(playerId: string | null | undefined) {
  return playerId ? playerMap[playerId]?.name ?? playerId : "Unknown";
}

function managedOutcomeSummary(args: {
  career: CareerState;
  record: CareerEventHistoryRecord | undefined;
  matchRecords: CareerMatchHistoryRecord[];
}) {
  const managedPlayerId = args.career.program.managedPlayerId;
  const managedRecords = args.matchRecords.filter(
    (record) => record.playerAId === managedPlayerId || record.playerBId === managedPlayerId
  );
  const latestManagedRecord = managedRecords.at(-1);
  const statusLabelText = args.record?.status.replace(/_/g, " ") ?? "Not entered";
  const label = args.record?.resultRound ?? statusLabelText;

  if (!latestManagedRecord) {
    return {
      label,
      detail: args.record?.scorelines[0] ?? (args.record ? "Legacy summary has no managed match scoreline." : "No managed result yet.")
    };
  }

  const opponentId =
    latestManagedRecord.playerAId === managedPlayerId ? latestManagedRecord.playerBId : latestManagedRecord.playerAId;
  const result = latestManagedRecord.winnerId === managedPlayerId ? "Win" : "Loss";

  return {
    label: `${result} / ${latestManagedRecord.round}`,
    detail: `${latestManagedRecord.scoreline} vs ${playerDisplayName(opponentId)} (${sourceLabelForRecord(latestManagedRecord.source)}).`
  };
}

function fieldChangeSummary(record: CareerState["universeEvents"][number] | undefined) {
  const snapshot = record?.fieldSnapshot;

  if (!snapshot) {
    return "Final fields publish through the draw engine once the event reaches draw day.";
  }

  if (snapshot.nonEntries.length === 0 && snapshot.alternateEntries.length === 0) {
    return "Final field matched the invited list; seeds were assigned from current rolling rank.";
  }

  return `${snapshot.nonEntries.length} ranked invitee(s) skipped; ${snapshot.alternateEntries.length} alternate(s) entered before final rank-based seeding.`;
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

type HomeDecisionButtonKind =
  | "enter_event"
  | "open_timeline"
  | "open_training"
  | "open_program"
  | "open_rivals"
  | "open_match_planning"
  | "open_post_match"
  | "open_scheduled_match"
  | "open_tournament_home";

type HomeDecisionButton = {
  label: string;
  kind: HomeDecisionButtonKind;
  tone: "primary" | "secondary" | "required";
  eventId?: string;
  disabled?: boolean;
  reason?: string;
};

type HomeDecisionConsequence = {
  label: "Action" | "Reward" | "Cost" | "Risk" | "Deadline";
  value: string;
  detail: string;
};

type HomeDecisionModel = {
  title: string;
  eventId: string | null;
  eyebrow: string;
  context: string;
  consequences: HomeDecisionConsequence[];
  recommendation: string;
  buttons: HomeDecisionButton[];
};

type HomeTaskRow = {
  label: string;
  value: string;
  action: string;
  urgent: boolean;
};

type HomeCalendarDay = {
  date: string;
  primaryEntry: ManagerScheduleEntry | null;
  additionalCount: number;
  active: boolean;
};

function selectedTrainingPlan(career: CareerState) {
  return career.selectedTrainingPlanId
    ? trainingPlans.find((plan) => plan.id === career.selectedTrainingPlanId) ?? null
    : null;
}

function managedPsychology(career: CareerState) {
  return career.ecosystem.psychology.find((entry) => entry.athleteId === career.program.managedPlayerId) ?? null;
}

function eventRoundPoints(event: CareerEventDefinition | undefined, round: RoundName | "champion") {
  return event?.rankingPoints[round] ?? 0;
}

function eventRoundPrize(event: CareerEventDefinition | undefined, round: RoundName | "champion") {
  return event?.prizeMoney[round] ?? 0;
}

function projectedConditionAfterTravel(readiness: number, travelFatigue: number) {
  return Math.max(0, Math.round(readiness - travelFatigue));
}

function homeDecisionRecommendation(args: {
  career: CareerState;
  event: CareerEventDefinition;
  allowed: boolean;
  affordable: boolean;
  medicalAllowed: boolean;
  readiness: number;
}) {
  const daysUntilEntry = daysBetween(args.career.date, args.event.entryDeadline);

  if (!args.medicalAllowed) {
    return "Do not force the entry: medical availability is the blocker, so recovery protects the season better than chasing points.";
  }

  if (!args.affordable) {
    return "Delay the entry or find cashflow first; the event cost would overdraw the local program budget.";
  }

  if (!args.allowed) {
    return "The event gate is not clean yet. Use the Calendar details to verify rank, readiness, and race requirements before committing.";
  }

  if (args.readiness < 72) {
    return "The points are attractive, but the athlete is not fresh enough for a clean entry. Prioritize recovery before locking travel.";
  }

  if (daysUntilEntry <= 1) {
    return "Enter now if this points chase matters; the entry window closes immediately and the cost is affordable.";
  }

  return "Entry is viable. Commit if the ranking upside matters, or spend one day on load management before the deadline.";
}

function buildHomeDecisionModel(args: {
  career: CareerState;
  tournament: TournamentState | null;
  athlete: ReturnType<typeof managedAthlete>;
  event: CareerEventDefinition | undefined;
}): HomeDecisionModel {
  const { career, tournament, athlete, event } = args;
  const report = career.lastMatchReport;
  const brief = career.lastPreMatchBrief;
  const schedule = event
    ? managedMatchScheduleForEvent({
        career,
        tournament,
        eventId: event.id
      })
    : null;

  if (career.stage === "post_match" && report) {
    return {
      title: event ? `Review ${event.name} ${report.round}` : "Review latest match",
      eventId: event?.id ?? report.eventId,
      eyebrow: "Post-match review waiting",
      context: `${report.scoreline} ${report.result}; settle evidence before the next career day changes the schedule.`,
      consequences: [
        {
          label: "Action",
          value: "Review Match",
          detail: "Post-match report is the blocking desk."
        },
        {
          label: "Reward",
          value: `+${points(report.pointsDelta)} / ${signedMoney(report.cashDelta)}`,
          detail: "Exact settlement values from the saved match report."
        },
        {
          label: "Cost",
          value: `+${Math.round(report.fatigueDelta)} fatigue`,
          detail: "Exact match-load consequence already recorded."
        },
        {
          label: "Risk",
          value: `${athlete.readiness}% ready`,
          detail: `${Math.round(athlete.fatigue)} fatigue, ${Math.round(athlete.injuryRisk * 100)}% injury risk after the match.`
        },
        {
          label: "Deadline",
          value: "Before advance",
          detail: `Review before leaving ${career.date}.`
        }
      ],
      recommendation: report.recommendations[0] ?? "Settle the report, then choose the next training or travel block.",
      buttons: [
        { label: "Review Match", kind: "open_post_match", tone: "required" },
        { label: "Match Planning", kind: "open_match_planning", tone: "secondary" },
        { label: "Training Desk", kind: "open_training", tone: "secondary" },
        { label: "Program Hub", kind: "open_program", tone: "secondary" },
        { label: "Circuit Room", kind: "open_rivals", tone: "secondary" }
      ]
    };
  }

  if (career.stage === "pre_match" && event) {
    const round = schedule?.round ?? "R16";
    const roundPoints = eventRoundPoints(event, round);
    const roundPrize = eventRoundPrize(event, round);

    return {
      title: `${event.name} ${calendarRoundLabel(round)}`,
      eventId: event.id,
      eyebrow: "Match briefing ready",
      context: brief?.opponentBrief ?? "Opponent briefing is ready; lock the badminton plan before entering the match command center.",
      consequences: [
        {
          label: "Action",
          value: "Open Pre-Match",
          detail: "Scout, tactic, and readiness checks are due now."
        },
        {
          label: "Reward",
          value: `+${points(roundPoints)} / +${money(roundPrize)}`,
          detail: `Current round stake; title ceiling remains +${points(event.rankingPoints.champion)}.`
        },
        {
          label: "Cost",
          value: "Projected match load",
          detail: "Fatigue and injury risk will be resolved by the match engine after play."
        },
        {
          label: "Risk",
          value: `${athlete.readiness}% ready`,
          detail: brief?.riskNote ?? `${Math.round(athlete.fatigue)} fatigue, ${Math.round(athlete.injuryRisk * 100)}% injury risk.`
        },
        {
          label: "Deadline",
          value: schedule?.scheduledDate ?? career.date,
          detail: schedule?.overdue ? "Match day is overdue." : "Scheduled managed match day."
        }
      ],
      recommendation:
        brief?.recommendation ??
        (athlete.readiness >= 76 ? "Proceed with the prepared tactic." : "Protect rallies and avoid overload until readiness recovers."),
      buttons: [
        { label: "Open Pre-Match", kind: "open_scheduled_match", tone: "required", eventId: event.id },
        { label: "Match Planning", kind: "open_match_planning", tone: "secondary" },
        { label: "Training Desk", kind: "open_training", tone: "secondary" },
        { label: "Program Hub", kind: "open_program", tone: "secondary" },
        { label: "Circuit Room", kind: "open_rivals", tone: "secondary" }
      ]
    };
  }

  if (event) {
    const status = eventStatusFor(career, event);
    const gate = eventEligibilityFor(career, event);
    const medicalGate = canCompeteWithInjury(athlete);
    const entryCosts = effectiveEventEntryCosts(event, career.facilities);
    const totalCost = eventEntryCost(entryCosts);
    const affordable = canAffordEventEntry({
      economy: career.economy,
      travelCost: entryCosts.travelCost,
      entryFee: entryCosts.entryFee
    });
    const entered = career.enteredEventIds.includes(event.id);
    const projectedCondition = projectedConditionAfterTravel(athlete.readiness, entryCosts.travelFatigue);

    if (entered) {
      const nextMatchDate = schedule?.scheduledDate ?? event.startDate;

      return {
        title: event.name,
        eventId: event.id,
        eyebrow: status === "in_progress" ? "Event active" : "Entry committed",
        context: `${event.location.city}, ${event.location.country}. Prepare the travel, draw, and match plan around ${nextMatchDate}.`,
        consequences: [
          {
            label: "Action",
            value: schedule?.playable ? "Open Match Day" : "Prepare Event",
            detail: schedule?.playable ? "A managed match is playable now." : "Entry is locked; planning pressure moves to travel and tactics."
          },
          {
            label: "Reward",
            value: `+${points(event.rankingPoints.champion)} title ceiling`,
            detail: `Opening-round stake is +${points(event.rankingPoints.R16)} and +${money(event.prizeMoney.R16)}.`
          },
          {
            label: "Cost",
            value: "Entry committed",
            detail: "Cash cost has already been posted to the local ledger at entry time."
          },
          {
            label: "Risk",
            value: `${athlete.readiness}% ready`,
            detail: `${Math.round(athlete.fatigue)} fatigue; match-day load is still unresolved.`
          },
          {
            label: "Deadline",
            value: nextMatchDate,
            detail: schedule?.round ? `${calendarRoundLabel(schedule.round)} schedule.` : "Main draw start."
          }
        ],
        recommendation:
          athlete.fatigue >= 60
            ? "Reduce load before the match day; the athlete is carrying enough fatigue to blunt explosiveness."
            : "Use the remaining days for opponent scouting and a contained training block.",
        buttons: [
          {
            label: schedule?.playable ? "Open Match Day" : "Open Event",
            kind: schedule?.playable ? "open_scheduled_match" : "open_tournament_home",
            tone: schedule?.playable ? "required" : "primary",
            eventId: event.id
          },
          { label: "Timeline", kind: "open_timeline", tone: "secondary" },
          { label: "Match Planning", kind: "open_match_planning", tone: "secondary" },
          { label: "Training Desk", kind: "open_training", tone: "secondary" },
          { label: "Program Hub", kind: "open_program", tone: "secondary" },
          { label: "Circuit Room", kind: "open_rivals", tone: "secondary" }
        ]
      };
    }

    const entryBlocked = !gate.allowed || !affordable || !medicalGate.allowed || status === "missed_deadline";
    const actionValue = entryBlocked ? "Resolve Entry Block" : "Enter Event";

    return {
      title: event.name,
      eventId: event.id,
      eyebrow: `${event.tier} / week ${event.weekNumber}`,
      context: `${event.location.city}, ${event.location.country}. ${event.stakesLabel}.`,
      consequences: [
        {
          label: "Action",
          value: actionValue,
          detail: entryBlocked ? "Entry needs a gate, cash, deadline, or medical fix." : "Direct event entry is available from this panel."
        },
        {
          label: "Reward",
          value: `+${points(event.rankingPoints.champion)} / +${money(event.prizeMoney.champion)}`,
          detail: `Projected title upside; R16 floor is +${points(event.rankingPoints.R16)}.`
        },
        {
          label: "Cost",
          value: signedMoney(-totalCost),
          detail:
            entryCosts.savedTravelCost > 0
              ? `Exact entry + travel cost; facilities save ${money(entryCosts.savedTravelCost)}.`
              : "Exact entry + travel cost from the event and facility state."
        },
        {
          label: "Risk",
          value: `${athlete.readiness}% ready`,
          detail: `Projected condition ${projectedCondition}% after ${entryCosts.travelFatigue} travel fatigue; injury risk ${Math.round(athlete.injuryRisk * 100)}%.`
        },
        {
          label: "Deadline",
          value: event.entryDeadline,
          detail: `Entry closes ${daysUntilLabel(career.date, event.entryDeadline)}.`
        }
      ],
      recommendation: homeDecisionRecommendation({
        career,
        event,
        allowed: gate.allowed && status !== "missed_deadline",
        affordable,
        medicalAllowed: medicalGate.allowed,
        readiness: athlete.readiness
      }),
      buttons: [
        {
          label: entryBlocked ? "Open Event Details" : "Enter Event",
          kind: entryBlocked ? "open_tournament_home" : "enter_event",
          tone: entryBlocked ? "secondary" : "primary",
          eventId: event.id,
          disabled: false
        },
        { label: "Timeline", kind: "open_timeline", tone: "secondary" },
        { label: athlete.fatigue >= 60 ? "Recovery Desk" : "Training Desk", kind: "open_training", tone: "secondary" },
        { label: "Match Planning", kind: "open_match_planning", tone: "secondary" },
        { label: "Program Hub", kind: "open_program", tone: "secondary" },
        { label: "Circuit Room", kind: "open_rivals", tone: "secondary" }
      ]
    };
  }

  return {
    title: "Season planning",
    eventId: null,
    eyebrow: "No event window",
    context: "No future event is available in the current catalog. Use the day to tune the athlete and program systems.",
    consequences: [
      {
        label: "Action",
        value: "Plan Season",
        detail: "Calendar and training are the useful desks until a new event opens."
      },
      {
        label: "Reward",
        value: "Development upside",
        detail: "Training, scouting, and facilities are the available progression levers."
      },
      {
        label: "Cost",
        value: "Manager choice",
        detail: "Cash impact depends on the desk you open next."
      },
      {
        label: "Risk",
        value: `${athlete.readiness}% ready`,
        detail: `${Math.round(athlete.fatigue)} fatigue, ${Math.round(athlete.injuryRisk * 100)}% injury risk.`
      },
      {
        label: "Deadline",
        value: "Open",
        detail: "No entry window is currently closing."
      }
    ],
    recommendation: "Choose a training or scouting block, then advance when the topbar says the day is safe.",
    buttons: [
      { label: "Timeline", kind: "open_timeline", tone: "primary" },
      { label: "Training Desk", kind: "open_training", tone: "secondary" },
      { label: "Program Hub", kind: "open_program", tone: "secondary" },
      { label: "Circuit Room", kind: "open_rivals", tone: "secondary" },
      { label: "Match Planning", kind: "open_match_planning", tone: "secondary" }
    ]
  };
}

function homeTaskRowsFor(args: {
  career: CareerState;
  athlete: ReturnType<typeof managedAthlete>;
  event: CareerEventDefinition | undefined;
  activeSavePresent: boolean;
  corruptSavePresent: boolean;
  saveRecovery: SaveRecoveryNotice | null;
}): HomeTaskRow[] {
  const rows: HomeTaskRow[] = [];

  if (args.career.stage === "post_match") {
    rows.push({
      label: "Review desk",
      value: "Post-match report waiting",
      action: "Review Match",
      urgent: true
    });
  } else if (args.career.stage === "pre_match") {
    rows.push({
      label: "Match day",
      value: "Opponent briefing ready",
      action: "Open Pre-Match",
      urgent: true
    });
  } else if (args.event && !args.career.enteredEventIds.includes(args.event.id)) {
    const gate = eventEligibilityFor(args.career, args.event);

    if (gate.daysUntilEntryDeadline <= 3 && gate.daysUntilEntryDeadline >= 0) {
      rows.push({
        label: "Entry deadline",
        value: `Window closes ${daysUntilLabel(args.career.date, args.event.entryDeadline)}`,
        action: gate.allowed ? "Decide entry" : "Check gate",
        urgent: gate.daysUntilEntryDeadline <= 1
      });
    }
  }

  if (args.athlete.injury.status !== "healthy" || args.athlete.fatigue >= 60 || args.athlete.injuryRisk >= 0.24) {
    rows.push({
      label: "Condition",
      value: `${args.athlete.recoveryStatus.replace(/_/g, " ")} / ${Math.round(args.athlete.fatigue)} fatigue`,
      action: "Protect load",
      urgent: args.athlete.recoveryStatus === "red_zone" || args.athlete.recoveryStatus === "injured"
    });
  }

  if (!args.activeSavePresent || args.corruptSavePresent || args.saveRecovery) {
    rows.push({
      label: "Save issue",
      value: args.corruptSavePresent || args.saveRecovery ? "Quarantine or recovery state needs review" : "No active browser slot detected",
      action: "Review Save Manager",
      urgent: true
    });
  }

  if (rows.length === 0) {
    return [
      {
        label: "No urgent blockers",
        value: "Calendar, athlete, and local save state are stable",
        action: "Use topbar when ready",
        urgent: false
      }
    ];
  }

  return rows.slice(0, 4);
}

function homeCalendarDaysFor(args: {
  career: CareerState;
  tournament: TournamentState | null;
}): HomeCalendarDay[] {
  const week = buildWeek(args.career.date);
  const groups = groupManagerScheduleEntriesByDate(
    managerScheduleEntriesBetween({
      career: args.career,
      tournament: args.tournament,
      startDate: week[0],
      endDateExclusive: addDays(week.at(-1) ?? week[0], 1)
    })
  );
  const entriesByDate = new Map(groups.map((group) => [group.date, group.entries]));

  return week.map((date) => {
    const entries = entriesByDate.get(date) ?? [];

    return {
      date,
      primaryEntry: entries[0] ?? null,
      additionalCount: Math.max(0, entries.length - 1),
      active: date === args.career.date
    };
  });
}

function financeDeltaForLastThirtyDays(career: CareerState) {
  return career.economy.ledger
    .filter((entry) => {
      const age = daysBetween(entry.date, career.date);
      return age >= 0 && age <= 30;
    })
    .reduce((total, entry) => total + entry.amount, 0);
}

function homeEvidenceRows(career: CareerState, athlete: ReturnType<typeof managedAthlete>) {
  if (!career.lastMatchReport) {
    return [
      {
        label: "Prep",
        value: "No managed match tape yet.",
        detail:
          athlete.readiness < 72
            ? "Readiness is the immediate evidence: keep the next block light."
            : "Scout the first opponent or use a controlled training block."
      }
    ];
  }

  const evidence = career.lastMatchReport.evidence.slice(0, 2).map((entry, index) => ({
    label: `${index + 1}`,
    value: entry,
    detail: career.lastMatchReport?.scoreline ?? "Pending"
  }));
  const recommendation = career.lastMatchReport.recommendations[0];

  return recommendation
    ? [
        ...evidence,
        {
          label: "Prep",
          value: recommendation,
          detail: career.lastMatchReport.round
        }
      ].slice(0, 3)
    : evidence;
}

function decisionButtonClass(button: HomeDecisionButton) {
  if (button.tone === "required") {
    return "command-button command-button-required";
  }

  if (button.tone === "primary") {
    return "command-button command-button-primary";
  }

  return "command-button command-button-secondary";
}

export function CareerHomePage(props: CareerPageProps) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const athlete = managedAthlete(career);
  const player = playerMap[career.program.managedPlayerId];
  const event = activeEvent(career);
  const ranking = career.rankings.find((entry) => entry.playerId === career.program.managedPlayerId);
  const decision = buildHomeDecisionModel({
    career,
    tournament: props.tournament,
    athlete,
    event
  });
  const taskRows = homeTaskRowsFor({
    career,
    athlete,
    event,
    activeSavePresent: props.activeSavePresent,
    corruptSavePresent: props.corruptSavePresent,
    saveRecovery: props.saveRecovery
  });
  const urgentTaskCount = taskRows.filter((task) => task.urgent).length;
  const calendarDays = homeCalendarDaysFor({
    career,
    tournament: props.tournament
  });
  const evidenceRows = homeEvidenceRows(career, athlete);
  const psychology = managedPsychology(career);
  const advanceDayForecast = props.advanceDayForecast ?? null;
  const entryCosts = event ? effectiveEventEntryCosts(event, career.facilities) : null;
  const nextEventCost = event && entryCosts && !career.enteredEventIds.includes(event.id)
    ? eventEntryCost(entryCosts)
    : 0;
  const thirtyDayCashDelta = financeDeltaForLastThirtyDays(career);
  const stageLabel = career.stage.replace(/_/g, " ");
  const medicalSummary =
    athlete.injury.status === "healthy"
      ? "Available for training and event entry."
      : `${athlete.injury.daysRemaining} day(s) remaining; return ${athlete.injury.returnDate ?? "pending"}. ${athlete.injury.notes[0]}`;
  const handleDecisionButton = (button: HomeDecisionButton) => {
    switch (button.kind) {
      case "enter_event":
        if (button.eventId) {
          props.onEnterEvent(button.eventId);
        }
        return;
      case "open_timeline":
        props.onOpenTimeline();
        return;
      case "open_training":
        props.onOpenTraining();
        return;
      case "open_program":
        props.onOpenProgram();
        return;
      case "open_rivals":
        props.onOpenRivals();
        return;
      case "open_match_planning":
        props.onOpenMatchPlanning();
        return;
      case "open_post_match":
        props.onOpenPostMatch();
        return;
      case "open_scheduled_match":
        props.onOpenScheduledCareerMatch(button.eventId);
        return;
      case "open_tournament_home":
        if (button.eventId) {
          openTournamentHome(props, career, button.eventId);
        }
        return;
    }
  };

  return (
    <section className="screen-shell career-page" aria-label="Portal Home" data-page-contract="portal-home">
      <div className="screen-header career-portal-header">
        <div>
          <p className="screen-kicker">Portal Home</p>
          <h1 className="screen-title">Career Command Center</h1>
          <p className="screen-copy career-portal-summary">
            {career.date} |{" "}
            <ProfileNameButton
              playerId={player.id}
              fallback={player.name}
              onOpenPlayerProfile={props.onOpenPlayerProfile}
            />{" "}
            | Decision-first career day | {stageLabel}
          </p>
        </div>
        <div className="screen-meta screen-meta-actions career-portal-meta">
          <span>Cash {money(career.economy.cash)}</span>
          <span>Rank #{athlete.currentRank}</span>
          <span>{points(ranking?.seasonPoints ?? 0)} race</span>
        </div>
      </div>

      <div className="career-dashboard-grid career-dashboard-grid-compact career-home-zones">
        <section className="career-home-zone career-home-zone-now" aria-label="Now zone">
          <div className="career-zone-heading">
            <span>Now</span>
            <strong>today&apos;s decision, condition, and blockers</strong>
          </div>
          <div className="career-zone-layout career-now-layout">
            <section
              className="command-panel career-dashboard-card career-dashboard-card-decision career-priority-panel"
              aria-label="Next Decision"
            >
              <div className="panel-header">
                <h2 id="career-next-decision-heading">Next Decision</h2>
                <span>{decision.eyebrow}</span>
              </div>
              <div className="career-decision-block career-decision-block-compact career-decision-block-primary">
                <strong>
                  {decision.eventId ? (
                    <CareerTournamentLink career={career} eventId={decision.eventId}>
                      {decision.title}
                    </CareerTournamentLink>
                  ) : (
                    decision.title
                  )}
                </strong>
                <p>{decision.context}</p>
                <div className="career-consequence-grid" aria-label="Next decision consequence summary">
                  {decision.consequences.map((consequence) => (
                    <div key={consequence.label}>
                      <span>{consequence.label}</span>
                      <strong>{consequence.value}</strong>
                      <small>{consequence.detail}</small>
                    </div>
                  ))}
                </div>
                <div className="career-decision-recommendation">
                  <span>Recommendation</span>
                  <strong>{decision.recommendation}</strong>
                </div>
                <div className="career-action-row" aria-label="Next decision actions">
                  {decision.buttons.map((button) => (
                    <button
                      key={`${button.kind}-${button.label}-${button.eventId ?? "none"}`}
                      className={decisionButtonClass(button)}
                      type="button"
                      disabled={button.disabled}
                      title={button.reason}
                      onClick={() => handleDecisionButton(button)}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section
              className={
                advanceDayForecast?.available
                  ? "command-panel career-dashboard-card career-dashboard-card-forecast"
                  : "command-panel career-dashboard-card career-dashboard-card-forecast career-dashboard-card-forecast-blocked"
              }
              aria-label="Advance Day Forecast"
            >
              <div className="panel-header">
                <h2>Advance Day Forecast</h2>
                <span>
                  {advanceDayForecast?.available
                    ? `${advanceDayForecast.fromDate} → ${advanceDayForecast.targetDate}`
                    : "Required action blocks advance"}
                </span>
              </div>
              {advanceDayForecast?.available ? (
                <>
                  <div className="career-advance-forecast-summary">
                    <div>
                      <span>Target</span>
                      <strong>{advanceDayForecast.targetDate}</strong>
                    </div>
                    <div>
                      <span>Preparation</span>
                      <strong>{advanceDayForecast.preparationLabel}</strong>
                      <small>{advanceDayForecast.preparationOutcome.replace(/_/g, " ")}</small>
                    </div>
                    <div>
                      <span>Cash</span>
                      <strong>{signedMoney(advanceDayForecast.cashDelta)}</strong>
                    </div>
                  </div>
                  <div
                    className="career-advance-forecast-deltas"
                    aria-label="Forecast condition and development deltas"
                  >
                    <div>
                      <span>Readiness</span>
                      <strong>{signedNumber(advanceDayForecast.readinessDelta)}</strong>
                    </div>
                    <div>
                      <span>Fatigue</span>
                      <strong>{signedNumber(advanceDayForecast.fatigueDelta)}</strong>
                    </div>
                    <div>
                      <span>Injury Risk</span>
                      <strong>{signedNumber(advanceDayForecast.injuryRiskDelta * 100, " pts")}</strong>
                    </div>
                    <div>
                      <span>Smash</span>
                      <strong>{signedNumber(advanceDayForecast.developmentDelta.smash)}</strong>
                    </div>
                    <div>
                      <span>Stamina</span>
                      <strong>{signedNumber(advanceDayForecast.developmentDelta.stamina)}</strong>
                    </div>
                    <div>
                      <span>Composure</span>
                      <strong>{signedNumber(advanceDayForecast.developmentDelta.composure)}</strong>
                    </div>
                    <div>
                      <span>Recovery</span>
                      <strong>{signedNumber(advanceDayForecast.developmentDelta.recovery)}</strong>
                    </div>
                  </div>
                  <div className="career-advance-forecast-due" aria-label="Next due item">
                    <span>Due next</span>
                    <strong>{advanceDayForecast.dueItems[0]}</strong>
                    {advanceDayForecast.dueItems.length > 1 && (
                      <small>+{advanceDayForecast.dueItems.length - 1} more scheduled item(s)</small>
                    )}
                  </div>
                </>
              ) : (
                <div className="career-advance-forecast-unavailable" role="status">
                  <strong>{advanceDayForecast?.action.label ?? "Forecast unavailable"}</strong>
                  <p>
                    {advanceDayForecast?.action.reason ??
                      "The next-day resolver is unavailable for this career state. Complete the required action first."}
                  </p>
                </div>
              )}
            </section>

            <section className="command-panel career-dashboard-card career-dashboard-card-readiness">
              <div className="panel-header">
                <h2>Player Condition</h2>
                <span>{athlete.recoveryStatus.replace(/_/g, " ")}</span>
              </div>
              <div className="career-meter-list career-meter-list-compact">
                <CareerMeter label="Readiness" value={athlete.readiness} />
                <CareerMeter label="Fatigue" value={Math.round(athlete.fatigue)} danger />
                <CareerMeter label="Injury Risk" value={Math.round(athlete.injuryRisk * 100)} danger />
              </div>
              <div className="career-condition-mini-grid" aria-label="Badminton condition signals">
                <div>
                  <span>Form</span>
                  <strong>{psychology?.form ?? "—"}</strong>
                </div>
                <div>
                  <span>Explosive</span>
                  <strong>{Math.max(0, Math.round(player.ratings.physical.explosivenessJump - athlete.fatigue * 0.18))}</strong>
                </div>
                <div>
                  <span>Net / Smash</span>
                  <strong>{player.ratings.technical.netPlay}/{player.ratings.technical.smash}</strong>
                </div>
              </div>
              <div className="program-log-row career-readiness-medical-row career-button-spaced">
                <span>Medical</span>
                <strong>{athlete.injury.label}</strong>
                <small>{medicalSummary}</small>
              </div>
            </section>

            <section className="command-panel career-dashboard-card career-dashboard-card-tasks">
              <div className="panel-header">
                <h2>Urgent Tasks</h2>
                <span>{urgentTaskCount} urgent</span>
              </div>
              <div className="management-table management-table-compact career-task-table" aria-label="Portal tasks inbox">
                <div className="management-table-row management-table-row-head" aria-hidden="true">
                  <span>Type</span>
                  <strong>Item</strong>
                  <small>Action</small>
                </div>
                {taskRows.map((task) => (
                  <div key={task.label} className={task.urgent ? "management-table-row management-table-row-urgent" : "management-table-row"}>
                    <span>{task.label}</span>
                    <strong>{task.value}</strong>
                    <small>{task.action}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="career-home-zone career-home-zone-soon" aria-label="Soon zone">
          <div className="career-zone-heading">
            <span>Soon</span>
            <strong>schedule pressure and preparation context</strong>
          </div>
          <div className="career-zone-layout career-soon-layout">
            <section className="command-panel career-dashboard-card career-dashboard-card-calendar">
              <div className="panel-header">
                <h2>Calendar Snapshot</h2>
                <button
                  className="command-button command-button-secondary calendar-snapshot-open"
                  type="button"
                  onClick={props.onOpenCalendar}
                >
                  Full Calendar
                </button>
              </div>
              <div className="career-week-strip career-week-strip-compact" aria-label="Portal calendar snapshot">
                {calendarDays.map((day) => {
                  const entry = day.primaryEntry;
                  const actionLabel = entry ? managerScheduleAccessibleAction(entry) : null;
                  const primaryClassName = entry
                    ? [
                        "career-day-primary",
                        managerScheduleCategoryClass(entry),
                        managerScheduleStatusClass(entry)
                      ].join(" ")
                    : "career-day-empty";
                  const primaryContent = entry ? (
                    <>
                      <span>{readableScheduleToken(entry.category)} · {readableScheduleToken(entry.status)}</span>
                      <strong>{entry.title}</strong>
                    </>
                  ) : (
                    <>
                      <strong>Open</strong>
                      <small>No fixed obligation</small>
                    </>
                  );

                  return (
                    <div
                      key={day.date}
                      className={day.active ? "career-day career-day-active" : "career-day"}
                      data-schedule-count={day.additionalCount + (entry ? 1 : 0)}
                    >
                      <span className="career-day-date">
                        {day.date.slice(5)}
                        {day.active ? <em>Today</em> : null}
                      </span>
                      {entry && actionLabel ? (
                        <button
                          className={primaryClassName}
                          type="button"
                          aria-label={actionLabel}
                          onClick={() => openManagerScheduleDestination(props, entry.destination)}
                        >
                          {primaryContent}
                        </button>
                      ) : (
                        <div className={primaryClassName}>{primaryContent}</div>
                      )}
                      {entry ? <small className="career-day-detail">{entry.detail}</small> : null}
                      {day.additionalCount > 0 ? (
                        <button
                          className="career-day-more"
                          type="button"
                          aria-label={`+${day.additionalCount} more on ${day.date}; open Calendar`}
                          onClick={props.onOpenCalendar}
                        >
                          +{day.additionalCount} more
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="command-panel career-dashboard-card career-dashboard-card-ranking">
              <div className="panel-header">
                <h2>Ranking Pressure</h2>
                <span>compact circuit consequence</span>
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
                  <strong>{career.completedEventIds.length}</strong>
                </div>
              </div>
              {event && (
                <p className="panel-summary career-ranking-note">
                  Next upside: +{points(event.rankingPoints.champion)} title ceiling; Finals gate remains top 8 or four completed events.
                </p>
              )}
            </section>

            <section className="command-panel career-dashboard-card career-dashboard-card-evidence">
              <div className="panel-header">
                <h2>Recent Match Evidence</h2>
                <span>{career.lastMatchReport ? `${career.lastMatchReport.round} prep signal` : "Preparation prompt"}</span>
              </div>
              <div className="management-table management-table-compact career-evidence-table" aria-label="Recent match evidence">
                <div className="management-table-row management-table-row-head" aria-hidden="true">
                  <span>#</span>
                  <strong>Evidence</strong>
                  <small>Use</small>
                </div>
                {evidenceRows.map((entry) => (
                  <div key={`${entry.label}-${entry.value}`} className="management-table-row">
                    <span>{entry.label}</span>
                    <strong>
                      <SmartCareerText text={entry.value} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                    </strong>
                    <small>{entry.detail}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="career-home-zone career-home-zone-later" aria-label="Later zone">
          <div className="career-zone-heading">
            <span>Later</span>
            <strong>admin context kept reachable, not dominant</strong>
          </div>
          <div className="career-zone-layout career-later-layout">
            <section className="command-panel career-dashboard-card career-dashboard-card-finance">
              <div className="panel-header">
                <h2>Finance Summary</h2>
                <span>compact cashflow</span>
              </div>
              <div className="career-finance-summary" aria-label="Career finance summary">
                <div>
                  <span>Cash</span>
                  <strong>{money(career.economy.cash)}</strong>
                  <small>Available local budget</small>
                </div>
                <div>
                  <span>Δ30d</span>
                  <strong className={thirtyDayCashDelta >= 0 ? "career-ledger-amount-positive" : "career-ledger-amount-negative"}>
                    {signedMoney(thirtyDayCashDelta)}
                  </strong>
                  <small>Recent ledger movement</small>
                </div>
                <div>
                  <span>Next Cost</span>
                  <strong>{nextEventCost > 0 ? money(nextEventCost) : "Committed"}</strong>
                  <small>{event ? (entryCosts ? `Travel fatigue ${entryCosts.travelFatigue}` : "Event cost unavailable") : "No event cost"}</small>
                </div>
              </div>
            </section>

            <section className="command-panel career-dashboard-card career-dashboard-card-ecosystem">
              <div className="panel-header">
                <h2>Program Ecosystem</h2>
                <span>Subsystem chips</span>
              </div>
              <div className="career-ecosystem-strip career-ecosystem-strip-compact">
                <button className="career-system-tile" type="button" onClick={props.onOpenScouting}>
                  <span>Reports</span>
                  <strong>{career.ecosystem.scouting.reports.length}</strong>
                  <small>{career.ecosystem.scouting.assignments.length} assignments</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenRecruitment}>
                  <span>Roster</span>
                  <strong>
                    {career.ecosystem.recruitment.roster.length}/{career.ecosystem.recruitment.rosterLimit}
                  </strong>
                  <small>{career.ecosystem.recruitment.candidates.length} candidates</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenYouth}>
                  <span>Youth</span>
                  <strong>{career.ecosystem.academy.prospects.length}</strong>
                  <small>{career.ecosystem.lowerEventEntries.filter((entry) => entry.subjectType === "youth_prospect").length} lower entries</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenStaff}>
                  <span>Staff</span>
                  <strong>{career.ecosystem.staff.hired.length}/5</strong>
                  <small>{money(staffModifiers(career.ecosystem).salary)} committed</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenPromises}>
                  <span>Promises</span>
                  <strong>{career.ecosystem.promises.filter((promise) => promise.status === "active").length}</strong>
                  <small>{career.ecosystem.promises.filter((promise) => promise.status !== "active").length} resolved</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenRivals}>
                  <span>Rivals</span>
                  <strong>{Math.round(Math.max(...career.rivals.programs.map((program) => program.pressureScore)))}</strong>
                  <small>{career.rivals.fieldPressure.length} fields</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenMatchPlanning}>
                  <span>Tactics</span>
                  <strong>{activeAdvancedTacticPlan(career).name}</strong>
                  <small>{career.matchPlanning.advice.filter((entry) => entry.overrideState === "pending").length} notes</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenFacilities}>
                  <span>Facilities</span>
                  <strong>{career.facilities.reduce((total, facility) => total + facility.level, 0)}</strong>
                  <small>{money(career.facilities.reduce((total, facility) => total + facility.maintenanceCost, 0))} upkeep</small>
                </button>
                <button className="career-system-tile" type="button" onClick={props.onOpenMedia}>
                  <span>Media</span>
                  <strong>{career.media.reputation}</strong>
                  <small>
                    {career.media.sponsors.filter((objective) => objective.status === "active").length +
                      career.media.federationObjectives.filter((objective) => objective.status === "active").length}{" "}
                    active
                  </small>
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </section>
  );
}

export function CareerRankingsPage(props: CareerPageProps) {
  const [requestedRankingsPageIndex, setRequestedRankingsPageIndex] = useState(0);

  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const managedPlayerId = career.program.managedPlayerId;
  const orderedRankings = rankingsByCurrentRank(career.rankings);
  const rankingsPageCount = Math.max(1, Math.ceil(orderedRankings.length / RANKINGS_PAGE_SIZE));
  const rankingsPageIndex = Math.min(requestedRankingsPageIndex, rankingsPageCount - 1);
  const rankingsPageStartIndex = rankingsPageIndex * RANKINGS_PAGE_SIZE;
  const visibleRankings = orderedRankings.slice(rankingsPageStartIndex, rankingsPageStartIndex + RANKINGS_PAGE_SIZE);
  const visibleRangeStart = orderedRankings.length > 0 ? rankingsPageStartIndex + 1 : 0;
  const visibleRangeEnd = rankingsPageStartIndex + visibleRankings.length;
  const hasPreviousRankingsPage = rankingsPageIndex > 0;
  const hasNextRankingsPage = rankingsPageIndex < rankingsPageCount - 1;
  const managedIndex = orderedRankings.findIndex((entry) => entry.playerId === managedPlayerId);
  const managedRanking = managedIndex >= 0 ? orderedRankings[managedIndex] : undefined;
  const leader = orderedRankings[0];
  const playerAhead = managedIndex > 0 ? orderedRankings[managedIndex - 1] : undefined;
  const playerBehind = managedIndex >= 0 ? orderedRankings[managedIndex + 1] : undefined;
  const leaderPlayer = leader ? playerMap[leader.playerId] : undefined;
  const gapToLeader = leader && managedRanking ? Math.max(0, leader.points - managedRanking.points) : 0;
  const gapAhead = playerAhead && managedRanking ? Math.max(0, playerAhead.points - managedRanking.points) : 0;

  return (
    <section className="screen-shell career-page rankings-page" data-page-contract="rankings">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Career Rankings</p>
          <h1 className="screen-title">Circuit Rankings</h1>
          <p className="screen-copy">
            BWF-inspired, fictional rankings built from dated result rows inside a rolling 52-week window. Only the best
            {career.rankingSettings.maxCountedResults} eligible results count toward ranking points; season race points
            remain separate from the world list.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenTimeline}>
            Timeline
          </button>
        </div>
      </div>

      <section className="management-status-strip rankings-status-strip" aria-label="Rankings status">
        <div>
          <span>Rows</span>
          <strong>{orderedRankings.length}</strong>
        </div>
        <div>
          <span>Leader</span>
          <strong>
            {leader ? (
              <ProfileNameButton
                playerId={leader.playerId}
                fallback={leaderPlayer?.name ?? leader.playerId}
                onOpenPlayerProfile={props.onOpenPlayerProfile}
              />
            ) : (
              "No leader"
            )}
          </strong>
        </div>
        <div>
          <span>Our rank</span>
          <strong>{managedRanking ? `#${managedRanking.rank}` : "Unranked"}</strong>
        </div>
        <div>
          <span>Leader gap</span>
          <strong>{points(gapToLeader)}</strong>
        </div>
        <div>
          <span>Window</span>
          <strong>{career.rankingSettings.windowDays} days</strong>
        </div>
        <div>
          <span>Best cap</span>
          <strong>{career.rankingSettings.maxCountedResults}</strong>
        </div>
      </section>

      <section className="command-panel command-panel-full rankings-summary-panel">
        <div className="panel-header">
          <h2>Table Read</h2>
          <span>who is ahead / where are we / point gaps</span>
        </div>
        <div className="career-event-brief rankings-summary-grid">
          <div>
            <span>Ahead</span>
            <strong>
              {playerAhead ? (
                <>
                  {playerAhead.rank}.{" "}
                  <ProfileNameButton
                    playerId={playerAhead.playerId}
                    fallback={playerMap[playerAhead.playerId]?.name ?? playerAhead.playerId}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </>
              ) : (
                "Nobody"
              )}
            </strong>
            <small>{playerAhead ? `${points(gapAhead)} to the next rung.` : "Your athlete leads the list."}</small>
          </div>
          <div>
            <span>Managed athlete</span>
            <strong>
              {managedRanking ? (
                <>
                  #{managedRanking.rank}{" "}
                  <ProfileNameButton
                    playerId={managedPlayerId}
                    fallback={playerMap[managedPlayerId]?.name ?? managedPlayerId}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </>
              ) : (
                "Not ranked"
              )}
            </strong>
            <small>
              {managedRanking
                ? `${points(managedRanking.points)} rolling, ${points(managedRanking.seasonPoints)} season race.`
                : "No ranking row found in the career save."}
            </small>
          </div>
          <div>
            <span>Behind</span>
            <strong>
              {playerBehind ? (
                <>
                  {playerBehind.rank}.{" "}
                  <ProfileNameButton
                    playerId={playerBehind.playerId}
                    fallback={playerMap[playerBehind.playerId]?.name ?? playerBehind.playerId}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </>
              ) : (
                "Nobody"
              )}
            </strong>
            <small>{playerBehind && managedRanking ? `${points(Math.max(0, managedRanking.points - playerBehind.points))} cushion.` : "No lower-ranked row."}</small>
          </div>
        </div>
      </section>

      <section className="command-panel command-panel-full rankings-table-panel">
        <div className="panel-header">
          <h2>Full Circuit Table</h2>
          <span>{visibleRangeStart}-{visibleRangeEnd} of {orderedRankings.length} ranked athletes</span>
        </div>
        <div className="rankings-table" role="table" aria-label="Circuit rankings table">
          <div className="rankings-row rankings-row-head" role="row">
            <span role="columnheader">Rank</span>
            <span role="columnheader">Player</span>
            <span role="columnheader">Nationality</span>
            <span role="columnheader">Rolling points</span>
            <span role="columnheader">Counted</span>
            <span role="columnheader">Next expiry</span>
            <span role="columnheader">Season race</span>
            <span role="columnheader">Status</span>
          </div>
          {visibleRankings.map((entry) => {
            const player = playerMap[entry.playerId];
            const isManaged = entry.playerId === managedPlayerId;
            const rowClassName = isManaged
              ? "rankings-row rankings-row-managed"
              : "rankings-row";

            return (
              <div
                key={entry.playerId}
                className={rowClassName}
                role="row"
                aria-label={`Rank ${entry.rank} ${player?.name ?? entry.playerId}${isManaged ? " managed athlete" : ""}`}
              >
                <div className="rankings-cell rankings-rank-cell" role="cell" data-label="Rank">
                  <strong>#{entry.rank}</strong>
                </div>
                <div className="rankings-cell rankings-player-cell" role="cell" data-label="Player">
                  <ProfileNameButton
                    playerId={entry.playerId}
                    fallback={player?.name ?? entry.playerId}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                  {isManaged && <span className="managed-ranking-label">Managed athlete</span>}
                </div>
                <div className="rankings-cell" role="cell" data-label="Nationality">
                  <strong>{player?.nationality ?? "-"}</strong>
                </div>
                <div className="rankings-cell" role="cell" data-label="Points">
                  <strong>{points(entry.points)}</strong>
                </div>
                <div className="rankings-cell" role="cell" data-label="Counted">
                  <strong>{entry.countedResults}/{entry.eligibleResults}</strong>
                  <small>best results</small>
                </div>
                <div className="rankings-cell" role="cell" data-label="Next expiry">
                  <strong>{entry.nextExpiryDate ?? "None"}</strong>
                  <small>{entry.bestResultPoints ? `Best ${points(entry.bestResultPoints)}` : "No active row"}</small>
                </div>
                <div className="rankings-cell" role="cell" data-label="Season race">
                  <strong>{points(entry.seasonPoints)}</strong>
                </div>
                <div className="rankings-cell rankings-status-cell" role="cell" data-label="Status">
                  <strong>{isManaged ? "Our program" : rankingStatus(entry)}</strong>
                  {isManaged && <small>{rankingStatus(entry)}</small>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="calendar-pagination rankings-pagination" aria-label="Rankings pagination">
          <button
            className="command-button command-button-secondary"
            type="button"
            disabled={!hasPreviousRankingsPage}
            onClick={() => setRequestedRankingsPageIndex(rankingsPageIndex - 1)}
          >
            Prev
          </button>
          <span className="rankings-page-range" aria-live="polite">
            {visibleRangeStart}-{visibleRangeEnd} of {orderedRankings.length}
          </span>
          <span>
            Page {rankingsPageIndex + 1} of {rankingsPageCount}
          </span>
          <button
            className="command-button command-button-secondary"
            type="button"
            disabled={!hasNextRankingsPage}
            onClick={() => setRequestedRankingsPageIndex(rankingsPageIndex + 1)}
          >
            Next
          </button>
        </div>
      </section>
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
                  <strong>
                    {event ? (
                      <CareerTournamentLink career={props.career!} eventId={event.id}>
                        {event.name}
                      </CareerTournamentLink>
                    ) : (
                      pressure.eventId
                    )}
                  </strong>
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
                      <strong>
                        <ProfileNameButton
                          playerId={lead?.playerId}
                          fallback={lead?.name ?? "No athlete"}
                          onOpenPlayerProfile={props.onOpenPlayerProfile}
                        />
                      </strong>
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
                      ? (
                          <>
                            <CareerTournamentLink career={props.career!} eventId={latestEntry.eventId}>
                              {latestEntry.eventName}
                            </CareerTournamentLink>
                            {`, projected ${latestEntry.projectedRound}, ${latestEntry.status}${
                              latestEntry.resultRound ? ` as ${latestEntry.resultRound}` : ""
                            }`}
                          </>
                        )
                      : "watching the calendar"}
                    .
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
              <strong>
                <CareerTournamentLink career={props.career} eventId={nextEvent.id}>
                  {nextEvent.name}
                </CareerTournamentLink>
              </strong>
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
  const nextOpponent = props.career.lastPreMatchBrief
    ? playerMap[props.career.lastPreMatchBrief.opponentId]
    : undefined;
  const scoutSubjects = [
    ...(nextOpponent
      ? [
          {
            id: nextOpponent.id,
            name: nextOpponent.name,
            type: "opponent" as const,
            detail: `${nextOpponent.nationality} / ${nextOpponent.styleLabel}`,
            knowledge: "Known draw opponent; commission a profile report before trusting tactical assumptions."
          }
        ]
      : []),
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
  const scoutingSubjectName = (subjectId: string) =>
    playerMap[subjectId]?.name ??
    props.career?.ecosystem.recruitment.candidates.find((candidate) => candidate.id === subjectId)?.name ??
    props.career?.ecosystem.academy.prospects.find((prospect) => prospect.id === subjectId)?.name ??
    subjectId;

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
                  <strong>
                    <ProfileNameButton
                      playerId={subject.id}
                      fallback={subject.name}
                      onOpenPlayerProfile={props.onOpenPlayerProfile}
                    />
                  </strong>
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
                <strong>
                  <ProfileNameButton
                    playerId={assignment.subjectId}
                    fallback={scoutingSubjectName(assignment.subjectId)}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </strong>
                <p>{assignment.scope} scope, cost {money(assignment.cost)}</p>
              </div>
            ))}
            {props.career.ecosystem.scouting.reports.map((report) => (
              <div key={report.id} className="program-log-row">
                <span>{report.state} / {report.confidence}% confidence</span>
                <strong>
                  <ProfileNameButton
                    playerId={report.subjectId}
                    fallback={scoutingSubjectName(report.subjectId)}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </strong>
                <p>
                  <SmartCareerText text={report.recommendation} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
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
                  <strong>
                    <ProfileNameButton
                      playerId={slot.athleteId}
                      fallback={slot.name}
                      onOpenPlayerProfile={props.onOpenPlayerProfile}
                    />
                  </strong>
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
                  <strong>
                    <ProfileNameButton
                      playerId={entry.subjectId}
                      fallback={entry.subjectName}
                      onOpenPlayerProfile={props.onOpenPlayerProfile}
                    />
                  </strong>
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
                <strong>
                  <ProfileNameButton
                    playerId={entry.athleteId}
                    fallback={
                      props.career?.ecosystem.recruitment.roster.find((slot) => slot.athleteId === entry.athleteId)?.name ??
                      playerMap[entry.athleteId]?.name ??
                      entry.athleteId
                    }
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </strong>
                <p>
                  Form {entry.form}, morale {entry.morale}, confidence {entry.confidence}. Latest:{" "}
                  <SmartCareerText text={entry.recentDrivers[0] ?? "No recent driver"} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
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
                  Owner:{" "}
                  <ProfileNameButton
                    playerId={promise.athleteId}
                    fallback={
                      props.career?.ecosystem.recruitment.roster.find((slot) => slot.athleteId === promise.athleteId)?.name ??
                      playerMap[promise.athleteId]?.name ??
                      promise.athleteId
                    }
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </p>
                <p>
                  Reward morale {promise.reward.morale >= 0 ? "+" : ""}{promise.reward.morale}, confidence +
                  {promise.reward.confidence}; penalty morale {promise.penalty.morale}, confidence {promise.penalty.confidence}.
                </p>
                <p>
                  <SmartCareerText text={promise.resolutionLog[0] ?? "No resolution logged"} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
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
                <strong>
                  <SmartCareerText text={advice.recommendation} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </strong>
                <p>
                  <SmartCareerText text={advice.rationale} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
                <p>
                  <SmartCareerText text={advice.tradeoff} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
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
                {advice.overrideReason && (
                  <p>
                    Override reason:{" "}
                    <SmartCareerText text={advice.overrideReason} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                  </p>
                )}
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

  const career = props.career;
  const athlete = managedAthlete(career);
  const scheduledBlock = scheduledPreparationForAthlete(career);
  const selectedPlan = selectedTrainingPlan(career);
  const previewPlan = scheduledBlock?.planSnapshot ?? selectedPlan;
  const preview = previewPlan ? previewPreparationPlan({ state: career, plan: previewPlan }) : null;
  const previewRecord = preview?.record?.kind === "preparation" ? preview.record : null;
  const schedulingAvailable = props.advanceDayForecast?.available === true;
  const schedulingBlockedReason = props.advanceDayForecast?.action.reason ??
    props.advanceDayForecast?.dueItems[0] ??
    "Advance-day planning is unavailable for this career state.";
  const previewCost = preview ? career.economy.cash - preview.economyAfter.cash : 0;
  const projectionRows = preview
    ? [
        {
          label: "Smash",
          before: preview.before.development.smash,
          after: preview.after.development.smash,
          suffix: ""
        },
        {
          label: "Stamina",
          before: preview.before.development.stamina,
          after: preview.after.development.stamina,
          suffix: ""
        },
        {
          label: "Composure",
          before: preview.before.development.composure,
          after: preview.after.development.composure,
          suffix: ""
        },
        {
          label: "Recovery",
          before: preview.before.development.recovery,
          after: preview.after.development.recovery,
          suffix: ""
        },
        {
          label: "Readiness",
          before: preview.before.readiness,
          after: preview.after.readiness,
          suffix: ""
        },
        {
          label: "Fatigue",
          before: preview.before.fatigue,
          after: preview.after.fatigue,
          suffix: ""
        },
        {
          label: "Injury Risk",
          before: preview.before.injuryRisk * 100,
          after: preview.after.injuryRisk * 100,
          suffix: "%"
        }
      ]
    : [];

  return (
    <section className="screen-shell career-page career-training-page" data-page-contract="training-preparation">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Training / Recovery</p>
          <h1 className="screen-title">Load Management</h1>
          <p className="screen-copy">
            Schedule one current-day preparation block. It resolves once when you advance; replacing or clearing it
            does not spend cash or change the athlete immediately.
          </p>
        </div>
        <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
          Career Home
        </button>
      </div>

      <section className="management-status-strip" aria-label="Training status">
        <div>
          <span>Scheduled block</span>
          <strong>{scheduledBlock?.planSnapshot.label ?? "Passive recovery only"}</strong>
        </div>
        <div>
          <span>Current date</span>
          <strong>{career.date}</strong>
        </div>
        <div>
          <span>Block cost</span>
          <strong>{scheduledBlock ? money(scheduledBlock.planSnapshot.cost) : money(0)}</strong>
        </div>
        <div>
          <span>Advance target</span>
          <strong>{props.advanceDayForecast?.available ? props.advanceDayForecast.targetDate : "Blocked"}</strong>
        </div>
        <div>
          <span>Scheduling</span>
          <strong>{schedulingAvailable ? "Available" : props.advanceDayForecast?.action.label ?? "Unavailable"}</strong>
        </div>
      </section>

      <div className="career-training-grid">
        <section className="command-panel command-panel-wide">
          <div className="panel-header">
            <h2>Training Plans</h2>
            <div className="career-training-plan-actions">
              <span>Cash {money(career.economy.cash)}</span>
              <button
                className="command-button command-button-secondary"
                type="button"
                disabled={!scheduledBlock}
                onClick={() => props.onApplyTraining(null)}
              >
                Clear Block
              </button>
            </div>
          </div>
          {!schedulingAvailable && (
            <div className="career-training-blocked-reason" role="status" aria-label="Training scheduling blocked">
              <strong>Scheduling locked</strong>
              <p>{schedulingBlockedReason}</p>
            </div>
          )}
          <div className="career-plan-grid">
            {trainingPlans.map((plan) => {
              const medicalGate = canTrainWithInjury(athlete, plan.intensity);
              const affordable = career.economy.cash >= plan.cost;
              const disabled = !schedulingAvailable || !medicalGate.allowed || !affordable;
              const active = scheduledBlock?.planSnapshot.id === plan.id;
              const planPreview = previewPreparationPlan({ state: career, plan });
              const disabledReason = !schedulingAvailable
                ? schedulingBlockedReason
                : !affordable
                  ? `Insufficient budget for ${money(plan.cost)} block.`
                  : !medicalGate.allowed
                    ? medicalGate.reason
                    : null;

              return (
                <button
                  key={plan.id}
                  className={
                    active
                      ? "career-plan-card career-plan-card-active"
                      : disabled
                        ? "career-plan-card career-plan-card-blocked"
                        : "career-plan-card"
                  }
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  title={disabledReason ?? `Schedule ${plan.label} for ${career.date}`}
                  onClick={() => props.onApplyTraining(plan.id)}
                >
                  <span>{plan.intensity}</span>
                  <strong>{plan.label}</strong>
                  <p>
                    {disabledReason ??
                      `${plan.focus} / ${money(plan.cost)} / readiness ${compactNumber(planPreview.before.readiness)} → ${compactNumber(planPreview.after.readiness)}, fatigue ${compactNumber(planPreview.before.fatigue)} → ${compactNumber(planPreview.after.fatigue)}`}
                  </p>
                  <small className="career-plan-card-action">
                    {active ? `Scheduled for ${career.date}; choose another block to replace it` : `Schedule for ${career.date}`}
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="command-panel career-training-projection-panel" aria-label="Preparation block preview">
          <div className="panel-header">
            <h2>Exact Block Preview</h2>
            <span>
              {previewPlan
                ? scheduledBlock
                  ? `Scheduled ${career.date}`
                  : "Selected, not scheduled"
                : "Choose a block"}
            </span>
          </div>
          {preview && previewPlan ? (
            <>
              <div className="career-training-preview-meta">
                <div>
                  <span>Plan</span>
                  <strong>{previewPlan.label}</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{career.date}</strong>
                </div>
                <div>
                  <span>Exact cost</span>
                  <strong>{money(previewCost)}</strong>
                </div>
              </div>
              <div className="career-training-projection-grid">
                {projectionRows.map((row) => (
                  <div key={row.label} aria-label={`${row.label} projection`}>
                    <span>{row.label}</span>
                    <strong>
                      {compactNumber(row.before)}{row.suffix} → {compactNumber(row.after)}{row.suffix}
                    </strong>
                    <small>{signedNumber(row.after - row.before, row.suffix)}</small>
                  </div>
                ))}
              </div>
              <div className="program-log-row career-training-preview-outcome">
                <span>projected {previewRecord?.outcome ?? "preview"} / {preview.after.recoveryStatus.replace(/_/g, " ")}</span>
                <strong>{preview.after.injury.label}</strong>
                <p>
                  Resolver projection: {previewRecord?.reason ?? "This uses the persisted athlete, staff, facility, and medical state."}
                </p>
              </div>
            </>
          ) : (
            <div className="career-training-preview-empty">
              <strong>Passive recovery remains the current plan.</strong>
              <p>Choose a block to inspect its exact one-time cost and before-to-after athlete state before scheduling it.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export function CareerTimelinePage(props: CareerPageProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "pastEvents">("upcoming");
  const [upcomingPageIndex, setUpcomingPageIndex] = useState(0);
  const [pastPageIndex, setPastPageIndex] = useState(0);

  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const careerDate = career.date;
  const athlete = managedAthlete(career);
  const medicalGate = canCompeteWithInjury(athlete);
  const upcomingEvents = upcomingCalendarEvents(career);
  const pastRecords = pastCalendarRecords(career);
  const managerCommitments = managerScheduleEntriesBetween({
    career,
    tournament: props.tournament,
    startDate: career.date,
    endDateExclusive: addDays(career.date, 31)
  });
  const managerCommitmentGroups = groupManagerScheduleEntriesByDate(managerCommitments);
  const upcomingPage = paginateCalendarItems(upcomingEvents, upcomingPageIndex);
  const pastPage = paginateCalendarItems(pastRecords, pastPageIndex);
  const activeResolvedEvent = career.activeEventId ? getCareerEvent(career.events, career.activeEventId) ?? null : null;
  const nextEvent = career.activeEventId ? activeResolvedEvent ?? upcomingEvents[0] : upcomingEvents[0];
  const activeEventLabel = activeResolvedEvent?.name ?? career.activeEventId ?? "No active entry";
  const handleTimelineTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextTab: "upcoming" | "pastEvents" | null = null;

    if (event.key === "ArrowRight" || event.key === "End") {
      nextTab = "pastEvents";
    } else if (event.key === "ArrowLeft" || event.key === "Home") {
      nextTab = "upcoming";
    }

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    setActiveTab(nextTab);
    document.getElementById(nextTab === "upcoming" ? "timeline-tab-upcoming" : "timeline-tab-past-events")?.focus();
  };

  return (
    <section className="screen-shell career-page timeline-page" data-page-contract="timeline">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Career Timeline</p>
          <h1 className="screen-title">Timeline</h1>
          <p className="screen-copy">
            Use the Timeline as the event ledger: what is coming next, and what has already happened in the career world.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenHome}>
            Career Home
          </button>
        </div>
      </div>

      <section className="management-status-strip calendar-status-strip" aria-label="Timeline status">
        <div>
          <span>Today</span>
          <strong>{careerDate}</strong>
        </div>
        <div>
          <span>Active event</span>
          <strong>
            {activeResolvedEvent ? (
              <CareerTournamentLink career={career} eventId={activeResolvedEvent.id}>
                {activeResolvedEvent.name}
              </CareerTournamentLink>
            ) : (
              activeEventLabel
            )}
          </strong>
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

      <div className="calendar-subnav timeline-tablist" role="tablist" aria-label="Timeline event tabs">
        <button
          id="timeline-tab-upcoming"
          className={activeTab === "upcoming" ? "calendar-subnav-tab calendar-subnav-tab-active" : "calendar-subnav-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          aria-controls="timeline-panel-upcoming"
          tabIndex={activeTab === "upcoming" ? 0 : -1}
          onClick={() => setActiveTab("upcoming")}
          onKeyDown={handleTimelineTabKeyDown}
        >
          Upcoming
        </button>
        <button
          id="timeline-tab-past-events"
          className={activeTab === "pastEvents" ? "calendar-subnav-tab calendar-subnav-tab-active" : "calendar-subnav-tab"}
          type="button"
          role="tab"
          aria-selected={activeTab === "pastEvents"}
          aria-controls="timeline-panel-past-events"
          tabIndex={activeTab === "pastEvents" ? 0 : -1}
          onClick={() => setActiveTab("pastEvents")}
          onKeyDown={handleTimelineTabKeyDown}
        >
          Past Events
        </button>
      </div>

      {activeTab === "upcoming" ? (
        <div
          id="timeline-panel-upcoming"
          className="career-calendar-layout timeline-tab-panel"
          role="tabpanel"
          aria-labelledby="timeline-tab-upcoming"
        >
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
                const tierGate = eventEligibilityFor(career, event);
                const status = eventStatusFor(career, event);
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
                const endDate = eventEndDate(event);
                const rowClassName =
                  eventBlocked && !entered && !completed
                    ? "calendar-event-row calendar-event-row-blocked"
                    : "calendar-event-row";
                const handleUrgentAction = () => {
                  switch (action.kind) {
                    case "enter_event":
                      props.onEnterEvent(action.eventId);
                      return;
                    case "play_match":
                      props.onOpenScheduledCareerMatch(action.eventId);
                      return;
                    case "open_draw":
                      return;
                    case "review_match":
                      props.onOpenPostMatch();
                      return;
                    case "blocked":
                    case "completed":
                      return;
                  }
                };
                const showUrgentAction =
                  action.kind === "enter_event" || action.kind === "play_match" || action.kind === "review_match";

                return (
                  <article key={event.id} className={rowClassName}>
                    <div className="calendar-event-main">
                      <span>{event.tier} / week {event.weekNumber} / {statusLabel(status)}</span>
                      <strong>
                        <CareerTournamentLink career={career} eventId={event.id}>
                          {event.name}
                        </CareerTournamentLink>
                      </strong>
                      <p>{event.location.city}, {event.location.country} - {event.location.venue}.</p>
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
                      {showUrgentAction ? (
                        <button
                          className={calendarEventActionClass(action)}
                          type="button"
                          onClick={handleUrgentAction}
                        >
                          {action.label}
                        </button>
                      ) : null}
                      <button
                        className="command-button command-button-secondary"
                        type="button"
                        onClick={() => openTournamentHome(props, career, event.id)}
                      >
                        Open Event
                      </button>
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

          <section
            className="command-panel command-panel-full calendar-commitments-panel"
            aria-label="Manager commitments"
          >
            <div className="panel-header">
              <h2 id="manager-commitments-heading">Manager Commitments</h2>
              <span>{managerCommitments.length} item(s) in the next 30 days</span>
            </div>
            {managerCommitmentGroups.length > 0 ? (
              <div className="calendar-commitment-list" aria-label="Manager commitment list">
                {managerCommitmentGroups.map((group) => (
                  <section key={group.date} className="calendar-commitment-day" aria-label={`Manager commitments on ${group.date}`}>
                    <div className="calendar-commitment-date">
                      <span>Date</span>
                      <strong>{group.date}</strong>
                    </div>
                    <div className="calendar-commitment-stack">
                      {group.entries.map((entry) => {
                        const actionLabel = managerScheduleAccessibleAction(entry);
                        return (
                          <article
                            key={entry.id}
                            className={[
                              "calendar-commitment-card",
                              "manager-schedule-card",
                              managerScheduleCategoryClass(entry),
                              managerScheduleStatusClass(entry)
                            ].join(" ")}
                            data-schedule-category={entry.category}
                            data-schedule-status={entry.status}
                          >
                            <div className="calendar-commitment-copy manager-schedule-copy">
                              <div className="manager-schedule-meta" aria-label="Commitment category and status">
                                <span className="manager-schedule-category">
                                  {readableScheduleToken(entry.category)}
                                </span>
                                <span className="manager-schedule-status">
                                  {readableScheduleToken(entry.status)}
                                </span>
                              </div>
                              <strong className="calendar-commitment-title">{entry.title}</strong>
                              <p>{entry.detail}</p>
                              {entry.category === "event" && entry.eventKind === "match" ? (
                                <div className="calendar-commitment-opponent">
                                  <span>Opponent</span>
                                  <ProfileNameButton
                                    playerId={entry.opponentId}
                                    fallback={<strong>{entry.opponentLabel}</strong>}
                                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                                    className="profile-name-button calendar-opponent-link"
                                  >
                                    {entry.opponentLabel}
                                  </ProfileNameButton>
                                </div>
                              ) : null}
                            </div>
                            {actionLabel ? (
                              <button
                                className="command-button command-button-secondary calendar-commitment-action manager-schedule-action"
                                type="button"
                                aria-label={actionLabel}
                                onClick={() => openManagerScheduleDestination(props, entry.destination)}
                              >
                                {managerScheduleActionLabel(entry.destination)}
                              </button>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="panel-summary">
                No manager commitments are due in the next 30 days. Schedule preparation, enter an event,
                commission scouting, or start facility work to create one.
              </p>
            )}
          </section>
        </div>
      ) : (
        <div
          id="timeline-panel-past-events"
          className="career-calendar-layout timeline-tab-panel"
          role="tabpanel"
          aria-labelledby="timeline-tab-past-events"
        >
          <section className="command-panel command-panel-full calendar-past-state">
            <div className="panel-header">
              <h2>Past Events</h2>
              <span>{pastRecords.length} recorded events, {CALENDAR_PAGE_SIZE} per page</span>
            </div>
            {pastPage.items.length > 0 ? (
              <>
                <div className="calendar-event-table" aria-label="Past event records">
                  <div className="calendar-event-row calendar-event-row-head" aria-hidden="true">
                    <span>Event</span>
                    <span>Dates</span>
                    <span>Result</span>
                    <span>Rewards / Costs</span>
                    <span>Evidence</span>
                    <span>Action</span>
                  </div>
                  {pastPage.items.map((record) => (
                    <article key={record.eventId} className="calendar-event-row">
                      <div className="calendar-event-main">
                        <span>{record.tier} / {record.status.replace(/_/g, " ")}</span>
                        <strong>
                          <CareerTournamentLink career={career} eventId={record.eventId}>
                            {record.eventName}
                          </CareerTournamentLink>
                        </strong>
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
                        <span>Rewards / Costs</span>
                        <strong>{points(record.pointsAwarded)} / {money(record.prizeMoney)}</strong>
                        <small>Costs {money(record.entryCost + record.travelCost)}; net {signedMoney(record.netCash)}</small>
                      </div>
                      <div>
                        <span>Evidence</span>
                        <strong>{record.scorelines[0] ?? "No match played"}</strong>
                        <small>{record.matchIds.length} match record(s)</small>
                      </div>
                      <div className="calendar-event-actions">
                        <button
                          className="command-button command-button-secondary"
                          type="button"
                          onClick={() => openTournamentHome(props, career, record.eventId)}
                        >
                          Open Event
                        </button>
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

export function CareerCalendarPage(props: CareerCalendarPageProps) {
  const initialCursor = props.initialMonthCursor ?? (props.career ? calendarMonthCursorForDate(props.career.date) : "2026-01-01");
  const [monthCursor, setMonthCursor] = useState<CalendarMonthCursor>(() => calendarMonthCursorForDate(initialCursor));

  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const careerMonthCursor = calendarMonthCursorForDate(career.date);
  const month = scheduleCalendarMonthForCareer({
    career,
    tournament: props.tournament,
    monthCursor
  });
  const managerMonth = managerScheduleMonthForCareer({
    career,
    tournament: props.tournament,
    monthCursor
  });

  return (
    <section className="screen-shell career-page calendar-month-page" data-page-contract="calendar-month">
      <div className="screen-header calendar-month-screen-header">
        <div>
          <p className="screen-kicker">Career Calendar</p>
          <h1 className="screen-title">Calendar</h1>
          <p className="screen-copy">
            One trusted month view for events, preparation, medical returns, travel, scouting, and facility work.
          </p>
        </div>
      </div>

      <section className="command-panel command-panel-full calendar-month-grid-panel">
        <ScheduleCalendarGrid
          career={career}
          month={month}
          managerGroups={managerMonth.groups}
          monthControls={
            <div className="calendar-month-controls" aria-label="Calendar month controls">
              <button
                className="command-button command-button-secondary"
                type="button"
                aria-label="Previous month"
                onClick={() => setMonthCursor(addCalendarMonths(month.cursor, -1))}
              >
                &lt;&lt;
              </button>
              <button
                className="command-button command-button-secondary"
                type="button"
                onClick={() => setMonthCursor(careerMonthCursor)}
              >
                Today
              </button>
              <button
                className="command-button command-button-secondary"
                type="button"
                aria-label="Next month"
                onClick={() => setMonthCursor(addCalendarMonths(month.cursor, 1))}
              >
                &gt;&gt;
              </button>
            </div>
          }
          onOpenScheduledCareerMatch={props.onOpenScheduledCareerMatch}
          onOpenTournamentHome={props.onOpenTournamentHome}
          onOpenTraining={props.onOpenTraining}
          onOpenScouting={props.onOpenScouting}
          onOpenFacilities={props.onOpenFacilities}
        />
      </section>
    </section>
  );
}

export function CareerTournamentHomePage(props: CareerPageProps & TournamentAddress) {
  if (!props.career) {
    return <CareerEmpty onStartCareer={props.onStartCareer} saveRecovery={props.saveRecovery} />;
  }

  const career = props.career;
  const event = getCareerEvent(career.events, props.eventId);
  const historyRecord = career.eventHistory.find((record) => record.eventId === props.eventId);
  const universeRecord = career.universeEvents.find(
    (record) => record.seasonId === career.seasonId && record.eventId === props.eventId
  );

  if (!event || props.seasonId !== career.seasonId) {
    return (
      <section className="screen-shell career-page">
        <div className="screen-header">
          <div>
            <p className="screen-kicker">Tournament Home</p>
            <h1 className="screen-title">Tournament Not Found</h1>
            <p className="screen-copy">
              The selected tournament address is unavailable for this career season. Address: {props.seasonId} / {props.eventId}.
            </p>
          </div>
          <div className="career-action-row">
            <button className="command-button command-button-secondary" type="button" onClick={props.onOpenTimeline}>
              Timeline
            </button>
          </div>
        </div>
      </section>
    );
  }

  const athlete = managedAthlete(career);
  const medicalGate = canCompeteWithInjury(athlete);
  const entered = career.enteredEventIds.includes(event.id);
  const completed =
    career.completedEventIds.includes(event.id) ||
    Boolean(historyRecord) ||
    universeRecord?.status === "completed" ||
    universeRecord?.status === "legacy_unavailable";
  const tierGate = eventEligibilityFor(career, event);
  const seedingSnapshot = buildEventSeedingSnapshot({ state: career, event });
  const entryCosts = effectiveEventEntryCosts(event, career.facilities);
  const totalCost = eventEntryCost(entryCosts);
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
  const status = historyRecord ? "completed" : eventStatusFor(career, event);
  const activeTournament = props.tournament?.id === event.id ? props.tournament : null;
  const archivedTournament =
    !activeTournament && historyRecord?.bracketSnapshot
      ? tournamentFromSnapshot({ event, record: historyRecord, snapshot: historyRecord.bracketSnapshot })
      : null;
  const matchRecords = eventMatchHistory(career, event.id);
  const reconstructedTournament =
    !activeTournament && !archivedTournament
      ? completeTournamentFromMatchHistory({
          event,
          records: matchRecords,
          managedPlayerId: career.program.managedPlayerId
        })
      : null;
  const displayTournament = activeTournament ?? archivedTournament ?? reconstructedTournament;
  const displayTournamentSource = activeTournament
    ? "Live event state"
    : archivedTournament
      ? "Archived bracket snapshot"
      : reconstructedTournament
        ? "Reconstructed from complete match records"
        : null;
  const tournamentEventOutcome =
    displayTournament && displayTournamentSource
      ? tournamentOutcome(displayTournament, displayTournamentSource)
      : null;
  const eventOutcome =
    tournamentEventOutcome ??
    achievementOutcome(career, event.id) ??
    managedHistoryOnlyOutcome({
      record: historyRecord,
      managedPlayerId: career.program.managedPlayerId
    });
  const matchEvidenceRows =
    matchRecords.length > 0
      ? evidenceFromMatchRecords(matchRecords)
      : displayTournament
        ? evidenceFromTournament(displayTournament)
        : [];
  const managedOutcome = managedOutcomeSummary({ career, record: historyRecord, matchRecords });
  const archiveStatus = activeTournament
    ? {
        title: activeTournament.championId ? "Live complete bracket" : "Active draw",
        detail: activeTournament.championId
          ? "The active tournament state already contains the final outcome."
          : "The draw is still in progress; no champion is claimed yet."
      }
    : historyRecord?.bracketSnapshot
      ? {
          title: "Bracket snapshot available",
          detail: "Closed draw was saved at settlement."
        }
      : reconstructedTournament
        ? {
            title: "Reconstructed bracket",
            detail: "Complete match records rebuild the archived draw without fabricating missing results."
          }
        : matchRecords.length > 0
          ? {
              title: "Partial match evidence",
              detail: `${matchRecords.length} recorded match result(s); champion stays unknown until final evidence exists.`
            }
          : historyRecord
            ? {
                title: "Legacy summary only",
                detail: "This save predates complete bracket truth, so unknown champions are not claimed."
              }
            : {
                title: "Pending draw",
                detail: "Bracket evidence appears after the event reaches match day."
              };
  const fieldPressure = pressureForEvent(career, event.id);
  const fieldSnapshot = universeRecord?.fieldSnapshot ?? null;
  const fieldSummary = fieldChangeSummary(universeRecord);
  const championName = eventOutcome?.championId ? playerDisplayName(eventOutcome.championId) : null;
  const runnerUpName = eventOutcome?.runnerUpId ? playerDisplayName(eventOutcome.runnerUpId) : null;
  const mainActionLabel =
    historyRecord || completed
      ? "Completed"
      : action.kind === "open_draw"
        ? entered
          ? "Entered"
          : "Open Event"
        : action.label;
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
  const actionDisabled = completed || action.disabled || action.kind === "open_draw";
  const eligibilityRows = [
    ["Rank", event.eligibility.minRank ? `Top ${event.eligibility.minRank}` : "Open", `Current rank ${tierGate.rank}`],
    ["Points", event.eligibility.minPoints ? points(event.eligibility.minPoints) : "Open", `Current ${points(tierGate.points)}`],
    ["Season race", event.tier === "Finals" ? points(event.eligibility.minPoints ?? 0) : "No finals gate", `Race ${points(tierGate.seasonPoints)}`],
    ["Readiness", `${event.eligibility.readinessFloor}+`, `Current ${tierGate.readiness}`],
    ["Completed events", event.eligibility.minCompletedEvents ? `${event.eligibility.minCompletedEvents}+` : "Open", `${tierGate.completedEvents} complete`],
    [
      "Affordability",
      money(totalCost),
      affordable ? `Cash ${money(career.economy.cash)}` : `Cash ${money(career.economy.cash)}; short ${money(totalCost - career.economy.cash)}`
    ],
    ["Medical", "Available", medicalGate.reason],
    ["Deadline", event.entryDeadline, tierGate.status === "missed_deadline" && !entered ? "Closed" : "Open enough for current state"]
  ];

  return (
    <section className="screen-shell career-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Tournament Home</p>
          <h1 className="screen-title">{event.name}</h1>
          <p className="screen-copy">
            {event.tier} event in week {event.weekNumber}, hosted at {event.location.venue} in {event.location.city},{" "}
            {event.location.country}. Address: {career.seasonId} / {event.id}.
          </p>
        </div>
        <div className="career-action-row">
          <button className="command-button command-button-secondary" type="button" onClick={props.onOpenTimeline}>
            Timeline
          </button>
          <button
            className={calendarEventActionClass(action)}
            type="button"
            disabled={actionDisabled}
            onClick={handleAction}
          >
            {mainActionLabel}
          </button>
        </div>
      </div>

      <section className="management-status-strip tournament-status-strip" aria-label="Event detail status">
        <div>
          <span>Status</span>
          <strong>{statusLabel(status)}</strong>
        </div>
        <div>
          <span>Window</span>
          <strong>{event.startDate} - {eventEndDate(event)}</strong>
        </div>
        <div>
          <span>Venue</span>
          <strong>{event.location.venue}</strong>
        </div>
        <div>
          <span>Champion</span>
          <strong>
            {eventOutcome?.championId ? (
              <ProfileNameButton
                playerId={eventOutcome.championId}
                fallback={championName ?? "Unknown"}
                onOpenPlayerProfile={props.onOpenPlayerProfile}
              />
            ) : historyRecord ? (
              "Unknown"
            ) : (
              "Pending"
            )}
          </strong>
        </div>
        <div>
          <span>Runner-up</span>
          <strong>
            {eventOutcome?.runnerUpId ? (
              <ProfileNameButton
                playerId={eventOutcome.runnerUpId}
                fallback={runnerUpName ?? "Unknown"}
                onOpenPlayerProfile={props.onOpenPlayerProfile}
              />
            ) : historyRecord ? (
              "Unknown"
            ) : (
              "Pending"
            )}
          </strong>
        </div>
        <div>
          <span>Action</span>
          <strong>{mainActionLabel}</strong>
        </div>
      </section>

      <div className="career-dashboard-grid">
        {displayTournament ? (
          <KnockoutTree
            tournament={displayTournament}
            selectedPlayerId={career.program.managedPlayerId}
            title={historyRecord ? "Archived Knockout Draw" : "Current Knockout Draw"}
            subtitle={historyRecord ? archiveStatus.detail : "Live event path and background results"}
            onOpenPlayerProfile={props.onOpenPlayerProfile}
          />
        ) : (
          <section className="command-panel command-panel-full tournament-draw-placeholder">
            <div className="panel-header">
              <h2>Knockout Draw</h2>
              <span>
                {universeRecord?.entrants.length
                  ? universeRecord.status.replace(/_/g, " ")
                  : career.date >= event.drawDate
                    ? "draw pending engine state"
                    : "projected"}
              </span>
            </div>
            <div className="career-event-brief calendar-brief-grid">
              <div>
                <span>Draw Size</span>
                <strong>{event.drawSize}</strong>
                <small>{event.seedCount} seeds; draw publishes {event.drawDate}</small>
              </div>
              <div>
                <span>Managed Seed</span>
                <strong>{seedingSnapshot.managedSeed ? `Seed ${seedingSnapshot.managedSeed.seed}` : "Outside seeds"}</strong>
                <small>{seedingSnapshot.status} from fictional circuit ranking</small>
              </div>
              <div>
                <span>Draw State</span>
                <strong>{entered ? "Entry registered" : "Not entered"}</strong>
                <small>
                  {universeRecord?.entrants.length
                    ? `${universeRecord.entrants.length} deterministic entrant(s) published.`
                    : "Playable bracket appears when the event reaches match day."}
                </small>
              </div>
            </div>
            {universeRecord?.entrants.length ? (
              <div className="career-deadline-row" aria-label={`${event.name} deterministic universe field`}>
                {universeRecord.entrants.map((playerId) => (
                  <span key={playerId} className="deadline-chip">
                    {playerDisplayName(playerId)}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {completed || eventOutcome ? (
          <section className="command-panel command-panel-full tournament-outcome-panel" aria-label={`${event.name} complete event outcome`}>
            <div className="panel-header">
              <h2>Full Event Outcome</h2>
              <span>{eventOutcome?.sourceLabel ?? archiveStatus.title}</span>
            </div>
            <div className="career-event-brief calendar-brief-grid">
              <div>
                <span>Champion</span>
                <strong>
                  {eventOutcome?.championId ? (
                    <ProfileNameButton
                      playerId={eventOutcome.championId}
                      fallback={playerDisplayName(eventOutcome.championId)}
                      onOpenPlayerProfile={props.onOpenPlayerProfile}
                    />
                  ) : (
                    "Unknown"
                  )}
                </strong>
                <small>
                  {rankingLedgerLine({
                    career,
                    eventId: event.id,
                    playerId: eventOutcome?.championId ?? null,
                    fallbackPoints: eventOutcome?.championId ? event.rankingPoints.champion : null,
                    fallbackLabel: "Champion"
                  })}
                </small>
              </div>
              <div>
                <span>Runner-up</span>
                <strong>
                  {eventOutcome?.runnerUpId ? (
                    <ProfileNameButton
                      playerId={eventOutcome.runnerUpId}
                      fallback={playerDisplayName(eventOutcome.runnerUpId)}
                      onOpenPlayerProfile={props.onOpenPlayerProfile}
                    />
                  ) : (
                    "Unknown"
                  )}
                </strong>
                <small>
                  {rankingLedgerLine({
                    career,
                    eventId: event.id,
                    playerId: eventOutcome?.runnerUpId ?? null,
                    fallbackPoints: eventOutcome?.runnerUpId ? event.rankingPoints.F : null,
                    fallbackLabel: "Runner-up"
                  })}
                </small>
              </div>
              <div>
                <span>Final Scoreline</span>
                <strong>{eventOutcome?.finalScoreline ?? "Unavailable"}</strong>
                <small>{eventOutcome ? `${eventOutcome.confidence} outcome evidence` : "No final evidence in this save."}</small>
              </div>
              <div>
                <span>Managed Result</span>
                <strong>{managedOutcome.label}</strong>
                <small>{managedOutcome.detail}</small>
              </div>
              <div>
                <span>Archive Trust</span>
                <strong>{archiveStatus.title}</strong>
                <small>{archiveStatus.detail}</small>
              </div>
            </div>
          </section>
        ) : null}

        {historyRecord ? (
          <section className="command-panel command-panel-full tournament-archive-panel">
            <div className="panel-header">
              <h2>Result Archive</h2>
              <span>{historyRecord.status.replace(/_/g, " ")}</span>
            </div>
            <div className="career-event-brief calendar-brief-grid">
              <div>
                <span>Managed Result</span>
                <strong>{historyRecord.resultRound ?? historyRecord.status.replace(/_/g, " ")}</strong>
                <small>{historyRecord.scorelines[0] ?? "No match scoreline archived"}</small>
              </div>
              <div>
                <span>Rewards</span>
                <strong>{points(historyRecord.pointsAwarded)} / {money(historyRecord.prizeMoney)}</strong>
                <small>Net cash {signedMoney(historyRecord.netCash)}</small>
              </div>
              <div>
                <span>Costs</span>
                <strong>{money(historyRecord.entryCost + historyRecord.travelCost)}</strong>
                <small>Entry {money(historyRecord.entryCost)}, travel {money(historyRecord.travelCost)}</small>
              </div>
              <div>
                <span>Archive</span>
                <strong>{archiveStatus.title}</strong>
                <small>{archiveStatus.detail}</small>
              </div>
            </div>
          </section>
        ) : null}

        <details className="command-panel command-panel-full tournament-notes-panel">
          <summary>
            <span>Event Notes</span>
            <small>Scoreline evidence, decision gates, and field changes</small>
          </summary>
          <div className="tournament-notes-grid">
            {completed || matchEvidenceRows.length > 0 ? (
              <section className="tournament-note-block">
                <div className="panel-header">
                  <h3>Scoreline Evidence</h3>
                  <span>{matchEvidenceRows.length > 0 ? `${matchEvidenceRows.length} result(s)` : "legacy fallback"}</span>
                </div>
                {matchEvidenceRows.length > 0 ? (
                  <div className="management-table tournament-evidence-table" aria-label={`${event.name} match result evidence`}>
                    {matchEvidenceRows.map((row) => (
                      <div className="management-table-row" key={row.id}>
                        <span>{calendarRoundLabel(row.round)}</span>
                        <strong>
                          <ProfileNameButton
                            playerId={row.winnerId}
                            fallback={playerDisplayName(row.winnerId)}
                            onOpenPlayerProfile={props.onOpenPlayerProfile}
                          />{" "}
                          def.{" "}
                          <ProfileNameButton
                            playerId={row.loserId}
                            fallback={playerDisplayName(row.loserId)}
                            onOpenPlayerProfile={props.onOpenPlayerProfile}
                          />
                        </strong>
                        <small>{row.scoreline} / {row.sourceLabel}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="panel-summary">
                    {historyRecord?.scorelines.length
                      ? `Legacy summary scorelines: ${historyRecord.scorelines.join(" | ")}. The save does not contain enough bracket evidence to identify a champion or runner-up.`
                      : "This legacy archive has no match scorelines, so the page keeps champion and runner-up unknown."}
                  </p>
                )}
              </section>
            ) : null}

            <section className="tournament-note-block">
              <div className="panel-header">
                <h3>Decision Gates</h3>
                <span>{tierGate.allowed && medicalGate.allowed && affordable ? "ready" : "check gates"}</span>
              </div>
              <div className="career-event-brief calendar-brief-grid">
                <div>
                  <span>Entry Deadline</span>
                  <strong>{event.entryDeadline}</strong>
                  <small>{daysUntilLabel(career.date, event.entryDeadline)}</small>
                </div>
                <div>
                  <span>Eligibility</span>
                  <strong>{tierGate.allowed ? "Gate clear" : "Blocked"}</strong>
                  <small>Rank {tierGate.rank}, readiness {tierGate.readiness}</small>
                </div>
                <div>
                  <span>Readiness</span>
                  <strong>{athlete.readiness}</strong>
                  <small>{medicalGate.allowed ? "Medical gate clear" : medicalGate.reason}</small>
                </div>
                <div>
                  <span>Champion Upside</span>
                  <strong>{money(event.prizeMoney.champion)} / {points(event.rankingPoints.champion)}</strong>
                  <small>Net possible gain {signedMoney(event.prizeMoney.champion - totalCost)}</small>
                </div>
              </div>
            </section>

            {fieldSnapshot ? (
              <section className="tournament-note-block">
                <div className="panel-header">
                  <h3>Field Delta</h3>
                  <span>final seeds after alternates</span>
                </div>
                <div className="career-event-brief calendar-brief-grid">
                  <div>
                    <span>Invited</span>
                    <strong>{fieldSnapshot.invitedPlayerIds.length}</strong>
                    <small>Initial rank invitations before non-entry resolution.</small>
                  </div>
                  <div>
                    <span>Skipped</span>
                    <strong>{fieldSnapshot.nonEntries.length}</strong>
                    <small>{fieldSnapshot.nonEntries.slice(0, 3).map((entry) => entry.reason.replace(/_/g, " ")).join(", ") || "No skipped invitees."}</small>
                  </div>
                  <div>
                    <span>Alternates</span>
                    <strong>{fieldSnapshot.alternateEntries.length}</strong>
                    <small>{fieldSnapshot.alternateEntries.slice(0, 3).map((entry) => playerDisplayName(entry.playerId)).join(", ") || "No alternates needed."}</small>
                  </div>
                  <div>
                    <span>Final seeding</span>
                    <strong>{fieldSnapshot.finalPlayerIds.length}</strong>
                    <small>{fieldSummary}</small>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </details>

        <section className="command-panel tournament-secondary-panel tournament-timeline-panel">
          <div className="panel-header">
            <h2>Timeline</h2>
            <span>{event.drawDate} draw</span>
          </div>
          <div className="career-deadline-row" aria-label={`${event.name} tournament timeline`}>
            {[
              ...eventDeadlineMilestones(event),
              { key: "end", label: "Event ends", date: eventEndDate(event) }
            ].map((milestone) => (
              <span
                key={milestone.key}
                className={career.date >= milestone.date ? "deadline-chip deadline-chip-past" : "deadline-chip"}
              >
                {milestone.label}: {milestone.date}
              </span>
            ))}
          </div>
        </section>

        <section className="command-panel tournament-secondary-panel tournament-eligibility-panel">
          <div className="panel-header">
            <h2>Eligibility</h2>
            <span>{tierGate.allowed ? "clear" : "blocked"}</span>
          </div>
          <div className="management-table" aria-label={`${event.name} eligibility checks`}>
            {eligibilityRows.map(([label, requirement, current]) => (
              <div className="management-table-row" key={label}>
                <span>{label}</span>
                <strong>{requirement}</strong>
                <small>{current}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="command-panel tournament-secondary-panel tournament-rewards-panel">
          <div className="panel-header">
            <h2>Rewards And Stakes</h2>
            <span>{event.tier}</span>
          </div>
          <div className="career-event-brief calendar-brief-grid">
            <div>
              <span>Prize Money</span>
              <strong>{money(event.prizeMoney.champion)}</strong>
              <small>R16 floor {money(event.prizeMoney.R16)}</small>
            </div>
            <div>
              <span>Entry / Travel</span>
              <strong>{money(entryCosts.entryFee)} / {money(entryCosts.travelCost)}</strong>
              <small>Total cost {money(totalCost)}</small>
            </div>
            <div>
              <span>Ranking Points</span>
              <strong>{points(event.rankingPoints.champion)}</strong>
              <small>R16 floor {points(event.rankingPoints.R16)}</small>
            </div>
            <div>
              <span>Net Possible Gain</span>
              <strong>{signedMoney(event.prizeMoney.champion - totalCost)}</strong>
              <small>{event.stakesLabel}</small>
            </div>
          </div>
        </section>

        <section className="command-panel tournament-secondary-panel tournament-field-panel">
          <div className="panel-header">
            <h2>Field And Scouting</h2>
            <span>{seedingSnapshot.status}</span>
          </div>
          <div className="career-event-brief calendar-brief-grid">
            <div>
              <span>Rival Pressure</span>
              <strong>{fieldPressure ? Math.round(fieldPressure.pressureScore) : "Open"}</strong>
              <small>{fieldPressure ? `${fieldPressure.rivalCount} rival programs entered` : "No rival pressure estimate yet"}</small>
            </div>
            <div>
              <span>Top Threat</span>
              <strong>{fieldPressure?.topThreatName ?? "Unknown"}</strong>
              <small>Scout reports improve opponent certainty.</small>
            </div>
            <div>
              <span>Seed Snapshot</span>
              <strong>{seedingSnapshot.managedSeed ? `Seed ${seedingSnapshot.managedSeed.seed}` : "Outside top seeds"}</strong>
              <small>Locked on {event.seedingDate}, draw on {event.drawDate}</small>
            </div>
            <div>
              <span>Draw Honesty</span>
              <strong>{displayTournament ? "Actual draw" : fieldSnapshot ? "Final field published" : "Projected until match day"}</strong>
              <small>{fieldSummary}</small>
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
          <strong>
            {event ? (
              <CareerTournamentLink career={props.career} eventId={event.id}>
                {event.name}
              </CareerTournamentLink>
            ) : (
              "No event"
            )}
          </strong>
        </div>
        <div>
          <span>Opponent</span>
          <strong>
            <ProfileNameButton
              playerId={opponent?.id}
              fallback="Pending"
              onOpenPlayerProfile={props.onOpenPlayerProfile}
            />
          </strong>
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
            <h2>
              <ProfileNameButton
                playerId={opponent?.id}
                fallback="Opponent pending"
                onOpenPlayerProfile={props.onOpenPlayerProfile}
              />
            </h2>
            <span>{event?.tier ?? "Event"}</span>
          </div>
          <p className="panel-summary">
            <SmartCareerText
              text={brief?.opponentBrief ?? "The draw will resolve when the event opens."}
              onOpenPlayerProfile={props.onOpenPlayerProfile}
            />
          </p>
          <div className="career-brief-grid">
            <div>
              <span>Readiness</span>
              <strong>{brief?.readiness ?? 0}</strong>
            </div>
            <div>
              <span>Risk Note</span>
              <strong>
                <SmartCareerText
                  text={
                    athlete.injury.status === "healthy"
                      ? brief?.riskNote ?? "No briefing yet"
                      : `${athlete.injury.label}: ${athlete.injury.daysRemaining} day(s) remaining`
                  }
                  onOpenPlayerProfile={props.onOpenPlayerProfile}
                />
              </strong>
            </div>
            <div>
              <span>Tier Stakes</span>
              <strong>
                <SmartCareerText
                  text={brief?.tierStakes ?? "No event entered"}
                  onOpenPlayerProfile={props.onOpenPlayerProfile}
                />
              </strong>
            </div>
            <div>
              <span>Recommendation</span>
              <strong>
                <SmartCareerText
                  text={brief?.recommendation ?? "Advance the calendar into match day."}
                  onOpenPlayerProfile={props.onOpenPlayerProfile}
                />
              </strong>
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
              <p>
                <SmartCareerText text={planningBridge.tacticSummary} onOpenPlayerProfile={props.onOpenPlayerProfile} />
              </p>
            </div>
            <div>
              <span>Assistant Signal</span>
              <strong>{planningBridge.adviceLabel}</strong>
              <p>
                <SmartCareerText text={planningBridge.adviceDetail} onOpenPlayerProfile={props.onOpenPlayerProfile} />
              </p>
            </div>
            <div>
              <span>Rival Intel</span>
              <strong>
                <SmartCareerText text={planningBridge.rivalIntel} onOpenPlayerProfile={props.onOpenPlayerProfile} />
              </strong>
            </div>
            <div>
              <span>Objective Stakes</span>
              <strong>
                <SmartCareerText text={planningBridge.objectiveStakes} onOpenPlayerProfile={props.onOpenPlayerProfile} />
              </strong>
            </div>
            <div>
              <span>Effect Projection</span>
              <strong>{planningBridge.effectSummary}</strong>
            </div>
            <div>
              <span>Fatigue / Strain Warning</span>
              <strong>
                <SmartCareerText text={planningBridge.strainWarning} onOpenPlayerProfile={props.onOpenPlayerProfile} />
              </strong>
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
          <strong>
            {event ? (
              <CareerTournamentLink career={props.career} eventId={event.id}>
                {event.name}
              </CareerTournamentLink>
            ) : report?.eventId ? (
              <CareerTournamentLink career={props.career} eventId={report.eventId}>
                {report.eventId}
              </CareerTournamentLink>
            ) : (
              "No event"
            )}
          </strong>
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
            <h2>
              {report ? (
                <>
                  {report.result.toUpperCase()} vs{" "}
                  <ProfileNameButton
                    playerId={opponent?.id}
                    fallback={report.opponentId}
                    onOpenPlayerProfile={props.onOpenPlayerProfile}
                  />
                </>
              ) : (
                "No report"
              )}
            </h2>
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
                <p key={entry}>
                  <SmartCareerText text={entry} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
              ))}
            </div>
            <div>
              <h3>Training Recommendations</h3>
              {(report?.recommendations ?? ["Post-match recommendations will appear here."]).map((entry) => (
                <p key={entry}>
                  <SmartCareerText text={entry} onOpenPlayerProfile={props.onOpenPlayerProfile} />
                </p>
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
