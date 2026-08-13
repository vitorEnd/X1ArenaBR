import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getConfiguredSupportIds(): readonly string[] {
  return [
    ...new Set(
      (process.env.SUPABASE_SUPPORT_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim().toLocaleLowerCase("en-US"))
        .filter((value) => UUID_PATTERN.test(value)),
    ),
  ];
}

/** Keeps the private environment allowlist authoritative over database roles. */
export async function syncConfiguredSupportUsers(): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const admin = createAdminClient();
  const supportIds = getConfiguredSupportIds();

  // An empty deployment allowlist must never revoke every support account in a
  // shared database (for example, when a Preview environment is incomplete).
  if (supportIds.length === 0) return;

  const { error: deactivateError } = await admin
    .from("support_users")
    .update({ is_active: false })
    .neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (deactivateError) throw deactivateError;

  if (supportIds.length > 0) {
    const { error: upsertError } = await admin.from("support_users").upsert(
      supportIds.map((userId) => ({ user_id: userId, is_active: true })),
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;
  }
}
