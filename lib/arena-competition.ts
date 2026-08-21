import { officialPlayers } from "../data/arena.ts";
import type { ArenaCard, ArenaCardMatch } from "./arena-card-types";
import type { CategoryId, Champion, MatchOutcome, RankingEntry } from "./types";

type FinishedArenaMatch = {
  readonly match: ArenaCardMatch;
  readonly occurredAt: string;
  readonly timestamp: number;
  readonly sourceOrder: number;
};

type MutablePlayerRankingSummary = {
  playerId: string;
  categoryId: CategoryId;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  recentForm: MatchOutcome[];
  knockouts: number;
  dataStatus: "official";
};

const officialPlayerIdByNormalizedId = new Map(
  officialPlayers.map((player) => [player.id.trim().toLocaleLowerCase("pt-BR"), player.id]),
);

export function getCanonicalOfficialPlayerId(playerId: string): string {
  const normalizedId = playerId.trim().toLocaleLowerCase("pt-BR");
  return officialPlayerIdByNormalizedId.get(normalizedId) ?? playerId.trim();
}

function getMatchOccurredAt(card: ArenaCard, match: ArenaCardMatch): string {
  return match.scheduledAt ?? card.startsAt ?? card.updatedAt;
}

function getFinishedMatchesChronologically(
  cards: readonly ArenaCard[],
): readonly FinishedArenaMatch[] {
  let sourceOrder = 0;

  return cards
    .flatMap((card) =>
      card.matches.map((match) => {
        const occurredAt = getMatchOccurredAt(card, match);
        const parsedTimestamp = Date.parse(occurredAt);

        return {
          match,
          occurredAt,
          timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0,
          sourceOrder: sourceOrder++,
        };
      }),
    )
    .filter(({ match }) => match.status === "finished")
    .sort(
      (first, second) =>
        first.timestamp - second.timestamp ||
        first.match.position - second.match.position ||
        first.sourceOrder - second.sourceOrder,
    );
}

export function derivePublicChampionsByCategory(
  cards: readonly ArenaCard[],
): ReadonlyMap<CategoryId, Champion> {
  const champions = new Map<CategoryId, Champion>();

  for (const { match, occurredAt } of getFinishedMatchesChronologically(cards)) {
    if (match.type !== "belt" || !match.winnerPlayerId) continue;

    const current = champions.get(match.categoryId);
    if (current?.playerId === match.winnerPlayerId) {
      champions.set(match.categoryId, {
        ...current,
        defenses: current.defenses + 1,
      });
      continue;
    }

    champions.set(match.categoryId, {
      id: `arena-card-champion:${match.categoryId}`,
      playerId: match.winnerPlayerId,
      categoryId: match.categoryId,
      type: "official",
      defenses: 0,
      wonAt: occurredAt,
      dataStatus: "official",
    });
  }

  return champions;
}

export function derivePublicPlayerRankingEntries(
  cards: readonly ArenaCard[],
): readonly RankingEntry[] {
  const summaryByPlayer = new Map<string, MutablePlayerRankingSummary>();

  for (const { match } of getFinishedMatchesChronologically(cards)) {
    if (match.playerAScore === null || match.playerBScore === null || !match.winnerPlayerId) {
      continue;
    }

    const winnerId = match.winnerPlayerId;
    const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;
    const winnerGoals = winnerId === match.playerAId ? match.playerAScore : match.playerBScore;
    const loserGoals = winnerId === match.playerAId ? match.playerBScore : match.playerAScore;
    const knockout = Math.abs(winnerGoals - loserGoals) >= 3 && loserGoals === 0;

    const recordForPlayer = (
      playerId: string,
      goalsFor: number,
      goalsAgainst: number,
      didWin: boolean,
    ) => {
      const key = `${match.categoryId}:${playerId}`;
      const current = summaryByPlayer.get(key) ?? {
        playerId,
        categoryId: match.categoryId,
        wins: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        recentForm: [],
        knockouts: 0,
        dataStatus: "official" as const,
      };

      current.wins += didWin ? 1 : 0;
      current.losses += didWin ? 0 : 1;
      current.goalsFor += goalsFor;
      current.goalsAgainst += goalsAgainst;
      const outcome: MatchOutcome = didWin ? "win" : "loss";
      current.recentForm = [...current.recentForm, outcome].slice(-5);
      if (didWin && knockout) current.knockouts += 1;
      summaryByPlayer.set(key, current);
    };

    recordForPlayer(winnerId, winnerGoals, loserGoals, true);
    recordForPlayer(loserId, loserGoals, winnerGoals, false);
  }

  return [...summaryByPlayer.values()].map((entry) => ({
    ...entry,
    recentForm: [...entry.recentForm],
  }));
}

export function getCategoryPlayerRankingKey(
  categoryId: CategoryId,
  playerId: string,
): string {
  return `${categoryId}:${playerId}`;
}
