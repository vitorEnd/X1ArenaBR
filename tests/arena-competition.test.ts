import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaCard, ArenaCardMatch } from "../lib/arena-card-types";
import {
  derivePublicChampionsByCategory,
  derivePublicPlayerRankingEntries,
  getCanonicalOfficialPlayerId,
} from "../lib/arena-competition.ts";

function makeMatch(
  id: string,
  winnerPlayerId: string,
  overrides: Partial<ArenaCardMatch> = {},
): ArenaCardMatch {
  return {
    id,
    cardId: `card-${id}`,
    position: 1,
    categoryId: "peso-medio",
    playerAId: "itz",
    playerBId: "duardin",
    type: "normal",
    status: "finished",
    scheduledAt: null,
    playerAScore: winnerPlayerId === "itz" ? 2 : 1,
    playerBScore: winnerPlayerId === "duardin" ? 2 : 1,
    winnerPlayerId,
    ...overrides,
  };
}

function makeCard(
  id: string,
  startsAt: string,
  match: ArenaCardMatch,
): ArenaCard {
  return {
    id: `card-${id}`,
    name: id,
    status: "finished",
    startsAt,
    venue: "Park",
    createdAt: startsAt,
    updatedAt: startsAt,
    matches: [{ ...match, cardId: `card-${id}` }],
  };
}

test("normaliza IDs do Supabase para o ID canônico dos jogadores oficiais", () => {
  assert.equal(getCanonicalOfficialPlayerId("joao00325"), "Joao00325");
  assert.equal(getCanonicalOfficialPlayerId("  VTZINN021 "), "vtzinn021");
  assert.equal(getCanonicalOfficialPlayerId("jogador-externo"), "jogador-externo");
});

test("calcula a sequência recente na ordem cronológica mesmo com cards em ordem decrescente", () => {
  const cards = [
    makeCard("novo", "2026-08-20T20:00:00Z", makeMatch("novo", "itz")),
    makeCard("meio", "2026-08-13T20:00:00Z", makeMatch("meio", "duardin")),
    makeCard("antigo", "2026-08-06T20:00:00Z", makeMatch("antigo", "itz")),
  ];

  const entry = derivePublicPlayerRankingEntries(cards).find(
    (item) => item.playerId === "itz" && item.categoryId === "peso-medio",
  );

  assert.deepEqual(entry?.recentForm, ["win", "loss", "win"]);
  assert.equal(entry?.wins, 2);
  assert.equal(entry?.losses, 1);
});

test("mantém conquista e defesas da atual passagem do campeão", () => {
  const cards = [
    makeCard("defesa-beta", "2026-08-20T20:00:00Z", makeMatch("defesa-beta", "duardin", { type: "belt" })),
    makeCard("troca", "2026-08-13T20:00:00Z", makeMatch("troca", "duardin", { type: "belt" })),
    makeCard("defesa-itz", "2026-08-06T20:00:00Z", makeMatch("defesa-itz", "itz", { type: "belt" })),
    makeCard("conquista-itz", "2026-07-30T20:00:00Z", makeMatch("conquista-itz", "itz", { type: "belt" })),
  ];

  const champion = derivePublicChampionsByCategory(cards).get("peso-medio");

  assert.equal(champion?.playerId, "duardin");
  assert.equal(champion?.wonAt, "2026-08-13T20:00:00Z");
  assert.equal(champion?.defenses, 1);
});
