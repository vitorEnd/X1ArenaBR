import type { RankedProfileStatistics } from "@/lib/ranked/profile-statistics";

export type RankedTier =
  | "novato"
  | "pro"
  | "craque"
  | "desafiante"
  | "immortal"
  | "champion";

export type RankedLeaderboardFilter =
  | RankedTier
  | "all"
  | "placement"
  | "no-matches";

export type RankedMatchState =
  | "awaiting_acceptance"
  | "lobby"
  | "in_progress"
  | "awaiting_score"
  | "awaiting_confirmation"
  | "frozen"
  | "disputed"
  | "confirmed"
  | "cancelled";

export type RankedQueueState = "idle" | "searching" | "match_found";

export type RankedReportCategory =
  | "room_not_created"
  | "incorrect_password"
  | "opponent_absent"
  | "abandonment"
  | "technical_problem"
  | "misconduct"
  | "other";

export interface RankedPublicProfile {
  readonly id: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly wins: number;
  readonly losses: number;
  readonly mmr: number | null;
  readonly tier: RankedTier | null;
  readonly globalPosition: number | null;
  readonly placementMatchesPlayed: number;
  readonly placementMatchesRequired: 5;
  readonly createdAt: string;
}

export interface RankedOpponent {
  readonly id: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly mmr: number | null;
  readonly tier: RankedTier | null;
  readonly globalPosition: number | null;
}

export interface RankedPenaltyView {
  readonly active: boolean;
  readonly expiresAt: string | null;
  readonly missedAcceptances: number;
  readonly progressionLevel: number;
}

export interface RankedQueueView {
  readonly state: RankedQueueState;
  readonly joinedAt: string | null;
  readonly searchExpandedAt: string | null;
  readonly playersSearching: number;
}

export interface RankedFoundMatchView {
  readonly matchId: string;
  readonly opponent: RankedOpponent;
  readonly acceptanceDeadline: string;
  readonly ownAccepted: boolean;
  readonly opponentAccepted: boolean;
}

export interface RankedLobbyView {
  readonly matchId: string;
  readonly matchNumber: number;
  readonly state: RankedMatchState;
  readonly roomName: string;
  readonly roomPassword: string;
  readonly creatorId: string;
  readonly viewerId: string;
  readonly playerA: RankedOpponent;
  readonly playerB: RankedOpponent;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly scoreSubmissionDeadline: string | null;
  readonly confirmationDeadline: string | null;
  readonly submittedScore: {
    readonly playerAGoals: number;
    readonly playerBGoals: number;
  } | null;
}

export type RankedPostMatchRankChange =
  | "promoted"
  | "demoted"
  | "unchanged"
  | "placement_revealed";

/** Private result projection returned only to the authenticated participant. */
export interface RankedPostMatchResult {
  readonly matchId: string;
  readonly matchNumber: number;
  readonly outcome: "win" | "loss";
  /** True while MMR must remain hidden during the first four placements. */
  readonly placementPending: boolean;
  readonly oldMmr: number | null;
  readonly newMmr: number | null;
  readonly mmrDelta: number | null;
  readonly previousTier: RankedTier | null;
  readonly nextTier: RankedTier | null;
  readonly rankChange: RankedPostMatchRankChange;
}

export interface MatchmakingSnapshotResponse {
  /** Authoritative database time captured while this snapshot was generated. */
  readonly serverNow?: string;
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly profileComplete: boolean;
  readonly profile: RankedPublicProfile | null;
  readonly queue: RankedQueueView | null;
  readonly foundMatch: RankedFoundMatchView | null;
  readonly activeMatch: RankedLobbyView | null;
  readonly postMatchResult: RankedPostMatchResult | null;
  readonly penalty: RankedPenaltyView | null;
}

export interface RankedHistoryEntry {
  readonly id: string;
  readonly matchNumber: number;
  readonly opponentUsername: string;
  readonly opponentAvatarUrl: string | null;
  readonly ownGoals: number | null;
  readonly opponentGoals: number | null;
  readonly outcome: "win" | "loss";
  readonly method: "score" | "walkover";
  readonly resolutionSource: "players" | "automatic" | "support";
  readonly mmrChange: number | null;
  readonly previousTier: RankedTier | null;
  readonly nextTier: RankedTier | null;
  readonly confirmedAt: string;
}

export interface RankedProfileResponse {
  readonly configured: boolean;
  readonly profile: RankedPublicProfile | null;
  readonly statistics: RankedProfileStatistics | null;
  readonly history: readonly RankedHistoryEntry[];
}

export type RankedLeaderboardEntry = RankedPublicProfile;

export interface RankedLeaderboardResponse {
  readonly configured: boolean;
  readonly entries: readonly RankedLeaderboardEntry[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalEntries: number;
}

export interface RankedSupportMatch {
  readonly id: string;
  readonly matchNumber: number;
  readonly state: RankedMatchState;
  readonly playerA: RankedOpponent;
  readonly playerB: RankedOpponent;
  readonly reportCategory: string | null;
  readonly reportObservation: string | null;
  readonly frozenAt: string | null;
  readonly submittedScore: {
    readonly playerAGoals: number;
    readonly playerBGoals: number;
  } | null;
}

export interface RankedSupportHistoryMatch extends RankedSupportMatch {
  readonly confirmedAt: string;
  readonly playerACurrentMmr: number;
  readonly playerBCurrentMmr: number;
}

export interface RankedSupportQueueEntry {
  readonly profileId: string;
  readonly username: string;
  readonly tier: RankedTier | null;
  readonly joinedAt: string;
}

export interface RankedSupportAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly targetLabel: string;
  readonly createdAt: string;
}

export interface RankedSupportAccount {
  readonly profileId: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly mmr: number | null;
  readonly tier: RankedTier | null;
  readonly frozen: boolean;
  readonly banned: boolean;
  readonly penaltyExpiresAt: string | null;
  readonly usernameHistory: readonly {
    readonly previousUsername: string;
    readonly nextUsername: string;
    readonly changedAt: string;
  }[];
}

export interface RankedSupportResponse {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly authorized: boolean;
  readonly queue: readonly RankedSupportQueueEntry[];
  readonly activeLobbies: readonly RankedSupportMatch[];
  readonly frozenMatches: readonly RankedSupportMatch[];
  readonly matchHistory: readonly RankedSupportHistoryMatch[];
  readonly accounts: readonly RankedSupportAccount[];
  readonly audit: readonly RankedSupportAuditEntry[];
}

export type RankedMatchIntent =
  | { readonly intent: "accept" | "decline" | "start" | "end" | "confirm" | "contest" | "continue" | "finish" }
  | {
      readonly intent: "submit-score";
      readonly playerAGoals: number;
      readonly playerBGoals: number;
    }
  | {
      readonly intent: "report";
      readonly category: RankedReportCategory;
      readonly observation: string;
    };

export type RankedSupportIntent =
  | {
      readonly intent: "reset-ranked";
      readonly password: string;
    }
  | {
      readonly intent: "correct-history-match";
      readonly matchId: string;
      readonly playerAGoals: number;
      readonly playerBGoals: number;
      readonly playerAMmr: number;
      readonly playerBMmr: number;
      readonly internalNote: string;
    }
  | {
      readonly intent: "resolve-match";
      readonly matchId: string;
      readonly resolution: "confirm" | "walkover-a" | "walkover-b" | "cancel";
      readonly playerAGoals?: number;
      readonly playerBGoals?: number;
      readonly internalNote: string;
    }
  | {
      readonly intent: "adjust-mmr";
      readonly profileId: string;
      readonly newMmr: number;
      readonly internalNote: string;
    }
  | {
      readonly intent: "account-action";
      readonly profileId: string;
      readonly action: "freeze" | "unfreeze" | "ban" | "unban" | "penalize";
      readonly durationSeconds?: number;
      readonly internalNote: string;
    };

export interface RankedMutationResponse {
  readonly ok: boolean;
  readonly message: string;
}

export class RankedApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RankedApiError";
    this.status = status;
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new RankedApiError(
      payload?.message ?? "Não foi possível concluir a ação. Tente novamente.",
      response.status,
    );
  }

  return payload as T;
}

export interface RankedUiAdapter {
  getSnapshot(signal?: AbortSignal): Promise<MatchmakingSnapshotResponse>;
  updateQueue(intent: "join" | "leave" | "heartbeat"): Promise<RankedMutationResponse>;
  updateMatch(matchId: string, payload: RankedMatchIntent): Promise<RankedMutationResponse>;
  getLeaderboard(
    query: string,
    rank: RankedLeaderboardFilter,
    page: number,
    signal?: AbortSignal,
  ): Promise<RankedLeaderboardResponse>;
  getProfile(username: string, signal?: AbortSignal): Promise<RankedProfileResponse>;
  getSupport(query: string, signal?: AbortSignal): Promise<RankedSupportResponse>;
  updateSupport(payload: RankedSupportIntent): Promise<RankedMutationResponse>;
}

export const rankedUiAdapter: RankedUiAdapter = {
  getSnapshot(signal) {
    return requestJson<MatchmakingSnapshotResponse>("/api/ranked/snapshot", { signal });
  },
  updateQueue(intent) {
    return requestJson<RankedMutationResponse>("/api/ranked/queue", {
      method: "POST",
      body: JSON.stringify({ intent }),
    });
  },
  updateMatch(matchId, payload) {
    return requestJson<RankedMutationResponse>(
      `/api/ranked/matches/${encodeURIComponent(matchId)}`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  getLeaderboard(query, rank, page, signal) {
    const parameters = new URLSearchParams({ query, rank, page: String(page) });
    return requestJson<RankedLeaderboardResponse>(
      `/api/ranked/leaderboard?${parameters.toString()}`,
      { signal },
    );
  },
  getProfile(username, signal) {
    return requestJson<RankedProfileResponse>(
      `/api/ranked/profiles/${encodeURIComponent(username)}`,
      { signal },
    );
  },
  getSupport(query, signal) {
    const parameters = new URLSearchParams({ query });
    return requestJson<RankedSupportResponse>(
      `/api/ranked/support?${parameters.toString()}`,
      { signal },
    );
  },
  updateSupport(payload) {
    return requestJson<RankedMutationResponse>("/api/ranked/support", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
