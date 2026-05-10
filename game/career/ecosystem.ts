import { addDays, daysBetween } from "./calendar";
import { addLedgerEntry } from "./economy";
import type {
  AthleteCareerState,
  AthletePsychology,
  CareerState,
  CareerStateV1,
  PlayerPromise,
  ProgramEcosystemState,
  ProgramEventLog,
  ProgramLowerEventEntry,
  ProgramRosterSlot,
  RecruitmentCandidate,
  ScoutAssignment,
  ScoutReport,
  StaffMember,
  StaffRole,
  YouthProspect
} from "./models";
import { clamp } from "./models";
import { refreshAthleteReadiness } from "./health";

export const staffCandidatePool: StaffMember[] = [
  {
    id: "staff-assistant-ruiz",
    name: "Marta Ruiz",
    role: "assistant_coach",
    level: 3,
    salary: 5_600,
    modifiers: { training: 0.1, recovery: 0.01, scouting: 0, analysis: 0.04, morale: 0.02 },
    capacity: 1,
    adviceBias: "Training blocks gain 10% more development before fatigue is applied.",
    hiredAt: null
  },
  {
    id: "staff-physio-tan",
    name: "Tan Wei",
    role: "physio",
    level: 4,
    salary: 6_400,
    modifiers: { training: 0, recovery: 0.16, scouting: 0, analysis: 0, morale: 0.02 },
    capacity: 1,
    adviceBias: "Recovery work removes extra fatigue and trims injury risk.",
    hiredAt: null
  },
  {
    id: "staff-analyst-cho",
    name: "Cho Min",
    role: "analyst",
    level: 3,
    salary: 5_900,
    modifiers: { training: 0.02, recovery: 0, scouting: 0, analysis: 0.12, morale: 0 },
    capacity: 1,
    adviceBias: "Scouted information reads cleaner in pre-match and recruitment decisions.",
    hiredAt: null
  },
  {
    id: "staff-scout-okafor",
    name: "Ife Okafor",
    role: "scout",
    level: 4,
    salary: 6_100,
    modifiers: { training: 0, recovery: 0, scouting: 0.18, analysis: 0.02, morale: 0 },
    capacity: 2,
    adviceBias: "Scout reports resolve faster and carry higher confidence.",
    hiredAt: null
  },
  {
    id: "staff-mental-kim",
    name: "Kim Hana",
    role: "mental_coach",
    level: 3,
    salary: 5_300,
    modifiers: { training: 0, recovery: 0.02, scouting: 0, analysis: 0, morale: 0.14 },
    capacity: 1,
    adviceBias: "Promise outcomes and match pressure have softer morale swings.",
    hiredAt: null
  }
];

const recruitmentSeed: RecruitmentCandidate[] = [
  {
    id: "cand-arya-prakash",
    name: "Arya Prakash",
    age: 19,
    country: "IND",
    source: "South Asia academy circuit",
    interest: 72,
    fit: 68,
    risk: 42,
    knowledge: { cost: "estimated", potential: "unknown", temperament: "unknown" },
    estimatedCost: 18_500,
    verifiedCost: 16_800,
    offerState: "none",
    rosterImpact: "rotation",
    promiseRequested: "Reach a quarterfinal within 30 days"
  },
  {
    id: "cand-liam-ng",
    name: "Liam Ng",
    age: 22,
    country: "MAS",
    source: "Independent senior pool",
    interest: 61,
    fit: 74,
    risk: 28,
    knowledge: { cost: "estimated", potential: "estimated", temperament: "unknown" },
    estimatedCost: 21_000,
    verifiedCost: 22_400,
    offerState: "none",
    rosterImpact: "senior",
    promiseRequested: "Protected event schedule after signing"
  }
];

const youthSeed: YouthProspect[] = [
  {
    id: "prospect-mei-sato",
    name: "Mei Sato",
    age: 16,
    potentialRange: [72, 91],
    readiness: 45,
    developmentPlan: "foundation",
    developmentTraits: ["fast learner", "net patience"],
    mentorOrStaffModifier: 0,
    lowerEventEligibility: false,
    morale: 63
  }
];

function logEntry(args: {
  state: ProgramEcosystemState;
  date: string;
  source: ProgramEventLog["source"];
  message: string;
  stateDelta: string;
  relatedIds: string[];
}) {
  const entry: ProgramEventLog = {
    id: `program-log-${args.date}-${args.state.programLog.length + 1}`,
    date: args.date,
    source: args.source,
    message: args.message,
    stateDelta: args.stateDelta,
    relatedIds: args.relatedIds
  };

  return [entry, ...args.state.programLog].slice(0, 18);
}

export function staffModifiers(state: ProgramEcosystemState) {
  return state.staff.hired.reduce(
    (total, staff) => ({
      training: total.training + staff.modifiers.training,
      recovery: total.recovery + staff.modifiers.recovery,
      scouting: total.scouting + staff.modifiers.scouting,
      analysis: total.analysis + staff.modifiers.analysis,
      morale: total.morale + staff.modifiers.morale,
      salary: total.salary + staff.salary,
      scoutCapacity: total.scoutCapacity + (staff.role === "scout" ? staff.capacity : 0)
    }),
    { training: 0, recovery: 0, scouting: 0, analysis: 0, morale: 0, salary: 0, scoutCapacity: 1 }
  );
}

export function createInitialPsychology(athleteId: string): AthletePsychology {
  return {
    athleteId,
    form: 64,
    morale: 68,
    confidence: 62,
    personalityTraits: ["ambitious", "analytical"],
    recentDrivers: ["New career program created"]
  };
}

export function createInitialEcosystem(managedPlayerId: string, date = "2026-06-01"): ProgramEcosystemState {
  const roster: ProgramRosterSlot[] = [
    {
      athleteId: managedPlayerId,
      name: "Managed lead athlete",
      role: "lead",
      contractCost: 3_500,
      status: "active",
      joinedAt: date,
      source: "founding roster"
    }
  ];

  return {
    scouting: { assignments: [], reports: [], capacityUsed: 0 },
    recruitment: {
      candidates: recruitmentSeed,
      roster,
      rosterLimit: 4
    },
    academy: { prospects: youthSeed },
    staff: { hired: [], candidates: staffCandidatePool },
    lowerEventEntries: [],
    psychology: [createInitialPsychology(managedPlayerId)],
    promises: [],
    programLog: [
      {
        id: `program-log-${date}-1`,
        date,
        source: "system",
        message: "Program ecosystem initialized",
        stateDelta: "Scouting, recruitment, youth, staff, psychology, and promise state are now tracked.",
        relatedIds: [managedPlayerId]
      }
    ]
  };
}

function createRecruitAthlete(candidate: RecruitmentCandidate, rank: number): AthleteCareerState {
  const upside = candidate.knowledge.potential === "estimated" ? 5 : 0;
  const riskDrag = Math.round(candidate.risk * 0.08);
  const athlete = {
    playerId: candidate.id,
    development: {
      smash: clamp(57 + candidate.fit * 0.18 + upside - riskDrag, 1, 100),
      stamina: clamp(58 + candidate.fit * 0.16 - riskDrag, 1, 100),
      composure: clamp(55 + candidate.interest * 0.12 - riskDrag, 1, 100),
      recovery: clamp(56 + (100 - candidate.risk) * 0.12, 1, 100)
    },
    fatigue: 18,
    injuryRisk: clamp(0.05 + candidate.risk / 1000, 0.02, 1),
    readiness: 0,
    recoveryStatus: "ready" as const,
    rankingPoints: 0,
    currentRank: rank
  };

  return refreshAthleteReadiness(athlete);
}

function lowerEventResult(readiness: number): ProgramLowerEventEntry["resultRound"] {
  if (readiness >= 86) {
    return "champion";
  }

  if (readiness >= 76) {
    return "SF";
  }

  if (readiness >= 62) {
    return "QF";
  }

  return "R16";
}

function lowerEventPromiseKept(state: ProgramEcosystemState, athleteId: string) {
  return state.lowerEventEntries.some(
    (entry) =>
      entry.subjectId === athleteId &&
      ["QF", "SF", "F", "champion"].includes(entry.resultRound)
  );
}

export function upgradeCareerStateV1(career: CareerStateV1): CareerState {
  return {
    ...career,
    version: 2,
    ecosystem: createInitialEcosystem(career.program.managedPlayerId, career.date)
  };
}

function activeAssignments(state: ProgramEcosystemState) {
  return state.scouting.assignments.filter((assignment) => assignment.status === "pending").length;
}

export function canCommissionScoutReport(state: CareerState, subjectId: string) {
  const modifiers = staffModifiers(state.ecosystem);
  const hasPending = state.ecosystem.scouting.assignments.some(
    (assignment) => assignment.subjectId === subjectId && assignment.status === "pending"
  );

  return {
    allowed: !hasPending && activeAssignments(state.ecosystem) < modifiers.scoutCapacity && state.economy.cash >= 3_200,
    reason: hasPending
      ? "Assignment already pending"
      : activeAssignments(state.ecosystem) >= modifiers.scoutCapacity
        ? "Scout capacity is full"
        : state.economy.cash < 3_200
          ? "Insufficient scouting budget"
          : "Ready"
  };
}

export function commissionScoutReport(state: CareerState, subjectId: string, subjectType: ScoutAssignment["subjectType"]) {
  const gate = canCommissionScoutReport(state, subjectId);

  if (!gate.allowed) {
    return {
      ...state,
      notes: [`Scout assignment blocked: ${gate.reason}`, ...state.notes].slice(0, 6)
    };
  }

  const modifiers = staffModifiers(state.ecosystem);
  const days = modifiers.scouting >= 0.18 ? 1 : 2;
  const assignment: ScoutAssignment = {
    id: `assignment-${subjectId}-${state.ecosystem.scouting.assignments.length + 1}`,
    subjectId,
    subjectType,
    assignedScoutId: state.ecosystem.staff.hired.find((staff) => staff.role === "scout")?.id ?? "baseline-network",
    cost: 3_200,
    startedAt: state.date,
    dueAt: addDays(state.date, days),
    status: "pending",
    scope: subjectType === "prospect" ? "potential" : "fit"
  };
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "scouting",
    label: `Scout ${subjectId}`,
    amount: -assignment.cost
  });
  const ecosystem = {
    ...state.ecosystem,
    scouting: {
      ...state.ecosystem.scouting,
      assignments: [...state.ecosystem.scouting.assignments, assignment],
      capacityUsed: activeAssignments(state.ecosystem) + 1
    },
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "scouting",
      message: `Scout assignment opened for ${subjectId}`,
      stateDelta: `-${assignment.cost} cash, due ${assignment.dueAt}`,
      relatedIds: [assignment.id, subjectId]
    })
  };

  return {
    ...state,
    economy,
    ecosystem,
    notes: [`Scout assignment due ${assignment.dueAt}`, ...state.notes].slice(0, 6)
  };
}

function reportForAssignment(state: CareerState, assignment: ScoutAssignment): ScoutReport {
  const modifiers = staffModifiers(state.ecosystem);
  const confidence = Math.round(clamp(62 + modifiers.scouting * 100 + modifiers.analysis * 45, 45, 95));
  const accuracy = Math.round(clamp(confidence - 8 + (assignment.subjectType === "prospect" ? 3 : 0), 40, 94));
  const subject =
    state.ecosystem.recruitment.candidates.find((candidate) => candidate.id === assignment.subjectId) ??
    state.ecosystem.academy.prospects.find((prospect) => prospect.id === assignment.subjectId);

  return {
    id: `report-${assignment.id}`,
    assignmentId: assignment.id,
    subjectId: assignment.subjectId,
    knownFields: ["identity", "source"],
    estimatedFields: {
      potential: assignment.subjectType === "prospect" ? "72-91" : "rotation upside",
      temperament: "pressure response estimated"
    },
    verifiedFields: {
      cost: "verifiedCost" in (subject ?? {}) ? `$${(subject as RecruitmentCandidate).verifiedCost}` : "academy scholarship",
      readiness: "readiness" in (subject ?? {}) ? `${(subject as YouthProspect).readiness}` : "senior-ready"
    },
    confidence,
    accuracy,
    createdAt: state.date,
    expiresAt: addDays(state.date, 21),
    state: "verified",
    recommendation:
      confidence >= 78
        ? "Proceed if budget pressure is acceptable."
        : "Useful signal, but keep risk buffer in the offer."
  };
}

export function resolveDueScoutReports(state: CareerState) {
  const readyAssignments = state.ecosystem.scouting.assignments.filter(
    (assignment) => assignment.status === "pending" && daysBetween(assignment.dueAt, state.date) >= 0
  );

  if (readyAssignments.length === 0) {
    return state;
  }

  const reports = readyAssignments.map((assignment) => reportForAssignment(state, assignment));
  const reportSubjectIds = new Set(reports.map((report) => report.subjectId));
  const ecosystem: ProgramEcosystemState = {
    ...state.ecosystem,
    scouting: {
      assignments: state.ecosystem.scouting.assignments.map((assignment) =>
        readyAssignments.some((ready) => ready.id === assignment.id)
          ? { ...assignment, status: "ready" as const }
          : assignment
      ),
      reports: [...reports, ...state.ecosystem.scouting.reports],
      capacityUsed: activeAssignments(state.ecosystem) - readyAssignments.length
    },
    recruitment: {
      ...state.ecosystem.recruitment,
      candidates: state.ecosystem.recruitment.candidates.map((candidate) =>
        reportSubjectIds.has(candidate.id)
          ? {
              ...candidate,
              knowledge: { cost: "verified", potential: "estimated", temperament: "estimated" },
              risk: Math.max(12, candidate.risk - 10)
            }
          : candidate
      )
    },
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "scouting",
      message: `${reports.length} scout report${reports.length === 1 ? "" : "s"} verified`,
      stateDelta: "Unknown fields moved into estimated or verified bands.",
      relatedIds: reports.map((report) => report.id)
    })
  };

  return {
    ...state,
    ecosystem,
    notes: [`${reports.length} scout report${reports.length === 1 ? "" : "s"} ready`, ...state.notes].slice(0, 6)
  };
}

export function expireScoutReports(state: CareerState) {
  const expiringReports = state.ecosystem.scouting.reports.filter(
    (report) => report.state !== "expired" && daysBetween(report.expiresAt, state.date) > 0
  );

  if (expiringReports.length === 0) {
    return state;
  }

  const expiredSubjectIds = new Set(expiringReports.map((report) => report.subjectId));
  const ecosystem: ProgramEcosystemState = {
    ...state.ecosystem,
    scouting: {
      ...state.ecosystem.scouting,
      reports: state.ecosystem.scouting.reports.map((report) =>
        expiredSubjectIds.has(report.subjectId)
          ? {
              ...report,
              state: "expired" as const
            }
          : report
      )
    },
    recruitment: {
      ...state.ecosystem.recruitment,
      candidates: state.ecosystem.recruitment.candidates.map((candidate) =>
        expiredSubjectIds.has(candidate.id)
          ? {
              ...candidate,
              knowledge: {
                ...candidate.knowledge,
                cost: "estimated",
                temperament: "unknown"
              }
            }
          : candidate
      )
    },
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "scouting",
      message: `${expiringReports.length} scout report${expiringReports.length === 1 ? "" : "s"} expired`,
      stateDelta: "Verified recruitment fields are stale until a new report is commissioned.",
      relatedIds: expiringReports.map((report) => report.id)
    })
  };

  return {
    ...state,
    ecosystem,
    notes: [`${expiringReports.length} scout report${expiringReports.length === 1 ? "" : "s"} expired`, ...state.notes].slice(0, 6)
  };
}

export function applyStaffToTraining(athlete: AthleteCareerState, ecosystem: ProgramEcosystemState) {
  const modifiers = staffModifiers(ecosystem);

  return refreshAthleteReadiness({
    ...athlete,
    development: {
      ...athlete.development,
      smash: clamp(athlete.development.smash + modifiers.training * 1.2, 1, 100),
      stamina: clamp(athlete.development.stamina + modifiers.training * 1.1, 1, 100),
      composure: clamp(athlete.development.composure + modifiers.morale * 0.8, 1, 100),
      recovery: clamp(athlete.development.recovery + modifiers.recovery * 1.4, 1, 100)
    },
    fatigue: clamp(athlete.fatigue - modifiers.recovery * 14, 0, 100),
    injuryRisk: clamp(athlete.injuryRisk - modifiers.recovery * 0.09, 0.02, 1)
  });
}

export function hireStaffMember(state: CareerState, staffId: string) {
  const staff = state.ecosystem.staff.candidates.find((candidate) => candidate.id === staffId);

  if (!staff) {
    return state;
  }

  if (state.ecosystem.staff.hired.some((hired) => hired.role === staff.role)) {
    return { ...state, notes: [`${roleLabel(staff.role)} slot is already filled`, ...state.notes].slice(0, 6) };
  }

  if (state.economy.cash < staff.salary) {
    return { ...state, notes: [`Insufficient funds to hire ${staff.name}`, ...state.notes].slice(0, 6) };
  }

  const hired = { ...staff, hiredAt: state.date };
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "staff",
    label: `${staff.name} signing salary`,
    amount: -staff.salary
  });
  const ecosystem = {
    ...state.ecosystem,
    staff: {
      hired: [...state.ecosystem.staff.hired, hired],
      candidates: state.ecosystem.staff.candidates.filter((candidate) => candidate.id !== staffId)
    },
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "staff",
      message: `${staff.name} hired as ${roleLabel(staff.role)}`,
      stateDelta: staff.adviceBias,
      relatedIds: [staff.id]
    })
  };

  return {
    ...state,
    economy,
    ecosystem,
    notes: [`Hired ${staff.name}`, ...state.notes].slice(0, 6)
  };
}

export function makeRecruitmentOffer(state: CareerState, candidateId: string) {
  const candidate = state.ecosystem.recruitment.candidates.find((entry) => entry.id === candidateId);

  if (!candidate) {
    return state;
  }

  const rosterFull = state.ecosystem.recruitment.roster.length >= state.ecosystem.recruitment.rosterLimit;
  const offerCost = candidate.knowledge.cost === "verified" ? candidate.verifiedCost : candidate.estimatedCost;
  const interest = candidate.interest + (candidate.fit - candidate.risk) * 0.22 + staffModifiers(state.ecosystem).morale * 60;
  const accepted = !rosterFull && state.economy.cash >= offerCost && interest >= 62;
  const offerState = rosterFull || state.economy.cash < offerCost ? "blocked" : accepted ? "accepted" : "rejected";
  const rosterSlot: ProgramRosterSlot | null = accepted
    ? {
        athleteId: candidate.id,
        name: candidate.name,
        role: candidate.rosterImpact === "senior" ? "senior" : "academy",
        contractCost: Math.round(offerCost / 8),
        status: "active",
        joinedAt: state.date,
        source: candidate.source
      }
    : null;
  const economy = accepted
    ? addLedgerEntry({
        economy: state.economy,
        date: state.date,
        category: "recruitment",
        label: `${candidate.name} program signing`,
        amount: -offerCost
      })
    : state.economy;
  const ecosystem: ProgramEcosystemState = {
    ...state.ecosystem,
    recruitment: {
      ...state.ecosystem.recruitment,
      roster: rosterSlot ? [...state.ecosystem.recruitment.roster, rosterSlot] : state.ecosystem.recruitment.roster,
      candidates: state.ecosystem.recruitment.candidates.map((entry) =>
        entry.id === candidate.id ? { ...entry, offerState } : entry
      )
    },
    promises: accepted && candidate.promiseRequested
      ? [
          createPromise({
            id: `promise-${candidate.id}`,
            athleteId: candidate.id,
            targetType: "reach_qf",
            targetValue: candidate.promiseRequested,
            date: state.date,
            deadline: addDays(state.date, 30)
          }),
          ...state.ecosystem.promises
        ]
      : state.ecosystem.promises,
    psychology: accepted
      ? [
          ...state.ecosystem.psychology.filter((entry) => entry.athleteId !== candidate.id),
          {
            ...createInitialPsychology(candidate.id),
            recentDrivers: [`${candidate.name} signed into the program`]
          }
        ]
      : state.ecosystem.psychology,
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "recruitment",
      message: `${candidate.name} offer ${offerState}`,
      stateDelta: accepted ? `Roster +1, cash -${offerCost}` : rosterFull ? "Roster limit blocked offer" : "Interest did not clear threshold",
      relatedIds: [candidate.id]
    })
  };

  return {
    ...state,
    athletes: accepted && !state.athletes.some((athlete) => athlete.playerId === candidate.id)
      ? [...state.athletes, createRecruitAthlete(candidate, 120 + state.athletes.length)]
      : state.athletes,
    economy,
    ecosystem,
    notes: [`${candidate.name} offer ${offerState}`, ...state.notes].slice(0, 6)
  };
}

export function trainRosterAthlete(state: CareerState, athleteId: string) {
  const rosterSlot = state.ecosystem.recruitment.roster.find(
    (slot) => slot.athleteId === athleteId && slot.status === "active"
  );
  const athlete = state.athletes.find((entry) => entry.playerId === athleteId);
  const cost = 950;

  if (!rosterSlot || !athlete) {
    return state;
  }

  if (state.economy.cash < cost) {
    return { ...state, notes: [`Insufficient funds to train ${rosterSlot.name}`, ...state.notes].slice(0, 6) };
  }

  const trained = refreshAthleteReadiness({
    ...athlete,
    development: {
      ...athlete.development,
      stamina: clamp(athlete.development.stamina + 4.5, 1, 100),
      composure: clamp(athlete.development.composure + 2, 1, 100),
      recovery: clamp(athlete.development.recovery + 1, 1, 100)
    },
    fatigue: clamp(athlete.fatigue + 5, 0, 100),
    injuryRisk: clamp(athlete.injuryRisk + 0.01, 0.02, 1)
  });
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "recruitment",
    label: `${rosterSlot.name} roster training`,
    amount: -cost
  });
  const ecosystem = updatePsychology(state.ecosystem, athleteId, {
    form: 2,
    morale: 1,
    confidence: 2,
    driver: "Roster training block completed"
  });

  return {
    ...state,
    economy,
    athletes: state.athletes.map((entry) => (entry.playerId === athleteId ? trained : entry)),
    ecosystem: {
      ...ecosystem,
      programLog: logEntry({
        state: ecosystem,
        date: state.date,
        source: "recruitment",
        message: `${rosterSlot.name} completed roster training`,
        stateDelta: "Stamina, composure, readiness, and psychology updated.",
        relatedIds: [athleteId]
      })
    },
    notes: [`${rosterSlot.name} roster training completed`, ...state.notes].slice(0, 6)
  };
}

export function enterRosterAthleteLowerEvent(state: CareerState, athleteId: string) {
  const rosterSlot = state.ecosystem.recruitment.roster.find(
    (slot) => slot.athleteId === athleteId && slot.status === "active"
  );
  const athlete = state.athletes.find((entry) => entry.playerId === athleteId);
  const cost = 1_400;

  if (!rosterSlot || !athlete) {
    return state;
  }

  if (state.economy.cash < cost) {
    return { ...state, notes: [`Insufficient funds to enter ${rosterSlot.name}`, ...state.notes].slice(0, 6) };
  }

  const resultRound = lowerEventResult(athlete.readiness);
  const entry: ProgramLowerEventEntry = {
    id: `lower-entry-${athleteId}-${state.ecosystem.lowerEventEntries.length + 1}`,
    subjectId: athleteId,
    subjectType: "roster_athlete",
    subjectName: rosterSlot.name,
    eventName: "Circuit Futures Invitational",
    tier: "Invitational",
    enteredAt: state.date,
    cost,
    readinessAtEntry: Math.round(athlete.readiness),
    resultRound,
    status: "completed"
  };
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "entry",
    label: `${rosterSlot.name} lower event`,
    amount: -cost
  });
  const competed = refreshAthleteReadiness({
    ...athlete,
    fatigue: clamp(athlete.fatigue + 9, 0, 100),
    rankingPoints: athlete.rankingPoints + (resultRound === "QF" ? 45 : resultRound === "SF" ? 80 : resultRound === "champion" ? 140 : 20)
  });
  const withPsychology = updatePsychology(state.ecosystem, athleteId, {
    form: resultRound === "R16" ? -1 : 3,
    morale: resultRound === "R16" ? -2 : 4,
    confidence: resultRound === "R16" ? -1 : 5,
    driver: `${entry.eventName} result: ${resultRound}`
  });
  const ecosystem: ProgramEcosystemState = {
    ...withPsychology,
    lowerEventEntries: [entry, ...withPsychology.lowerEventEntries],
    programLog: logEntry({
      state: withPsychology,
      date: state.date,
      source: "recruitment",
      message: `${rosterSlot.name} entered ${entry.eventName}`,
      stateDelta: `Finished ${resultRound}; athlete-specific event result recorded.`,
      relatedIds: [entry.id, athleteId]
    })
  };

  return {
    ...state,
    economy,
    athletes: state.athletes.map((entry) => (entry.playerId === athleteId ? competed : entry)),
    ecosystem,
    notes: [`${rosterSlot.name} lower-event result: ${resultRound}`, ...state.notes].slice(0, 6)
  };
}

export function developYouthProspect(state: CareerState, prospectId: string) {
  const modifiers = staffModifiers(state.ecosystem);
  const ecosystem: ProgramEcosystemState = {
    ...state.ecosystem,
    academy: {
      prospects: state.ecosystem.academy.prospects.map((prospect) => {
        if (prospect.id !== prospectId) {
          return prospect;
        }

        const readiness = clamp(prospect.readiness + 9 + modifiers.training * 25 + modifiers.morale * 12, 0, 100);

        return {
          ...prospect,
          readiness,
          mentorOrStaffModifier: Math.round((modifiers.training + modifiers.morale) * 100),
          lowerEventEligibility: readiness >= 58,
          morale: clamp(prospect.morale + 3 + modifiers.morale * 20, 0, 100),
          developmentPlan: readiness >= 58 ? "competition" : prospect.developmentPlan
        };
      })
    },
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "academy",
      message: "Youth development block completed",
      stateDelta: "Readiness, morale, and lower-event eligibility recalculated.",
      relatedIds: [prospectId]
    })
  };

  return {
    ...state,
    ecosystem,
    notes: ["Youth development block completed", ...state.notes].slice(0, 6)
  };
}

export function enterYouthLowerEvent(state: CareerState, prospectId: string) {
  const prospect = state.ecosystem.academy.prospects.find((entry) => entry.id === prospectId);
  const cost = 900;

  if (!prospect) {
    return state;
  }

  if (!prospect.lowerEventEligibility) {
    return { ...state, notes: [`${prospect.name} is not lower-event ready`, ...state.notes].slice(0, 6) };
  }

  if (state.economy.cash < cost) {
    return { ...state, notes: [`Insufficient academy budget for ${prospect.name}`, ...state.notes].slice(0, 6) };
  }

  const resultRound = lowerEventResult(prospect.readiness);
  const entry: ProgramLowerEventEntry = {
    id: `lower-entry-${prospectId}-${state.ecosystem.lowerEventEntries.length + 1}`,
    subjectId: prospect.id,
    subjectType: "youth_prospect",
    subjectName: prospect.name,
    eventName: "National Junior Futures",
    tier: "National",
    enteredAt: state.date,
    cost,
    readinessAtEntry: Math.round(prospect.readiness),
    resultRound,
    status: "completed"
  };
  const economy = addLedgerEntry({
    economy: state.economy,
    date: state.date,
    category: "academy",
    label: `${prospect.name} youth lower event`,
    amount: -cost
  });
  const ecosystem: ProgramEcosystemState = {
    ...state.ecosystem,
    lowerEventEntries: [entry, ...state.ecosystem.lowerEventEntries],
    academy: {
      prospects: state.ecosystem.academy.prospects.map((candidate) =>
        candidate.id === prospect.id
          ? {
              ...candidate,
              readiness: clamp(candidate.readiness - 4, 0, 100),
              morale: clamp(candidate.morale + (resultRound === "R16" ? 1 : 5), 0, 100)
            }
          : candidate
      )
    },
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "academy",
      message: `${prospect.name} entered ${entry.eventName}`,
      stateDelta: `Lower-tier event entry recorded; result ${resultRound}.`,
      relatedIds: [entry.id, prospect.id]
    })
  };

  return {
    ...state,
    economy,
    ecosystem,
    notes: [`${prospect.name} lower-event entry recorded`, ...state.notes].slice(0, 6)
  };
}

export function createPromise(args: {
  id: string;
  athleteId: string;
  targetType: PlayerPromise["targetType"];
  targetValue: string;
  date: string;
  deadline: string;
}): PlayerPromise {
  return {
    id: args.id,
    athleteId: args.athleteId,
    targetType: args.targetType,
    targetValue: args.targetValue,
    createdAt: args.date,
    deadline: args.deadline,
    status: "active",
    reward: { morale: 8, confidence: 6 },
    penalty: { morale: -10, confidence: -7 },
    resolutionLog: [`${args.date}: Promise created - ${args.targetValue}`]
  };
}

export function setManagedAthletePromise(state: CareerState, targetType: PlayerPromise["targetType"]) {
  const existing = state.ecosystem.promises.find(
    (promise) => promise.athleteId === state.program.managedPlayerId && promise.status === "active"
  );

  if (existing) {
    return { ...state, notes: ["One active managed-athlete promise is already open", ...state.notes].slice(0, 6) };
  }

  const targetText = targetType === "improve_stamina"
    ? "Improve stamina through the next training block"
    : targetType === "lower_event_entry"
      ? "Enter an appropriate lower-tier event"
      : targetType === "beat_top8"
        ? "Beat a top-8 opponent"
        : "Reach a quarterfinal";
  const promise = createPromise({
    id: `promise-${state.program.managedPlayerId}-${state.ecosystem.promises.length + 1}`,
    athleteId: state.program.managedPlayerId,
    targetType,
    targetValue: targetText,
    date: state.date,
    deadline: addDays(state.date, 14)
  });
  const ecosystem = {
    ...state.ecosystem,
    promises: [promise, ...state.ecosystem.promises],
    programLog: logEntry({
      state: state.ecosystem,
      date: state.date,
      source: "promise",
      message: `Promise created: ${targetText}`,
      stateDelta: `Deadline ${promise.deadline}`,
      relatedIds: [promise.id, promise.athleteId]
    })
  };

  return {
    ...state,
    ecosystem,
    notes: [`Promise created: ${targetText}`, ...state.notes].slice(0, 6)
  };
}

function updatePsychology(
  state: ProgramEcosystemState,
  athleteId: string,
  delta: { form?: number; morale?: number; confidence?: number; driver: string }
) {
  const found = state.psychology.some((entry) => entry.athleteId === athleteId);
  const psychology = (found ? state.psychology : [...state.psychology, createInitialPsychology(athleteId)]).map(
    (entry) =>
      entry.athleteId === athleteId
        ? {
            ...entry,
            form: clamp(entry.form + (delta.form ?? 0), 0, 100),
            morale: clamp(entry.morale + (delta.morale ?? 0), 0, 100),
            confidence: clamp(entry.confidence + (delta.confidence ?? 0), 0, 100),
            recentDrivers: [delta.driver, ...entry.recentDrivers].slice(0, 5)
          }
        : entry
  );

  return {
    ...state,
    psychology
  };
}

export function resolvePromises(state: CareerState) {
  let ecosystem = state.ecosystem;
  let changed = false;

  const promises = state.ecosystem.promises.map((promise) => {
    if (promise.status !== "active") {
      return promise;
    }

    const deadlinePassed = daysBetween(promise.deadline, state.date) > 0;
    const ownerAthlete = state.athletes.find((athlete) => athlete.playerId === promise.athleteId);
    const ownerIsManaged = promise.athleteId === state.program.managedPlayerId;
    const kept =
      (promise.targetType === "improve_stamina" && Boolean(ownerAthlete && ownerAthlete.development.stamina >= 75)) ||
      (promise.targetType === "reach_qf" && (
        lowerEventPromiseKept(ecosystem, promise.athleteId) ||
        Boolean(ownerIsManaged && state.lastMatchReport && ["QF", "SF", "F"].includes(state.lastMatchReport.round))
      )) ||
      (promise.targetType === "lower_event_entry" && (
        state.ecosystem.lowerEventEntries.some((entry) => entry.subjectId === promise.athleteId) ||
        Boolean(ownerIsManaged && state.enteredEventIds.length > 0)
      ));

    if (!kept && !deadlinePassed) {
      return promise;
    }

    changed = true;
    const status: PlayerPromise["status"] = kept ? "kept" : "missed";
    const delta = kept ? promise.reward : promise.penalty;
    ecosystem = updatePsychology(ecosystem, promise.athleteId, {
      morale: delta.morale,
      confidence: delta.confidence,
      form: kept ? 3 : -4,
      driver: `Promise ${status}: ${promise.targetValue}`
    });

    return {
      ...promise,
      status,
      resolutionLog: [`${state.date}: Promise ${status}`, ...promise.resolutionLog]
    };
  });

  if (!changed) {
    return state;
  }

  ecosystem = {
    ...ecosystem,
    promises,
    programLog: logEntry({
      state: ecosystem,
      date: state.date,
      source: "promise",
      message: "Promise resolution updated",
      stateDelta: "Morale and confidence consequences applied.",
      relatedIds: promises.filter((promise) => promise.status !== "active").map((promise) => promise.id)
    })
  };

  return {
    ...state,
    ecosystem,
    notes: ["Promise resolution updated", ...state.notes].slice(0, 6)
  };
}

export function withdrawPromise(state: CareerState, promiseId: string) {
  const promise = state.ecosystem.promises.find((entry) => entry.id === promiseId);

  if (!promise || promise.status !== "active") {
    return state;
  }

  const withPsychology = updatePsychology(state.ecosystem, promise.athleteId, {
    morale: -5,
    confidence: -3,
    driver: `Promise withdrawn: ${promise.targetValue}`
  });
  const ecosystem = {
    ...withPsychology,
    promises: withPsychology.promises.map((entry) =>
      entry.id === promise.id
        ? {
            ...entry,
            status: "withdrawn" as const,
            resolutionLog: [`${state.date}: Promise withdrawn`, ...entry.resolutionLog]
          }
        : entry
    ),
    programLog: logEntry({
      state: withPsychology,
      date: state.date,
      source: "promise",
      message: `Promise withdrawn: ${promise.targetValue}`,
      stateDelta: "Morale -5, confidence -3",
      relatedIds: [promise.id, promise.athleteId]
    })
  };

  return {
    ...state,
    ecosystem,
    notes: ["Promise withdrawn", ...state.notes].slice(0, 6)
  };
}

export function applyMatchPsychology(state: CareerState, won: boolean) {
  const ecosystem = updatePsychology(state.ecosystem, state.program.managedPlayerId, {
    form: won ? 5 : -4,
    morale: won ? 4 : -5,
    confidence: won ? 7 : -6,
    driver: won ? "Match win lifted confidence" : "Match loss dented confidence"
  });

  return {
    ...state,
    ecosystem: {
      ...ecosystem,
      programLog: logEntry({
        state: ecosystem,
        date: state.date,
        source: "psychology",
        message: won ? "Win response applied" : "Loss response applied",
        stateDelta: won ? "Form +5, morale +4, confidence +7" : "Form -4, morale -5, confidence -6",
        relatedIds: [state.program.managedPlayerId]
      })
    }
  };
}

export function psychologyReadinessModifier(state: CareerState, athleteId: string) {
  const psychology = state.ecosystem.psychology.find((entry) => entry.athleteId === athleteId);

  if (!psychology) {
    return 0;
  }

  return Math.round((psychology.form - 60) * 0.08 + (psychology.confidence - 60) * 0.06 + (psychology.morale - 60) * 0.04);
}

export function roleLabel(role: StaffRole) {
  return role.replace("_", " ");
}
