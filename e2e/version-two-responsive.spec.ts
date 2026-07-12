import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 320, height: 720, mobileNavigation: true },
  { width: 768, height: 1024, mobileNavigation: true },
  { width: 1024, height: 900, mobileNavigation: false },
  { width: 1440, height: 900, mobileNavigation: false }
] as const;

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

    await expect(page.getByRole("heading", { name: "Athlete Directory" })).toBeVisible();
    await expect(menuButton).toHaveAccessibleName("Open navigation menu");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).not.toHaveClass(/command-sidebar-mobile-open/);
    await expect.poll(async () => {
      return sidebar.evaluate((element) => element.getBoundingClientRect().right);
    }).toBeLessThanOrEqual(1);
    await expectClosedDrawerOutsideLayout(page);
    await expectNoHorizontalOverflow(page);
  });
}
