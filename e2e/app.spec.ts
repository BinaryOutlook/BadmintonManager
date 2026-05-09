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

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Youth Academy" }).click();
  await expect(page.getByRole("heading", { name: "Prospect Pipeline" })).toBeVisible();
  await page.getByRole("button", { name: "Run Development Block" }).click();
  await page.getByRole("button", { name: "Run Development Block" }).click();
  await expect(page.getByText(/Eligible/)).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Staff Room" }).click();
  await expect(page.getByRole("heading", { name: "Hire Modifiers" })).toBeVisible();
  await page.getByRole("button", { name: "Hire Staff" }).first().click();
  await expect(page.getByText(/Active Modifiers/)).toBeVisible();
  await expect(page.getByText(/Marta Ruiz/)).toBeVisible();

  await page.getByRole("button", { name: "Program Hub" }).click();
  await page.getByRole("button", { name: "Athlete State + Promises" }).click();
  await expect(page.getByRole("heading", { name: "Psychology Desk" })).toBeVisible();
  await page.getByRole("button", { name: "Promise Stamina" }).click();
  await expect(page.getByText(/Promise created/).first()).toBeVisible();
  await page.getByRole("button", { name: "Withdraw Promise" }).click();
  await expect(page.getByText(/withdrawn/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Psychology Desk" })).toBeVisible();
  await expect(page.getByText(/withdrawn/).first()).toBeVisible();
  await page.getByRole("button", { name: "Program Hub" }).click();
  await expect(page.getByText(/Arya Prakash offer accepted/)).toBeVisible();
});
