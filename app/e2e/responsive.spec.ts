import { expect, test } from "@playwright/test";
import { noHorizontalScroll, reachChatViaExpiredReturn } from "./helpers";

for (const viewport of [
  { width: 360, height: 800 },
  { width: 1280, height: 800 },
]) {
  test(`no horizontal scroll at ${viewport.width}x${viewport.height} (AC-39)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Przeanalizuj zgłoszenie" })).toBeVisible();
    const form = await noHorizontalScroll(page);
    expect(form.scrollWidth, "form screen").toBeLessThanOrEqual(form.clientWidth);

    await reachChatViaExpiredReturn(page);
    const chat = await noHorizontalScroll(page);
    expect(chat.scrollWidth, "chat screen").toBeLessThanOrEqual(chat.clientWidth);
  });
}
