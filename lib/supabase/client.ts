"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const { url, publishableKey } = requirePublicSupabaseConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
