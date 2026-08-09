import "server-only";

import { headers } from "next/headers";

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function getSiteOrigin(): Promise<string> {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) {
    const normalized = normalizeOrigin(configuredOrigin);
    if (normalized) return normalized;
  }

  const requestHeaders = await headers();
  const originHeader = requestHeaders.get("origin");
  if (originHeader) {
    const normalized = normalizeOrigin(originHeader);
    if (normalized) return normalized;
  }

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (host) {
    const protocol =
      requestHeaders.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    const normalized = normalizeOrigin(`${protocol}://${host}`);
    if (normalized) return normalized;
  }

  return "http://localhost:3000";
}
