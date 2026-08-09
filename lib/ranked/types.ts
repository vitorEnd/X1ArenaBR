export type RankedTier =
  | "novato"
  | "pro"
  | "craque"
  | "desafiante"
  | "immortal"
  | "champion";

export type RankedQueueStatus =
  | "waiting"
  | "matched"
  | "completed"
  | "cancelled"
  | "expired";

export type RankedMatchStatus =
  | "awaiting_acceptance"
  | "lobby"
  | "in_progress"
  | "awaiting_score"
  | "awaiting_confirmation"
  | "frozen"
  | "disputed"
  | "confirmed"
  | "cancelled";

export type RankedAcceptanceState =
  | "pending"
  | "accepted"
  | "declined"
  | "expired";

export type RankedConfirmationState =
  | "pending"
  | "approved"
  | "contested"
  | "auto_approved";

export type RankedResolutionSource = "players" | "automatic" | "support";

export type RankedReportCategory =
  | "room_not_created"
  | "incorrect_password"
  | "opponent_absent"
  | "abandonment"
  | "technical_problem"
  | "misconduct"
  | "other";

export interface RankedProfile {
  readonly id: string;
  readonly username: string;
  readonly avatarPath: string | null;
  readonly wins: number;
  readonly losses: number;
  /** Public only after all five placement matches are complete. */
  readonly mmr: number | null;
  readonly tier: RankedTier | null;
  readonly globalPosition: number | null;
  readonly placementMatches: number;
  readonly placementWins: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RankedLeaderboardEntry extends RankedProfile {
  readonly mmr: number;
  readonly tier: RankedTier;
  readonly globalPosition: number;
}

export interface RankedQueueEntry {
  readonly id: string;
  readonly profileId: string;
  readonly status: RankedQueueStatus;
  readonly effectiveMmr: number;
  readonly joinedAt: string;
  readonly heartbeatAt: string;
  readonly matchId: string | null;
}

export interface RankedMatch {
  readonly id: string;
  readonly matchNumber: number;
  readonly playerOneId: string;
  readonly playerTwoId: string;
  readonly creatorProfileId: string | null;
  readonly status: RankedMatchStatus;
  readonly acceptDeadline: string;
  readonly roomName: string | null;
  /** Returned only to participants or support. */
  readonly roomPassword: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly scoreDeadline: string | null;
  readonly confirmationDeadline: string | null;
  readonly playerOneScore: number | null;
  readonly playerTwoScore: number | null;
  readonly winnerProfileId: string | null;
  readonly loserProfileId: string | null;
  readonly resolutionSource: RankedResolutionSource | null;
  readonly confirmedAt: string | null;
  readonly cancelledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RankedPostMatchChoice {
  readonly id: string;
  readonly matchId: string;
  readonly profileId: string;
  readonly requeue: boolean;
  readonly acknowledgedAt: string;
}

export interface RankedMmrChange {
  readonly winnerBefore: number;
  readonly winnerAfter: number;
  readonly loserBefore: number;
  readonly loserAfter: number;
  readonly nominalDelta: number;
  readonly winnerDelta: number;
  readonly loserDelta: number;
}

export interface RankedPlacementState {
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly matchesRemaining: number;
  readonly complete: boolean;
  readonly revealedMmr: number | null;
}
