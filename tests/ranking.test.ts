import assert from "node:assert/strict";
import test from "node:test";

import type { RankingEntry } from "../lib/types";

const rankingModuleUrl = new URL("../lib/ranking.ts", import.meta.url);
const {
  buildCategoryRanking,
  calculateGoalDifference,
  calculateRankingPoints,
  sortRankingEntries,
} = (await import(rankingModuleUrl.href)) as typeof import("../lib/ranking");

function makeEntry(
  playerId: string,
  overrides: Partial<RankingEntry> = {},
): RankingEntry {
  return {
    playerId,
    categoryId: "peso-pena",
    wins: 3,
    losses: 1,
    goalsFor: 10,
    goalsAgainst: 5,
    recentForm: [],
    dataStatus: "official",
    ...overrides,
  };
}

test("calcula Pontos de Ranking e saldo com as fórmulas oficiais", () => {
  assert.equal(calculateRankingPoints(7, 3), 11);
  assert.equal(calculateRankingPoints(0, 2), -2);
  assert.equal(calculateGoalDifference(18, 11), 7);
  assert.equal(calculateGoalDifference(4, 9), -5);
});

test("ordena por pontos, saldo e menor número de derrotas", () => {
  const entries = [
    makeEntry("saldo-menor", {
      wins: 3,
      losses: 0,
      goalsFor: 9,
      goalsAgainst: 2,
    }),
    makeEntry("menos-derrotas", {
      wins: 3,
      losses: 0,
      goalsFor: 10,
      goalsAgainst: 2,
    }),
    makeEntry("mais-derrotas", {
      wins: 4,
      losses: 2,
      goalsFor: 12,
      goalsAgainst: 4,
    }),
    makeEntry("mais-pontos", {
      wins: 5,
      losses: 2,
      goalsFor: 11,
      goalsAgainst: 10,
    }),
  ];

  const ranked = sortRankingEntries(entries);

  assert.deepEqual(
    ranked.map((entry) => entry.playerId),
    ["mais-pontos", "menos-derrotas", "mais-derrotas", "saldo-menor"],
  );
  assert.deepEqual(
    ranked.map((entry) => entry.points),
    [8, 6, 6, 6],
  );
});

test("mantém ordenação estável e não altera o array recebido", () => {
  const entries = [makeEntry("alpha"), makeEntry("bravo"), makeEntry("charlie")];
  const originalOrder = entries.map((entry) => entry.playerId);

  const ranked = sortRankingEntries(entries);

  assert.deepEqual(
    ranked.map((entry) => entry.playerId),
    originalOrder,
  );
  assert.deepEqual(
    entries.map((entry) => entry.playerId),
    originalOrder,
  );
  assert.notEqual(ranked, entries);
});

test("usa confronto direto antes da decisão da organização", () => {
  const entries = [makeEntry("alpha"), makeEntry("bravo")];
  let organizationResolverCalled = false;

  const ranked = sortRankingEntries(entries, {
    resolveHeadToHead: () => ["bravo", "alpha"],
    resolveOrganizationDecision: () => {
      organizationResolverCalled = true;
      return ["alpha", "bravo"];
    },
  });

  assert.deepEqual(
    ranked.map((entry) => entry.playerId),
    ["bravo", "alpha"],
  );
  assert.equal(organizationResolverCalled, false);
});

test("recorre à decisão da organização quando confronto direto não resolve", () => {
  const entries = [makeEntry("alpha"), makeEntry("bravo")];

  const ranked = sortRankingEntries(entries, {
    resolveHeadToHead: () => null,
    resolveOrganizationDecision: () => ["bravo", "alpha"],
  });

  assert.deepEqual(
    ranked.map((entry) => entry.playerId),
    ["bravo", "alpha"],
  );
});

test("aceita uma decisão persistida da organização como último desempate", () => {
  const entries = [
    makeEntry("alpha", {
      organizationDecision: { order: 2, reason: "Critério definido" },
    }),
    makeEntry("bravo", {
      organizationDecision: { order: 1, reason: "Critério definido" },
    }),
  ];

  const ranked = sortRankingEntries(entries);

  assert.deepEqual(
    ranked.map((entry) => entry.playerId),
    ["bravo", "alpha"],
  );
});

test("ignora um override parcial para não produzir desempate inconsistente", () => {
  const entries = [makeEntry("alpha"), makeEntry("bravo")];

  const ranked = sortRankingEntries(entries, {
    resolveHeadToHead: () => ["bravo"],
  });

  assert.deepEqual(
    ranked.map((entry) => entry.playerId),
    ["alpha", "bravo"],
  );
});

test("separa o campeão com C e numera o primeiro desafiante como #1", () => {
  const entries = [
    makeEntry("campeao-fixture", { wins: 10, losses: 0 }),
    makeEntry("desafiante-01", { wins: 7, losses: 1 }),
    makeEntry("desafiante-02", { wins: 5, losses: 2 }),
    makeEntry("outra-categoria", {
      categoryId: "peso-medio",
      wins: 20,
      losses: 0,
    }),
  ];

  const ranking = buildCategoryRanking(entries, "peso-pena", {
    championPlayerId: "campeao-fixture",
  });

  assert.equal(ranking.champion?.playerId, "campeao-fixture");
  assert.equal(ranking.champion?.marker, "C");
  assert.equal(ranking.champion?.position, null);
  assert.deepEqual(
    ranking.standings.map((entry) => ({
      playerId: entry.playerId,
      marker: entry.marker,
      position: entry.position,
    })),
    [
      { playerId: "desafiante-01", marker: "#1", position: 1 },
      { playerId: "desafiante-02", marker: "#2", position: 2 },
    ],
  );
  assert.equal(
    ranking.standings.some((entry) => entry.playerId === "campeao-fixture"),
    false,
  );
  assert.equal(
    ranking.standings.some((entry) => entry.playerId === "outra-categoria"),
    false,
  );
});

test("não inventa campeão quando o ID informado não está na categoria", () => {
  const ranking = buildCategoryRanking(
    [makeEntry("alpha")],
    "peso-pena",
    { championPlayerId: "sem-registro-oficial" },
  );

  assert.equal(ranking.champion, null);
  assert.equal(ranking.standings[0]?.marker, "#1");
});
