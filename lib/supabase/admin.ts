import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  requirePublicSupabaseConfig,
  SupabaseConfigurationError,
} from "./env";

export function createAdminClient() {
  const { url } = requirePublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new SupabaseConfigurationError(
      "SUPABASE_SERVICE_ROLE_KEY não foi configurada no servidor.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
