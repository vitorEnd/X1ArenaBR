import { NextResponse } from "next/server";
import { z } from "zod";
import type { RankedMutationResponse } from "@/components/ranked/adapter";
import {
  assertNoSupabaseError,
  rankedErrorResponse,
  RankedRequestError,
  requireRankedApiContext,
} from "@/lib/ranked/api-server";

const queueRequestSchema = z.object({
  intent: z.enum(["join", "leave", "heartbeat"]),
});

export async function POST(request: Request) {
  try {
    const payload = queueRequestSchema.safeParse(await request.json());
    if (!payload.success) {
      throw new RankedRequestError("Ação de fila inválida.");
    }
    const { supabase, profile } = await requireRankedApiContext();
    if (!profile) {
      throw new RankedRequestError("Finalize seu perfil ranked antes de entrar na fila.", 409);
    }

    await supabase.rpc("ranked_reconcile");

    if (payload.data.intent === "join") {
      assertNoSupabaseError(await supabase.rpc("ranked_join_queue"));
      assertNoSupabaseError(await supabase.rpc("ranked_try_matchmake"));
    } else {
      const { data: queueEntry, error } = await supabase
        .from("ranked_queue_entries")
        .select("id")
        .eq("profile_id", profile.id)
        .in("status", ["waiting", "matched"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!queueEntry) {
        throw new RankedRequestError("Você não está em uma fila ativa.", 409);
      }

      if (payload.data.intent === "leave") {
        assertNoSupabaseError(
          await supabase.rpc("ranked_leave_queue", {
            p_queue_entry_id: queueEntry.id,
          }),
        );
      } else {
        assertNoSupabaseError(
          await supabase.rpc("ranked_queue_heartbeat", {
            p_queue_entry_id: queueEntry.id,
          }),
        );
        assertNoSupabaseError(await supabase.rpc("ranked_try_matchmake"));
      }
    }

    const response: RankedMutationResponse = {
      ok: true,
      message:
        payload.data.intent === "join"
          ? "Busca iniciada."
          : payload.data.intent === "leave"
            ? "Você saiu da fila."
            : "Fila sincronizada.",
    };
    return NextResponse.json(response);
  } catch (error) {
    return rankedErrorResponse(error);
  }
}
