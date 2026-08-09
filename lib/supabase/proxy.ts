import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseConfig } from "./env";

export async function updateSession(request: NextRequest) {
  const config = getPublicSupabaseConfig();
  let response = NextResponse.next({ request });

  if (!config) return response;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims validates the access token and refreshes it when necessary.
  // Never authorize a request from getSession() alone on the server.
  await supabase.auth.getClaims();

  return response;
}
