import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { seededPlayers, playerMap } from "../game/content/players";
import { createInitialCareerState } from "../game/career/state";
import { getCareerEvent } from "../game/career/events";
import type { MatchResult, Side } from "../game/core/models";
import { advanceTournament, createTournament, getManagedMatchContext } from "../game/tournament/tournament";

const expectedPrimaryCommandLabels = [
  "Portal",
  "Inbox",
  "Squad",
  "Training",
  "Calendar",
  "Rankings",
  "Tactics",
  "Live Match",
  "Reports",
  "Scouting",
  "Staff",
  "Facilities",
  "Save Manager",
  "Settings"
];

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
    version: 9,
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
    version: 9,
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

async function expectCalendarViewportBounded(page: Page) {
  await page.evaluate(() => {
    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected Calendar document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const checkedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".calendar-subnav, .calendar-status-strip, .calendar-event-row, .calendar-secondary-grid, .career-week-strip"
      )
    );

    for (const element of checkedElements) {
      if (element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected Calendar element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }
  });
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
        ".rankings-status-strip, .rankings-table, .rankings-row, .rankings-summary-grid"
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
        ".career-status-strip-compact, .career-dashboard-grid-compact, .career-week-strip-compact, .career-ecosystem-strip-compact, .management-table-compact, .career-ledger-compact"
      )
    );

    for (const element of checkedElements) {
      const mobileTimelineOverflow =
        viewportWidth <= 780 && element.classList.contains("career-week-strip-compact");

      if (!mobileTimelineOverflow && element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected Portal element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
      }
    }

    const compactTextElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".career-week-strip-compact .career-day strong, .career-ecosystem-strip-compact .career-system-tile strong, .career-ecosystem-strip-compact .career-system-tile small, .career-status-strip-compact strong"
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
    const athlete = topbar.querySelector<HTMLElement>(".topbar-athlete-chip");
    const search = topbar.querySelector<HTMLElement>(".command-search");
    const dailyCluster = topbar.querySelector<HTMLElement>(".topbar-daily-cluster");
    const date = topbar.querySelector<HTMLElement>(".topbar-date");
    const dailyAction = topbar.querySelector<HTMLElement>(".topbar-continue");
    const saveStatus = topbar.querySelector<HTMLElement>(".topbar-save-status span");
    const settings = topbar.querySelector<HTMLButtonElement>(".topbar-actions button");

    if (!brand || !athlete || !search || !dailyCluster || !date || !dailyAction || !saveStatus || !settings) {
      throw new Error("Expected complete topbar identity, clock, save, and settings controls.");
    }

    if (brand.nextElementSibling !== athlete || athlete.nextElementSibling !== search) {
      throw new Error("Expected managed athlete directly between BM and command search.");
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

    const dateFontSize = Number.parseFloat(window.getComputedStyle(date).fontSize);
    const actionFontSize = Number.parseFloat(window.getComputedStyle(dailyAction).fontSize);
    const saveFontSize = Number.parseFloat(window.getComputedStyle(saveStatus).fontSize);

    if (dateFontSize <= saveFontSize || actionFontSize <= saveFontSize) {
      throw new Error(
        `Expected date/action font size to exceed save status: date ${dateFontSize}, action ${actionFontSize}, save ${saveFontSize}`
      );
    }

    const pageWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (pageWidth > viewportWidth + 1) {
      throw new Error(`Unexpected topbar document overflow: ${pageWidth} > ${viewportWidth}`);
    }

    const checkedElements = [
      topbar,
      topbar.querySelector<HTMLElement>(".topbar-brand-block"),
      dailyCluster,
      topbar.querySelector<HTMLElement>(".topbar-actions")
    ];

    for (const element of checkedElements) {
      if (element && element.scrollWidth > element.clientWidth + 1) {
        const label = element.className || element.tagName;
        throw new Error(`Unexpected topbar element overflow for ${label}: ${element.scrollWidth} > ${element.clientWidth}`);
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
    await page
      .getByRole("navigation", { name: "Primary commands" })
      .getByRole("button", { name: /Save Manager/ })
      .click();
    return;
  }

  await page.getByRole("button", { name: "Save Tools" }).click();
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
  await expect(page.getByText("Endurance").first()).toBeVisible();
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

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected career save.");
    }

    const save = JSON.parse(raw);
    if (save.career.program.managedPlayerId !== "player-17") {
      throw new Error(`Expected locked player-17, received ${save.career.program.managedPlayerId}`);
    }
  });

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
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await page.getByRole("button", { name: "Start New Career" }).click();
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue Tournament" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue Tournament" })).toBeVisible();
  await expect(page.getByLabel("Saved game summary")).toContainText("Saved Tournament");
  await expect(page.getByRole("heading", { name: "Resume Career" })).toHaveCount(0);
  await expect(page.getByText("Grand-Slam Southpaw").first()).toBeVisible();
  await expectLaunchViewportBounded(page);
  await captureFocusedScreenshot(page, "start-quick-save-desktop");
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

  await page.evaluate((expectedCareerPlayerId) => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected active career save before replacement.");
    }

    const save = JSON.parse(raw);
    if (save.career?.program.managedPlayerId !== expectedCareerPlayerId) {
      throw new Error(
        `Expected career save to remain ${expectedCareerPlayerId}, received ${save.career?.program.managedPlayerId}`
      );
    }
    if (save.selectedPlayerId !== expectedCareerPlayerId) {
      throw new Error(
        `Expected selected player in career save to remain ${expectedCareerPlayerId}, received ${save.selectedPlayerId}`
      );
    }
  }, careerPlayer.id);

  await page
    .getByRole("dialog", { name: "Start tournament and replace career?" })
    .getByRole("button", { name: "Start Tournament" })
    .click();
  await expect(page.getByRole("heading", { name: "Next Opponent" })).toBeVisible();

  await page.evaluate((expectedQuickDraftPlayerId) => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected replacement quick tournament save.");
    }

    const save = JSON.parse(raw);
    if (save.career !== null) {
      throw new Error("Expected quick tournament replacement to clear the career save.");
    }
    if (save.selectedPlayerId !== expectedQuickDraftPlayerId) {
      throw new Error(
        `Expected quick draft selected player ${expectedQuickDraftPlayerId}, received ${save.selectedPlayerId}`
      );
    }
    if (save.tournament?.managedPlayerId !== expectedQuickDraftPlayerId) {
      throw new Error(
        `Expected tournament managed player ${expectedQuickDraftPlayerId}, received ${save.tournament?.managedPlayerId}`
      );
    }
  }, quickDraftPlayer.id);
});

test("can complete and reload the career core slice with tactical viewer proof", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(/Rank 1/);

  await page.getByRole("button", { name: "Training Desk" }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  const rallyBase = page.getByRole("button", { name: /Rally Base/ });
  await rallyBase.click();
  await expect(rallyBase).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText(/prize \$15,000/)).toBeVisible();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await expect(page.getByRole("button", { name: "Open Event" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(/Career context is now attached/)).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Next Point", exact: true })).toBeVisible();
  await expect(page.getByTestId("tactical-viewer")).toBeVisible();

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
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected a persisted career save.");
    }

    const save = JSON.parse(raw);
    if (!save.career.lastMatchReport?.tacticalViewer || save.career.lastMatchReport.tacticalViewer.sequence < 1) {
      throw new Error("Expected persisted tactical viewer evidence.");
    }
  });
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
  await page.evaluate((payload) => {
    window.localStorage.setItem("badminton-manager-save", JSON.stringify(payload.save));
  }, betweenRounds);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue To Next Round" })).toBeVisible();
  await captureFocusedScreenshot(page, "post-match-next-round-cta");

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
  await expect(page.getByRole("heading", { name: "Coach Report" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await page.evaluate((payload) => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected active save.");
    }

    const save = JSON.parse(raw);
    if (!save.tournament || save.tournament.currentRoundIndex !== 1) {
      throw new Error("Expected next-round tournament to remain active.");
    }

    if (save.career.activeEventId !== payload.eventId) {
      throw new Error("Expected active event to survive non-final continue.");
    }

    if (save.career.completedEventIds.includes(payload.eventId)) {
      throw new Error("Expected non-final win to avoid event completion.");
    }

    if (save.career.lastPreMatchBrief?.opponentId !== payload.nextOpponentId) {
      throw new Error("Expected next managed opponent briefing after continue.");
    }
  }, betweenRounds);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(betweenRounds.nextOpponentName).first()).toBeVisible();
});

test("closes deterministic loss and title post-match CTA branches after reload", async ({ page }) => {
  for (const outcome of ["loss", "title"] as const) {
    const closeout = createPostMatchCloseoutCareerSave(outcome);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.evaluate((payload) => {
      window.localStorage.setItem("badminton-manager-save", JSON.stringify(payload.save));
    }, closeout);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
    await expect(page.getByRole("button", { name: closeout.expectedButton })).toBeVisible();
    await captureFocusedScreenshot(page, `post-match-${outcome}-cta`);

    await page.getByRole("button", { name: closeout.expectedButton }).click();
    await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
    await page.evaluate((payload) => {
      const raw = window.localStorage.getItem("badminton-manager-save");
      if (!raw) {
        throw new Error("Expected active save after closeout.");
      }

      const save = JSON.parse(raw);
      const completedCount = save.career.completedEventIds.filter((eventId: string) => eventId === payload.eventId).length;

      if (save.tournament !== null) {
        throw new Error("Expected closeout continue to clear active tournament.");
      }

      if (save.career.activeEventId !== null || save.career.stage !== "event_complete") {
        throw new Error("Expected closeout continue to clear active event.");
      }

      if (completedCount !== 1) {
        throw new Error("Expected closeout continue to preserve exactly one event completion.");
      }
    }, closeout);
  }
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
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(page.getByText(/Quarantine present|Recovery available/).first()).toBeVisible();

  await page.getByRole("button", { name: "Start New Career" }).click();
  await startNewCareer(page);
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected a career save after creation.");
    }

    const save = JSON.parse(raw);
    save.career.economy.cash = 100;
    window.localStorage.setItem("badminton-manager-save", JSON.stringify(save));
  });
  await page.reload();

  await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText(/prize \$15,000/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Save Manager/ })).toHaveAttribute("aria-current", "page");
  await expectPrimaryCommandLabels(commandRail);

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: "Start tournament and replace career?" })).toBeVisible();
  const overwriteCancel = page.getByRole("button", { name: "Cancel" });
  await expect(overwriteCancel).toBeVisible();
  await expect(overwriteCancel).toHaveJSProperty("scrollWidth", await overwriteCancel.evaluate((button) => button.clientWidth));
});

test("exposes the grouped management shell as the primary command surface", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  const commandRail = page.getByRole("navigation", { name: "Primary commands" });

  for (const group of ["Core", "Program", "Match", "Operations", "System"]) {
    await expect(commandRail.getByRole("heading", { name: group })).toBeVisible();
  }

  await expect(commandRail.getByRole("button", { name: /Portal/ })).toHaveAttribute("aria-current", "page");
  await expectPrimaryCommandLabels(commandRail);
  await expect(commandRail.getByRole("button", { name: /Inbox preview/ })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Career Workspace Map" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Career workspace navigation" })).toHaveCount(0);

  await commandRail.getByRole("button", { name: /Training/ }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Training/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Calendar/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: "Rankings: Circuit table" }).click();
  await expect(page.getByRole("heading", { name: "Circuit Rankings" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Rankings/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Tactics/ }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Tactics/ })).toHaveAttribute("aria-current", "page");

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
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

  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(commandRail.getByRole("button", { name: /Live Match/ })).toHaveAttribute("aria-current", "page");

  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await commandRail.getByRole("button", { name: /Live Match/ }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Next Point", exact: true })).toBeVisible();
  await commandRail.getByRole("button", { name: /Squad/ }).click();
  await expect(page.getByRole("heading", { name: "Athlete Directory" })).toBeVisible();
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

test("surfaces dense page contracts and Save Manager metadata", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await expect(page.getByLabel("Portal Home")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tasks / Inbox" })).toBeVisible();
  await expect(page.getByLabel("Portal tasks inbox")).toContainText("Save state");
  await expect(page.getByRole("heading", { name: "Calendar Snapshot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Match Evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Program Ecosystem" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Continue" })).toHaveCount(0);

  const commandRail = page.getByRole("navigation", { name: "Primary commands" });

  await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
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
  await expect(page.getByLabel("Training status")).toContainText("Selected block");
  await expect(page.getByLabel("Training status")).toContainText("Next action");

  await commandRail.getByRole("button", { name: /Calendar/ }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByLabel("Calendar status")).toContainText("Active event");
  await expect(page.getByLabel("Calendar status")).toContainText("Next match/draw/deadline");

  await commandRail.getByRole("button", { name: /Tactics/ }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(page.getByLabel("Match planning status")).toContainText("Advice");
  await expect(page.getByLabel("Match planning status")).toContainText("Next action");

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(page.getByLabel("Active save slot metadata")).toContainText("Active local slot");
  await expect(page.getByLabel("Active save slot metadata")).toContainText("Managed athlete");
  await expect(page.getByLabel("Active save slot metadata")).toContainText("Save version");
  await expect(page.getByRole("heading", { name: "Danger Zone" })).toBeVisible();

  const betweenRounds = createBetweenRoundsCareerSave();
  await page.evaluate((payload) => {
    window.localStorage.setItem("badminton-manager-save", JSON.stringify(payload.save));
  }, betweenRounds);
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

test("integrates fictional calendar ranking stakes into career home and Calendar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByLabel("Next event stakes summary")).toContainText("Entry clear");
  await expect(page.getByLabel("Next event stakes summary")).toContainText("Cutoff");
  await expect(page.getByLabel("Next event stakes summary")).toContainText("Champion points 700 pts");
  await expect(page.getByText(/fictional simplified circuit list/)).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Upcoming" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Past Events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule Brief" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();
  await expect(page.getByText(/Entry deadline 2026-06-01, draw milestone 2026-06-02/)).toBeVisible();
  await expect(page.getByText(/Champion prize \$15,000/)).toBeVisible();
  await expect(page.getByText(/Seed Snapshot/).first()).toBeVisible();
  await expect(page.getByLabel("Metro Open active milestones")).toContainText("Ranking cutoff: 2026-05-29");
  await expect(page.getByLabel("Metro Open active milestones")).toContainText("Draw published: 2026-06-02");
  await expect(page.getByText(/presentation, not full draw-engine replacement/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simplification Boundary" })).toBeVisible();
  await expect(page.getByText(/playable match bridge remains the existing deterministic 16-player knockout/)).toBeVisible();
  await page.getByRole("tab", { name: "Past Events" }).click();
  await expect(page.getByRole("heading", { name: "Past Events" })).toBeVisible();
  await expect(page.getByText(/No past-event records have been written yet/)).toBeVisible();
  await page.getByRole("tab", { name: "Upcoming" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Open Event" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open Event" }).first().click();
  await expect(page.getByRole("heading", { name: "Metro Open" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Knockout Draw" })).toBeVisible();
  await expect(page.getByLabel("Metro Open tournament timeline")).toContainText("Ranking cutoff: 2026-05-29");
  await expect(page.getByRole("heading", { name: "Rewards And Stakes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Field And Scouting" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Event" }).click();
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected a persisted career save.");
    }

    const save = JSON.parse(raw);
    if (!save.career.enteredEventIds.includes("metro-open-300")) {
      throw new Error("Expected Metro Open entry to persist.");
    }
  });
});

test("keeps the compact Career Portal bounded across target viewports", async ({ page }) => {
  for (const viewport of [
    { width: 2048, height: 1152, name: "portal-2048x1152", onePage: true },
    { width: 1440, height: 900, name: "portal-1440x900", onePage: true },
    { width: 1366, height: 768, name: "portal-1366x768", onePage: true },
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
    await expect(page.getByRole("heading", { name: "Tasks / Inbox" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Calendar Snapshot" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Match Evidence" })).toBeVisible();
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
    await commandRail.getByRole("button", { name: "Rankings: Circuit table" }).click();

    await expect(page.getByRole("heading", { name: "Circuit Rankings" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Circuit rankings table" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Rank 1 Adrian Koh managed athlete/i })).toContainText("Managed athlete");
    await expect(page.getByRole("row", { name: /Rank 1 Adrian Koh managed athlete/i })).toContainText("SGP");
    await expect(page.getByRole("row", { name: /Rank 1 Adrian Koh managed athlete/i })).toContainText("pts");
    await page.getByRole("row", { name: /Rank 1 Adrian Koh managed athlete/i }).getByRole("button", { name: "Adrian Koh" }).click();
    await expect(page.getByRole("heading", { name: "Adrian Koh" })).toBeVisible();
    await commandRail.getByRole("button", { name: "Rankings: Circuit table" }).click();
    await expect(page.getByRole("heading", { name: "Circuit Rankings" })).toBeVisible();
    await expectRankingsViewportBounded(page);
    await captureFocusedScreenshot(page, viewport.name);
  }
});

test("keeps the Calendar layout bounded across target viewports", async ({ page }) => {
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
    await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming Event Schedule" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Past Events" })).toBeVisible();
    await expectCalendarViewportBounded(page);
    await captureFocusedScreenshot(page, `${viewport.name}-upcoming`);

    await page.getByRole("tab", { name: "Past Events" }).click();
    await expect(page.getByRole("heading", { name: "Past Events" })).toBeVisible();
    await expectCalendarViewportBounded(page);
    await captureFocusedScreenshot(page, `${viewport.name}-past-events`);
  }
});

test("manages export import delete and overwrite warnings from the visible Save Manager", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("badminton-manager-save-corrupt", "old-corrupt-backup");
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await startNewCareer(page);
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Continue Career" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Import Save" })).toBeVisible();
  await expect(page.getByText(/Quarantine present/).first()).toBeVisible();

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: "Start tournament and replace career?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Start New Career" }).click();
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await page.getByRole("button", { name: "Start Career" }).click();
  const replacementDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(replacementDialog).toBeVisible();
  await selectAthleteInSelectionModal(page, seededPlayers[0].player.name);
  await replacementDialog.getByRole("button", { name: "Confirm Career Athlete" }).click();
  await expect(page.getByRole("heading", { name: "Start a new career?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await openSaveManager(page);
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Expected downloaded save path.");
  }
  const exportedSave = readFileSync(downloadPath, "utf8");

  const beforeInvalid = await page.evaluate(() => ({
    active: window.localStorage.getItem("badminton-manager-save"),
    corrupt: window.localStorage.getItem("badminton-manager-save-corrupt")
  }));
  await page.getByLabel("Import Save JSON", { exact: true }).fill("{not-json");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("alert")).toContainText("Malformed JSON");
  const afterInvalid = await page.evaluate(() => ({
    active: window.localStorage.getItem("badminton-manager-save"),
    corrupt: window.localStorage.getItem("badminton-manager-save-corrupt")
  }));
  expect(afterInvalid).toEqual(beforeInvalid);

  await page.getByRole("button", { name: "Delete Active Local Save" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();
  await page.evaluate(() => {
    if (window.localStorage.getItem("badminton-manager-save") !== null) {
      throw new Error("Expected active save to be deleted.");
    }
  });

  await openSaveManager(page);
  await page.getByLabel("Import Save JSON", { exact: true }).fill(exportedSave);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByText(/Import parsed, validated, and migrated/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm Import" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw || !JSON.parse(raw).career) {
      throw new Error("Expected imported career save.");
    }
  });

  await openSaveManager(page);
  await page.getByRole("button", { name: "Delete Quarantined Save" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.evaluate(() => {
    if (window.localStorage.getItem("badminton-manager-save-corrupt") !== null) {
      throw new Error("Expected corrupt backup to be deleted.");
    }
  });
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
  await page.getByRole("button", { name: "Make Offer" }).first().click();
  await expect(page.getByText(/Offer accepted/).first()).toBeVisible();
  await expect(page.getByText(/weekly contract/).first()).toBeVisible();
  await page.getByRole("button", { name: "Train Athlete" }).click();
  await page.getByRole("button", { name: "Enter Lower Event" }).click();
  await expect(page.getByText(/Circuit Futures Invitational/)).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Youth Academy" }).click();
  await expect(page.getByRole("heading", { name: "Prospect Pipeline" })).toBeVisible();
  await page.getByRole("button", { name: "Run Development Block" }).click();
  await page.getByRole("button", { name: "Run Development Block" }).click();
  await expect(page.getByText(/Eligible/)).toBeVisible();
  await page.getByRole("button", { name: "Enter Lower Event" }).click();
  await expect(page.getByText(/National Junior Futures/)).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Staff Room" }).click();
  await expect(page.getByRole("heading", { name: "Hire Modifiers" })).toBeVisible();
  await page.getByRole("button", { name: "Hire Staff" }).first().click();
  await expect(page.getByText(/Active Modifiers/)).toBeVisible();
  await expect(page.getByText(/Marta Ruiz/)).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Athlete State + Promises" }).click();
  await expect(page.getByRole("heading", { name: "Psychology Desk" })).toBeVisible();
  await expect(page.getByText("Owner: Arya Prakash")).toBeVisible();
  await expect(page.getByText(/kept/).first()).toBeVisible();
  await page.getByRole("button", { name: "Promise Stamina" }).click();
  await expect(page.getByText(/Promise created/).first()).toBeVisible();
  await page.getByRole("button", { name: "Withdraw Promise" }).first().click();
  await expect(page.getByText(/withdrawn/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Athlete State + Promises" }).click();
  await expect(page.getByRole("heading", { name: "Psychology Desk" })).toBeVisible();
  await expect(page.getByText(/withdrawn/).first()).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Recruitment Desk" }).click();
  await expect(page.getByText(/Circuit Futures Invitational/)).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected a persisted career save.");
    }

    const save = JSON.parse(raw);
    save.career.date = "2026-06-25";
    window.localStorage.setItem("badminton-manager-save", JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Scouting Network" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Scouting Network" }).click();
  await expect(page.getByText(/expired/).first()).toBeVisible();
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
  await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
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
  await page.getByRole("main").getByRole("button", { name: "Calendar" }).click();
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

  await page.evaluate(() => {
    const raw = window.localStorage.getItem("badminton-manager-save");
    if (!raw) {
      throw new Error("Expected a career save.");
    }

    const save = JSON.parse(raw);
    save.career.media.sponsors = save.career.media.sponsors.map((objective: any) => ({
      ...objective,
      deadline: "2026-06-20",
      progress: 35,
      status: "active",
      resolutionLog: []
    }));
    save.career.media.federationObjectives = save.career.media.federationObjectives.map((objective: any) => ({
      ...objective,
      deadline: "2026-06-20",
      progress: 50,
      status: "active",
      resolutionLog: []
    }));
    save.career.lastMatchReport = {
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
    window.localStorage.setItem("badminton-manager-save", JSON.stringify(save));
  });
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
