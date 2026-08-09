export interface PublicSupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export class SupabaseConfigurationError extends Error {
  constructor(
    message =
      "O Supabase ainda não foi configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  ) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return { url, publishableKey };
}

export function requirePublicSupabaseConfig(): PublicSupabaseConfig {
  const config = getPublicSupabaseConfig();
  if (!config) throw new SupabaseConfigurationError();
  return config;
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig() !== null;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    getPublicSupabaseConfig() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
