import "server-only";

import type { PlayerNickname } from "./types";
import { normalizePublicPlayerNicknames } from "./player-nicknames";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseAdminConfigured } from "./supabase/env";

export async function getPublicPlayerNicknames(): Promise<readonly PlayerNickname[]> {
  if (!isSupabaseAdminConfigured()) return [];

  const admin = createAdminClient();
  const result = await admin
    .from("arena_player_nicknames")
    .select("player_id,nickname,color")
    .order("updated_at", { ascending: false });

  if (result.error) {
    console.error("Official player nicknames read failed", result.error);
    return [];
  }

  return normalizePublicPlayerNicknames(result.data ?? []);
}
