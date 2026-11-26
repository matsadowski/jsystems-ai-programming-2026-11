import { expect, test } from "@playwright/test";
import { reachChatViaExpiredReturn } from "./helpers";

const FORBIDDEN = ["Submit", "Loading", "Error", "Send", "Cancel", "Upload", "Next", "Back"];

function expectNoEnglish(text: string, screen: string) {
  for (const word of FORBIDDEN) {
    expect(text, `${screen}: "${word}"`).not.toMatch(new RegExp(`\\b${word}\\b`));
  }
}

test("UI text on the form and chat screens contains no English UI words (TAC-003-03)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Przeanalizuj zgłoszenie" })).toBeVisible();
  expectNoEnglish(await page.locator("body").innerText(), "form");

  await reachChatViaExpiredReturn(page);
  expectNoEnglish(await page.locator("body").innerText(), "chat");
});
