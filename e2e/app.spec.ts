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
