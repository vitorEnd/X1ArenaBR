"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPostMatchResult } from "@/lib/ranked/post-match-result";
import { normalizeRankedProfile } from "@/lib/ranked/profile";
import { getRankedTier } from "@/lib/ranked/ranks";
import { createClient } from "@/lib/supabase/client";
import type {
  MatchmakingSnapshotResponse,
  RankedFoundMatchView,
  RankedLobbyView,
  RankedMatchIntent,
  RankedMutationResponse,
  RankedOpponent,
  RankedPenaltyView,
  RankedPostMatchResult,
  RankedPublicProfile,
  RankedQueueView,
  RankedTier,
  RankedUiAdapter,
} from "./adapter";
import { rankedUiAdapter } from "./adapter";

type RankedRecord = Record<string, unknown>;

function record(value: unknown): RankedRecord | null {
  return value && typeof value === "object" ? (value as RankedRecord) : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tierValue(value: unknown): RankedTier | null {
  return value === "novato" ||
    value === "pro" ||
    value === "craque" ||
    value === "desafiante" ||
    value === "immortal" ||
    value === "champion"
    ? value
    : null;
}

function avatarUrl(
  supabase: SupabaseClient,
  pathValue: unknown,
  versionValue?: unknown,
): string | null {
  const path = nullableString(pathValue);
  if (!path) return null;
  const publicUrl = supabase.storage.from("ranked-avatars").getPublicUrl(path).data
    .publicUrl;
  const version = nullableString(versionValue);
  return version ? `${publicUrl}?v=${encodeURIComponent(version)}` : publicUrl;
}

function publicProfile(
  supabase: SupabaseClient,
  value: unknown,
): RankedPublicProfile | null {
  const row = record(value);
  if (!row) return null;
  const id = stringValue(row.id);
  const username = stringValue(row.username);
  if (!id || !username) return null;

  const mmr = nullableNumber(row.mmr);
  const globalPosition = nullableNumber(row.global_position);
  const placementMatchesPlayed = numberValue(row.placement_matches);

  return {
    id,
    username,
    avatarUrl: avatarUrl(supabase, row.avatar_path, row.updated_at),
    wins: numberValue(row.wins),
    losses: numberValue(row.losses),
    mmr,
    tier:
      tierValue(row.tier) ??
      (mmr === null ? null : getRankedTier(mmr, globalPosition)),
    globalPosition,
    placementMatchesPlayed,
    placementMatchesRequired: 5,
    createdAt: stringValue(row.created_at, new Date(0).toISOString()),
    anonymousMode: row.anonymous_mode === true,
  };
}

function opponent(
  supabase: SupabaseClient,
  value: unknown,
): RankedOpponent | null {
  const profile = publicProfile(supabase, value);
  return profile
    ? {
        id: profile.id,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        mmr: profile.mmr,
        tier: profile.tier,
        globalPosition: profile.globalPosition,
      }
    : null;
}

function assertResult(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}

function emptySnapshot(
  configured: boolean,
  authenticated: boolean,
): MatchmakingSnapshotResponse {
  return {
    serverNow: new Date().toISOString(),
    configured,
    authenticated,
    profileComplete: false,
    profile: null,
    queue: null,
    foundMatch: null,
    activeMatch: null,
    postMatchResult: null,
    penalty: null,
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

async function getSnapshot(
  signal?: AbortSignal,
): Promise<MatchmakingSnapshotResponse> {
  throwIfAborted(signal);

  let supabase: SupabaseClient;
  try {
    supabase = createClient();
  } catch {
    return emptySnapshot(false, false);
  }

  const userResult = await supabase.auth.getUser();
  throwIfAborted(signal);
  if (userResult.error || !userResult.data.user) {
    return emptySnapshot(true, false);
  }

  const privateProfileResult = await supabase
    .rpc("ranked_get_my_profile")
    .maybeSingle();
  assertResult(privateProfileResult);
  const profile = normalizeRankedProfile(privateProfileResult.data);
  if (!profile) return emptySnapshot(true, true);

  const now = new Date().toISOString();
  const [
    publicProfileResult,
    queueResult,
    matchResult,
    penaltyResult,
    queueCountResult,
    serverClockResult,
  ] = await Promise.all([
    supabase.from("ranked_public_profiles").select("*").eq("id", profile.id).maybeSingle(),
    supabase
      .from("ranked_queue_entries")
      .select(
        "id,profile_id,status,joined_at,heartbeat_at,matched_at,match_id,left_at,created_at,updated_at",
      )
      .eq("profile_id", profile.id)
      .in("status", ["waiting", "matched"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ranked_matches")
      .select("*")
      .or(`player_one_id.eq.${profile.id},player_two_id.eq.${profile.id}`)
      .not("status", "in", "(confirmed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ranked_penalties")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("ranked_get_queue_count"),
    supabase.rpc("ranked_server_now"),
  ]);

  [
    publicProfileResult,
    queueResult,
    matchResult,
    penaltyResult,
    queueCountResult,
    serverClockResult,
  ].forEach(assertResult);
  throwIfAborted(signal);

  const visibleProfile = publicProfile(supabase, publicProfileResult.data) ?? {
    id: profile.id,
    username: profile.username,
    avatarUrl: avatarUrl(supabase, profile.avatarPath, profile.updatedAt),
    wins: profile.wins,
    losses: profile.losses,
    mmr: profile.placementMatches === 5 ? profile.mmr : null,
    tier: null,
    globalPosition: null,
    placementMatchesPlayed: profile.placementMatches,
    placementMatchesRequired: 5 as const,
    createdAt: profile.createdAt,
  };
  const ownProfile = profile.anonymousMode
    ? {
        ...visibleProfile,
        username: profile.username,
        avatarUrl: avatarUrl(supabase, profile.avatarPath, profile.updatedAt),
        wins: profile.wins,
        losses: profile.losses,
        mmr: profile.placementMatches === 5 ? profile.mmr : null,
      }
    : visibleProfile;

  const playersSearching = numberValue(queueCountResult.data);
  const queueRow = record(queueResult.data);
  let matchRow = record(matchResult.data);

  if (!matchRow) {
    const confirmedResult = await supabase
      .from("ranked_matches")
      .select("*")
      .or(`player_one_id.eq.${profile.id},player_two_id.eq.${profile.id}`)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(10);
    assertResult(confirmedResult);
    const confirmedIds = (confirmedResult.data ?? []).map((match) => match.id);
    const choicesResult = confirmedIds.length
      ? await supabase
          .from("ranked_post_match_choices")
          .select("match_id")
          .eq("profile_id", profile.id)
          .in("match_id", confirmedIds)
      : { data: [] as { match_id: string }[], error: null };
    assertResult(choicesResult);
    const acknowledged = new Set(
      (choicesResult.data ?? []).map((choice) => choice.match_id),
    );
    matchRow =
      record(
        (confirmedResult.data ?? []).find(
          (match) => !acknowledged.has(match.id),
        ),
      ) ?? null;
  }

  let queue: RankedQueueView = {
    state: "idle",
    joinedAt: null,
    searchExpandedAt: null,
    playersSearching,
  };
  let foundMatch: RankedFoundMatchView | null = null;
  let activeMatch: RankedLobbyView | null = null;
  let postMatchResult: RankedPostMatchResult | null = null;

  if (queueRow) {
    const joinedAt = nullableString(queueRow.joined_at);
    queue = {
      state: stringValue(queueRow.status) === "matched" ? "match_found" : "searching",
      joinedAt,
      searchExpandedAt: joinedAt
        ? new Date(Date.parse(joinedAt) + 60_000).toISOString()
        : null,
      playersSearching,
    };
  }

  if (matchRow) {
    const playerOneId = stringValue(matchRow.player_one_id);
    const playerTwoId = stringValue(matchRow.player_two_id);
    const playersResult = await supabase
      .from("ranked_public_profiles")
      .select("*")
      .in("id", [playerOneId, playerTwoId]);
    assertResult(playersResult);
    const playerRows = new Map(
      (playersResult.data ?? []).map((item) => [stringValue(item.id), item]),
    );
    const playerOne = opponent(supabase, playerRows.get(playerOneId));
    const playerTwo = opponent(supabase, playerRows.get(playerTwoId));
    const rival = profile.id === playerOneId ? playerTwo : playerOne;
    const matchId = stringValue(matchRow.id);
    const status = stringValue(matchRow.status);

    if (status === "awaiting_acceptance" && rival) {
      const acceptanceResult = await supabase
        .from("ranked_match_acceptances")
        .select("profile_id,state")
        .eq("match_id", matchId);
      assertResult(acceptanceResult);
      const states = new Map(
        (acceptanceResult.data ?? []).map((item) => [item.profile_id, item.state]),
      );
      foundMatch = {
        matchId,
        opponent: rival,
        acceptanceDeadline: stringValue(matchRow.accept_deadline),
        ownAccepted: states.get(profile.id) === "accepted",
        opponentAccepted: states.get(rival.id) === "accepted",
      };
      queue = { ...queue, state: "match_found" };
    } else if (playerOne && playerTwo) {
      const scoreOne = nullableNumber(matchRow.player_one_score);
      const scoreTwo = nullableNumber(matchRow.player_two_score);
      activeMatch = {
        matchId,
        matchNumber: numberValue(matchRow.match_number),
        state: status as RankedLobbyView["state"],
        roomName: stringValue(matchRow.room_name),
        roomPassword: stringValue(matchRow.room_password),
        creatorId: nullableString(matchRow.creator_profile_id) ?? "",
        viewerId: profile.id,
        playerA: playerOne,
        playerB: playerTwo,
        startedAt: nullableString(matchRow.started_at),
        endedAt: nullableString(matchRow.ended_at),
        scoreSubmissionDeadline: nullableString(matchRow.score_deadline),
        confirmationDeadline: nullableString(matchRow.confirmation_deadline),
        submittedScore:
          scoreOne !== null && scoreTwo !== null
            ? { playerAGoals: scoreOne, playerBGoals: scoreTwo }
            : null,
      };

      if (status === "confirmed") {
        const ledgerResult = await supabase
          .from("ranked_mmr_ledger")
          .select("old_mmr,new_mmr,delta,is_placement")
          .eq("match_id", matchId)
          .eq("profile_id", profile.id)
          .maybeSingle();
        assertResult(ledgerResult);
        const ledgerRow = record(ledgerResult.data);
        if (ledgerRow) {
          postMatchResult = buildPostMatchResult({
            matchId,
            matchNumber: numberValue(matchRow.match_number),
            viewerId: profile.id,
            winnerProfileId: stringValue(matchRow.winner_profile_id),
            isPlacement: ledgerRow.is_placement === true,
            placementMatchesPlayed: ownProfile.placementMatchesPlayed,
            placementMatchesRequired: ownProfile.placementMatchesRequired,
            currentMmr: ownProfile.mmr,
            currentTier: ownProfile.tier,
            oldMmr: nullableNumber(ledgerRow.old_mmr),
            newMmr: nullableNumber(ledgerRow.new_mmr),
            mmrDelta: nullableNumber(ledgerRow.delta),
          });
        }
      }
    }
  }

  const penaltyRow = record(penaltyResult.data);
  const profileFrozen =
    profile.bannedAt !== null ||
    (profile.frozenUntil !== null && Date.parse(profile.frozenUntil) > Date.now());
  const penalty: RankedPenaltyView = {
    active: Boolean(penaltyRow) || profileFrozen,
    expiresAt: nullableString(penaltyRow?.ends_at) ?? profile.frozenUntil,
    missedAcceptances: profile.queueStrikeCount,
    progressionLevel: profile.noAcceptPenaltyLevel,
  };

  return {
    serverNow: stringValue(serverClockResult.data, new Date().toISOString()),
    configured: true,
    authenticated: true,
    profileComplete: true,
    profile: ownProfile,
    queue,
    foundMatch,
    activeMatch,
    postMatchResult,
    penalty,
  };
}

async function activeQueueEntryId(supabase: SupabaseClient): Promise<string> {
  const result = await supabase
    .from("ranked_queue_entries")
    .select("id")
    .in("status", ["waiting", "matched"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertResult(result);
  if (!result.data?.id) throw new Error("Você não está em uma fila ativa.");
  return result.data.id;
}

async function updateQueue(
  intent: "join" | "leave" | "heartbeat",
): Promise<RankedMutationResponse> {
  const supabase = createClient();

  if (intent === "join") {
    const joinResult = await supabase.rpc("ranked_join_queue");
    assertResult(joinResult);
    const matchResult = await supabase.rpc("ranked_try_matchmake");
    assertResult(matchResult);
  } else {
    const entryId = await activeQueueEntryId(supabase);
    const result = await supabase.rpc(
      intent === "leave" ? "ranked_leave_queue" : "ranked_queue_heartbeat",
      { p_queue_entry_id: entryId },
    );
    assertResult(result);
    if (intent === "heartbeat") {
      const matchResult = await supabase.rpc("ranked_try_matchmake");
      assertResult(matchResult);
    }
  }

  return {
    ok: true,
    message:
      intent === "join"
        ? "Busca iniciada."
        : intent === "leave"
          ? "Você saiu da fila."
          : "Fila sincronizada.",
  };
}

async function updateMatch(
  matchId: string,
  payload: RankedMatchIntent,
): Promise<RankedMutationResponse> {
  const supabase = createClient();
  const params = { p_match_id: matchId };
  let result: { error: { message: string } | null };

  switch (payload.intent) {
    case "accept":
    case "decline":
      result = await supabase.rpc("ranked_respond_to_match", {
        ...params,
        p_accept: payload.intent === "accept",
      });
      break;
    case "end":
      result = await supabase.rpc("ranked_end_match", params);
      break;
    case "confirm":
    case "contest":
      result = await supabase.rpc("ranked_confirm_result", {
        ...params,
        p_approve: payload.intent === "confirm",
      });
      break;
    case "continue":
    case "finish":
      result = await supabase.rpc("ranked_acknowledge_post_match", {
        ...params,
        p_requeue: payload.intent === "continue",
      });
      break;
    case "submit-score": {
      if (payload.playerAGoals === payload.playerBGoals) {
        throw new Error("A ranked não permite placar empatado.");
      }
      const matchResult = await supabase
        .from("ranked_matches")
        .select("player_one_id,creator_profile_id")
        .eq("id", matchId)
        .single();
      assertResult(matchResult);
      const creatorIsPlayerA =
        matchResult.data.creator_profile_id === matchResult.data.player_one_id;
      result = await supabase.rpc("ranked_submit_score", {
        ...params,
        p_creator_goals: creatorIsPlayerA
          ? payload.playerAGoals
          : payload.playerBGoals,
        p_opponent_goals: creatorIsPlayerA
          ? payload.playerBGoals
          : payload.playerAGoals,
      });
      break;
    }
    case "report":
      result = await supabase.rpc("ranked_report_problem", {
        ...params,
        p_category: payload.category,
        p_observation: payload.observation,
      });
      break;
  }

  assertResult(result);
  return {
    ok: true,
    message:
      payload.intent === "report"
        ? "Problema enviado ao suporte. O lobby foi congelado."
        : payload.intent === "contest"
          ? "Resultado contestado e enviado ao suporte."
          : "Partida atualizada.",
  };
}

export const supabaseMatchmakingAdapter: RankedUiAdapter = {
  ...rankedUiAdapter,
  getSnapshot,
  updateQueue,
  updateMatch,
};
