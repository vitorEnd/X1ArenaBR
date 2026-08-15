import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  RankedLeaderboardEntry,
  RankedLeaderboardResponse,
} from "@/components/ranked/adapter";
import {
  getRankedApiContext,
  rankedErrorResponse,
  RankedRequestError,
  toRankedPublicProfile,
} from "@/lib/ranked/api-server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const filterSchema = z.object({
  query: z.string().trim().max(24).default(""),
  rank: z
    .enum([
      "all",
      "placement",
      "no-matches",
      "novato",
      "pro",
      "craque",
      "desafiante",
      "immortal",
      "champion",
    ])
    .default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = filterSchema.safeParse({
      query: url.searchParams.get("query") ?? "",
      rank: url.searchParams.get("rank") ?? "all",
      page: url.searchParams.get("page") ?? "1",
    });
    if (!filters.success) throw new RankedRequestError("Filtros inválidos.");

    const context = await getRankedApiContext();
    if (!context.configured || !context.supabase) {
      const response: RankedLeaderboardResponse = {
        configured: false,
        entries: [],
        page: 1,
        totalPages: 0,
        totalEntries: 0,
      };
      return NextResponse.json(response);
    }

    const from = (filters.data.page - 1) * PAGE_SIZE;
    let query = context.supabase
      // This projection includes every public profile while keeping provisional
      // MMR private until all five placement matches have been completed.
      .from("ranked_public_profiles")
      .select("*", { count: "exact" })
      .order("global_position", { ascending: true, nullsFirst: false })
      .order("placement_matches", { ascending: false })
      .order("wins", { ascending: false })
      .order("losses", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (filters.data.query) {
      query = query.ilike("username", `%${filters.data.query}%`);
    }
    if (filters.data.rank === "placement") {
      query = query.is("tier", null).lt("placement_matches", 5);
    } else if (filters.data.rank === "no-matches") {
      query = query.is("tier", null).eq("placement_matches", 0);
    } else if (filters.data.rank !== "all") {
      query = query.eq("tier", filters.data.rank);
    }

    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const entries = (data ?? [])
      .map((row) => toRankedPublicProfile(context.supabase!, row))
      .filter((entry): entry is RankedLeaderboardEntry => entry !== null);

    const totalEntries = count ?? 0;
    const response: RankedLeaderboardResponse = {
      configured: true,
      entries,
      page: filters.data.page,
      totalPages: totalEntries === 0 ? 0 : Math.ceil(totalEntries / PAGE_SIZE),
      totalEntries,
    };
    return NextResponse.json(response);
  } catch (error) {
    return rankedErrorResponse(error);
  }
}
