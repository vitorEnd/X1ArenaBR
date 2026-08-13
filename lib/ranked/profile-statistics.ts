export interface RankedProfileStatisticsMatch {
  readonly opponentUsername: string;
  readonly opponentAvatarUrl: string | null;
  readonly ownGoals: number | null;
  readonly opponentGoals: number | null;
  readonly outcome: "win" | "loss";
}

export interface RankedOpponentStatistic {
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly matches: number;
}

export interface RankedProfileStatistics {
  readonly matches: number;
  readonly wins: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly winRate: number | null;
  readonly mostBeatenOpponent: RankedOpponentStatistic | null;
  readonly mostLostToOpponent: RankedOpponentStatistic | null;
}

interface OpponentCounter {
  readonly username: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
}

function selectOpponent(
  opponents: Iterable<OpponentCounter>,
  field: "wins" | "losses",
): RankedOpponentStatistic | null {
  const ranked = [...opponents]
    .filter((opponent) => opponent[field] > 0)
    .sort((a, b) => {
      const difference = b[field] - a[field];
      return difference || a.username.localeCompare(b.username, "pt-BR");
    });
  const leader = ranked[0];

  return leader
    ? {
        username: leader.username,
        avatarUrl: leader.avatarUrl,
        matches: leader[field],
      }
    : null;
}

/**
 * Derives public stats exclusively from confirmed match history. Walkovers count
 * as wins/losses, but never fabricate goals for either player.
 */
export function calculateRankedProfileStatistics(
  matches: readonly RankedProfileStatisticsMatch[],
): RankedProfileStatistics {
  let wins = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const opponents = new Map<string, OpponentCounter>();

  for (const match of matches) {
    const normalizedName = match.opponentUsername.trim();
    const opponentKey = normalizedName.toLocaleLowerCase("pt-BR");
    const opponent = opponents.get(opponentKey) ?? {
      username: normalizedName,
      avatarUrl: match.opponentAvatarUrl,
      wins: 0,
      losses: 0,
    };

    if (!opponent.avatarUrl && match.opponentAvatarUrl) {
      opponent.avatarUrl = match.opponentAvatarUrl;
    }

    if (match.outcome === "win") {
      wins += 1;
      opponent.wins += 1;
    } else {
      losses += 1;
      opponent.losses += 1;
    }
    opponents.set(opponentKey, opponent);

    if (match.ownGoals !== null && match.opponentGoals !== null) {
      goalsFor += match.ownGoals;
      goalsAgainst += match.opponentGoals;
    }
  }

  const totalMatches = wins + losses;

  return {
    matches: totalMatches,
    wins,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 1_000) / 10 : null,
    mostBeatenOpponent: selectOpponent(opponents.values(), "wins"),
    mostLostToOpponent: selectOpponent(opponents.values(), "losses"),
  };
}
