import type { BrowserContextOptions, Page } from "@playwright/test";
import { devices, expect, test } from "@playwright/test";

function deviceOptions(
  name: "Desktop Chrome" | "Pixel 7",
): BrowserContextOptions {
  const device = devices[name];

  return {
    viewport: device.viewport,
    userAgent: device.userAgent,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    locale: "pt-BR",
    reducedMotion: "reduce",
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectPublicRankedFallback(page: Page) {
  await expect(
    page.getByRole("heading", { name: /entre\.\s*jogue\.\s*suba\./i }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /sistema em prepara/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /entrar na fila/i }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
}

test("fallback público e jogadores oficiais funcionam em dois contextos isolados", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "O cenário cria explicitamente um contexto desktop e outro mobile.",
  );

  const baseURL = String(testInfo.project.use.baseURL);
  const desktopContext = await browser.newContext({
    ...deviceOptions("Desktop Chrome"),
    baseURL,
  });
  const mobileContext = await browser.newContext({
    ...deviceOptions("Pixel 7"),
    baseURL,
  });

  try {
    const desktopPage = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    await Promise.all([
      desktopPage.goto("/matchmaking"),
      mobilePage.goto("/matchmaking"),
    ]);
    await Promise.all([
      expectPublicRankedFallback(desktopPage),
      expectPublicRankedFallback(mobilePage),
    ]);

    await desktopPage.locator("html").evaluate((element) => {
      element.dataset.testContext = "desktop";
    });
    await expect(mobilePage.locator("html")).not.toHaveAttribute(
      "data-test-context",
      "desktop",
    );

    await desktopPage.goto("/jogadores");
    await expect(
      desktopPage.getByRole("heading", { name: "Jogadores", exact: true }),
    ).toBeVisible();

    for (const playerName of ["Itz", "João00325", "Vtzinn021", "Vwyxz"]) {
      await expect(
        desktopPage.getByRole("heading", { name: playerName, exact: true }),
      ).toBeVisible();
    }

    const itzCard = desktopPage
      .getByRole("article")
      .filter({ has: desktopPage.getByRole("heading", { name: "Itz", exact: true }) });
    await expect(itzCard.getByRole("link", { name: /ver perfil/i })).toHaveAttribute(
      "href",
      "/jogadores/itz",
    );
    await expect(desktopPage.locator('a[href^="/ranked/"]')).toHaveCount(0);
    await expect(
      desktopPage.locator(".player-directory").getByText(/conta ranked/i),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(desktopPage);
  } finally {
    await Promise.all([desktopContext.close(), mobileContext.close()]);
  }
});

test("menu mobile respeita movimento reduzido e não cria overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Interação exclusiva da navegação mobile.",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/matchmaking");
  await expectPublicRankedFallback(page);
  await expect
    .poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
    .toBe(true);

  const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAccessibleName(/abrir menu/i);
  await menuButton.click();

  const mobileNavigation = page.getByRole("navigation", {
    name: /navega.*mobile/i,
  });
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(mobileNavigation).toBeVisible();
  await expect(
    mobileNavigation.getByRole("link", { name: /matchmaking$/i }),
  ).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press("Escape");
  await expect(mobileNavigation).toBeHidden();
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAccessibleName(/abrir menu/i);
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expectNoHorizontalOverflow(page);
});

test("fila ativa mostra contador e painel competitivo sem cortar o Elo", async ({
  page,
}) => {
  await page.route("**/api/ranked/snapshot", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        authenticated: true,
        profileComplete: true,
        profile: {
          id: "00000000-0000-4000-8000-000000000001",
          username: "Itz",
          avatarUrl: null,
          wins: 0,
          losses: 0,
          mmr: null,
          tier: null,
          globalPosition: null,
          placementMatchesPlayed: 0,
          placementMatchesRequired: 5,
          createdAt: "2026-08-13T12:00:00.000Z",
        },
        queue: {
          state: "searching",
          joinedAt: new Date(Date.now() - 53_000).toISOString(),
          searchExpandedAt: new Date(Date.now() + 7_000).toISOString(),
          playersSearching: 3,
        },
        foundMatch: null,
        activeMatch: null,
        penalty: {
          active: false,
          expiresAt: null,
          missedAcceptances: 0,
          progressionLevel: 0,
        },
      }),
    });
  });

  await page.goto("/matchmaking");
  await expect(page.getByRole("heading", { name: "Buscando adversário" })).toBeVisible();
  await expect(page.getByLabel("3 pessoas buscando", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Itz", exact: true })).toBeVisible();
  await expect(page.getByText("Em colocação", { exact: true })).toBeVisible();
  await expect(page.getByText("5 partidas restantes", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /ver perfil e histórico/i })).toHaveAttribute(
    "href",
    "/ranked/Itz",
  );
  await expectNoHorizontalOverflow(page);
});

test("Top 50 sempre oferece retorno para a fila", async ({ page }) => {
  await page.route("**/api/ranked/leaderboard**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        entries: [],
        page: 1,
        totalPages: 0,
        totalEntries: 0,
      }),
    });
  });

  await page.goto("/matchmaking/ranking");
  await expect(page.getByRole("link", { name: /voltar para a fila/i })).toHaveAttribute(
    "href",
    "/matchmaking",
  );
  await expectNoHorizontalOverflow(page);
});
