import { expect, test } from "@playwright/test";
import { image } from "./helpers";

test("laptop-1.png (JPEG bytes) is accepted with thumbnail, name, Zmień and Usuń (AC-10)", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(image("laptop-1.png"));

  await expect(page.getByRole("img", { name: "Podgląd zdjęcia laptop-1.png" })).toBeVisible();
  await expect(page.getByText("laptop-1.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zmień" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Usuń" })).toBeVisible();

  await page.getByRole("button", { name: "Usuń" }).click();
  await expect(page.getByRole("button", { name: "Wybierz plik" })).toBeVisible();
});
