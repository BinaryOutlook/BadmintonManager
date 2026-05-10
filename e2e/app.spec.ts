import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("can start a tournament run and play through a managed match", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Choose The Run" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Tournament" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Career" })).toBeVisible();

  await page.getByRole("button", { name: "Grand-Slam Southpaw", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Grand-Slam Southpaw" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Attributes" })).toBeVisible();
  await expect(page.getByText("Endurance").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Resize sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();

  await page.getByRole("banner").getByRole("button", { name: "SETTINGS" }).click();
  await expect(page.getByRole("heading", { name: "Console Preferences" })).toBeVisible();
  await page.getByRole("button", { name: "Cyan Cool tactical display accent." }).click();
  await expect(page.getByRole("button", { name: "Cyan Cool tactical display accent." })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Back" }).click();

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("button", { name: "Enter Match" })).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Simulate Next Point" })).toBeVisible();

  for (let index = 0; index < 160; index += 1) {
    if (await page.getByRole("button", { name: "Advance Bracket" }).isVisible().catch(() => false)) {
      break;
    }

    if (await page.getByRole("button", { name: "Encourage" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Encourage" }).click();
    }

    if (await page.getByRole("button", { name: "Open Next Set" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Open Next Set" }).click();
    } else {
      await page.getByRole("button", { name: "Simulate Next Point" }).click();
    }
  }

  await expect(page.getByRole("button", { name: "Advance Bracket" })).toBeVisible();
  await page.getByRole("button", { name: "Advance Bracket" }).click();

  await expect(
    page.getByRole("button", { name: /Enter Match|Start New Session/ })
  ).toBeVisible();
});

test("can complete and reload the career core slice with tactical viewer proof", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start Career" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByText(/Rank/).first()).toBeVisible();

  await page.getByRole("button", { name: "Training Desk" }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  const rallyBase = page.getByRole("button", { name: /Rally Base/ });
  await rallyBase.click();
  await expect(rallyBase).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Event Desk" }).click();
  await expect(page.getByRole("heading", { name: "Calendar / Event Desk" })).toBeVisible();
  await expect(page.getByText(/prize \$15,000/)).toBeVisible();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await expect(page.getByRole("button", { name: "Entered" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(/Career context is now attached/)).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Simulate Next Point" })).toBeVisible();
  await expect(page.getByTestId("tactical-viewer")).toBeVisible();

  for (let index = 0; index < 180; index += 1) {
    if (await page.getByRole("button", { name: "Advance Bracket" }).isVisible().catch(() => false)) {
      break;
    }

    if (await page.getByRole("button", { name: "Encourage" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Encourage" }).click();
    }

    if (await page.getByRole("button", { name: "Open Next Set" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Open Next Set" }).click();
    } else {
      await page.getByRole("button", { name: "Simulate Next Point" }).click();
    }
  }

  await page.getByRole("button", { name: "Advance Bracket" }).click();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(page.getByText("Career-aware recap")).toBeVisible();
  await expect(page.getByRole("heading", { name: "2D Tactical Viewer" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "2D Tactical Viewer" })).toBeVisible();
  await expect(page.getByText(/Points/).first()).toBeVisible();
  await expect(page.getByText(/Cash/).first()).toBeVisible();
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

  await page.getByRole("button", { name: "SAVE_MANAGER" }).click();
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(page.getByText(/Quarantine present/).first()).toBeVisible();

  await page.getByRole("button", { name: "Start New Career" }).click();
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

  await page.getByRole("button", { name: "Event Desk" }).click();
  await expect(page.getByRole("heading", { name: "Calendar / Event Desk" })).toBeVisible();
  await expect(page.getByText(/prize \$15,000/)).toBeVisible();
  await expect(page.getByText(/Insufficient funds: program cash \$100/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Insufficient Funds" }).first()).toBeDisabled();
});

test("keeps first-launch save trust surfaces bounded on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start Tournament" }).click();
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

  await page.getByRole("banner").getByRole("button", { name: "SETTINGS" }).click();
  await page.getByRole("button", { name: "New Session" }).click();
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
  await expect(page.getByRole("heading", { name: "Choose The Run" })).toBeVisible();
  await page.getByRole("button", { name: "Start Career" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  const topNav = page.getByRole("navigation", { name: "Primary" });
  await expect(topNav.getByRole("button", { name: "CAREER" })).toHaveAttribute("aria-current", "page");
  await expect(topNav.getByRole("button", { name: "BRACKETS" })).not.toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "SAVE_MANAGER" }).click();
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(topNav.getByRole("button", { name: "SAVES" })).toHaveAttribute("aria-current", "page");
  await expect(topNav.getByRole("button", { name: "BRACKETS" })).not.toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: "Start tournament and replace career?" })).toBeVisible();
  const overwriteCancel = page.getByRole("button", { name: "Cancel" });
  await expect(overwriteCancel).toBeVisible();
  await expect(overwriteCancel).toHaveJSProperty("scrollWidth", await overwriteCancel.evaluate((button) => button.clientWidth));
});

test("exposes the career workspace route shell and in-page management map", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start Career" }).click();
  const routeChrome = page.getByRole("region", { name: "Career workspace navigation" });
  const routeFamily = routeChrome.getByRole("group", { name: "Career route family" });
  const workspaceMap = page.locator(".career-workspace-map");

  await expect(routeChrome).toContainText("Career Home");
  await expect(routeFamily.getByRole("button", { name: "Career route home" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Career Workspace Map" })).toBeVisible();
  await expect(workspaceMap.getByRole("button", { name: "Career map training workspace" })).toContainText("Training Desk");
  await expect(workspaceMap.getByRole("button", { name: "Career map calendar workspace" })).toContainText(
    "Calendar / Event Desk"
  );
  await expect(workspaceMap.getByRole("button", { name: "Career map match planning workspace" })).toContainText(
    "Match Planning"
  );
  await expect(workspaceMap.getByRole("button", { name: "Career map live match workspace" })).toContainText("Live Match");
  await expect(workspaceMap.getByRole("button", { name: "Career map post match review workspace" })).toContainText(
    "Post-Match Review"
  );
  await expect(workspaceMap.getByRole("button", { name: "Career map save manager workspace" })).toContainText(
    "Save Manager"
  );
  await expect(workspaceMap.getByRole("button", { name: "Career map reset new session action" })).toContainText(
    "Reset / New Session"
  );

  await workspaceMap.getByRole("button", { name: "Career map training workspace" }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  await expect(routeFamily.getByRole("button", { name: "Career route training" })).toHaveAttribute("aria-current", "page");

  await routeFamily.getByRole("button", { name: "Career route calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar / Event Desk" })).toBeVisible();
  await expect(routeFamily.getByRole("button", { name: "Career route calendar" })).toHaveAttribute("aria-current", "page");

  await routeFamily.getByRole("button", { name: "Career route matchPlanning" }).click();
  await expect(page.getByRole("heading", { name: "Advanced Tactics Creator" })).toBeVisible();
  await expect(routeFamily.getByRole("button", { name: "Career route matchPlanning" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await routeFamily.getByRole("button", { name: "Career route postMatch" }).click();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
  await expect(routeFamily.getByRole("button", { name: "Career route postMatch" })).toHaveAttribute("aria-current", "page");

  await routeFamily.getByRole("button", { name: "Career route saveManager" }).click();
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(routeFamily.getByRole("button", { name: "Career route saveManager" })).toHaveAttribute("aria-current", "page");

  await routeChrome.getByRole("button", { name: "New Session" }).click();
  await expect(page.getByRole("heading", { name: "Reset tournament state?" })).toBeVisible();
});

test("integrates fictional calendar ranking stakes into career home and event desk", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start Career" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByLabel("Next event stakes summary")).toContainText("Entry gate clear");
  await expect(page.getByLabel("Next event stakes summary")).toContainText("Ranking Cutoff");
  await expect(page.getByLabel("Next event stakes summary")).toContainText("Champion points 700 pts");
  await expect(page.getByText(/fictional simplified circuit list/)).toBeVisible();

  await page.getByRole("button", { name: "Event Desk" }).click();
  await expect(page.getByRole("heading", { name: "Calendar / Event Desk" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event Desk Brief" })).toBeVisible();
  await expect(page.getByText(/Entry deadline 2026-06-01, draw milestone 2026-06-02/)).toBeVisible();
  await expect(page.getByText(/Champion prize \$15,000/)).toBeVisible();
  await expect(page.getByText(/Seed Snapshot/).first()).toBeVisible();
  await expect(page.getByLabel("Metro Open deadline milestones")).toContainText("Ranking cutoff: 2026-05-29");
  await expect(page.getByLabel("Metro Open deadline milestones")).toContainText("Draw published: 2026-06-02");
  await expect(page.getByText(/presentation, not full draw-engine replacement/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simplification Boundary" })).toBeVisible();
  await expect(page.getByText(/playable match bridge remains the existing deterministic 16-player knockout/)).toBeVisible();

  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await expect(page.getByRole("button", { name: "Entered" }).first()).toBeVisible();
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

test("manages export import delete and overwrite warnings from the visible Save Manager", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("badminton-manager-save-corrupt", "old-corrupt-backup");
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Choose The Run" })).toBeVisible();
  await page.getByRole("button", { name: "Start Career" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();

  await page.getByRole("button", { name: "SAVE_MANAGER" }).click();
  await expect(page.getByRole("heading", { name: "Local Save Control" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue Career" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Import Save" })).toBeVisible();
  await expect(page.getByText(/Quarantine present/).first()).toBeVisible();

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: "Start tournament and replace career?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Start New Career" }).click();
  await expect(page.getByRole("heading", { name: "Start a new career?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

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
  await expect(page.getByRole("heading", { name: "Choose The Run" })).toBeVisible();
  await page.evaluate(() => {
    if (window.localStorage.getItem("badminton-manager-save") !== null) {
      throw new Error("Expected active save to be deleted.");
    }
  });

  await page.getByRole("button", { name: "SAVE_MANAGER" }).click();
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

  await page.getByRole("button", { name: "SAVE_MANAGER" }).click();
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

  await page.getByRole("button", { name: "Start Career" }).click();
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

  await page.getByRole("button", { name: "Start Career" }).click();
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
  await page.getByRole("button", { name: "Event Desk" }).click();
  await expect(page.getByText(/Rival field:/).first()).toContainText(/top threat/);
});

test("can edit advanced tactics and preserve assistant advice overrides", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start Career" }).click();
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
  await page.getByRole("button", { name: "Event Desk" }).click();
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

  await page.getByRole("button", { name: "Start Career" }).click();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Facilities Upgrades" }).click();

  await expect(page.getByRole("heading", { name: "Facilities Upgrades" })).toBeVisible();
  await page.getByRole("button", { name: "Upgrade Training Hall" }).click();
  await expect(page.getByText("Training Hall level 1 build started")).toBeVisible();
  await expect(page.getByText(/Training/).first()).toBeVisible();

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
