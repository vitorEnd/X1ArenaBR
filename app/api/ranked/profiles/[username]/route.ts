import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  RankedHistoryEntry,
  RankedProfileResponse,
} from "@/components/ranked/adapter";
import {
  getAvatarPublicUrl,
  getRankedApiContext,
  nullableNumber,
  numberValue,
  rankedErrorResponse,
  RankedRequestError,
  stringValue,
  toRankedPublicProfile,
} from "@/lib/ranked/api-server";
import { getRankedTier } from "@/lib/ranked/ranks";

export const dynamic = "force-dynamic";

const usernameSchema = z.string().trim().min(3).max(24);

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  try {
    const { username: rawUsername } = await context.params;
    const username = usernameSchema.safeParse(rawUsername);
    if (!username.success) throw new RankedRequestError("Perfil ranked inválido.");

    const api = await getRankedApiContext();
    if (!api.configured || !api.supabase) {
      const response: RankedProfileResponse = {
        configured: false,
        profile: null,
        history: [],
      };
      return NextResponse.json(response);
    }

    const { data: profileRow, error: profileError } = await api.supabase
      .from("ranked_public_profiles")
      .select("*")
      .eq("username", username.data)
      .maybeSingle();
    if (profileError) throw profileError;
    const profile = toRankedPublicProfile(api.supabase, profileRow);
    if (!profile) {
      throw new RankedRequestError("Perfil ranked não encontrado.", 404);
    }

    const { data: matches, error: historyError } = await api.supabase
      .from("ranked_public_match_history")
      .select("*")
      .or(`player_one_id.eq.${profile.id},player_two_id.eq.${profile.id}`)
      .order("confirmed_at", { ascending: false })
      .limit(50);
    if (historyError) throw historyError;

    const history: RankedHistoryEntry[] = (matches ?? []).map((match) => {
      const viewerIsPlayerOne = match.player_one_id === profile.id;
      const ownGoals = nullableNumber(
        viewerIsPlayerOne ? match.player_one_score : match.player_two_score,
      );
      const opponentGoals = nullableNumber(
        viewerIsPlayerOne ? match.player_two_score : match.player_one_score,
      );
      const oldMmr = nullableNumber(
        viewerIsPlayerOne ? match.player_one_old_mmr : match.player_two_old_mmr,
      );
      const newMmr = nullableNumber(
        viewerIsPlayerOne ? match.player_one_new_mmr : match.player_two_new_mmr,
      );
      const wasPlacement = Boolean(
        viewerIsPlayerOne
          ? match.player_one_was_placement
          : match.player_two_was_placement,
      );
      const mmrChange = wasPlacement
        ? null
        : numberValue(
            viewerIsPlayerOne
              ? match.player_one_mmr_delta
              : match.player_two_mmr_delta,
          );

      return {
        id: stringValue(match.id),
        matchNumber: numberValue(match.match_number),
        opponentUsername: stringValue(
          viewerIsPlayerOne
            ? match.player_two_username
            : match.player_one_username,
        ),
        opponentAvatarUrl: getAvatarPublicUrl(
          api.supabase!,
          viewerIsPlayerOne
            ? match.player_two_avatar_path
            : match.player_one_avatar_path,
        ),
        ownGoals,
        opponentGoals,
        outcome: match.winner_profile_id === profile.id ? "win" : "loss",
        method: ownGoals === null || opponentGoals === null ? "walkover" : "score",
        resolutionSource:
          match.resolution_source === "automatic" ||
          match.resolution_source === "support"
            ? match.resolution_source
            : "players",
        mmrChange,
        previousTier: oldMmr === null ? null : getRankedTier(oldMmr, null),
        nextTier: newMmr === null ? null : getRankedTier(newMmr, null),
        confirmedAt: stringValue(match.confirmed_at),
      };
    });

    const response: RankedProfileResponse = {
      configured: true,
      profile,
      history,
    };
    return NextResponse.json(response);
  } catch (error) {
    return rankedErrorResponse(error);
  }
}
