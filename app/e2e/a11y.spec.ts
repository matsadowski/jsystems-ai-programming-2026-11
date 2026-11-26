import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { reachChatViaExpiredReturn } from "./helpers";

async function expectNoSeriousViolations(page: Page, testInfo: TestInfo, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  if (serious.length > 0) {
    await testInfo.attach(`axe-${name}.json`, {
      body: JSON.stringify(
        serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target) })),
        null,
        2,
      ),
      contentType: "application/json",
    });
  }
  expect(
    serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    `${name}: critical/serious axe violations`,
  ).toEqual([]);
}

test("form screen has no critical or serious axe violations (TAC-003-04, A1)", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Przeanalizuj zgłoszenie" })).toBeVisible();
  await expectNoSeriousViolations(page, testInfo, "form");
});

test("chat screen has no critical or serious axe violations (TAC-003-04, A1)", async ({ page }, testInfo) => {
  await reachChatViaExpiredReturn(page);
  await expectNoSeriousViolations(page, testInfo, "chat");
});
