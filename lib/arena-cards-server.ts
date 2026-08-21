import "server-only";

import {
  derivePublicChampionsByCategory,
  derivePublicPlayerRankingEntries,
  getCanonicalOfficialPlayerId,
} from "./arena-competition";
import { officialPlayers } from "../data/arena";
import type { ArenaCard, ArenaCardMatch } from "./arena-card-types";
import type { BeltHistory, CategoryId, Champion, Match, Player, RankingEntry } from "./types";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseAdminConfigured } from "./supabase/env";

function mapMatch(row: Record<string, unknown>): ArenaCardMatch {
  const playerAId = getCanonicalOfficialPlayerId(String(row.player_a_id));
  const playerBId = getCanonicalOfficialPlayerId(String(row.player_b_id));
  const winnerPlayerId = typeof row.winner_player_id === "string"
    ? getCanonicalOfficialPlayerId(row.winner_player_id)
    : null;

  return {
    id: String(row.id),
    cardId: String(row.card_id),
    position: Number(row.position),
    categoryId: row.category_id as ArenaCardMatch["categoryId"],
    playerAId,
    playerBId,
    type: row.match_type as ArenaCardMatch["type"],
    status: row.status as ArenaCardMatch["status"],
    scheduledAt: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
    playerAScore: typeof row.player_a_score === "number" ? row.player_a_score : null,
    playerBScore: typeof row.player_b_score === "number" ? row.player_b_score : null,
    winnerPlayerId,
  };
}

export async function getPublicArenaCards(): Promise<readonly ArenaCard[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const admin = createAdminClient();
  const [cardsResult, matchesResult] = await Promise.all([
    admin
      .from("arena_cards")
      .select("id,name,status,starts_at,venue,created_at,updated_at")
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    admin
      .from("arena_card_matches")
      .select("id,card_id,position,category_id,player_a_id,player_b_id,match_type,status,scheduled_at,player_a_score,player_b_score,winner_player_id")
      .order("position", { ascending: true }),
  ]);

  if (cardsResult.error || matchesResult.error) {
    console.error("Arena cards read failed", cardsResult.error ?? matchesResult.error);
    return [];
  }

  const matchesByCard = new Map<string, ArenaCardMatch[]>();
  for (const row of matchesResult.data ?? []) {
    const match = mapMatch(row);
    const current = matchesByCard.get(match.cardId) ?? [];
    current.push(match);
    matchesByCard.set(match.cardId, current);
  }

  return (cardsResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: row.status as ArenaCard["status"],
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    venue: "Park",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    matches: matchesByCard.get(String(row.id)) ?? [],
  }));
}

function withAvatarVersion(publicUrl: string, updatedAt: unknown): string {
  if (typeof updatedAt !== "string" || !updatedAt) return publicUrl;

  try {
    const url = new URL(publicUrl);
    const timestamp = Date.parse(updatedAt);
    url.searchParams.set("v", Number.isFinite(timestamp) ? String(timestamp) : updatedAt);
    return url.toString();
  } catch {
    return publicUrl;
  }
}

export async function getPublicOfficialPlayers(): Promise<readonly Player[]> {
  if (!isSupabaseAdminConfigured()) return officialPlayers;

  const admin = createAdminClient();
  const result = await admin
    .from("arena_player_avatars")
    .select("player_id,storage_path,updated_at")
    .order("updated_at", { ascending: true });

  if (result.error) {
    console.error("Official player avatars read failed", result.error.message);
    return officialPlayers;
  }

  const avatarUrlByPlayer = new Map<string, string>();
  for (const row of result.data ?? []) {
    if (typeof row.player_id !== "string" || typeof row.storage_path !== "string") {
      continue;
    }

    const playerId = getCanonicalOfficialPlayerId(row.player_id);
    if (!officialPlayers.some((player) => player.id === playerId)) continue;
    if (row.storage_path !== `official/${playerId.toLowerCase()}/avatar.webp`) {
      continue;
    }

    const publicUrl = admin.storage
      .from("player-avatars")
      .getPublicUrl(row.storage_path).data.publicUrl;
    avatarUrlByPlayer.set(
      playerId,
      withAvatarVersion(publicUrl, row.updated_at),
    );
  }

  return officialPlayers.map((player) => ({
    ...player,
    avatarUrl: avatarUrlByPlayer.get(player.id) ?? player.avatarUrl,
  }));
}

export type PublicArenaCompetitionData = {
  readonly cards: readonly ArenaCard[];
  readonly players: readonly Player[];
  readonly rankingEntries: readonly RankingEntry[];
  readonly championsByCategory: ReadonlyMap<CategoryId, Champion>;
  readonly championIdsByCategory: ReadonlyMap<CategoryId, string>;
};

export async function getPublicArenaCompetitionData(): Promise<PublicArenaCompetitionData> {
  const [cards, players] = await Promise.all([
    getPublicArenaCards(),
    getPublicOfficialPlayers(),
  ]);
  const championsByCategory = derivePublicChampionsByCategory(cards);

  return {
    cards,
    players,
    rankingEntries: derivePublicPlayerRankingEntries(cards),
    championsByCategory,
    championIdsByCategory: new Map(
      [...championsByCategory].map(([categoryId, champion]) => [
        categoryId,
        champion.playerId,
      ]),
    ),
  };
}

export async function getPublicChampionIdsByCategory(): Promise<ReadonlyMap<ArenaCardMatch["categoryId"], string>> {
  const cards = await getPublicArenaCards();
  const champions = derivePublicChampionsByCategory(cards);
  return new Map(
    [...champions].map(([categoryId, champion]) => [categoryId, champion.playerId]),
  );
}

export async function getPublicPlayerRankingEntries(): Promise<readonly RankingEntry[]> {
  const cards = await getPublicArenaCards();
  return derivePublicPlayerRankingEntries(cards);
}

export async function getPublicPlayerBeltHistory(playerId: string): Promise<readonly BeltHistory[]> {
  const cards = await getPublicArenaCards();
  const history: BeltHistory[] = [];

  for (const card of cards) {
    for (const match of card.matches) {
      if (
        match.type !== "belt" ||
        match.status !== "finished" ||
        match.winnerPlayerId !== playerId
      ) continue;

      history.push({
        id: `${match.id}:won`,
        categoryId: match.categoryId,
        playerId,
        championType: "official",
        action: "won",
        occurredAt: match.scheduledAt ?? card.updatedAt,
        matchId: match.id,
        dataStatus: "official",
      });
    }
  }

  return history.sort(
    (first, second) =>
      new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime(),
  );
}

export async function getPublicPlayerMatchHistory(playerId: string): Promise<readonly Match[]> {
  const cards = await getPublicArenaCards();
  const history: Match[] = [];

  for (const card of cards) {
    for (const match of card.matches) {
      if (match.status !== "finished") continue;
      if (match.playerAId !== playerId && match.playerBId !== playerId) continue;
      if (match.playerAScore === null || match.playerBScore === null) continue;

      const scheduledAt = match.scheduledAt ?? card.startsAt ?? new Date().toISOString();
      const score = {
        playerA: match.playerAScore,
        playerB: match.playerBScore,
      };
      const winnerId = match.winnerPlayerId ?? (score.playerA > score.playerB ? match.playerAId : match.playerBId);
      const method =
        score.playerA === 0 && score.playerB === 0
          ? "regular"
          : Math.abs(score.playerA - score.playerB) >= 3 && Math.min(score.playerA, score.playerB) === 0
            ? "knockout"
            : "regular";

      history.push({
        id: match.id,
        eventId: card.id,
        categoryId: match.categoryId,
        playerAId: match.playerAId,
        playerBId: match.playerBId,
        type: match.type === "belt" ? "belt" : "normal",
        status: "finished",
        scheduledAt,
        result: winnerId
          ? {
              winnerId,
              score,
              method,
            }
          : null,
        dataStatus: "official",
      });
    }
  }

  return history.sort((first, second) => new Date(second.scheduledAt ?? 0).getTime() - new Date(first.scheduledAt ?? 0).getTime());
}
