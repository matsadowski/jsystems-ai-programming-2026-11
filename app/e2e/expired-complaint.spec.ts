import { expect, test } from "@playwright/test";
import { fillCaseForm, monthsAgo } from "./helpers";

test("complaint older than 24 months is rejected by the rules path (AC-21)", async ({ page }) => {
  await page.goto("/");
  await fillCaseForm(page, {
    type: "Reklamacja",
    category: "Laptop",
    model: "Lenovo ThinkPad T14",
    purchaseDate: monthsAgo(25),
    reason: "Laptop nie włącza się od kilku dni, ekran pozostaje czarny.",
    photo: "laptop-2.webp",
  });
  await page.getByRole("button", { name: "Przeanalizuj zgłoszenie" }).click();

  await expect(page.getByText("Reklamacja odrzucona").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "Czat" })).toContainText("C1.3");
  await expect(page.getByText("Reguła terminu").first()).toBeVisible();
});
