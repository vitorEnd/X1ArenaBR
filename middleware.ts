import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// OpenNext currently requires Edge Middleware. Next.js 16's newer proxy.ts
// convention is Node-only, so this project intentionally keeps middleware.ts.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/conta/:path*",
    "/suporte/:path*",
    "/api/ranked/:path*",
  ],
};
