import { NextResponse } from "next/server";
import { getSafeNextPath } from "@/lib/ranked/auth-validation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function redirectOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // Fall back to the request origin when the development value is invalid.
    }
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = redirectOrigin(request);
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=config`);
  }

  const code = url.searchParams.get("code");
  const next = getSafeNextPath(url.searchParams.get("next"), "/conta");
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=callback`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=callback`);
  }

  return NextResponse.redirect(new URL(next, origin));
}
