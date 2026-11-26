import { expect, test } from "@playwright/test";

test("home page shows the application name and the form heading", async ({ page }) => {
  await page.goto("/");
  // The application name lives in the header (a span, not a heading); the page h1 is the form title.
  await expect(page.getByRole("banner")).toContainText("Hardware Service Decision Copilot");
  await expect(page.getByRole("heading", { level: 1, name: "Nowe zgłoszenie" })).toBeVisible();
});
