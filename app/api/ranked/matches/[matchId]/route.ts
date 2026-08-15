import { NextResponse } from "next/server";
import { z } from "zod";
import type { RankedMutationResponse } from "@/components/ranked/adapter";
import {
  assertNoSupabaseError,
  rankedErrorResponse,
  RankedRequestError,
  requireRankedApiContext,
} from "@/lib/ranked/api-server";

const matchIntentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.enum([
      "accept",
      "decline",
      "end",
      "confirm",
      "contest",
      "continue",
      "finish",
    ]),
  }),
  z.object({
    intent: z.literal("submit-score"),
    playerAGoals: z.number().int().min(0).max(2_147_483_647),
    playerBGoals: z.number().int().min(0).max(2_147_483_647),
  }),
  z.object({
    intent: z.literal("report"),
    category: z.enum([
      "room_not_created",
      "incorrect_password",
      "opponent_absent",
      "abandonment",
      "technical_problem",
      "misconduct",
      "other",
    ]),
    observation: z.string().trim().min(10).max(1000),
  }),
]);

const matchIdSchema = z.string().uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId: rawMatchId } = await context.params;
    const matchId = matchIdSchema.safeParse(rawMatchId);
    if (!matchId.success) throw new RankedRequestError("Partida inválida.");

    const payload = matchIntentSchema.safeParse(await request.json());
    if (!payload.success) {
      throw new RankedRequestError("Os dados enviados para a partida são inválidos.");
    }
    const { supabase } = await requireRankedApiContext();
    const params = { p_match_id: matchId.data };

    switch (payload.data.intent) {
      case "accept":
      case "decline":
        assertNoSupabaseError(
          await supabase.rpc("ranked_respond_to_match", {
            ...params,
            p_accept: payload.data.intent === "accept",
          }),
        );
        break;
      case "end":
        assertNoSupabaseError(await supabase.rpc("ranked_end_match", params));
        break;
      case "confirm":
      case "contest":
        assertNoSupabaseError(
          await supabase.rpc("ranked_confirm_result", {
            ...params,
            p_approve: payload.data.intent === "confirm",
          }),
        );
        break;
      case "continue":
      case "finish":
        assertNoSupabaseError(
          await supabase.rpc("ranked_acknowledge_post_match", {
            ...params,
            p_requeue: payload.data.intent === "continue",
          }),
        );
        break;
      case "submit-score": {
        if (payload.data.playerAGoals === payload.data.playerBGoals) {
          throw new RankedRequestError("A ranked não permite placar empatado.");
        }
        const { data: match, error } = await supabase
          .from("ranked_matches")
          .select("player_one_id,creator_profile_id")
          .eq("id", matchId.data)
          .single();
        if (error) throw error;
        const creatorIsPlayerA = match.creator_profile_id === match.player_one_id;
        assertNoSupabaseError(
          await supabase.rpc("ranked_submit_score", {
            ...params,
            p_creator_goals: creatorIsPlayerA
              ? payload.data.playerAGoals
              : payload.data.playerBGoals,
            p_opponent_goals: creatorIsPlayerA
              ? payload.data.playerBGoals
              : payload.data.playerAGoals,
          }),
        );
        break;
      }
      case "report":
        assertNoSupabaseError(
          await supabase.rpc("ranked_report_problem", {
            ...params,
            p_category: payload.data.category,
            p_observation: payload.data.observation,
          }),
        );
        break;
    }

    assertNoSupabaseError(await supabase.rpc("ranked_reconcile"));
    const response: RankedMutationResponse = {
      ok: true,
      message:
        payload.data.intent === "report"
          ? "Problema enviado ao suporte. O lobby foi congelado."
          : payload.data.intent === "contest"
            ? "Resultado contestado e enviado ao suporte."
            : "Partida atualizada.",
    };
    return NextResponse.json(response);
  } catch (error) {
    return rankedErrorResponse(error);
  }
}
