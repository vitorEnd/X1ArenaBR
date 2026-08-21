import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicPlayerNicknames } from "../lib/player-nicknames.ts";

test("normaliza apelidos apenas para jogadores oficiais e cores permitidas", () => {
  const nicknames = normalizePublicPlayerNicknames([
    { player_id: "GABBO", nickname: "  O Rei  ", color: "gold" },
    { player_id: "itz", nickname: "Fera", color: "red" },
    { player_id: "jogador-inexistente", nickname: "Fantasma", color: "purple" },
    { player_id: "Vwyxz", nickname: "Inválido", color: "blue" },
  ]);

  assert.deepEqual(nicknames, [
    { playerId: "Gabbo", nickname: "O Rei", color: "gold" },
    { playerId: "itz", nickname: "Fera", color: "red" },
  ]);
});

test("mantém somente o registro mais recente recebido para o mesmo jogador", () => {
  const nicknames = normalizePublicPlayerNicknames([
    { player_id: "Gabbo", nickname: "Primeiro", color: "red" },
    { player_id: "gabbo", nickname: "Atual", color: "purple" },
  ]);

  assert.deepEqual(nicknames, [
    { playerId: "Gabbo", nickname: "Primeiro", color: "red" },
  ]);
});
