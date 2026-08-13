import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSafeNextPath } from "@/lib/ranked/auth-validation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  let origin = url.origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) {
    try {
      const configuredUrl = new URL(configuredOrigin);
      if (
        configuredUrl.protocol === "http:" ||
        configuredUrl.protocol === "https:"
      ) {
        origin = configuredUrl.origin;
      }
    } catch {
      // Use the request origin for local development with an invalid value.
    }
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=config`);
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNextPath(
    url.searchParams.get("next"),
    type === "recovery" ? "/auth/atualizar-senha" : "/conta/perfil",
  );

  if (!tokenHash || !type || !EMAIL_OTP_TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=confirmation`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/auth/erro?reason=confirmation`);
  }

  return NextResponse.redirect(new URL(next, origin));
}
