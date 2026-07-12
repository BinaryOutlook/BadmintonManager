import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 320, height: 720, mobileNavigation: true },
  { width: 768, height: 1024, mobileNavigation: true },
  { width: 1024, height: 900, mobileNavigation: false },
  { width: 1440, height: 900, mobileNavigation: false }
] as const;

type ResponsiveViewport = (typeof viewports)[number];

async function startCareer(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await page.getByRole("button", { name: "Start Career" }).click();
  const dialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });

  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Select( featured)? / }).first().click();
  await expect(dialog.getByRole("button", { name: "Confirm Career Athlete" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Confirm Career Athlete" }).click();
  await expect(page.getByRole("banner")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
}

async function expectTopbarIdentityNotTruncated(page: Page) {
  const identityMetrics = await page.evaluate(() => {
    const elements = [
      document.querySelector<HTMLElement>(".brand-lockup strong"),
      document.querySelector<HTMLElement>(".topbar-athlete-chip strong")
    ];

    return elements.map((element) => {
      if (!element) {
        throw new Error("Expected both product and managed-athlete identity labels.");
      }

      return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
    });
  });

  for (const metric of identityMetrics) {
    expect(metric.clientWidth).toBeGreaterThan(0);
    expect(metric.scrollWidth).toBeLessThanOrEqual(metric.clientWidth + 1);
  }
}

async function captureResponsiveEvidence(page: Page, name: string) {
  const screenshotDir = process.env.VERSION_TWO_SCREENSHOT_DIR;

  if (!screenshotDir) {
    return;
  }

  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: false });
}

async function activateCareerCommand(
  page: Page,
  viewport: ResponsiveViewport,
  command: "portal" | "timeline" | "calendar" | "training" | "inbox" | "reports"
) {
  const sidebar = page.getByRole("complementary", { name: "Primary command sidebar" });
  const commandButton = sidebar.locator(`[data-command="${command}"]`);

  if (viewport.mobileNavigation) {
    const menuButton = page.locator(".mobile-navigation-toggle");
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(commandButton).toBeVisible();
    await commandButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () =>
      sidebar.evaluate((element) => element.getBoundingClientRect().right)
    ).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    return;
  }

  await expect(commandButton).toBeVisible();
  await commandButton.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function expectClosedDrawerOutsideLayout(page: Page) {
  const metrics = await page.evaluate(() => {
    const main = document.querySelector("main.main-canvas");
    const sidebar = document.querySelector(".command-sidebar");

    if (!main || !sidebar) {
      throw new Error("Expected the career canvas and command drawer.");
    }

    const mainBounds = main.getBoundingClientRect();
    const sidebarBounds = sidebar.getBoundingClientRect();

    return {
      mainLeft: mainBounds.left,
      mainWidth: mainBounds.width,
      sidebarRight: sidebarBounds.right,
      viewportWidth: window.innerWidth
    };
  });

  expect(Math.abs(metrics.mainLeft)).toBeLessThanOrEqual(1);
  expect(metrics.mainWidth).toBeGreaterThanOrEqual(metrics.viewportWidth - 1);
  expect(metrics.sidebarRight).toBeLessThanOrEqual(1);
}

for (const viewport of viewports) {
  test(`keeps the Version Two shell bounded at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startCareer(page);
    await captureResponsiveEvidence(page, `portal-${viewport.width}x${viewport.height}`);
    await expectTopbarIdentityNotTruncated(page);

    const menuButton = page.locator(".mobile-navigation-toggle");
    const sidebar = page.getByRole("complementary", { name: "Primary command sidebar" });

    if (!viewport.mobileNavigation) {
      await expect(menuButton).toBeHidden();
      await expectNoHorizontalOverflow(page);
      await sidebar.locator('[data-command="squad"]').click();
      await expect(page.getByRole("heading", { name: "My Program", level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await captureResponsiveEvidence(page, `my-program-${viewport.width}x${viewport.height}`);
      return;
    }

    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAccessibleName("Open navigation menu");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expectClosedDrawerOutsideLayout(page);
    await expectNoHorizontalOverflow(page);

    await menuButton.click();
    await expect(menuButton).toHaveAccessibleName("Close navigation menu");
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar).toHaveClass(/command-sidebar-mobile-open/);
    await expect.poll(async () => {
      return sidebar.evaluate((element) => element.getBoundingClientRect().left);
    }).toBeGreaterThanOrEqual(-1);
    await expect(sidebar.getByRole("button", { name: "Close Menu" })).toBeFocused();
    await captureResponsiveEvidence(page, `navigation-${viewport.width}x${viewport.height}`);

    for (const command of ["portal", "calendar", "squad", "training"] as const) {
      await expect(sidebar.locator(`[data-command="${command}"] > span`)).toBeVisible();
    }

    if (viewport.width === 320) {
      await page.keyboard.press("Escape");
      await expect(sidebar).not.toHaveClass(/command-sidebar-mobile-open/);
      await expect(menuButton).toBeFocused();
      await menuButton.click();
      await expect.poll(async () => {
        return sidebar.evaluate((element) => element.getBoundingClientRect().left);
      }).toBeGreaterThanOrEqual(-1);
    }

    await expectNoHorizontalOverflow(page);
    await sidebar.locator('[data-command="squad"]').click();

    await expect(page.getByRole("heading", { name: "My Program", level: 1 })).toBeVisible();
    await expect(menuButton).toHaveAccessibleName("Open navigation menu");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).not.toHaveClass(/command-sidebar-mobile-open/);
    await expect.poll(async () => {
      return sidebar.evaluate((element) => element.getBoundingClientRect().right);
    }).toBeLessThanOrEqual(1);
    await expectClosedDrawerOutsideLayout(page);
    await expectNoHorizontalOverflow(page);
    await captureResponsiveEvidence(page, `my-program-${viewport.width}x${viewport.height}`);
  });

  test(`keeps the unified manager schedule trustworthy at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startCareer(page);

    await activateCareerCommand(page, viewport, "training");
    await expect(page.getByRole("heading", { level: 1, name: "Load Management" })).toBeVisible();

    const rallyBasePlan = page.locator(".career-plan-grid").getByRole("button", { name: /Rally Base/ });
    await rallyBasePlan.click();
    await expect(rallyBasePlan).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Training status")).toContainText("Rally Base");

    await activateCareerCommand(page, viewport, "portal");
    await expect(page.getByRole("heading", { level: 1, name: "Career Command Center" })).toBeVisible();

    const snapshot = page.getByLabel("Portal calendar snapshot");
    await expect(snapshot).toBeVisible();
    const scheduledDay = snapshot.locator('.career-day[data-schedule-count="2"]');
    await expect(scheduledDay).toHaveCount(1);
    await expect(scheduledDay.getByRole("button", { name: /\+1 more/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await snapshot.scrollIntoViewIfNeeded();
    await captureResponsiveEvidence(page, `portal-schedule-${viewport.width}x${viewport.height}`);

    await page.getByRole("button", { name: "Full Calendar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();

    await activateCareerCommand(page, viewport, "timeline");
    await expect(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();

    const managerCommitments = page.getByRole("region", { name: "Manager commitments", exact: true });
    await expect(managerCommitments).toBeVisible();
    const trainingCommitment = managerCommitments.locator(
      '.manager-schedule-card[data-schedule-category="training"]'
    );
    await expect(trainingCommitment).toHaveCount(1);
    await expect(trainingCommitment).toContainText("Rally Base");
    await expect(trainingCommitment).toContainText("Training");
    await expect(trainingCommitment).toContainText("Due");
    await expectNoHorizontalOverflow(page);
    await managerCommitments.locator(".panel-header").scrollIntoViewIfNeeded();
    await captureResponsiveEvidence(page, `timeline-schedule-${viewport.width}x${viewport.height}`);

    await trainingCommitment.getByRole("button", { name: /^Open training: .*Rally Base/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Load Management" })).toBeVisible();
    await expect(page.getByLabel("Training status")).toContainText("Rally Base");

    await activateCareerCommand(page, viewport, "calendar");
    await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();

    const calendarGrid = page.getByRole("grid", { name: "Calendar for June 2026" });
    await expect(calendarGrid).toBeVisible();
    const calendarRows = calendarGrid.getByRole("row");
    await expect(calendarRows).toHaveCount(5);
    for (const row of await calendarRows.all()) {
      await expect(row.getByRole("gridcell")).toHaveCount(7);
    }
    await expect(calendarGrid.getByRole("gridcell", { name: /career today/ })).toHaveAttribute(
      "aria-current",
      "date"
    );
    await expect(calendarGrid.getByRole("button", { name: /^Open training: .*Rally Base/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureResponsiveEvidence(page, `calendar-schedule-${viewport.width}x${viewport.height}`);

    await activateCareerCommand(page, viewport, "inbox");
    await expect(page.getByRole("heading", { level: 1, name: "Actionable Career Desk" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureResponsiveEvidence(page, `inbox-${viewport.width}x${viewport.height}`);

    await activateCareerCommand(page, viewport, "reports");
    await expect(page.getByRole("heading", { level: 1, name: "Institutional Memory" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureResponsiveEvidence(page, `reports-${viewport.width}x${viewport.height}`);
  });
}
