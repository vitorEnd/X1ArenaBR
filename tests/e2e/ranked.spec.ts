import { expect, test } from "@playwright/test";

test("a ranked permanece separada dos jogadores oficiais em duas sessões", async ({
  browser,
}) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPlayer = await firstContext.newPage();
  const secondPlayer = await secondContext.newPage();

  await Promise.all([
    firstPlayer.goto("/matchmaking"),
    secondPlayer.goto("/matchmaking"),
  ]);

  await expect(firstPlayer.getByRole("heading", { name: /matchmaking/i })).toBeVisible();
  await expect(secondPlayer.getByRole("heading", { name: /matchmaking/i })).toBeVisible();

  await firstPlayer.goto("/jogadores");
  await expect(firstPlayer.getByText("Itz", { exact: true })).toBeVisible();
  await expect(firstPlayer.getByText(/conta ranked/i)).toHaveCount(0);

  await firstContext.close();
  await secondContext.close();
});

test("a experiência mobile respeita movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/matchmaking");

  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("button", { name: /abrir menu/i })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
});
