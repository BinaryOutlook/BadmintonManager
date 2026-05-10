import { expect, test } from "@playwright/test";

test("can start a tournament run and play through a managed match", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tournament Deployment" })).toBeVisible();

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

test("can complete and reload the career core slice", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Events" }).click();
  await page.getByRole("button", { name: "Create Career Save" }).click();
  await expect(page.getByRole("heading", { name: "Career Command Center" })).toBeVisible();
  await expect(page.getByText(/Rank/).first()).toBeVisible();

  await page.getByRole("button", { name: "Training Desk" }).click();
  await expect(page.getByRole("heading", { name: "Load Management" })).toBeVisible();
  const rallyBase = page.getByRole("button", { name: /Rally Base/ });
  await rallyBase.click();
  await expect(rallyBase).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Career Home" }).click();
  await page.getByRole("button", { name: "Event Desk" }).click();
  await expect(page.getByRole("heading", { name: "Season Week" })).toBeVisible();
  await expect(page.getByText(/prize \$15,000/)).toBeVisible();
  await page.getByRole("button", { name: "Enter Event" }).first().click();
  await expect(page.getByRole("button", { name: "Entered" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Advance Day" }).click();
  await page.getByRole("button", { name: "Advance Day" }).click();
  await expect(page.getByRole("heading", { name: "Opponent Briefing" })).toBeVisible();
  await expect(page.getByText(/Career context is now attached/)).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Simulate Next Point" })).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Training Recommendations" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Match Evidence Review" })).toBeVisible();
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

  await page.getByRole("button", { name: "Events" }).click();
  await expect(page.getByRole("heading", { name: "Career Save Recovery" })).toBeVisible();
  await expect(page.getByText(/Corrupt save quarantined/)).toBeVisible();

  await page.getByRole("button", { name: "Create Career Save" }).click();
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
  await expect(page.getByRole("heading", { name: "Season Week" })).toBeVisible();
  await expect(page.getByText(/prize \$15,000/)).toBeVisible();
  await expect(page.getByText(/Insufficient funds: program cash \$100/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Insufficient Funds" }).first()).toBeDisabled();
});

test("can run the Phase 2 program ecosystem flow and persist it after reload", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Events" }).click();
  await page.getByRole("button", { name: "Create Career Save" }).click();
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

  await page.getByRole("button", { name: "Events" }).click();
  await page.getByRole("button", { name: "Create Career Save" }).click();
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

  await page.getByRole("button", { name: "Events" }).click();
  await page.getByRole("button", { name: "Create Career Save" }).click();
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

  await page.getByRole("button", { name: "Events" }).click();
  await page.getByRole("button", { name: "Create Career Save" }).click();
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
