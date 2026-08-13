import { expect, test } from "@playwright/test";

function resultSnapshot(
  outcome: "win" | "loss",
  rankChange: "promoted" | "demoted",
) {
  const won = outcome === "win";
  return {
    serverNow: "2026-08-13T18:00:00.000Z",
    configured: true,
    authenticated: true,
    profileComplete: true,
    profile: {
      id: "00000000-0000-4000-8000-000000000001",
      username: "Itz",
      avatarUrl: null,
      wins: won ? 8 : 7,
      losses: won ? 3 : 4,
      mmr: won ? 1_264 : 1_238,
      tier: won ? "craque" : "pro",
      globalPosition: 12,
      placementMatchesPlayed: 5,
      placementMatchesRequired: 5,
      createdAt: "2026-08-01T12:00:00.000Z",
    },
    queue: { state: "idle", joinedAt: null, searchExpandedAt: null, playersSearching: 0 },
    foundMatch: null,
    activeMatch: null,
    postMatchResult: {
      matchId: "00000000-0000-4000-8000-000000000099",
      matchNumber: 18,
      outcome,
      placementPending: false,
      oldMmr: won ? 1_238 : 1_264,
      newMmr: won ? 1_264 : 1_238,
      mmrDelta: won ? 26 : -26,
      previousTier: won ? "pro" : "craque",
      nextTier: won ? "craque" : "pro",
      rankChange,
    },
    penalty: { active: false, expiresAt: null, missedAcceptances: 0, progressionLevel: 0 },
  };
}

for (const scenario of [
  { outcome: "win" as const, rankChange: "promoted" as const, title: "Vitória", delta: "+26 MMR", change: "Promovido para Craque" },
  { outcome: "loss" as const, rankChange: "demoted" as const, title: "Derrota", delta: "-26 MMR", change: "Rebaixado para Pro" },
]) {
  test(`mostra animação de ${scenario.outcome} com MMR e mudança de Elo`, async ({ page }) => {
    await page.route("**/api/ranked/snapshot", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(resultSnapshot(scenario.outcome, scenario.rankChange)),
      });
    });

    await page.goto("/matchmaking");
    const result = page.getByTestId("post-match-result");
    await expect(result.getByRole("heading", { name: scenario.title })).toBeVisible();
    await expect(result.getByText(scenario.delta, { exact: true })).toBeVisible();
    await expect(result.getByText(scenario.change, { exact: true })).toBeVisible();
    await expect(result.getByRole("button", { name: /continuar jogando/i })).toBeEnabled();
    await expect(result.getByRole("button", { name: /encerrar sessão/i })).toBeEnabled();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
}
