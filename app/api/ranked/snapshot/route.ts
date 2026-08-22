import { NextResponse } from "next/server";
import type {
  MatchmakingSnapshotResponse,
  RankedFoundMatchView,
  RankedLobbyView,
  RankedPenaltyView,
  RankedPostMatchResult,
  RankedQueueView,
} from "@/components/ranked/adapter";
import {
  assertNoSupabaseError,
  getAvatarPublicUrl,
  getRankedApiContext,
  nullableNumber,
  nullableString,
  numberValue,
  rankedErrorResponse,
  record,
  stringValue,
  toRankedOpponent,
  toRankedPublicProfile,
} from "@/lib/ranked/api-server";
import { buildPostMatchResult } from "@/lib/ranked/post-match-result";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const context = await getRankedApiContext();
    if (!context.configured || !context.supabase) {
      return NextResponse.json(emptySnapshot(false, false));
    }
    if (!context.user) {
      return NextResponse.json(emptySnapshot(true, false));
    }
    if (!context.profile) {
      return NextResponse.json(emptySnapshot(true, true));
    }

    const { supabase, profile } = context;
    const now = new Date().toISOString();
    const [publicProfileResult, queueResult, matchResult, penaltyResult, queueCount] =
      await Promise.all([
        supabase
          .from("ranked_public_profiles")
          .select("*")
          .eq("id", profile.id)
          .maybeSingle(),
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
      ]);

    assertNoSupabaseError(publicProfileResult);
    assertNoSupabaseError(queueResult);
    assertNoSupabaseError(matchResult);
    assertNoSupabaseError(penaltyResult);
    assertNoSupabaseError(queueCount);
    const playersSearching = Number(queueCount.data ?? 0);

    const publicProfile =
      toRankedPublicProfile(supabase, publicProfileResult.data) ?? {
        id: profile.id,
        username: profile.username,
        avatarUrl: getAvatarPublicUrl(
          supabase,
          profile.avatarPath,
          profile.updatedAt,
        ),
        wins: profile.wins,
        losses: profile.losses,
        mmr: profile.placementMatches === 5 ? profile.mmr : null,
        tier: null,
        globalPosition: null,
        placementMatchesPlayed: profile.placementMatches,
        placementMatchesRequired: 5 as const,
        createdAt: profile.createdAt,
      };

    // The public view deliberately masks anonymous players. This endpoint is
    // authenticated and belongs to the player, so the matchmaking dashboard
    // must show the owner's real identity and private statistics.
    const ownProfile = profile.anonymousMode
      ? {
          ...publicProfile,
          username: profile.username,
          avatarUrl: getAvatarPublicUrl(supabase, profile.avatarPath, profile.updatedAt),
          wins: profile.wins,
          losses: profile.losses,
          mmr: profile.placementMatches === 5 ? profile.mmr : null,
        }
      : publicProfile;

    const queueRow = record(queueResult.data);
    let matchRow = record(matchResult.data);
    if (!matchRow) {
      const { data: confirmedMatches, error: confirmedError } = await supabase
        .from("ranked_matches")
        .select("*")
        .or(`player_one_id.eq.${profile.id},player_two_id.eq.${profile.id}`)
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(10);
      if (confirmedError) throw confirmedError;
      const confirmedIds = (confirmedMatches ?? []).map((match) => match.id);
      const { data: choices, error: choicesError } = confirmedIds.length
        ? await supabase
            .from("ranked_post_match_choices")
            .select("match_id")
            .eq("profile_id", profile.id)
            .in("match_id", confirmedIds)
        : { data: [], error: null };
      if (choicesError) throw choicesError;
      const acknowledged = new Set((choices ?? []).map((choice) => choice.match_id));
      matchRow =
        record((confirmedMatches ?? []).find((match) => !acknowledged.has(match.id))) ??
        null;
    }
    let queue: RankedQueueView | null = {
      state: "idle",
      joinedAt: null,
      searchExpandedAt: null,
      playersSearching: Number.isFinite(playersSearching) ? playersSearching : 0,
    };
    let foundMatch: RankedFoundMatchView | null = null;
    let activeMatch: RankedLobbyView | null = null;
    let postMatchResult: RankedPostMatchResult | null = null;

    if (queueRow) {
      const joinedAt = nullableString(queueRow.joined_at);
      queue = {
        state: stringValue(queueRow.status) === "matched" ? "match_found" : "searching",
        joinedAt,
        searchExpandedAt: null,
        playersSearching: Number.isFinite(playersSearching) ? playersSearching : 0,
      };
    }

    if (matchRow) {
      const playerOneId = stringValue(matchRow.player_one_id);
      const playerTwoId = stringValue(matchRow.player_two_id);
      const { data: players, error: playersError } = await supabase
        .from("ranked_public_profiles")
        .select("*")
        .in("id", [playerOneId, playerTwoId]);
      if (playersError) throw playersError;
      const playerRows = new Map(
        (players ?? []).map((item) => [stringValue(item.id), item]),
      );
      const playerOne = toRankedOpponent(supabase, playerRows.get(playerOneId));
      const playerTwo = toRankedOpponent(supabase, playerRows.get(playerTwoId));
      const opponent =
        profile.id === playerOneId ? playerTwo : playerOne;
      const matchId = stringValue(matchRow.id);
      const status = stringValue(matchRow.status);

      if (status === "awaiting_acceptance" && opponent) {
        const { data: acceptances, error: acceptanceError } = await supabase
          .from("ranked_match_acceptances")
          .select("profile_id,state")
          .eq("match_id", matchId);
        if (acceptanceError) throw acceptanceError;
        const states = new Map(
          (acceptances ?? []).map((item) => [item.profile_id, item.state]),
        );
        foundMatch = {
          matchId,
          opponent,
          acceptanceDeadline: stringValue(matchRow.accept_deadline),
          ownAccepted: states.get(profile.id) === "accepted",
          opponentAccepted: states.get(opponent.id) === "accepted",
        };
        queue = {
          state: "match_found",
          joinedAt: queue?.joinedAt ?? null,
          searchExpandedAt: queue?.searchExpandedAt ?? null,
          playersSearching: Number.isFinite(playersSearching) ? playersSearching : 0,
        };
      } else if (playerOne && playerTwo) {
        const scoreOne = nullableNumber(matchRow.player_one_score);
        const scoreTwo = nullableNumber(matchRow.player_two_score);
        const creatorId = nullableString(matchRow.creator_profile_id) ?? "";
        activeMatch = {
          matchId,
          matchNumber: numberValue(matchRow.match_number),
          state: status as RankedLobbyView["state"],
          roomName: stringValue(matchRow.room_name),
          roomPassword: stringValue(matchRow.room_password),
          creatorId,
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
          assertNoSupabaseError(ledgerResult);
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
      expiresAt:
        nullableString(penaltyRow?.ends_at) ?? profile.frozenUntil ?? null,
      missedAcceptances: profile.queueStrikeCount,
      progressionLevel: profile.noAcceptPenaltyLevel,
    };

    const response: MatchmakingSnapshotResponse = {
      serverNow: new Date().toISOString(),
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
    return NextResponse.json(response);
  } catch (error) {
    return rankedErrorResponse(error);
  }
}
