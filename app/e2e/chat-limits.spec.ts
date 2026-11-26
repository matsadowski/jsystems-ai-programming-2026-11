import { expect, test } from "@playwright/test";
import { reachChatViaExpiredReturn } from "./helpers";

test("chat input: 2001 characters are blocked, Shift+Enter inserts a newline (AC-27, AC-32)", async ({ page }) => {
  await reachChatViaExpiredReturn(page); // RULES flow: no model call for the first message
  const input = page.getByLabel("Wiadomość");
  const send = page.getByRole("button", { name: "Wyślij" });

  await input.fill("a".repeat(2001));
  await expect(send).toBeDisabled();
  await expect(page.getByText(/maksymalnie 2000 znaków/)).toBeVisible();
  await input.fill("a".repeat(2000));
  await expect(send).toBeEnabled();

  await input.fill("");
  await input.fill("pierwsza linia");
  const messagesBefore = await page.getByRole("log", { name: "Rozmowa" }).innerText();
  await input.press("Shift+Enter");
  await input.pressSequentially("druga linia");
  await expect(input).toHaveValue("pierwsza linia\ndruga linia");
  expect(await page.getByRole("log", { name: "Rozmowa" }).innerText()).toBe(messagesBefore);
});
