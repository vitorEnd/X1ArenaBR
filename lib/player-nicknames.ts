import { officialPlayers } from "../data/arena.ts";
import type { PlayerNickname } from "./types";

const officialPlayerIdByNormalizedId = new Map(
  officialPlayers.map((player) => [player.id.toLocaleLowerCase("pt-BR"), player.id]),
);

export function normalizePublicPlayerNicknames(
  rows: readonly Record<string, unknown>[],
): readonly PlayerNickname[] {
  const nicknames = new Map<string, PlayerNickname>();

  for (const row of rows) {
    const rawPlayerId = typeof row.player_id === "string" ? row.player_id.trim() : "";
    const playerId = officialPlayerIdByNormalizedId.get(
      rawPlayerId.toLocaleLowerCase("pt-BR"),
    );
    const nickname = typeof row.nickname === "string" ? row.nickname.trim() : "";
    const color = row.color;

    if (
      !playerId ||
      nicknames.has(playerId) ||
      nickname.length < 2 ||
      !["gold", "red", "purple"].includes(String(color))
    ) {
      continue;
    }

    nicknames.set(playerId, {
      playerId,
      nickname,
      color: color as PlayerNickname["color"],
    });
  }

  return [...nicknames.values()];
}

export function createPlayerNicknameMap(
  nicknames: readonly PlayerNickname[],
): ReadonlyMap<string, PlayerNickname> {
  return new Map(nicknames.map((nickname) => [nickname.playerId, nickname]));
}
