import "server-only";

import type { ArenaCard, ArenaCardMatch } from "./arena-card-types";
import type { BeltHistory, Match, MatchOutcome, RankingEntry } from "./types";
import { createAdminClient } from "./supabase/admin";
import type { PlayerNickname, PlayerNicknameColor } from "./types";
import { isSupabaseAdminConfigured } from "./supabase/env";

export async function getPublicPlayerNicknames(): Promise<ReadonlyMap<string, PlayerNickname>> {
  if (!isSupabaseAdminConfigured()) return new Map();
  const admin = createAdminClient();
  const result = await admin.from("arena_player_nicknames").select("player_id,nickname,color");
  if (result.error) {
    console.error("Player nicknames read failed", result.error);
    return new Map();
  }
  return new Map((result.data ?? []).map((row) => [
    String(row.player_id),
    { playerId: String(row.player_id), nickname: String(row.nickname), color: row.color as PlayerNicknameColor },
  ]));
}

function mapMatch(row: Record<string, unknown>): ArenaCardMatch {
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    position: Number(row.position),
    categoryId: row.category_id as ArenaCardMatch["categoryId"],
    playerAId: String(row.player_a_id),
    playerBId: String(row.player_b_id),
    type: row.match_type as ArenaCardMatch["type"],
    status: row.status as ArenaCardMatch["status"],
    scheduledAt: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
    playerAScore: typeof row.player_a_score === "number" ? row.player_a_score : null,
    playerBScore: typeof row.player_b_score === "number" ? row.player_b_score : null,
    winnerPlayerId: typeof row.winner_player_id === "string" ? row.winner_player_id : null,
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

type MutablePlayerRankingSummary = {
  playerId: string;
  categoryId: ArenaCardMatch["categoryId"];
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  recentForm: MatchOutcome[];
  knockouts: number;
  dataStatus: "official";
};

export async function getPublicChampionIdsByCategory(): Promise<ReadonlyMap<ArenaCardMatch["categoryId"], string>> {
  const cards = await getPublicArenaCards();
  const champions = new Map<ArenaCardMatch["categoryId"], { playerId: string; at: number }>();

  for (const card of cards) {
    for (const match of card.matches) {
      if (match.type !== "belt" || match.status !== "finished" || !match.winnerPlayerId) continue;
      const at = Date.parse(match.scheduledAt ?? card.startsAt ?? card.updatedAt);
      const current = champions.get(match.categoryId);
      if (!current || at >= current.at) {
        champions.set(match.categoryId, { playerId: match.winnerPlayerId, at });
      }
    }
  }

  return new Map([...champions].map(([categoryId, value]) => [categoryId, value.playerId]));
}

export async function getPublicPlayerRankingEntries(): Promise<readonly RankingEntry[]> {
  const cards = await getPublicArenaCards();
  const summaryByPlayer = new Map<string, MutablePlayerRankingSummary>();

  for (const card of cards) {
    for (const match of card.matches) {
      if (match.status !== "finished") continue;
      if (match.playerAScore === null || match.playerBScore === null || !match.winnerPlayerId) continue;

      const winnerId = match.winnerPlayerId;
      const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;
      const winnerGoals = winnerId === match.playerAId ? match.playerAScore : match.playerBScore;
      const loserGoals = winnerId === match.playerAId ? match.playerBScore : match.playerAScore;
      const knockout = Math.abs(winnerGoals - loserGoals) >= 3 && loserGoals === 0;

      const recordForPlayer = (playerId: string, goalsFor: number, goalsAgainst: number, didWin: boolean) => {
        const key = `${match.categoryId}:${playerId}`;
        const current = summaryByPlayer.get(key) ?? {
          playerId,
          categoryId: match.categoryId,
          wins: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          recentForm: [] as MatchOutcome[],
          knockouts: 0,
          dataStatus: "official" as const,
        };

        current.wins += didWin ? 1 : 0;
        current.losses += didWin ? 0 : 1;
        current.goalsFor += goalsFor;
        current.goalsAgainst += goalsAgainst;
        const nextRecentForm: MatchOutcome[] = [...current.recentForm, didWin ? "win" : "loss"];
        current.recentForm = nextRecentForm.slice(-5) as MatchOutcome[];
        if (didWin && knockout) {
          current.knockouts += 1;
        }
        summaryByPlayer.set(key, current);
      };

      recordForPlayer(winnerId, winnerGoals, loserGoals, true);
      recordForPlayer(loserId, loserGoals, winnerGoals, false);
    }
  }

  return [...summaryByPlayer.values()].map((entry) => ({
    ...entry,
    recentForm: [...entry.recentForm],
    knockouts: entry.knockouts,
  }));
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
