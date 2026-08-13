import { NextResponse } from "next/server";
import type { PublicQueueStatusResponse } from "@/lib/ranked/public-queue-status";
import { normalizePublicQueueCount } from "@/lib/ranked/public-queue-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

function response(payload: PublicQueueStatusResponse, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control":
        status === 200
          ? "public, max-age=0, s-maxage=5, stale-while-revalidate=10"
          : "no-store, max-age=0",
    },
  });
}

export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseAdminConfigured()) {
    return response({
      configured: isSupabaseConfigured(),
      available: false,
      active: false,
      playersSearching: 0,
      checkedAt,
    });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("ranked_get_queue_count");
    if (error) throw error;

    const playersSearching = normalizePublicQueueCount(data);
    return response({
      configured: true,
      available: true,
      active: playersSearching > 0,
      playersSearching,
      checkedAt,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Public ranked queue status error", error);
    }

    return response(
      {
        configured: true,
        available: false,
        active: false,
        playersSearching: 0,
        checkedAt,
      },
      503,
    );
  }
}
