import { expect, test } from "@playwright/test";
import { reachChatViaExpiredReturn } from "./helpers";

test("Nowe zgłoszenie: Anuluj keeps the chat, Rozpocznij nowe gives an empty form (AC-35)", async ({ page }) => {
  await reachChatViaExpiredReturn(page);
  const chat = page.getByRole("region", { name: "Czat" });

  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Bieżąca rozmowa zostanie utracona.");
  await dialog.getByRole("button", { name: "Anuluj" }).click();
  await expect(dialog).toBeHidden();
  await expect(chat).toBeVisible();
  await expect(chat).toContainText("Uzasadnienie");

  await page.getByRole("button", { name: "Nowe zgłoszenie" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Rozpocznij nowe" }).click();
  await expect(chat).toBeHidden();
  await expect(page.getByRole("button", { name: "Przeanalizuj zgłoszenie" })).toBeDisabled();
  await expect(page.getByLabel("Nazwa / model")).toHaveValue("");
  await expect(page.getByLabel("Data zakupu")).toHaveValue("");
  await expect(page.getByLabel(/Powód zgłoszenia/)).toHaveValue("");
  await expect(page.getByRole("button", { name: "Wybierz plik" })).toBeVisible();
});
