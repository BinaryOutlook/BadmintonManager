import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { seededPlayers, playerMap } from "../game/content/players";
import { createInitialCareerState } from "../game/career/state";
import {
  appendCompletedTournamentMatchRecords,
  eventEndDate,
  getCareerEvent,
  tournamentMatchArchiveIds,
  tournamentMatchArchiveScorelines
} from "../game/career/events";
import { appendRankingResultsAndRebuild, createRankingResult } from "../game/career/rankings";
import type { CareerState } from "../game/career/models";
import type { MatchResult, Side } from "../game/core/models";
import { CURRENT_SAVE_VERSION, type PersistedSave } from "../game/store/save";
import { advanceTournament, createTournament, getManagedMatchContext } from "../game/tournament/tournament";

const expectedPrimaryCommandLabels = [
  "Portal",
  "Timeline",
  "Calendar",
  "Inbox",
  "Squad",
  "Training",
  "Tactics",
  "Rankings",
  "Live Match",
  "Reports",
  "Scouting",
  "Staff",
  "Facilities",
  "Save Manager",
  "Settings"
];

const ACTIVE_SAVE_SLOT_KEY = "badminton-manager-saves:active";
const SAVE_SLOT_PREFIX = "badminton-manager-saves:slot:";
const LEGACY_SAVE_KEY = "badminton-manager-save";
const E2E_SAVE_SLOT_ID = "playwright-active";

async function readActiveSave(page: Page): Promise<PersistedSave | null> {
  return page.evaluate(({ activeKey, slotPrefix, legacyKey }) => {
    const activeSlotId = window.localStorage.getItem(activeKey);
    const slotRaw = activeSlotId
      ? window.localStorage.getItem(`${slotPrefix}${activeSlotId}`)
      : null;

    if (slotRaw) {
      return JSON.parse(slotRaw).save ?? null;
    }

    const legacyRaw = window.localStorage.getItem(legacyKey);
    return legacyRaw ? JSON.parse(legacyRaw) : null;
  }, {
    activeKey: ACTIVE_SAVE_SLOT_KEY,
    slotPrefix: SAVE_SLOT_PREFIX,
    legacyKey: LEGACY_SAVE_KEY
  });
}

async function writeActiveSave(page: Page, save: PersistedSave) {
  await page.evaluate(({ activeKey, slotPrefix, slotId, payload }) => {
    const activeSlotId = window.localStorage.getItem(activeKey) ?? slotId;
    const key = `${slotPrefix}${activeSlotId}`;
    const existingRaw = window.localStorage.getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    const timestamp = "2026-07-13T00:00:00.000Z";
    const envelope = {
      storageVersion: 1,
      slotId: activeSlotId,
      name: existing?.name ?? "Playwright Career",
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastPlayedAt: timestamp,
      archivedAt: null,
      revision: existing?.revision ?? 1,
      save: payload
    };

    window.localStorage.setItem(key, JSON.stringify(envelope));
    window.localStorage.setItem(activeKey, activeSlotId);
    window.localStorage.removeItem("badminton-manager-save");
  }, {
    activeKey: ACTIVE_SAVE_SLOT_KEY,
    slotPrefix: SAVE_SLOT_PREFIX,
    slotId: E2E_SAVE_SLOT_ID,
    payload: save
  });
}

function forcedStraightGamesResult(winner: Side): MatchResult {
  return {
    winner,
    setsWonA: winner === "A" ? 2 : 0,
    setsWonB: winner === "B" ? 2 : 0,
    setSummaries: [
      {
        winner,
        scoreA: winner === "A" ? 21 : 14,
        scoreB: winner === "B" ? 21 : 14,
        points: []
      },
      {
        winner,
        scoreA: winner === "A" ? 21 : 16,
        scoreB: winner === "B" ? 21 : 16,
        points: []
      }
    ],
    stats: {
      winnersA: winner === "A" ? 22 : 12,
      winnersB: winner === "B" ? 22 : 12,
      unforcedErrorsA: winner === "A" ? 8 : 17,
      unforcedErrorsB: winner === "B" ? 8 : 17,
      totalSmashesA: 16,
      totalSmashesB: 15,
      peakSmashSpeedA: 388,
      peakSmashSpeedB: 381,
      staminaDrainA: 8,
      staminaDrainB: 10,
      longestRally: 26,
      totalPoints: 72
    },
    scoreline: winner === "A" ? "21-14, 21-16" : "14-21, 16-21",
    fidelity: "detailed",
    summaryEvents: [
      {
        kind: "straight_games",
        side: winner,
        title: "Forced deterministic result",
        detail: "Playwright state-flow proof supplies the result instead of relying on match luck."
      }
    ]
  };
}

async function fillImportSaveJson(page: Page, value: string) {
  await page.getByLabel("Import save JSON", { exact: true }).evaluate((element, text) => {
    const textarea = element as HTMLTextAreaElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    valueSetter?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

function createBetweenRoundsCareerSave() {
  const managedPlayerId = seededPlayers[0].player.id;
  const career = createInitialCareerState(managedPlayerId, 61001);
  const event = getCareerEvent(career.events, "metro-open-300")!;
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, 61001),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };
  const context = getManagedMatchContext(tournament);

  if (!context) {
    throw new Error("Expected opening managed match.");
  }

  const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
  const advancedTournament = advanceTournament({
    tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: forcedStraightGamesResult(managedSide)
  });
  const nextContext = getManagedMatchContext(advancedTournament);

  if (!nextContext) {
    throw new Error("Expected next-round managed match.");
  }

  const nextOpponentId = nextContext.playerAId === managedPlayerId ? nextContext.playerBId : nextContext.playerAId;
  const opponentId = context.playerAId === managedPlayerId ? context.playerBId : context.playerAId;
  const save = {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed: 61001,
    tournament: advancedTournament,
    liveMatch: null,
    career: {
      ...career,
      date: event.startDate,
      stage: "post_match" as const,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      completedEventIds: [],
      lastMatchReport: {
        eventId: event.id,
        matchId: context.matchId,
        opponentId,
        result: "win" as const,
        scoreline: "21-14, 21-16",
        round: context.roundName,
        pointsDelta: 0,
        cashDelta: 0,
        fatigueDelta: 8,
        evidence: ["Forced deterministic non-final win for state-flow proof"],
        recommendations: ["Continue into the next managed round"],
        tacticalViewer: null
      }
    }
  };

  return {
    save,
    eventId: event.id,
    nextOpponentId,
    nextOpponentName: playerMap[nextOpponentId].name
  };
}

function createPostMatchCloseoutCareerSave(outcome: "loss" | "title") {
  const managedPlayerId = seededPlayers[0].player.id;
  const career = createInitialCareerState(managedPlayerId, outcome === "title" ? 62002 : 62001);
  const event = getCareerEvent(career.events, "metro-open-300")!;
  let tournament = {
    ...createTournament(seededPlayers, managedPlayerId, outcome === "title" ? 62002 : 62001),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };

  while (outcome === "title" && getManagedMatchContext(tournament)?.roundName !== "F") {
    const context = getManagedMatchContext(tournament);

    if (!context) {
      throw new Error("Expected managed match before final.");
    }

    const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
    tournament = advanceTournament({
      tournament,
      seededEntries: seededPlayers,
      managedMatchId: context.matchId,
      managedResult: forcedStraightGamesResult(managedSide)
    });
  }

  const context = getManagedMatchContext(tournament);

  if (!context) {
    throw new Error("Expected managed closeout match.");
  }

  const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
  const opponentId = context.playerAId === managedPlayerId ? context.playerBId : context.playerAId;
  const won = outcome === "title";
  const winner = won ? managedSide : managedSide === "A" ? "B" : "A";
  const advancedTournament = advanceTournament({
    tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: forcedStraightGamesResult(winner)
  });
  const placementKey = won ? "champion" : context.roundName;
  const save = {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed: outcome === "title" ? 62002 : 62001,
    tournament: advancedTournament,
    liveMatch: null,
    career: {
      ...career,
      date: event.startDate,
      stage: "post_match" as const,
      activeEventId: event.id,
      enteredEventIds: [event.id],
      completedEventIds: [event.id],
      lastMatchReport: {
        eventId: event.id,
        matchId: context.matchId,
        opponentId,
        result: won ? "win" as const : "loss" as const,
        scoreline: won ? "21-14, 21-16" : "14-21, 16-21",
        round: context.roundName,
        pointsDelta: event.rankingPoints[placementKey],
        cashDelta: event.prizeMoney[placementKey],
        fatigueDelta: 8,
        evidence: [`Forced deterministic ${outcome} closeout proof`],
        recommendations: won ? ["Collect title settlement and return home"] : ["Close the event and reset the training block"],
        tacticalViewer: null
      }
    }
  };

  return {
    save,
    eventId: event.id,
    expectedButton: won ? "Collect Title And Continue" : "Close Event"
  };
}

function createCompletedNonManagedArchiveSave() {
  const managedPlayerId = seededPlayers[0].player.id;
  const seed = 63043;
  const career = createInitialCareerState(managedPlayerId, seed);
  const event = getCareerEvent(career.events, "metro-open-300")!;
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };
  const context = getManagedMatchContext(tournament);

  if (!context) {
    throw new Error("Expected managed opening match.");
  }

  const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
  const completedTournament = advanceTournament({
    tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: forcedStraightGamesResult(managedSide === "A" ? "B" : "A")
  });
  const finalMatch = completedTournament.rounds.find((round) => round.name === "F")?.matches[0];

  if (!finalMatch?.winnerId || !finalMatch.scoreline) {
    throw new Error("Expected completed archive final.");
  }

  const runnerUpId = finalMatch.sideAId === finalMatch.winnerId ? finalMatch.sideBId : finalMatch.sideAId;
  const archiveDate = eventEndDate(event);
  const withMatchRecords = appendCompletedTournamentMatchRecords({
    state: {
      ...career,
      date: archiveDate,
      stage: "event_complete" as const,
      activeEventId: null,
      enteredEventIds: [event.id],
      completedEventIds: [event.id]
    },
    event,
    tournament: completedTournament,
    date: archiveDate
  });
  const withRankingResults = appendRankingResultsAndRebuild({
    career: withMatchRecords,
    results: [
      createRankingResult({
        seasonId: withMatchRecords.seasonId,
        playerId: finalMatch.winnerId,
        eventId: event.id,
        eventName: event.name,
        tier: event.tier,
        date: archiveDate,
        resultRound: "champion",
        points: event.rankingPoints.champion,
        source: "archive_import",
        artificial: false
      }),
      createRankingResult({
        seasonId: withMatchRecords.seasonId,
        playerId: runnerUpId,
        eventId: event.id,
        eventName: event.name,
        tier: event.tier,
        date: archiveDate,
        resultRound: "F",
        points: event.rankingPoints.F,
        source: "archive_import",
        artificial: false
      })
    ],
    asOfDate: archiveDate
  });
  const save = {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed,
    tournament: null,
    liveMatch: null,
    career: {
      ...withRankingResults,
      eventHistory: [
        {
          seasonId: career.seasonId,
          eventId: event.id,
          eventName: event.name,
          tier: event.tier,
          startDate: event.startDate,
          endDate: archiveDate,
          status: "round_of_16" as const,
          entered: true,
          resultRound: "R16",
          pointsAwarded: event.rankingPoints.R16,
          prizeMoney: event.prizeMoney.R16,
          entryCost: event.entryFee,
          travelCost: event.travelCost,
          netCash: event.prizeMoney.R16 - event.entryFee - event.travelCost,
          completedAt: archiveDate,
          matchIds: tournamentMatchArchiveIds(completedTournament),
          scorelines: tournamentMatchArchiveScorelines(completedTournament),
          achievements: ["Points Finish"],
          bracketSnapshot: null
        }
      ]
    }
  };

  return {
    save,
    eventName: event.name,
    championName: playerMap[finalMatch.winnerId].name,
    runnerUpName: playerMap[runnerUpId].name,
    finalScoreline: finalMatch.scoreline,
    championPoints: event.rankingPoints.champion
  };
}

function createTix030ProfileVisualSave() {
  const managedPlayerId = seededPlayers[0].player.id;
  const seed = 67030;
  const career = createInitialCareerState(managedPlayerId, seed);
  const event = getCareerEvent(career.events, "metro-open-300")!;
  const tournament = {
    ...createTournament(seededPlayers, managedPlayerId, seed),
    id: event.id,
    name: event.name,
    tier: event.tier,
    prizePoolUsd: event.prizeMoney.champion * 2
  };
  const context = getManagedMatchContext(tournament);

  if (!context) {
    throw new Error("Expected managed profile visual QA match.");
  }

  const managedSide = context.playerAId === managedPlayerId ? "A" : "B";
  const opponentId = context.playerAId === managedPlayerId ? context.playerBId : context.playerAId;
  const advancedTournament = advanceTournament({
    tournament,
    seededEntries: seededPlayers,
    managedMatchId: context.matchId,
    managedResult: forcedStraightGamesResult(managedSide)
  });
  const matchHistory: CareerState["matchHistory"] = [
    {
      id: `${event.id}:${context.roundName}-profile-win`,
      seasonId: career.seasonId,
      eventId: event.id,
      eventName: event.name,
      date: event.startDate,
      round: context.roundName,
      playerAId: context.playerAId,
      playerBId: context.playerBId,
      winnerId: managedPlayerId,
      scoreline: "21-14, 21-16",
      source: "played"
    },
    {
      id: "harbor-masters-500:F-profile-loss",
      seasonId: career.seasonId,
      eventId: "harbor-masters-500",
      eventName: "Harbor Masters",
      date: "2026-06-17",
      round: "F",
      playerAId: opponentId,
      playerBId: managedPlayerId,
      winnerId: opponentId,
      scoreline: "18-21, 19-21",
      source: "played"
    }
  ];
  const playerAchievements: CareerState["playerAchievements"] = [
    {
      seasonId: career.seasonId,
      playerId: managedPlayerId,
      eventId: event.id,
      eventName: event.name,
      date: "2026-06-07",
      result: "champion"
    },
    {
      seasonId: career.seasonId,
      playerId: managedPlayerId,
      eventId: "harbor-masters-500",
      eventName: "Harbor Masters",
      date: "2026-06-17",
      result: "runner_up"
    }
  ];
  const save: PersistedSave = {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: managedPlayerId,
    plannedTacticKey: "balancedControl",
    seed,
    tournament: advancedTournament,
    liveMatch: null,
    career: {
      ...career,
      date: event.startDate,
      stage: "between_rounds",
      activeEventId: event.id,
      enteredEventIds: [event.id],
      completedEventIds: [],
      matchHistory,
      playerAchievements,
      lastMatchReport: {
        eventId: event.id,
        matchId: context.matchId,
        opponentId,
        result: "win",
        scoreline: "21-14, 21-16",
        round: context.roundName,
        pointsDelta: 0,
        cashDelta: 0,
        fatigueDelta: 8,
        evidence: ["Visual QA save preserves a managed result with telemetry evidence."],
        recommendations: ["Use the Performance tab to audit winners, errors, stamina, and pace."],
        tacticalViewer: null
      }
    }
  };

  return {
    save,
    managedName: playerMap[managedPlayerId].name,
    opponentName: playerMap[opponentId].name
  };
}

async function captureFocusedScreenshot(page: { screenshot: (options: { path: string; fullPage: boolean }) => Promise<Buffer> }, name: string) {
  const screenshotDir = process.env.FOCUSED_SCREENSHOT_DIR;

  if (!screenshotDir) {
    return;
  }

  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: `${screenshotDir}/${name}.png`,
    fullPage: true
  });
}

async function loadPersistedSave(page: Page, save: PersistedSave) {
  await writeActiveSave(page, save);
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.location.reload();
  });
}

async function expectCalendarViewportBounded(page: Page) {
  await page.evaluate(() => {
    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected calendar/timeline document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const checkedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".calendar-subnav, .calendar-status-strip, .calendar-month-controls, .calendar-event-row, .calendar-secondary-grid, .career-week-strip, .schedule-calendar-month, .schedule-calendar-grid"
      )
    );

    for (const element of checkedElements) {
      if (element.classList.contains("schedule-calendar-month") && element.scrollWidth > element.clientWidth + 1) {
        const overflowX = window.getComputedStyle(element).overflowX;
        if (overflowX !== "auto" && overflowX !== "scroll") {
          throw new Error(`Expected overflowing calendar month to remain horizontally scrollable, received ${overflowX}.`);
        }
        continue;
      }

      if (element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected calendar/timeline element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
  });
}

async function expectCompactCalendarMonthContract(page: Page) {
  const calendarMonth = page.locator(".schedule-calendar-month").first();
  const monthLabels = calendarMonth.locator(".schedule-calendar-month-header h2");
  const controls = calendarMonth.getByLabel("Calendar month controls");

  await expect(monthLabels).toHaveCount(1);
  await expect(monthLabels.first()).toContainText(/[A-Z][a-z]+ 2026/);
  await expect(page.getByLabel("Calendar status")).toHaveCount(0);
  for (const diagnosticLabel of ["Career today", "Visible month", "Visible range", "Diary entries", "Scope"]) {
    await expect(page.getByText(diagnosticLabel, { exact: true })).toHaveCount(0);
  }
  await expect(controls).toBeVisible();
  await expect(controls.getByRole("button", { name: "Previous month" })).toHaveText("<<");
  await expect(controls.getByRole("button", { name: "Today" })).toHaveText("Today");
  await expect(controls.getByRole("button", { name: "Next month" })).toHaveText(">>");
}

async function expectRankingsViewportBounded(page: Page) {
  await page.evaluate(() => {
    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected Rankings document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const checkedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".rankings-status-strip, .rankings-table, .rankings-row, .rankings-summary-grid, .rankings-pagination"
      )
    );

    for (const element of checkedElements) {
      if (element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected Rankings element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
  });
}

async function expectPortalViewportBounded(page: Page, expectOnePage: boolean) {
  await page.evaluate((shouldFitInViewport) => {
    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected Portal document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const portal = document.querySelector<HTMLElement>('[data-page-contract="portal-home"]');

    if (!portal) {
      throw new Error("Expected compact Portal Home contract element.");
    }

    if (shouldFitInViewport) {
      const portalBottom = portal.getBoundingClientRect().bottom;

      if (portalBottom > window.innerHeight + 1) {
        throw new Error(`Expected desktop Portal to fit one viewport: ${portalBottom} > ${window.innerHeight}`);
      }
    }

    const checkedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".career-home-zone, .career-zone-layout, .career-dashboard-grid-compact, .career-consequence-grid, .career-week-strip-compact, .career-ecosystem-strip-compact, .management-table-compact, .career-finance-summary"
      )
    );

    for (const element of checkedElements) {
      const intentionalTimelineScroller = element.classList.contains("career-week-strip-compact");

      if (intentionalTimelineScroller && element.scrollWidth > element.clientWidth + 1) {
        const overflowX = window.getComputedStyle(element).overflowX;
        if (overflowX !== "auto" && overflowX !== "scroll") {
          throw new Error(`Expected overflowing Portal timeline to remain horizontally scrollable, received ${overflowX}.`);
        }
        continue;
      }

      if (element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected Portal element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }

    const compactTextElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".career-consequence-grid strong, .career-week-strip-compact .career-day strong, .career-ecosystem-strip-compact .career-system-tile strong, .career-ecosystem-strip-compact .career-system-tile small, .career-finance-summary strong"
      )
    );

    for (const element of compactTextElements) {
      if (element.scrollWidth > element.clientWidth + 1) {
        const text = element.textContent?.trim() || element.className || element.tagName;
        throw new Error(`Unexpected Portal text clipping for ${text}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
  }, expectOnePage);
}

async function expectLaunchViewportBounded(page: Page) {
  await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;

    if (overflow > 0) {
      throw new Error(`Unexpected launch document overflow: ${overflow}px`);
    }

    const checkedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".start-screen-redesign, .start-hero, .start-layout, .start-resume-panel, .start-mode-card, .start-utility-card, .start-save-trust-strip"
      )
    );

    for (const element of checkedElements) {
      if (element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected launch element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
  });
}

async function expectProfileViewportBounded(page: Page) {
  await page.evaluate(() => {
    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected player profile document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const checkedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".player-profile-hero, .profile-tab-list, .player-profile-toolbar, .profile-verdict-panel, .profile-tactic-layout, .profile-decision-grid, .profile-attributes-grid, .profile-performance-grid, .profile-future-grid, .profile-radar"
      )
    );

    for (const element of checkedElements) {
      if (element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected player profile element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
  });
}

async function expectPrimaryCommandLabels(commandRail: Locator) {
  const labels = await commandRail.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => button.querySelector("span")?.textContent ?? "")
  );

  expect(labels).toEqual(expectedPrimaryCommandLabels);
}

async function expectTopbarHierarchyAndBounded(page: Page) {
  await page.evaluate(() => {
    const topbar = document.querySelector<HTMLElement>(".topbar:not(.launch-topbar)");

    if (!topbar) {
      throw new Error("Expected loaded career topbar.");
    }

    const brand = topbar.querySelector<HTMLElement>(".brand-mark");
    const brandLockup = topbar.querySelector<HTMLElement>(".brand-lockup");
    const navigationToggle = topbar.querySelector<HTMLButtonElement>(".mobile-navigation-toggle");
    const athlete = topbar.querySelector<HTMLElement>(".topbar-athlete-chip");
    const search = topbar.querySelector<HTMLElement>(".command-search");
    const commandZone = topbar.querySelector<HTMLElement>(".topbar-command-zone");
    const dailyCluster = topbar.querySelector<HTMLElement>(".topbar-daily-cluster");
    const utilityCluster = topbar.querySelector<HTMLElement>(".topbar-actions");
    const date = topbar.querySelector<HTMLElement>(".topbar-date");
    const dailyAction = topbar.querySelector<HTMLElement>(".topbar-continue");
    const saveControl = topbar.querySelector<HTMLButtonElement>(".topbar-save-button");
    const settings = utilityCluster?.querySelector<HTMLButtonElement>("button:not(.topbar-save-button)") ?? null;

    if (!brand || !brandLockup || !navigationToggle || !athlete || !search || !commandZone || !dailyCluster || !utilityCluster || !date || !dailyAction || !saveControl || !settings) {
      throw new Error("Expected complete topbar identity, utility controls, clock, save, and settings controls.");
    }

    if (
      brand.nextElementSibling !== brandLockup ||
      brandLockup.nextElementSibling !== navigationToggle ||
      navigationToggle.nextElementSibling !== athlete ||
      athlete.nextElementSibling !== search
    ) {
      throw new Error("Expected brand, navigation toggle, managed athlete, and command search in topbar identity order.");
    }

    if (saveControl.textContent?.trim() !== "Career Save") {
      throw new Error("Expected Career Save to remain the topbar save-management utility.");
    }

    if (saveControl.nextElementSibling !== settings) {
      throw new Error("Expected Career Save directly left of Settings.");
    }

    if (!(settings.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      throw new Error("Expected Settings to sit left of the career date.");
    }

    if (date.nextElementSibling !== dailyAction) {
      throw new Error("Expected date directly beside the daily action.");
    }

    const topbarButtonLabels = Array.from(topbar.querySelectorAll("button")).map((button) => button.textContent?.trim());

    if (topbarButtonLabels.includes("Intel")) {
      throw new Error("Intel button should not be visible in the topbar.");
    }

    if (settings.textContent?.trim() !== "Settings") {
      throw new Error("Expected Settings to remain reachable from the topbar.");
    }

    const actionFontWeight = Number.parseFloat(window.getComputedStyle(dailyAction).fontWeight);
    const saveFontWeight = Number.parseFloat(window.getComputedStyle(saveControl).fontWeight);

    if (saveFontWeight > actionFontWeight) {
      throw new Error(`Expected Career Save not to read stronger than Advance Day: save ${saveFontWeight}, action ${actionFontWeight}`);
    }

    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected topbar document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const checkedElements = [
      topbar,
      topbar.querySelector<HTMLElement>(".topbar-brand-block"),
      commandZone,
      utilityCluster,
      dailyCluster
    ];

    for (const element of checkedElements) {
      if (element && element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected topbar element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }

    const controls = [saveControl, settings, date, dailyAction];

    for (let index = 0; index < controls.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < controls.length; nextIndex += 1) {
        const first = controls[index]!.getBoundingClientRect();
        const second = controls[nextIndex]!.getBoundingClientRect();
        const overlapsHorizontally = first.left < second.right - 1 && first.right > second.left + 1;
        const overlapsVertically = first.top < second.bottom - 1 && first.bottom > second.top + 1;

        if (overlapsHorizontally && overlapsVertically) {
          throw new Error(`Unexpected topbar control overlap between positions ${index} and ${nextIndex}.`);
        }
      }
    }

    if (viewportWidth >= 1024) {
      const saveRect = saveControl.getBoundingClientRect();
      const settingsRect = settings.getBoundingClientRect();
      const dateRect = date.getBoundingClientRect();
      const actionRect = dailyAction.getBoundingClientRect();
      const utilityGap = settingsRect.left - saveRect.right;
      const groupGap = dateRect.left - settingsRect.right;
      const rightmostEdge = Math.max(saveRect.right, settingsRect.right, dateRect.right, actionRect.right);

      if (!(saveRect.left < settingsRect.left && settingsRect.left < dateRect.left && dateRect.left < actionRect.left)) {
        throw new Error("Expected desktop topbar visual order to be Career Save, Settings, Date, Advance Day.");
      }

      if (actionRect.right < rightmostEdge - 1) {
        throw new Error("Expected Advance Day to be the rightmost desktop topbar control.");
      }

      if (groupGap <= utilityGap + 2) {
        throw new Error(`Expected a stronger utility-to-clock gap than utility button gap: ${groupGap}px vs ${utilityGap}px.`);
      }
    }
  });
}

async function selectAthleteInSelectionModal(page: Page, athleteName: string) {
  const dialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  const directSelect = dialog
    .getByRole("button", { name: new RegExp(`Select( featured)? ${escapeRegExp(athleteName)}`) })
    .first();

  if (await directSelect.isVisible().catch(() => false)) {
    await directSelect.click();
    return;
  }

  await dialog.getByRole("button", { name: "Browse All Athletes" }).click();
  await dialog.getByLabel("Search").fill(athleteName);
  await dialog.getByRole("button", { name: new RegExp(`Select ${escapeRegExp(athleteName)}`) }).click();
}

async function startNewCareer(page: Page, athleteName = seededPlayers[0].player.name) {
  await page.getByRole("button", { name: "Start Career" }).click();
  const dialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm Career Athlete" })).toBeDisabled();
  await selectAthleteInSelectionModal(page, athleteName);
  await expect(dialog.getByRole("button", { name: "Confirm Career Athlete" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Confirm Career Athlete" }).click();
}

async function startQuickTournamentFromModal(page: Page, athleteName = seededPlayers[0].player.name) {
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Strategic Override" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Start Tournament" })).toBeDisabled();
  await selectAthleteInSelectionModal(page, athleteName);
  await expect(dialog.getByRole("button", { name: "Start Tournament" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Start Tournament" }).click();
}

async function openSettings(page: Page) {
  if (await page.getByRole("banner").count()) {
    await page.getByRole("banner").getByRole("button", { name: "Settings" }).click();
    return;
  }

  await page.getByRole("button", { name: "Preferences", exact: true }).click();
}

async function openSaveManager(page: Page) {
  if (await page.getByRole("navigation", { name: "Primary commands" }).count()) {
    await openPrimaryCommand(page, /Save Manager/);
    return;
  }

  await page.getByRole("button", { name: "Save Tools" }).click();
}

async function openPrimaryCommand(page: Page, name: string | RegExp) {
  const navigationToggle = page.getByRole("banner").getByRole("button", { name: "Open navigation menu" });
  if (await navigationToggle.isVisible().catch(() => false)) {
    await navigationToggle.click();
  }

  await page
    .getByRole("navigation", { name: "Primary commands" })
    .getByRole("button", { name })
    .click();
}

async function requestNewSession(page: Page) {
  await openSettings(page);
  await page.getByRole("button", { name: "New Session" }).click();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("can start a tournament run and play through a managed match", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quick Tournament", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Career" })).toBeVisible();
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  const selectionDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(selectionDialog).toBeVisible();

  await selectionDialog.getByRole("button", { name: "Grand-Slam Southpaw", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Grand-Slam Southpaw" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Attributes" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Scouting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scouting Verdict" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Threat / Fit Summary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resize sidebar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();

  await openSettings(page);
  await expect(page.getByRole("heading", { name: "Console Preferences" })).toBeVisible();
  await page.getByRole("button", { name: "Cyan Cool tactical display accent." }).click();
  await expect(page.getByRole("button", { name: "Cyan Cool tactical display accent." })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.getByRole("button", { name: "Close settings" }).click();

  await startQuickTournamentFromModal(page, "Grand-Slam Southpaw");
  await expect(page.getByRole("button", { name: "Enter Match" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resize sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Next Point", exact: true })).toBeVisible();

  for (let index = 0; index < 160; index += 1) {
    if (await page.getByRole("button", { name: "Advance", exact: true }).isVisible().catch(() => false)) {
      break;
    }

    if (await page.getByRole("button", { name: "Encourage" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Encourage" }).click();
    }

    if (await page.getByRole("button", { name: "Open Next Set" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Open Next Set" }).click();
    } else {
      await page.getByRole("button", { name: "Finish Set", exact: true }).click();
    }
  }

  await expect(page.getByRole("button", { name: "Advance", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Advance", exact: true }).click();

  await expect(
    page.getByRole("button", { name: /Enter Match|Start New Session/ })
  ).toBeVisible();
});

test("traps overlay focus and cancels safe dialogs on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const settingsButton = page.getByRole("button", { name: "Preferences", exact: true });
  await settingsButton.click();

  const settingsDialog = page.getByRole("dialog", { name: "Console Preferences" });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByRole("button", { name: "Close settings" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(settingsDialog.getByRole("button", { name: "Open Save Manager" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(settingsDialog.getByRole("button", { name: "Close settings" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(settingsDialog).toHaveCount(0);
  await expect(settingsButton).toBeFocused();

  const quickTournamentButton = page.getByRole("button", { name: "Quick Tournament", exact: true });
  await quickTournamentButton.click();
  const selectionDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(selectionDialog).toBeVisible();
  await expect(selectionDialog.getByRole("button", { name: "Close athlete selection" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(selectionDialog).toHaveCount(0);
  await expect(quickTournamentButton).toBeFocused();

  await startQuickTournamentFromModal(page, seededPlayers[0].player.name);

  const resetRunButton = page.getByRole("button", { name: "Reset Run" });
  await expect(resetRunButton).toBeVisible();
  await resetRunButton.click();

  const confirmDialog = page.getByRole("dialog", { name: "Start a new session?" });
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(confirmDialog.getByRole("button", { name: "Start New Session" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(confirmDialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(confirmDialog).toHaveCount(0);
  await expect(resetRunButton).toBeFocused();
});

test("starts from a direct screen and locks a confirmed career athlete", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Career" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quick Tournament", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preferences", exact: true })).toBeVisible();
  await expect(page.getByText("Court Desk")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start New" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local Setup" })).toBeVisible();
  await expect(page.locator(".start-resume-panel")).toHaveCount(0);
  await expect(page.getByText(/blocking launch modal|confirm this modal selection/)).toHaveCount(0);
  await expect(page.getByText("After first save")).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse All Athletes" })).toHaveCount(0);
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-empty-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-empty-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("button", { name: "Start Career" }).click();
  const careerDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(careerDialog).toBeVisible();
  await expect(page.getByText(/coaching program will commit/)).toBeVisible();
  await expect(careerDialog.getByText(/in this modal|blocking launch modal|confirm this modal selection/)).toHaveCount(0);
  await captureFocusedScreenshot(page, "t099-athlete-lock-dialog-desktop");
  await selectAthleteInSelectionModal(page, "Grand-Slam Southpaw");
  await careerDialog.getByRole("button", { name: "Confirm Career Athlete" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  const confirmedCareerSave = await readActiveSave(page);
  expect(confirmedCareerSave?.career?.program.managedPlayerId).toBe("player-17");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary commands" }).getByRole("button", { name: /Squad/ }).click();
  await expect(page.getByText("Career athlete locked").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Select Athlete" })).toHaveCount(0);

  await requestNewSession(page);
  await page.getByRole("button", { name: "Start New Session" }).click();
  await expect(page.getByRole("button", { name: "Continue Career" })).toBeVisible();
  await expect(page.getByLabel("Saved game summary")).toContainText("Saved Career");
  await expect(page.getByText("Next decision")).toBeVisible();
  await expect(page.getByText("Grand-Slam Southpaw").first()).toBeVisible();
  await expect(page.getByText(/Readiness/).first()).toBeVisible();
  await expect(page.getByLabel("Active save details")).toContainText("Save Health");
  await expect(page.getByRole("navigation", { name: "Primary commands" })).toHaveCount(0);
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-career-save-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-career-save-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: "Quick Tournament", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Pick Your Playstyle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse All Athletes" })).toBeVisible();
  await selectAthleteInSelectionModal(page, "Grand-Slam Southpaw");
  await page.getByRole("dialog", { name: "Pick Your Playstyle" }).getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: "Start tournament and replace career?" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Start tournament and replace career?" })
    .getByRole("button", { name: "Start Tournament" })
    .click();
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  await page.getByRole("textbox", { name: "Career name (optional)", exact: true }).fill("Fresh Career Slot");
  await page.getByRole("button", { name: "Create Empty Career" }).click();
  await expect(page.locator(".save-career-card-active")).toContainText("Fresh Career Slot");
  await page.locator(".save-career-card-active").getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Career" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue Tournament" })).toHaveCount(0);
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-new-slot-desktop");
  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fresh Career Slot" })).toBeVisible();
  await expect(page.getByLabel("Local save library status")).toContainText("Live careers2");
});

test("uses an active-career quick tournament draft only after replacement confirmation", async ({ page }) => {
  const careerPlayer = seededPlayers[0].player;
  const quickDraftPlayer = seededPlayers[1].player;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page, careerPlayer.name);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  await requestNewSession(page);
  await page.getByRole("button", { name: "Start New Session" }).click();
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  const quickDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(quickDialog).toBeVisible();
  await selectAthleteInSelectionModal(page, quickDraftPlayer.name);
  await expect(quickDialog.getByText(quickDraftPlayer.name).first()).toBeVisible();

  await quickDialog.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: "Start tournament and replace career?" })).toBeVisible();

  const careerBeforeReplacement = await readActiveSave(page);
  expect(careerBeforeReplacement?.career?.program.managedPlayerId).toBe(careerPlayer.id);
  expect(careerBeforeReplacement?.selectedPlayerId).toBe(careerPlayer.id);

  await page
    .getByRole("dialog", { name: "Start tournament and replace career?" })
    .getByRole("button", { name: "Start Tournament" })
    .click();
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();

  const quickSaveAfterReplacement = await readActiveSave(page);
  expect(quickSaveAfterReplacement?.career).toBeNull();
  expect(quickSaveAfterReplacement?.selectedPlayerId).toBe(quickDraftPlayer.id);
  expect(quickSaveAfterReplacement?.tournament?.managedPlayerId).toBe(quickDraftPlayer.id);
});

test("can complete and reload the career core slice with tactical viewer proof", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(/Rank #?\d+/);

  await page.getByRole("button", { name: "Training Desk" }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  const rallyBase = page.getByRole("button", { name: /Rally Base/ });
  await rallyBase.click();
  await expect(rallyBase).toHaveAttribute("aria-pressed", "true");
  await captureFocusedScreenshot(page, "version-two-training-scheduled");

  await page.getByRole("button", { name: "Career Home" }).click();
  await captureFocusedScreenshot(page, "version-two-portal-forecast");
  await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();
  await expect(page.getByLabel("Upcoming event schedule").getByText(/\$15,000/)).toBeVisible();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await expect(page.getByRole("button", { name: "Open Event" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(/Career context is now attached/)).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Next Point", exact: true })).toBeVisible();
  await expect(page.getByTestId("tactical-viewer")).toBeVisible();
  await expect(page.getByLabel("Locked match plan")).toContainText("Command Balance");
  await expect(page.getByLabel("Active plan modules")).toContainText("rear court lock");
  await expect(page.getByLabel("Active plan modules")).toContainText("net trap");

  for (let index = 0; index < 180; index += 1) {
    if (await page.getByRole("button", { name: "Advance", exact: true }).isVisible().catch(() => false)) {
      break;
    }

    if (await page.getByRole("button", { name: "Encourage" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Encourage" }).click();
    }

    if (await page.getByRole("button", { name: "Open Next Set" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Open Next Set" }).click();
    } else {
      await page.getByRole("button", { name: "Finish Set", exact: true }).click();
    }
  }

  await page.getByRole("button", { name: "Advance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(page.getByText("Career-aware recap")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rally Pattern Map" })).toBeVisible();
  await expect(page.locator("[data-zone]")).toHaveCount(9);
  await expect(page.getByTestId("tactical-momentum-timeline")).toBeVisible();
  const tacticalViewerSave = await readActiveSave(page);
  expect(tacticalViewerSave?.career?.lastMatchReport?.tacticalViewer?.sequence).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "Training Recommendations" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rally Pattern Map" })).toBeVisible();
  await expect(page.getByText(/Points/).first()).toBeVisible();
  await expect(page.getByText(/Cash/).first()).toBeVisible();
});

test("continues a deterministic career event from post-match into the next round after reload", async ({ page }) => {
  const betweenRounds = createBetweenRoundsCareerSave();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await writeActiveSave(page, betweenRounds.save as PersistedSave);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue To Next Round" })).toBeVisible();
  await captureFocusedScreenshot(page, "post-match-next-round-cta");

  await page.getByRole("button", { name: "Open tournament home for Metro Open" }).click();
  await expect(page.getByRole("heading", { name: "Current Knockout Draw" })).toBeVisible();
  await expect(page.getByLabel("Knockout tree")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match Results And Scoreline Evidence" })).toHaveCount(0);
  await captureFocusedScreenshot(page, "tix-027-active-16-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Current Knockout Draw" })).toBeVisible();
  await captureFocusedScreenshot(page, "tix-027-active-16-mobile");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("main").getByRole("button", { name: "Review Match" }).click();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();

  await page.getByRole("button", { name: "Continue To Next Round" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Advance Day" })).toBeVisible();
  await page.getByRole("button", { name: "Advance Day" }).click();

  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(betweenRounds.nextOpponentName).first()).toBeVisible();
  await page
    .getByLabel("Pre-match briefing status")
    .getByRole("button", { name: betweenRounds.nextOpponentName })
    .click();
  await expect(page.getByRole("heading", { name: betweenRounds.nextOpponentName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scouting Verdict" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How To Beat Them" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  const nextRoundSave = await readActiveSave(page);
  expect(nextRoundSave?.tournament?.currentRoundIndex).toBe(1);
  expect(nextRoundSave?.career?.activeEventId).toBe(betweenRounds.eventId);
  expect(nextRoundSave?.career?.completedEventIds).not.toContain(betweenRounds.eventId);
  expect(nextRoundSave?.career?.lastPreMatchBrief?.opponentId).toBe(betweenRounds.nextOpponentId);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(betweenRounds.nextOpponentName).first()).toBeVisible();
});

test("closes deterministic loss and title post-match CTA branches after reload", async ({ page }) => {
  for (const outcome of ["loss", "title"] as const) {
    const closeout = createPostMatchCloseoutCareerSave(outcome);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await writeActiveSave(page, closeout.save as PersistedSave);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
    await expect(page.getByRole("button", { name: closeout.expectedButton })).toBeVisible();
    await captureFocusedScreenshot(page, `post-match-${outcome}-cta`);

    await page.getByRole("button", { name: closeout.expectedButton }).click();
    await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
    const closedSave = await readActiveSave(page);
    expect(closedSave?.tournament).toBeNull();
    expect(closedSave?.career?.activeEventId).toBeNull();
    expect(closedSave?.career?.stage).toBe("event_complete");
    expect(closedSave?.career?.completedEventIds.filter((eventId) => eventId === closeout.eventId)).toHaveLength(1);
  }
});

test("surfaces completed tournament archive outcomes from complete match records", async ({ page }) => {
  const archive = createCompletedNonManagedArchiveSave();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await writeActiveSave(page, archive.save as PersistedSave);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary commands" }).getByRole("button", { name: /Timeline/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await page.getByRole("tab", { name: "Past Events" }).click();
  await page.getByLabel("Past event records").getByRole("button", { name: `Open tournament home for ${archive.eventName}` }).click();

  await expect(page.getByRole("heading", { name: archive.eventName })).toBeVisible();
  const outcome = page.getByLabel(`${archive.eventName} complete event outcome`);
  await expect(page.getByRole("heading", { name: "Full Event Outcome" })).toBeVisible();
  await expect(outcome).toContainText(archive.championName);
  await expect(outcome).toContainText(archive.runnerUpName);
  await expect(outcome).toContainText(archive.finalScoreline);
  await expect(outcome).toContainText("Reconstructed bracket");
  await expect(outcome).toContainText(`Ranking ledger +${archive.championPoints.toLocaleString()} pts (champion).`);
  await expect(page.getByRole("heading", { name: "Archived Knockout Draw" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match Results And Scoreline Evidence" })).toHaveCount(0);
  await page.getByText("Event Notes").click();
  await expect(page.getByRole("heading", { name: "Scoreline Evidence" })).toBeVisible();
  await expect(page.getByLabel(`${archive.eventName} match result evidence`)).toContainText("Quick simulation");
  await expect(page.getByText("Not archived")).toHaveCount(0);
});

test("surfaces corrupt save recovery and blocks unaffordable event entry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("corrupt-save-seeded")) {
      window.localStorage.setItem("badminton-manager-save", "{not-valid-json");
      window.sessionStorage.setItem("corrupt-save-seeded", "true");
    }
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await expect(page.getByText(/Recovery available/)).toHaveCount(1);
  await expect(page.getByText(/Recovery available/).first()).toBeVisible();
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-recovery-warning-desktop");
  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Legacy save quarantined safely");

  await page.getByRole("button", { name: "Create Empty Career" }).click();
  await page.locator(".save-career-card-active").getByRole("button", { name: "Continue" }).click();
  await startNewCareer(page);
  const cashConstrainedSave = await readActiveSave(page);
  if (!cashConstrainedSave?.career) {
    throw new Error("Expected a career save after creation.");
  }
  cashConstrainedSave.career.economy.cash = 100;
  await writeActiveSave(page, cashConstrainedSave);
  await page.reload();

  await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();
  await expect(page.getByLabel("Upcoming event schedule").getByText(/\$15,000/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Event" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open Event" }).first().click();
  await expect(page.getByRole("heading", { name: "Metro Open" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Insufficient Funds" })).toBeDisabled();
  await expect(page.getByLabel("Metro Open eligibility checks")).toContainText(/Cash \$100; short/);
});

test("keeps first-launch save trust surfaces bounded on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await startQuickTournamentFromModal(page);
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();
  await page.evaluate(() => {
    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const matchup = document.querySelector(".matchup-grid");

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    if (matchup && matchup.scrollWidth > matchup.clientWidth + 1) {
      throw new Error(`Unexpected matchup overflow: ${matchup.scrollWidth} > ${matchup.clientWidth}`);
    }
  });

  await requestNewSession(page);
  await expect(page.getByRole("heading", { name: "Start a new session?" })).toBeVisible();
  const resetCancel = page.getByRole("button", { name: "Cancel" });
  await expect(resetCancel).toBeVisible();
  await expect(resetCancel).toHaveJSProperty("scrollWidth", await resetCancel.evaluate((button) => button.clientWidth));
  await resetCancel.click();

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.location.reload();
  });
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  const commandRail = page.getByRole("navigation", { name: "Primary commands" });
  await expectPrimaryCommandLabels(commandRail);
  await expect(commandRail.getByRole("button", { name: /Portal/ })).toHaveAttribute("aria-current", "page");

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Save Manager/ })).toHaveAttribute("aria-current", "page");
  await expectPrimaryCommandLabels(commandRail);

  await page.locator(".save-career-card-active").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/Archive Career 1\?/);
  const archiveCancel = page.getByRole("alertdialog").getByRole("button", { name: "Cancel" });
  await expect(archiveCancel).toBeVisible();
  await expect(archiveCancel).toHaveJSProperty("scrollWidth", await archiveCancel.evaluate((button) => button.clientWidth));
});

test("exposes the grouped management shell as the primary command surface", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  const commandRail = page.getByRole("navigation", { name: "Primary commands" });
  const sidebar = page.getByRole("complementary", { name: "Primary command sidebar" });

  await expect(sidebar.getByText("BM", { exact: true })).toHaveCount(0);
  await expect(sidebar.getByText("Command Rail")).toHaveCount(0);
  await expect(sidebar.getByText("Local-first career shell")).toHaveCount(0);

  for (const group of ["CORE", "PROGRAM", "MATCH", "OPERATIONS", "SYSTEM"]) {
    await expect(commandRail.getByRole("heading", { name: group })).toBeVisible();
  }

  await expect(commandRail.getByRole("button", { name: /Portal/ })).toHaveAttribute("aria-current", "page");
  await expectPrimaryCommandLabels(commandRail);
  await expect(commandRail.getByRole("button", { name: /^Inbox:/ })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Career Workspace Map" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Career workspace navigation" })).toHaveCount(0);

  await commandRail.getByRole("button", { name: /Training/ }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Training/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Timeline/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveCount(0);
  await expect(page.locator(".schedule-calendar-grid")).toHaveCount(0);
  await expect(commandRail.getByRole("button", { name: /Timeline/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Timeline" })).toHaveCount(0);
  await expect(page.locator(".schedule-calendar-month")).toHaveCount(1);
  await expect(commandRail.getByRole("button", { name: /Calendar/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: "Rankings: Circuit table" }).click();
  await expect(page.getByRole("heading", { name: "Circuit Rankings" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Rankings/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Tactics/ }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Tactics/ })).toHaveAttribute("aria-current", "page");

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Save Manager/ })).toHaveAttribute("aria-current", "page");

  await requestNewSession(page);
  await expect(page.getByRole("heading", { name: "Reset tournament state?" })).toBeVisible();
});

test("routes the Live Match command through career and quick match paths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  const commandRail = page.getByRole("navigation", { name: "Primary commands" });

  await commandRail.getByRole("button", { name: /Live Match/ }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();

  await commandRail.getByRole("button", { name: /Timeline/ }).click();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Live Match/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Timeline/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveCount(0);
  await commandRail.getByRole("button", { name: /Live Match/ }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Next Point", exact: true })).toBeVisible();
  await commandRail.getByRole("button", { name: /Squad/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My Program" })).toBeVisible();
  await commandRail.getByRole("button", { name: /Live Match/ }).click();
  await expect(page.getByRole("button", { name: "Next Point", exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.location.reload();
  });
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();

  await startQuickTournamentFromModal(page);
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();
  const quickCommandRail = page.getByRole("navigation", { name: "Primary commands" });
  await expect(quickCommandRail.getByRole("button", { name: /Live Match/ })).toHaveAttribute("aria-current", "page");
  await quickCommandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await quickCommandRail.getByRole("button", { name: /Live Match/ }).click();
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();
});

test("player profile renders decision-first managed and scouting dossiers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const selectableName = "Grand-Slam Southpaw";
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  const selectionDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(selectionDialog).toBeVisible();
  await selectionDialog.getByRole("button", { name: selectableName, exact: true }).click();
  await expect(page.getByRole("heading", { name: selectableName })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Scouting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scouting Verdict" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select Athlete" }).first()).toBeVisible();
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-selectable-overview-desktop");
  await page.getByRole("button", { name: "Back" }).click();
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.location.reload();
  });
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();

  await startQuickTournamentFromModal(page);
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();

  const managedName = seededPlayers[0].player.name;
  await page.locator(".matchup-competitor-managed .profile-name-button").first().click();
  await expect(page.getByRole("heading", { name: managedName })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Development" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manager Verdict" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Readiness Strip" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tactical Plan" })).toBeVisible();
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-managed-overview-desktop");

  await page.getByRole("tab", { name: "Attributes" }).click();
  await expect(page.getByRole("heading", { name: "Technical" })).toBeVisible();
  await expect(page.getByText(/Field rank #/).first()).toBeVisible();
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-attributes-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-attributes-mobile");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "Performance" }).click();
  await expect(page.getByRole("heading", { name: "Telemetry State" })).toBeVisible();
  await captureFocusedScreenshot(page, "player-profile-performance-empty-desktop");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();
  const opponentButton = page.locator(".matchup-competitor-opponent .profile-name-button").first();
  const opponentName = (await opponentButton.textContent())?.trim();

  if (!opponentName) {
    throw new Error("Expected opponent profile button text.");
  }

  await opponentButton.click();
  await expect(page.getByRole("heading", { name: opponentName })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Scouting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scouting Verdict" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How To Beat Them" })).toBeVisible();
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-opponent-overview-desktop");

  await page.getByRole("tab", { name: "Career" }).click();
  await expect(page.getByRole("heading", { name: "Career Record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rivalries And Head-To-Head" })).toBeVisible();
  await captureFocusedScreenshot(page, "player-profile-career-desktop");

  const visualProfile = createTix030ProfileVisualSave();
  await loadPersistedSave(page, visualProfile.save);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  const visualCommandRail = page.getByRole("navigation", { name: "Primary commands" });
  await visualCommandRail.getByRole("button", { name: /Squad/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My Program" })).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: visualProfile.managedName, exact: true }).click();
  await expect(page.getByRole("heading", { name: visualProfile.managedName })).toBeVisible();

  await page.getByRole("tab", { name: "Performance" }).click();
  await expect(page.getByRole("heading", { name: "Last Match Evidence" })).toBeVisible();
  await expect(page.getByText("Peak smash", { exact: true }).first()).toBeVisible();
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-performance-telemetry-desktop");

  await page.getByRole("tab", { name: "Career" }).click();
  await expect(page.getByRole("heading", { name: "Rivalries And Head-To-Head" })).toBeVisible();
  await expect(page.getByText("Even Rivalry", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: visualProfile.opponentName, exact: true }).first()).toBeVisible();
  await expectProfileViewportBounded(page);
  await captureFocusedScreenshot(page, "player-profile-career-h2h-desktop");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My Program" })).toBeVisible();
  await expect(visualCommandRail.getByRole("button", { name: /Squad/ })).toHaveAttribute("aria-current", "page");
});

test("surfaces dense page contracts and Save Manager metadata", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await expect(page.getByLabel("Portal Home")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Urgent Tasks" })).toBeVisible();
  await expect(page.getByLabel("Portal tasks inbox")).not.toContainText("Save state");
  await expect(page.getByLabel("Portal tasks inbox")).toContainText("Metro Open entry decision");
  await expect(page.getByRole("heading", { name: "Player Condition" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calendar Snapshot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Match Evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Finance Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Program Ecosystem" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Continue" })).toHaveCount(0);

  const commandRail = page.getByRole("navigation", { name: "Primary commands" });

  await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await commandRail.getByRole("button", { name: /Portal/ }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "Training Desk" }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  await commandRail.getByRole("button", { name: /Portal/ }).click();

  await page.getByRole("main").getByRole("button", { name: "Program Hub" }).click();
  await expect(page.getByText(/Scout capacity/)).toBeVisible();
  await commandRail.getByRole("button", { name: /Portal/ }).click();

  await page.getByRole("main").getByRole("button", { name: "Circuit Room" }).click();
  await expect(page.getByRole("heading", { name: "Rival Programs" })).toBeVisible();
  await commandRail.getByRole("button", { name: /Portal/ }).click();

  await page.getByRole("main").getByRole("button", { name: "Match Planning" }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await commandRail.getByRole("button", { name: /Portal/ }).click();

  await commandRail.getByRole("button", { name: /Training/ }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  await expect(page.getByLabel("Training status")).toContainText("Scheduled block");
  await expect(page.getByLabel("Training status")).toContainText("Advance target");

  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await expect(page.locator(".schedule-calendar-month")).toHaveCount(1);
  await expectCompactCalendarMonthContract(page);

  await commandRail.getByRole("button", { name: /Tactics/ }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(page.getByLabel("Match planning status")).toContainText("Advice");
  await expect(page.getByLabel("Match planning status")).toContainText("Next action");

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  const activeCareerCard = page.locator(".save-career-card-active");
  await expect(activeCareerCard).toContainText("Active");
  await expect(activeCareerCard).toContainText("Career");
  await expect(activeCareerCard).toContainText(`Save v${CURRENT_SAVE_VERSION}`);
  await expect(activeCareerCard).toContainText("Verified backups");
  await expect(page.getByRole("heading", { name: "Import as New Career" })).toBeVisible();

  const betweenRounds = createBetweenRoundsCareerSave();
  await writeActiveSave(page, betweenRounds.save as PersistedSave);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(page.getByLabel("Post-match review status")).toContainText("Continue To Next Round");
  await expect(page.getByRole("button", { name: "Continue To Next Round" })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await startQuickTournamentFromModal(page);
  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("heading", { name: "Match Command Center" })).toBeVisible();
  await expect(page.getByLabel("Match controls")).toContainText("Next Point");
  await expect(page.getByLabel("Live match status")).toHaveCount(0);
});

test("integrates fictional calendar ranking stakes into career home and Timeline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByLabel("Next decision consequence summary")).toContainText("Enter Event");
  await expect(page.getByLabel("Next decision consequence summary")).toContainText("+700 pts");
  await expect(page.getByLabel("Next decision consequence summary")).toContainText("$15,000");
  await expect(page.getByLabel("Next decision consequence summary")).toContainText("-$3,550");
  await expect(page.getByText(/Finals gate remains top 8/)).toBeVisible();
  const commandRail = page.getByRole("navigation", { name: "Primary commands" });

  await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Upcoming" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Past Events" })).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manager Commitments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event Brief" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Week Strip" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Milestones & Seeding" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Eligibility & Costs" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Past Events" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Past Events" }).click();
  await expect(page.getByRole("tab", { name: "Past Events" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Past Events" })).toBeVisible();
  await expect(page.getByText(/No past-event records have been written yet/)).toBeVisible();
  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await expect(page.locator(".schedule-calendar-grid").first()).toBeVisible();
  await expect(page.locator(".schedule-calendar-weekdays").first().locator("span")).toHaveCount(7);
  await expect(page.locator(".schedule-calendar-month")).toHaveCount(1);
  await commandRail.getByRole("button", { name: /Timeline/ }).click();
  await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Open Event" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open Event" }).first().click();
  await expect(page.getByRole("heading", { name: "Metro Open" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Summary" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Knockout Draw" })).toBeVisible();
  await expect(page.getByText("Event Notes")).toBeVisible();
  await captureFocusedScreenshot(page, "tix-027-tournament-home-desktop-projected");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Knockout Draw" })).toBeVisible();
  await captureFocusedScreenshot(page, "tix-027-tournament-home-mobile-projected");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByLabel("Metro Open tournament timeline")).toContainText("Ranking cutoff: 2026-05-29");
  await expect(page.getByRole("heading", { name: "Rewards And Stakes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Field And Scouting" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Event" }).click();
  const enteredEventSave = await readActiveSave(page);
  expect(enteredEventSave?.career?.enteredEventIds).toContain("metro-open-300");
});

test("keeps the compact Career Portal bounded across target viewports", async ({ page }) => {
  for (const viewport of [
    { width: 2048, height: 1152, name: "portal-2048x1152", onePage: true },
    { width: 1440, height: 900, name: "portal-1440x900", onePage: false },
    { width: 1366, height: 768, name: "portal-1366x768", onePage: false },
    { width: 390, height: 844, name: "portal-mobile", onePage: false }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/");

    await startNewCareer(page);
    await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Urgent Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Player Condition" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Calendar Snapshot" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Match Evidence" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Finance Summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Program Ecosystem" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Advance Day" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Intel" })).toHaveCount(0);
    await expectTopbarHierarchyAndBounded(page);
    await expectPortalViewportBounded(page, viewport.onePage);
    await captureFocusedScreenshot(page, viewport.name);
    await captureFocusedScreenshot(page, `tix-012-topbar-${viewport.name}`);
  }
});

test("opens the full career Rankings table with managed highlight and bounded mobile layout", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, name: "rankings-1440x900" },
    { width: 390, height: 844, name: "rankings-mobile" }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    await startNewCareer(page);
    const commandRail = page.getByRole("navigation", { name: "Primary commands" });
    await openPrimaryCommand(page, "Rankings: Circuit table");

    await expect(page.getByRole("heading", { name: "Circuit Rankings" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Circuit rankings table" })).toBeVisible();
    await expect(page.locator(".rankings-row:not(.rankings-row-head)")).toHaveCount(8);
    await expect(page.getByText(`1-8 of ${seededPlayers.length}`, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Rankings pagination").getByRole("button", { name: "Prev" })).toBeDisabled();
    await expect(page.getByLabel("Rankings pagination").getByRole("button", { name: "Next" })).toBeEnabled();
    const activeRankingSave = await readActiveSave(page);
    if (!activeRankingSave?.career) {
      throw new Error("Expected active career save.");
    }
    const rankingSnapshot = {
      managedPlayerId: activeRankingSave.career.program.managedPlayerId,
      rankings: [...activeRankingSave.career.rankings]
        .sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId))
        .map((entry) => ({ playerId: entry.playerId, rank: entry.rank }))
    };
    const firstRanking = rankingSnapshot.rankings[0]!;
    const ninthRanking = rankingSnapshot.rankings[8]!;
    const managedRanking = rankingSnapshot.rankings.find(
      (entry) => entry.playerId === rankingSnapshot.managedPlayerId
    )!;
    const firstName = playerMap[firstRanking.playerId].name;
    const ninthName = playerMap[ninthRanking.playerId].name;
    const managedPlayer = playerMap[rankingSnapshot.managedPlayerId];
    const managedPage = Math.floor((managedRanking.rank - 1) / 8);
    const pagination = page.getByLabel("Rankings pagination");

    await expect(page.getByRole("row", { name: new RegExp(`Rank 1 ${escapeRegExp(firstName)}`, "i") })).toContainText("pts");
    for (let pageAdvance = 0; pageAdvance < managedPage; pageAdvance += 1) {
      await pagination.getByRole("button", { name: "Next" }).click();
    }
    const managedRow = page.getByRole("row", {
      name: new RegExp(`Rank ${managedRanking.rank} ${escapeRegExp(managedPlayer.name)} managed athlete`, "i")
    });
    await expect(managedRow).toContainText("Managed athlete");
    await expect(managedRow).toContainText(managedPlayer.nationality);
    await expect(managedRow).toContainText("pts");
    await managedRow.getByRole("button", { name: managedPlayer.name }).click();
    await expect(page.getByRole("heading", { name: managedPlayer.name })).toBeVisible();
    await openPrimaryCommand(page, "Rankings: Circuit table");
    await expect(page.getByRole("heading", { name: "Circuit Rankings" })).toBeVisible();
    for (let pageAdvance = 0; pageAdvance < 6; pageAdvance += 1) {
      const prevButton = pagination.getByRole("button", { name: "Prev" });
      if (await prevButton.isDisabled()) {
        break;
      }
      await prevButton.click();
    }
    await pagination.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(`9-16 of ${seededPlayers.length}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(`Rank 9 ${escapeRegExp(ninthName)}`, "i") })).toBeVisible();
    await pagination.getByRole("button", { name: "Prev" }).click();
    await expect(page.getByRole("row", { name: new RegExp(`Rank 1 ${escapeRegExp(firstName)}`, "i") })).toBeVisible();
    for (let pageAdvance = 0; pageAdvance < 5; pageAdvance += 1) {
      await pagination.getByRole("button", { name: "Next" }).click();
    }
    await expect(page.getByText(`41-${seededPlayers.length} of ${seededPlayers.length}`, { exact: true })).toBeVisible();
    await expect(page.locator(".rankings-row:not(.rankings-row-head)")).toHaveCount(7);
    await expect(page.getByRole("row", { name: /Rank 47/i })).toBeVisible();
    await expect(page.getByLabel("Rankings pagination").getByRole("button", { name: "Next" })).toBeDisabled();
    await expectRankingsViewportBounded(page);
    await captureFocusedScreenshot(page, viewport.name);
  }
});

test("keeps the Timeline and Calendar layouts bounded across target viewports", async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768, name: "calendar-1366x768" },
    { width: 1440, height: 900, name: "calendar-1440x900" },
    { width: 390, height: 844, name: "calendar-mobile" }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    await startNewCareer(page);
    await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Upcoming" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Past Events" })).toHaveAttribute("aria-selected", "false");
    await expectCalendarViewportBounded(page);
    await captureFocusedScreenshot(page, `${viewport.name}-upcoming`);

    await page.getByRole("tab", { name: "Past Events" }).click();
    await expect(page.getByRole("heading", { name: "Past Events" })).toBeVisible();
    await expectCalendarViewportBounded(page);
    await captureFocusedScreenshot(page, `${viewport.name}-past-events`);

    await page.getByRole("tab", { name: "Upcoming" }).click();
    await expect(page.getByRole("heading", { name: "Manager Commitments" })).toBeVisible();
    await expectCalendarViewportBounded(page);

    await openPrimaryCommand(page, /Calendar/);
    await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
    await expect(page.locator(".schedule-calendar-grid").first()).toBeVisible();
    await expect(page.locator(".schedule-calendar-month")).toHaveCount(1);
    await expectCompactCalendarMonthContract(page);
    await expectCalendarViewportBounded(page);
    await captureFocusedScreenshot(page, `${viewport.name}-calendar-grid`);
  }
});

test("manages export, import-as-new, archive, and deletion from the visible Save Manager", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("badminton-manager-save-corrupt", "old-corrupt-backup");
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Career Library" })).toBeVisible();
  await expect(page.locator(".save-career-card-active").getByRole("button", { name: "Continue" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Import as New Career" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Legacy Recovery" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Active JSON" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Expected downloaded save path.");
  }
  const exportedSave = readFileSync(downloadPath, "utf8");

  const beforeInvalid = await page.evaluate(({ activeKey, slotPrefix }) => {
    const activeSlotId = window.localStorage.getItem(activeKey);
    return {
      activeSlotId,
      active: activeSlotId ? window.localStorage.getItem(`${slotPrefix}${activeSlotId}`) : null,
      corrupt: window.localStorage.getItem("badminton-manager-save-corrupt")
    };
  }, {
    activeKey: ACTIVE_SAVE_SLOT_KEY,
    slotPrefix: SAVE_SLOT_PREFIX
  });
  await page.getByLabel("Import save JSON", { exact: true }).fill("{not-json");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("alert")).toContainText("Malformed JSON");
  const afterInvalid = await page.evaluate(({ activeKey, slotPrefix }) => {
    const activeSlotId = window.localStorage.getItem(activeKey);
    return {
      activeSlotId,
      active: activeSlotId ? window.localStorage.getItem(`${slotPrefix}${activeSlotId}`) : null,
      corrupt: window.localStorage.getItem("badminton-manager-save-corrupt")
    };
  }, {
    activeKey: ACTIVE_SAVE_SLOT_KEY,
    slotPrefix: SAVE_SLOT_PREFIX
  });
  expect(afterInvalid).toEqual(beforeInvalid);

  await fillImportSaveJson(page, exportedSave);
  await page.getByLabel("New career name").fill("Imported Proof Career");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText(/Validated and migrated/)).toBeVisible();
  await page.getByRole("button", { name: "Import as New Slot" }).click();
  await expect(page.getByText(/Imported save created as a new active career slot/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Imported Proof Career" })).toBeVisible();
  await expect(page.getByLabel("Local save library status")).toContainText("Live careers2");
  await expect(page.locator(".save-career-card-active")).toContainText("Imported Proof Career");

  const importedActiveSlotId = await page.evaluate((activeKey) => window.localStorage.getItem(activeKey), ACTIVE_SAVE_SLOT_KEY);
  expect(importedActiveSlotId).not.toBe(beforeInvalid.activeSlotId);
  expect(await readActiveSave(page)).not.toBeNull();

  await page.locator(".save-career-card-active").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Archive Imported Proof Career?");
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive Career" }).click();
  await expect(page.getByRole("heading", { name: "Archived careers" })).toBeVisible();
  const archivedCard = page.locator(".save-career-card").filter({ hasText: "Imported Proof Career" });
  await expect(archivedCard).toContainText("Archived");
  await expect(archivedCard.getByRole("button", { name: "Restore Career" })).toBeVisible();

  await archivedCard.getByRole("button", { name: "Permanently Delete" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Permanently delete Imported Proof Career?");
  await page.getByRole("alertdialog").getByRole("button", { name: "Permanently Delete" }).click();
  await expect(page.getByRole("heading", { name: "Imported Proof Career" })).toHaveCount(0);
  if (importedActiveSlotId) {
    expect(await page.evaluate((key) => window.localStorage.getItem(key), `${SAVE_SLOT_PREFIX}${importedActiveSlotId}`)).toBeNull();
  }

  await page.getByRole("button", { name: "Delete Legacy Quarantine Backup" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Legacy Backup" }).click();
  const corruptBackup = await page.evaluate(() => window.localStorage.getItem("badminton-manager-save-corrupt"));
  expect(corruptBackup).toBeNull();
});

test("can run the Phase 2 program ecosystem flow and persist it after reload", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await page.getByRole("button", { name: "Program Hub" }).click();
  await expect(page.getByRole("heading", { name: "Program Ecosystem" })).toBeVisible();
  await expect(page.getByText(/Scout capacity/)).toBeVisible();

  await page.getByRole("button", { name: "Scouting Network" }).click();
  await expect(page.getByRole("heading", { name: "Reduce Uncertainty" })).toBeVisible();
  await page.getByRole("button", { name: "Commission Report" }).first().click();
  await expect(page.getByText(/Assignment pending/).first()).toBeVisible();

  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Scouting Network" }).click();
  await expect(page.getByText(/confidence/).first()).toBeVisible();
  await expect(page.getByText(/verified/).first()).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Recruitment Desk" }).click();
  await expect(page.getByRole("heading", { name: "Offer Flow" })).toBeVisible();
  await page.getByRole("button", { name: /Offer \$[\d,]+/ }).first().click();
  await expect(page.getByText(/Offer accepted/).first()).toBeVisible();
  await expect(page.getByText(/weekly contract/).first()).toBeVisible();

  await page.locator(".sidenav").getByRole("button", { name: "Squad" }).click();
  await expect(page.getByRole("heading", { name: "My Program", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "World Directory" })).toBeVisible();
  const managedLead = page.locator(".program-squad-row-lead");
  await expect(page.getByLabel("Managed athlete")).toContainText(seededPlayers[0].player.name);
  await expect(managedLead.getByText("Managed lead", { exact: true })).toBeVisible();
  await expect(page.getByText("Rotation", { exact: true })).toBeVisible();
  await captureFocusedScreenshot(page, "version-two-my-program-roster");

  await page.locator(".sidenav").getByRole("button", { name: "Portal" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Recruitment Desk" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const recruitedProgramSave = await readActiveSave(page);
  if (!recruitedProgramSave?.career) {
    throw new Error("Expected the recruited program to be persisted.");
  }
  const beforeScheduling = (() => {
    const career = recruitedProgramSave.career;
    const rosterSlot = career.ecosystem.recruitment.roster.find(
      (slot: { athleteId: string }) => slot.athleteId !== career.program.managedPlayerId
    );
    const athlete = career.athletes.find(
      (entry: { playerId: string }) => entry.playerId === rosterSlot?.athleteId
    );

    if (!rosterSlot || !athlete) {
      throw new Error("Expected a recruited rotation athlete in the career save.");
    }

    return {
      athleteId: rosterSlot.athleteId as string,
      cash: career.economy.cash as number,
      readiness: athlete.readiness as number,
      fatigue: athlete.fatigue as number,
      development: athlete.development as Record<string, number>,
      historyLength: career.developmentHistory.length as number
    };
  })();

  await page.getByRole("button", { name: "Schedule Rally Base" }).click();
  await expect(page.getByText(/Rally Base is scheduled .* resolves once on Advance Day/)).toBeVisible();
  await captureFocusedScreenshot(page, "version-two-recruitment-scheduled");
  await expect.poll(async () => {
    const save = await readActiveSave(page);
    return save?.career?.preparationSchedule.some(
      (block) => block.athleteId === beforeScheduling.athleteId && block.planSnapshot.id === "rally-base"
    ) ?? false;
  }).toBe(true);

  const afterSchedulingSave = await readActiveSave(page);
  if (!afterSchedulingSave?.career) {
    throw new Error("Expected the scheduled preparation to persist.");
  }
  const afterScheduling = (() => {
    const career = afterSchedulingSave.career;
    const athlete = career.athletes.find((entry) => entry.playerId === beforeScheduling.athleteId)!;

    return {
      cash: career.economy.cash as number,
      readiness: athlete.readiness as number,
      fatigue: athlete.fatigue as number,
      development: athlete.development as Record<string, number>,
      historyLength: career.developmentHistory.length as number
    };
  })();
  expect(afterScheduling).toEqual({
    cash: beforeScheduling.cash,
    readiness: beforeScheduling.readiness,
    fatigue: beforeScheduling.fatigue,
    development: beforeScheduling.development,
    historyLength: beforeScheduling.historyLength
  });

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Career Home" }).click();
  const portalTasks = page.getByLabel("Portal tasks inbox");
  await expect(portalTasks.getByText("Rotation preparation", { exact: true })).toBeVisible();
  await expect(portalTasks).toContainText("Rally Base resolves on Advance Day");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByLabel("Portal tasks inbox")).toContainText("Rally Base resolves on Advance Day");
  const reloadedPreparationSave = await readActiveSave(page);
  expect(reloadedPreparationSave?.career?.preparationSchedule.some(
    (block) => block.athleteId === beforeScheduling.athleteId
  )).toBe(true);

  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect.poll(async () => {
    const save = await readActiveSave(page);
    const career = save?.career;
    return Boolean(
      career &&
        !career.preparationSchedule.some((block) => block.athleteId === beforeScheduling.athleteId) &&
        career.developmentHistory.some(
          (entry) => entry.athleteId === beforeScheduling.athleteId &&
            entry.kind === "preparation" &&
            entry.planId === "rally-base" &&
            entry.outcome === "completed"
        )
    );
  }).toBe(true);
  const resolvedPreparationSave = await readActiveSave(page);
  if (!resolvedPreparationSave?.career) {
    throw new Error("Expected the resolved preparation to persist.");
  }
  const afterResolution = (() => {
    const career = resolvedPreparationSave.career;
    const athlete = career.athletes.find((entry) => entry.playerId === beforeScheduling.athleteId)!;
    const history = career.developmentHistory.find(
      (entry) => entry.athleteId === beforeScheduling.athleteId && entry.kind === "preparation" && entry.planId === "rally-base"
    );

    return {
      cash: career.economy.cash as number,
      stamina: athlete.development.stamina as number,
      pending: career.preparationSchedule.some(
        (block) => block.athleteId === beforeScheduling.athleteId
      ) as boolean,
      historyOutcome: history?.outcome as string | undefined,
      historyCost: history?.cost as number | undefined
    };
  })();
  expect(afterResolution.pending).toBe(false);
  expect(afterResolution.cash).toBeLessThan(beforeScheduling.cash);
  expect(afterResolution.stamina).toBeGreaterThan(beforeScheduling.development.stamina);
  expect(afterResolution.historyOutcome).toBe("completed");
  expect(afterResolution.historyCost).toBe(1800);

  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Youth Academy" }).click();
  await expect(page.getByRole("heading", { name: "Prospect Pipeline" })).toBeVisible();
  await expect(page.getByText(/Potential unverified/)).toBeVisible();
  await expect(page.getByText(/Daily development resolves once when you Advance Day/)).toBeVisible();
  await page.getByRole("button", { name: "Commission Academy Report" }).click();
  await expect(page.getByRole("heading", { name: "Reduce Uncertainty" })).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Staff Room" }).click();
  await expect(page.getByRole("heading", { name: "Hire Modifiers" })).toBeVisible();
  await expect(page.getByText(/Onboarding fee .* weekly salary/).first()).toBeVisible();
  await page.getByRole("button", { name: /Hire · \$[\d,]+ now/ }).first().click();
  await expect(page.getByText(/Active Modifiers/)).toBeVisible();
  await expect(page.getByText(/Marta Ruiz/)).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Athlete State + Promises" }).click();
  await expect(page.getByRole("heading", { name: "Psychology Desk" })).toBeVisible();
  await expect(page.getByText("Owner: Arya Prakash")).toBeVisible();
  await expect(page.getByText("Reach a quarterfinal within 30 days", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Promise Stamina" }).click();
  const staminaPromise = page.locator("article.program-decision-card").filter({
    hasText: "Improve stamina through the next training block"
  });
  await expect(staminaPromise).toContainText(`Owner: ${seededPlayers[0].player.name}`);
  await staminaPromise.getByRole("button", { name: "Withdraw Promise" }).click();
  await expect(staminaPromise).toContainText("withdrawn");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Athlete State + Promises" }).click();
  await expect(page.getByRole("heading", { name: "Psychology Desk" })).toBeVisible();
  await expect(page.getByText(/withdrawn/).first()).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  const expiringAssignmentSave = await readActiveSave(page);
  if (!expiringAssignmentSave?.career) {
    throw new Error("Expected a persisted career save.");
  }
  expiringAssignmentSave.career.date = "2026-06-25";
  await writeActiveSave(page, expiringAssignmentSave);
  await page.reload();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Scouting Network" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Scouting Network" }).click();
  await expect(page.getByText(/expired/).first()).toBeVisible();
});

test("routes the state-backed Inbox and keeps Reports read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await startNewCareer(page);

  const sidebar = page.locator(".sidenav");
  const savedBefore = JSON.stringify(await readActiveSave(page));

  await sidebar.getByRole("button", { name: /^Inbox:/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Actionable Career Desk" })).toBeVisible();
  const inbox = page.getByLabel("Career inbox items");
  await expect(inbox).toContainText("Metro Open entry decision");
  await inbox.getByRole("button", { name: "Open Event" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Metro Open" })).toBeVisible();

  await sidebar.getByRole("button", { name: /^Reports:/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Institutional Memory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Persisted Archive" })).toBeVisible();
  await expect(page.getByText("Development baseline", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue|Close Event/ })).toHaveCount(0);
  await captureFocusedScreenshot(page, "version-two-reports-archive");

  const savedAfter = JSON.stringify(await readActiveSave(page));
  expect(savedAfter).toBe(savedBefore);
});

test("surfaces dynamic rival pressure and persists the circuit room", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await page.getByRole("button", { name: "Circuit Room" }).first().click();

  await expect(page.getByRole("heading", { name: "Rival Programs" })).toBeVisible();
  await expect(page.getByText("Tokyo Vector Lab", { exact: true })).toBeVisible();
  await expect(page.getByText(/Persistent circuit events/)).toBeVisible();

  await page.getByRole("button", { name: "Sim Rival Day" }).click();
  await expect(page.getByText(/Metro Open/).first()).toBeVisible();
  await expect(page.getByText(/leads the field/).first()).toBeVisible();
  await expect(page.getByText(/Latest selection: .*entered/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.getByRole("button", { name: "Circuit Room" }).first().click();
  await expect(page.getByRole("heading", { name: "Rival Programs" })).toBeVisible();
  await expect(page.getByText(/Metro Open/).first()).toBeVisible();

  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Open Event" }).first().click();
  await expect(page.getByRole("heading", { name: "Metro Open" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Field And Scouting" })).toBeVisible();
  await expect(page.getByText("Top Threat").first()).toBeVisible();
  await expect(page.getByText(/rival programs entered/).first()).toBeVisible();
});

test("can edit advanced tactics and preserve assistant advice overrides", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await page.locator(".sidenav").getByRole("button", { name: /Tactics/ }).click();

  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(page.getByText("Assistant Advice / Override")).toBeVisible();

  await page.locator(".tactic-slider-row", { hasText: "Tempo" }).locator("input").fill("84");
  await page.locator(".tactic-slider-row", { hasText: "Rear-Court Pressure" }).locator("input").fill("90");
  await page.locator(".tactic-slider-row", { hasText: "Risk" }).locator("input").fill("76");
  await page.getByRole("button", { name: /Body Smash/ }).click();

  await expect(page.getByText(/Simulation bridge:/)).toContainText(/high risk|all out attack/);
  await expect(page.getByText(/Winner Pressure/)).toBeVisible();

  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByRole("button", { name: "Applied" })).toBeVisible();

  await page.locator('button:has-text("Override"):not([disabled])').first().click();
  await expect(page.getByRole("button", { name: "Overridden" })).toBeVisible();
  await expect(page.getByText(/Manager override preserved/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.locator(".sidenav").getByRole("button", { name: /Tactics/ }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(page.getByText("Manager override kept Command Balance.", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("main").getByRole("button", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText("Pre-Match Planning Bridge")).toBeVisible();
  await expect(page.getByText("Selected Tactic")).toBeVisible();
  await expect(page.getByText("Command Balance").first()).toBeVisible();
  await expect(page.getByText(/Manager override:/).first()).toBeVisible();
  await expect(page.getByText("Manager override kept Command Balance.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Adjust Match Plan")).toBeVisible();
});

test("can upgrade facilities and resolve sponsor media pressure", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Facilities Upgrades" }).click();

  await expect(page.getByRole("heading", { name: "Facilities Upgrades" })).toBeVisible();
  await page.getByRole("button", { name: "Upgrade Training Hall" }).click();
  await expect(page.getByText("Training Hall level 1 build started")).toBeVisible();
  await expect(page.getByRole("main").getByText(/Training/).first()).toBeVisible();

  await page.getByRole("button", { name: "Upgrade Analytics Lab" }).click();
  await expect(page.getByText("Analytics Lab level 1 build started")).toBeVisible();
  for (let i = 0; i < 6; i += 1) {
    await page.getByRole("button", { name: "Advance Day" }).click();
  }
  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Facilities Upgrades" }).click();
  await expect(page.getByText("Training Hall level 1 construction complete")).toBeVisible();
  await expect(page.getByText("Analytics Lab level 1 construction complete")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Facilities Upgrades" }).click();
  await expect(page.getByText("Analytics Lab level 1 construction complete")).toBeVisible();
  await expect(page.getByText(/Travel cost/)).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Scouting Network" }).click();
  await expect(page.getByText("Cost $3,200 / 1 day(s).").first()).toBeVisible();

  const mediaPressureSave = await readActiveSave(page);
  if (!mediaPressureSave?.career) {
    throw new Error("Expected a career save.");
  }
  mediaPressureSave.career.media.sponsors = mediaPressureSave.career.media.sponsors.map((objective) => ({
      ...objective,
      deadline: "2026-06-20",
      progress: 35,
      status: "active",
      resolutionLog: []
    }));
  mediaPressureSave.career.media.federationObjectives = mediaPressureSave.career.media.federationObjectives.map((objective) => ({
      ...objective,
      deadline: "2026-06-20",
      progress: 50,
      status: "active",
      resolutionLog: []
    }));
  mediaPressureSave.career.lastMatchReport = {
      eventId: "metro-open-300",
      matchId: "managed-r16",
      opponentId: "opponent",
      result: "win",
      scoreline: "21-17 21-19",
      round: "R16",
      pointsDelta: 210,
      cashDelta: 1500,
      fatigueDelta: 8,
      evidence: [],
      recommendations: []
    };
  await writeActiveSave(page, mediaPressureSave);
  await page.reload();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Media Desk" }).click();
  await expect(page.getByRole("heading", { name: "Media / Sponsors / Objectives" })).toBeVisible();
  await expect(page.getByText("Aero String Labs", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resolve Pressure" }).click();

  await expect(page.getByText(/Aero String Labs objective fulfilled/).first()).toBeVisible();
  await expect(page.getByText(/National Federation objective fulfilled/).first()).toBeVisible();
  await expect(page.getByText(/Visible consequences/)).toBeVisible();
});
