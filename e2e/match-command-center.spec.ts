import { expect, test, type Page } from "@playwright/test";

async function enterQuickLiveMatch(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  const selectionDialog = page.getByRole("dialog", { name: "Pick Your Playstyle" });
  await expect(selectionDialog).toBeVisible();
  await expect(selectionDialog.getByRole("button", { name: "Start Tournament" })).toBeDisabled();
  await selectionDialog.getByRole("button", { name: /Select( featured)? / }).first().click();
  await expect(selectionDialog.getByRole("button", { name: "Start Tournament" })).toBeEnabled();
  await selectionDialog.getByRole("button", { name: "Start Tournament" }).click();
  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("heading", { name: "Match Command Center" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectCommandSurfaceInViewport(page: Page) {
  const metrics = await page.evaluate(() => {
    const score = document.querySelector('[aria-label="Compact scoreboard"]');
    const action = document.querySelector('[aria-label="Match controls"]');
    const surface = document.querySelector('[aria-label="Match command surface"]');
    const feed = document.querySelector(".match-feed-panel");
    const viewer = document.querySelector('[data-testid="tactical-viewer"]');
    const telemetryAndOptions = document.querySelector('[aria-label="Managed and opponent telemetry with tactical options"]');
    const tacticalOptions = document.querySelector('[aria-label="Tactical options"]');

    if (!score || !action || !surface || !feed || !viewer || !telemetryAndOptions || !tacticalOptions) {
      throw new Error("Expected all match command surface panels to render.");
    }

    function rect(element: Element) {
      const bounds = element.getBoundingClientRect();

      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height
      };
    }

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      surface: rect(surface),
      score: rect(score),
      action: rect(action),
      feed: rect(feed),
      viewer: rect(viewer),
      telemetryAndOptions: rect(telemetryAndOptions),
      tacticalOptions: rect(tacticalOptions),
      primaryPointButtonCount: [...document.querySelectorAll("button")].filter((button) =>
        button.textContent?.trim() === "Next Point"
      ).length,
      finishSetButtonCount: [...document.querySelectorAll("button")].filter((button) =>
        button.textContent?.trim() === "Finish Set"
      ).length,
      statusStripCount: document.querySelectorAll('[aria-label="Live match status"]').length
    };
  });

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport.width);
  expect(metrics.surface.top).toBeGreaterThanOrEqual(0);
  expect(metrics.surface.bottom).toBeLessThanOrEqual(metrics.viewport.height);
  expect(metrics.action.left).toBeGreaterThanOrEqual(metrics.score.right - 1);
  expect(Math.abs(metrics.action.top - metrics.score.top)).toBeLessThanOrEqual(1);
  expect(metrics.feed.bottom).toBeLessThanOrEqual(metrics.viewport.height);
  expect(metrics.viewer.bottom).toBeLessThanOrEqual(metrics.viewport.height);
  expect(metrics.telemetryAndOptions.bottom).toBeLessThanOrEqual(metrics.viewport.height);
  expect(metrics.tacticalOptions.top).toBeLessThan(metrics.viewport.height);
  expect(metrics.primaryPointButtonCount).toBe(1);
  expect(metrics.finishSetButtonCount).toBe(1);
  expect(metrics.statusStripCount).toBe(0);
}

test("keeps the live match command surface horizontal at desktop viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterQuickLiveMatch(page);

  await expectCommandSurfaceInViewport(page);
  await page.screenshot({ path: "test-results/workstream-d/match-command-1440-initial.png", fullPage: false });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.scrollTo(0, 0));

  for (let pointIndex = 0; pointIndex < 3; pointIndex += 1) {
    await page.getByRole("button", { name: "Next Point" }).click();
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await expectCommandSurfaceInViewport(page);
  await page.screenshot({ path: "test-results/workstream-d/match-command-1366-after-3-points.png", fullPage: false });
});
